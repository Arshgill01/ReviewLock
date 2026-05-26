import { DEMO_SCENARIO } from '../fixtures/demoScenario';
import { DEMO_SUBREDDIT } from '../../shared/constants';
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
    await redis.set(
      keys.metricsTarget(scenario.subreddit, target.targetId),
      JSON.stringify(target),
    );
    await redis.zAdd(keys.metricsTargetIndex(scenario.subreddit), {
      member: target.targetId,
      score: target.reportsSuppressed,
    });
  }
};

const allSortedSetMembers = async (redis: RedisStore, keyName: string): Promise<string[]> =>
  (await redis.zRange(keyName, 0, -1)).map((entry) => entry.member);

const clearDemoLedger = async (redis: RedisStore, subreddit: string): Promise<void> => {
  const [lockIds, targetLockIds, reopenEventIds, auditEventIds, metricDates, metricTargetIds] =
    await Promise.all([
      allSortedSetMembers(redis, keys.activeLocks(subreddit)),
      redis.hgetall(keys.activeLocksByTarget(subreddit)),
      allSortedSetMembers(redis, keys.reopenQueue(subreddit)),
      allSortedSetMembers(redis, keys.audit(subreddit)),
      allSortedSetMembers(redis, keys.metricsDailyIndex(subreddit)),
      allSortedSetMembers(redis, keys.metricsTargetIndex(subreddit)),
    ]);
  const lockIdsToDelete = new Set([...lockIds, ...Object.values(targetLockIds)]);

  await Promise.all([
    ...[...lockIdsToDelete].map((lockId) => redis.del(keys.lock(subreddit, lockId))),
    ...Object.keys(targetLockIds).map((targetId) =>
      redis.del(keys.targetLock(subreddit, targetId)),
    ),
    ...reopenEventIds.map((eventId) => redis.del(keys.reopenEvent(subreddit, eventId))),
    ...auditEventIds.map((eventId) => redis.del(keys.auditEvent(subreddit, eventId))),
    ...metricDates.map((date) => redis.del(keys.metricsDaily(subreddit, date))),
    ...metricTargetIds.map((targetId) => redis.del(keys.metricsTarget(subreddit, targetId))),
    redis.del(keys.activeLocks(subreddit)),
    redis.del(keys.activeLocksByTarget(subreddit)),
    redis.del(keys.reopenQueue(subreddit)),
    redis.del(keys.audit(subreddit)),
    redis.del(keys.metricsDailyIndex(subreddit)),
    redis.del(keys.metricsTargetIndex(subreddit)),
  ]);
};

const assertDemoSubreddit = (subreddit: string): void => {
  if (subreddit !== DEMO_SUBREDDIT) {
    throw new Error(`Demo data writes are restricted to ${DEMO_SUBREDDIT}.`);
  }
};

const parseDemoMarker = (raw: string): { enabled: boolean; seededAt?: string } | undefined => {
  try {
    const parsed = JSON.parse(raw) as { enabled?: unknown; seededAt?: unknown };

    if (typeof parsed.enabled !== 'boolean') {
      return undefined;
    }

    return {
      enabled: parsed.enabled,
      seededAt: typeof parsed.seededAt === 'string' ? parsed.seededAt : undefined,
    };
  } catch {
    return undefined;
  }
};

export const seedDemoData = async (
  redis: RedisStore,
  now: string,
  scenario: DemoScenario = DEMO_SCENARIO,
): Promise<DemoModeStatus> => {
  assertDemoSubreddit(scenario.subreddit);
  await clearDemoLedger(redis, scenario.subreddit);

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
  await redis.set(
    keys.demo(scenario.subreddit),
    JSON.stringify({ enabled: true, seededAt: now, demo: true }),
  );
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
  assertDemoSubreddit(subreddit);

  await redis.set(
    keys.demo(subreddit),
    JSON.stringify({ enabled: false, disabledAt: now, demo: true }),
  );
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

  const stored = parseDemoMarker(raw);

  if (!stored) {
    return {
      subreddit,
      enabled: false,
      demo: true,
      lockCount: 0,
      reopenEventCount: 0,
    };
  }

  return {
    subreddit,
    enabled: stored.enabled,
    demo: true,
    seededAt: stored.seededAt,
    lockCount: stored.enabled ? DEMO_SCENARIO.locks.length : 0,
    reopenEventCount: stored.enabled ? DEMO_SCENARIO.reopenEvents.length : 0,
  };
};
