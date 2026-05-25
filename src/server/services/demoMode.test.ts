import { describe, expect, it } from 'vitest';
import { DEMO_SUBREDDIT } from '../../shared/constants';
import type { DemoScenario } from '../../shared/schema';
import { InMemoryRedisStore } from '../adapters/redis';
import { listAuditEvents } from './audit';
import { loadConfig } from './config';
import { getDemoModeStatus, resetDemoMode, seedDemoData, disableDemoMode } from './demoMode';
import { keys } from './keys';
import { listActiveLocks } from './locks';
import { listDailyMetrics, listTopTargetMetrics } from './metrics';
import { listOpenReopenEvents } from './reopenQueue';
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
      warnings: expect.arrayContaining([
        'Demo data only. Seeded records are not runtime proof.',
      ]),
    });
  });

  it('reset is idempotent for indexed demo records', async () => {
    const redis = new InMemoryRedisStore();

    await resetDemoMode(redis, '2026-05-24T00:00:00.000Z');
    await resetDemoMode(redis, '2026-05-24T00:00:00.000Z');

    expect(await listActiveLocks(redis, DEMO_SUBREDDIT)).toHaveLength(12);
    expect(await listOpenReopenEvents(redis, DEMO_SUBREDDIT)).toHaveLength(5);
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
