import { describe, expect, it } from 'vitest';
import { DEMO_SUBREDDIT } from '../../shared/constants';
import { InMemoryRedisStore } from '../adapters/redis';
import { listAuditEvents } from './audit';
import { loadConfig } from './config';
import { getDemoModeStatus, resetDemoMode, seedDemoData, disableDemoMode } from './demoMode';
import { listActiveLocks } from './locks';
import { listDailyMetrics, listTopTargetMetrics } from './metrics';
import { listOpenReopenEvents } from './reopenQueue';

describe('demo mode service', () => {
  it('seeds deterministic data through persistence services', async () => {
    const redis = new InMemoryRedisStore();
    const status = await seedDemoData(redis, '2026-05-24T00:00:00.000Z');

    expect(status).toMatchObject({ demo: true, enabled: true, lockCount: 12 });
    expect(await listActiveLocks(redis, DEMO_SUBREDDIT)).toHaveLength(8);
    expect(await listOpenReopenEvents(redis, DEMO_SUBREDDIT)).toHaveLength(3);
    expect(await listDailyMetrics(redis, DEMO_SUBREDDIT)).toHaveLength(1);
    expect(await listTopTargetMetrics(redis, DEMO_SUBREDDIT)).toHaveLength(10);
    expect((await listAuditEvents(redis, DEMO_SUBREDDIT)).some((event) => event.kind === 'demo_reset')).toBe(true);
  });

  it('reset is idempotent for indexed demo records', async () => {
    const redis = new InMemoryRedisStore();

    await resetDemoMode(redis, '2026-05-24T00:00:00.000Z');
    await resetDemoMode(redis, '2026-05-24T00:00:00.000Z');

    expect(await listActiveLocks(redis, DEMO_SUBREDDIT)).toHaveLength(8);
    expect(await listOpenReopenEvents(redis, DEMO_SUBREDDIT)).toHaveLength(3);
  });

  it('tracks demo status separately from live config', async () => {
    const redis = new InMemoryRedisStore();

    await seedDemoData(redis, '2026-05-24T00:00:00.000Z');
    expect(await getDemoModeStatus(redis, DEMO_SUBREDDIT)).toMatchObject({ enabled: true, demo: true });
    expect(await loadConfig(redis, DEMO_SUBREDDIT)).toMatchObject({ demoModeEnabled: true });

    await disableDemoMode(redis, DEMO_SUBREDDIT, '2026-05-24T01:00:00.000Z');
    expect(await getDemoModeStatus(redis, DEMO_SUBREDDIT)).toMatchObject({ enabled: false, demo: true });
    expect(await loadConfig(redis, DEMO_SUBREDDIT)).toMatchObject({ demoModeEnabled: false });
  });
});
