import { DEMO_SCENARIO } from '../fixtures/demoScenario';
import type { RedisStore } from '../adapters/redis';
import type { DemoScenario } from '../../shared/schema';
import { appendAuditEvent } from './audit';
import { updateConfig } from './config';
import { keys } from './keys';
import { saveLock } from './locks';
import { enqueueReopenEvent } from './reopenQueue';
import { saveRuntimeProofStatus } from './runtimeProof';

export interface DemoModeStatus {
  subreddit: string;
  enabled: boolean;
  demo: boolean;
  seededAt?: string;
  lockCount: number;
  reopenEventCount: number;
}

const writeDemoMetrics = async (redis: RedisStore, scenario: DemoScenario): Promise<void> => {
  for (const daily of scenario.dailyMetrics) {
    await redis.set(keys.metricsDaily(scenario.subreddit, daily.date), JSON.stringify(daily));
    await redis.zAdd(keys.metricsDailyIndex(scenario.subreddit), {
      member: daily.date,
      score: Date.parse(`${daily.date}T00:00:00.000Z`),
    });
  }

  for (const target of scenario.targetMetrics) {
    await redis.set(keys.metricsTarget(scenario.subreddit, target.targetId), JSON.stringify(target));
    await redis.zAdd(keys.metricsTargetIndex(scenario.subreddit), {
      member: target.targetId,
      score: target.reportsSuppressed,
    });
  }
};

export const seedDemoData = async (
  redis: RedisStore,
  now: string,
  scenario: DemoScenario = DEMO_SCENARIO,
): Promise<DemoModeStatus> => {
  for (const lock of scenario.locks) {
    await saveLock(redis, lock);
  }

  for (const event of scenario.reopenEvents) {
    await enqueueReopenEvent(redis, event);
  }

  for (const event of scenario.auditEvents) {
    await appendAuditEvent(redis, event);
  }

  await appendAuditEvent(redis, {
    id: `demo-reset-${Date.parse(now)}`,
    kind: 'demo_reset',
    subreddit: scenario.subreddit,
    actor: 'reviewlock',
    createdAt: now,
    message: 'Demo data reset from deterministic ReviewLock scenario.',
    data: { locks: scenario.locks.length, reopenEvents: scenario.reopenEvents.length },
    demo: true,
  });
  await writeDemoMetrics(redis, scenario);
  await saveRuntimeProofStatus(redis, scenario.subreddit, scenario.runtimeStatus);
  await redis.set(keys.demo(scenario.subreddit), JSON.stringify({ enabled: true, seededAt: now, demo: true }));
  await updateConfig(redis, scenario.subreddit, { demoModeEnabled: true }, now);

  return {
    subreddit: scenario.subreddit,
    enabled: true,
    demo: true,
    seededAt: now,
    lockCount: scenario.locks.length,
    reopenEventCount: scenario.reopenEvents.length,
  };
};

export const enableDemoMode = (
  redis: RedisStore,
  now: string,
  scenario: DemoScenario = DEMO_SCENARIO,
): Promise<DemoModeStatus> => seedDemoData(redis, now, scenario);

export const resetDemoMode = (
  redis: RedisStore,
  now: string,
  scenario: DemoScenario = DEMO_SCENARIO,
): Promise<DemoModeStatus> => seedDemoData(redis, now, scenario);

export const disableDemoMode = async (
  redis: RedisStore,
  subreddit: string,
  now: string,
): Promise<DemoModeStatus> => {
  await redis.set(keys.demo(subreddit), JSON.stringify({ enabled: false, disabledAt: now, demo: true }));
  await updateConfig(redis, subreddit, { demoModeEnabled: false }, now);

  return {
    subreddit,
    enabled: false,
    demo: true,
    lockCount: 0,
    reopenEventCount: 0,
  };
};

export const getDemoModeStatus = async (
  redis: RedisStore,
  subreddit: string,
): Promise<DemoModeStatus> => {
  const raw = await redis.get(keys.demo(subreddit));

  if (!raw) {
    return {
      subreddit,
      enabled: false,
      demo: true,
      lockCount: 0,
      reopenEventCount: 0,
    };
  }

  const stored = JSON.parse(raw) as { enabled: boolean; seededAt?: string };

  return {
    subreddit,
    enabled: stored.enabled,
    demo: true,
    seededAt: stored.seededAt,
    lockCount: stored.enabled ? DEMO_SCENARIO.locks.length : 0,
    reopenEventCount: stored.enabled ? DEMO_SCENARIO.reopenEvents.length : 0,
  };
};
