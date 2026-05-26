import { describe, expect, it } from 'vitest';
import { DEMO_SUBREDDIT } from '../../shared/constants';
import type {
  AuditEvent,
  DailyMetrics,
  DemoScenario,
  ReopenEvent,
  ReviewLockRecord,
  TargetMetrics,
} from '../../shared/schema';
import { InMemoryRedisStore } from '../adapters/redis';
import { DEMO_SCENARIO } from '../fixtures/demoScenario';
import { appendAuditEvent, listAuditEvents } from './audit';
import { loadConfig } from './config';
import { getDemoModeStatus, resetDemoMode, seedDemoData, disableDemoMode } from './demoMode';
import { keys } from './keys';
import { listActiveLocks, saveLock } from './locks';
import { listDailyMetrics, listTopTargetMetrics } from './metrics';
import { enqueueReopenEvent, listOpenReopenEvents } from './reopenQueue';
import { loadRuntimeProofStatus } from './runtimeProof';

describe('demo mode service', () => {
  it('seeds deterministic data through persistence services', async () => {
    const redis = new InMemoryRedisStore();
    const status = await seedDemoData(redis, '2026-05-24T00:00:00.000Z');

    expect(status).toMatchObject({ demo: true, enabled: true, lockCount: 18 });
    expect(await listActiveLocks(redis, DEMO_SUBREDDIT)).toHaveLength(12);
    expect(await listOpenReopenEvents(redis, DEMO_SUBREDDIT)).toHaveLength(5);
    expect(await listDailyMetrics(redis, DEMO_SUBREDDIT)).toHaveLength(3);
    expect(await listTopTargetMetrics(redis, DEMO_SUBREDDIT)).toHaveLength(10);
    expect(
      (await listAuditEvents(redis, DEMO_SUBREDDIT)).some((event) => event.kind === 'demo_reset'),
    ).toBe(true);
    await expect(loadRuntimeProofStatus(redis, DEMO_SUBREDDIT)).resolves.toMatchObject({
      warnings: expect.arrayContaining(['Demo data only. Seeded records are not runtime proof.']),
    });
  });

  it('reset is idempotent for indexed demo records', async () => {
    const redis = new InMemoryRedisStore();

    await resetDemoMode(redis, '2026-05-24T00:00:00.000Z');
    await resetDemoMode(redis, '2026-05-24T00:00:00.000Z');

    expect(await listActiveLocks(redis, DEMO_SUBREDDIT)).toHaveLength(12);
    expect(await listOpenReopenEvents(redis, DEMO_SUBREDDIT)).toHaveLength(5);
  });

  it('clears stale indexed demo records before reseeding', async () => {
    const redis = new InMemoryRedisStore();

    await resetDemoMode(redis, '2026-05-24T00:00:00.000Z');

    const staleLock: ReviewLockRecord = {
      ...DEMO_SCENARIO.locks[0],
      id: 'demo-lock-stale',
      targetId: 't3_demo_stale',
      status: 'active',
    };
    const staleReopen: ReopenEvent = {
      ...DEMO_SCENARIO.reopenEvents[0],
      id: 'demo-reopen-stale',
      lockId: staleLock.id,
      targetId: staleLock.targetId,
    };
    const staleAudit: AuditEvent = {
      ...DEMO_SCENARIO.auditEvents[0],
      id: 'demo-audit-stale',
      targetId: staleLock.targetId,
      lockId: staleLock.id,
    };
    const staleDailyMetrics: DailyMetrics = {
      subreddit: DEMO_SUBREDDIT,
      date: '2026-04-01',
      locksCreated: 99,
      reportsSuppressed: 99,
      locksReopened: 99,
      demo: true,
    };
    const staleTargetMetrics: TargetMetrics = {
      subreddit: DEMO_SUBREDDIT,
      targetId: staleLock.targetId,
      targetKind: 'post',
      reportsSuppressed: 99,
      locksCreated: 99,
      locksReopened: 99,
      lastActivityAt: '2026-04-01T00:00:00.000Z',
      demo: true,
    };

    await saveLock(redis, staleLock);
    await enqueueReopenEvent(redis, staleReopen);
    await appendAuditEvent(redis, staleAudit);
    await redis.set(
      keys.metricsDaily(DEMO_SUBREDDIT, staleDailyMetrics.date),
      JSON.stringify(staleDailyMetrics),
    );
    await redis.zAdd(keys.metricsDailyIndex(DEMO_SUBREDDIT), {
      member: staleDailyMetrics.date,
      score: Date.parse('2026-04-01T00:00:00.000Z'),
    });
    await redis.set(
      keys.metricsTarget(DEMO_SUBREDDIT, staleTargetMetrics.targetId),
      JSON.stringify(staleTargetMetrics),
    );
    await redis.zAdd(keys.metricsTargetIndex(DEMO_SUBREDDIT), {
      member: staleTargetMetrics.targetId,
      score: staleTargetMetrics.reportsSuppressed,
    });

    await resetDemoMode(redis, '2026-05-24T02:00:00.000Z');

    const activeLocks = await listActiveLocks(redis, DEMO_SUBREDDIT);
    const reopenEvents = await listOpenReopenEvents(redis, DEMO_SUBREDDIT);
    const auditEvents = await listAuditEvents(redis, DEMO_SUBREDDIT);
    const dailyMetrics = await listDailyMetrics(redis, DEMO_SUBREDDIT);
    const topTargetMetrics = await listTopTargetMetrics(redis, DEMO_SUBREDDIT);

    expect(activeLocks).toHaveLength(12);
    expect(activeLocks.map((lock) => lock.id)).not.toContain(staleLock.id);
    expect(reopenEvents).toHaveLength(5);
    expect(reopenEvents.map((event) => event.id)).not.toContain(staleReopen.id);
    expect(auditEvents.map((event) => event.id)).not.toContain(staleAudit.id);
    expect(dailyMetrics).toHaveLength(3);
    expect(dailyMetrics.map((metrics) => metrics.date)).not.toContain(staleDailyMetrics.date);
    expect(topTargetMetrics).toHaveLength(10);
    expect(topTargetMetrics.map((metrics) => metrics.targetId)).not.toContain(staleLock.targetId);
    await expect(redis.exists(keys.lock(DEMO_SUBREDDIT, staleLock.id))).resolves.toBe(false);
    await expect(redis.exists(keys.targetLock(DEMO_SUBREDDIT, staleLock.targetId))).resolves.toBe(
      false,
    );
    await expect(redis.exists(keys.reopenEvent(DEMO_SUBREDDIT, staleReopen.id))).resolves.toBe(
      false,
    );
    await expect(redis.exists(keys.auditEvent(DEMO_SUBREDDIT, staleAudit.id))).resolves.toBe(false);
  });

  it('tracks demo status separately from live config', async () => {
    const redis = new InMemoryRedisStore();

    await seedDemoData(redis, '2026-05-24T00:00:00.000Z');
    expect(await getDemoModeStatus(redis, DEMO_SUBREDDIT)).toMatchObject({
      enabled: true,
      demo: true,
    });
    expect(await loadConfig(redis, DEMO_SUBREDDIT)).toMatchObject({ demoModeEnabled: true });

    await disableDemoMode(redis, DEMO_SUBREDDIT, '2026-05-24T01:00:00.000Z');
    expect(await getDemoModeStatus(redis, DEMO_SUBREDDIT)).toMatchObject({
      enabled: false,
      demo: true,
    });
    expect(await loadConfig(redis, DEMO_SUBREDDIT)).toMatchObject({ demoModeEnabled: false });
  });

  it('refuses to seed demo data into a live subreddit namespace', async () => {
    const redis = new InMemoryRedisStore();
    const liveScenario = {
      subreddit: 'alpha',
      generatedAt: '2026-05-24T00:00:00.000Z',
      label: 'Bad live demo scenario',
      locks: [],
      reopenEvents: [],
      auditEvents: [],
      dailyMetrics: [],
      targetMetrics: [],
      runtimeStatus: {
        overall: 'unverified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [],
        warnings: [],
      },
    } satisfies DemoScenario;

    await expect(seedDemoData(redis, '2026-05-24T00:00:00.000Z', liveScenario)).rejects.toThrow(
      `Demo data writes are restricted to ${DEMO_SUBREDDIT}.`,
    );
    expect(await listActiveLocks(redis, 'alpha')).toEqual([]);
    expect(await listAuditEvents(redis, 'alpha')).toEqual([]);
    expect(await loadConfig(redis, 'alpha')).toMatchObject({ demoModeEnabled: false });
  });

  it('refuses to disable demo mode for a live subreddit namespace', async () => {
    const redis = new InMemoryRedisStore();

    await expect(disableDemoMode(redis, 'alpha', '2026-05-24T01:00:00.000Z')).rejects.toThrow(
      `Demo data writes are restricted to ${DEMO_SUBREDDIT}.`,
    );
    expect(await loadConfig(redis, 'alpha')).toMatchObject({ demoModeEnabled: false });
  });

  it('degrades malformed demo status markers to disabled demo status', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(keys.demo(DEMO_SUBREDDIT), '{');

    expect(await getDemoModeStatus(redis, DEMO_SUBREDDIT)).toEqual({
      subreddit: DEMO_SUBREDDIT,
      enabled: false,
      demo: true,
      lockCount: 0,
      reopenEventCount: 0,
    });
  });
});
