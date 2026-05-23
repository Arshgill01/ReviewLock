import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { ReviewLockTarget } from '../../shared/schema';
import {
  getDailyMetrics,
  getTargetMetrics,
  incrementReopenedMetric,
  incrementSuppressedReportMetric,
  listDailyMetrics,
  listTopTargetMetrics,
  recordLockCreatedMetric,
} from './metrics';

const target = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't3_alpha',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/alpha',
  title: 'Reviewed post',
  body: 'Body',
  edited: false,
  reportCount: 0,
  ...overrides,
});

describe('metrics persistence', () => {
  it('increments daily and per-target counters', async () => {
    const redis = new InMemoryRedisStore();

    await recordLockCreatedMetric(redis, target(), '2026-05-24T00:00:00.000Z');
    await incrementSuppressedReportMetric(redis, target(), '2026-05-24T01:00:00.000Z');
    await incrementReopenedMetric(redis, target(), '2026-05-24T02:00:00.000Z');

    expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toMatchObject({
      locksCreated: 1,
      reportsSuppressed: 1,
      locksReopened: 1,
    });
    expect(await getTargetMetrics(redis, 'alpha', 't3_alpha')).toMatchObject({
      locksCreated: 1,
      reportsSuppressed: 1,
      locksReopened: 1,
    });
  });

  it('orders daily and top target metrics', async () => {
    const redis = new InMemoryRedisStore();

    await incrementSuppressedReportMetric(redis, target({ id: 't3_low' }), '2026-05-23T01:00:00.000Z');
    await incrementSuppressedReportMetric(redis, target({ id: 't3_high' }), '2026-05-24T01:00:00.000Z');
    await incrementSuppressedReportMetric(redis, target({ id: 't3_high' }), '2026-05-24T02:00:00.000Z');

    expect((await listDailyMetrics(redis, 'alpha')).map((entry) => entry.date)).toEqual([
      '2026-05-24',
      '2026-05-23',
    ]);
    expect((await listTopTargetMetrics(redis, 'alpha')).map((entry) => entry.targetId)[0]).toBe(
      't3_high',
    );
  });
});
