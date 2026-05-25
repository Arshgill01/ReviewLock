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
import { keys } from './keys';

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

  it('serializes concurrent same-day metric writes across targets', async () => {
    const redis = new InMemoryRedisStore();
    const now = '2026-05-24T01:00:00.000Z';

    await Promise.all([
      incrementSuppressedReportMetric(redis, target({ id: 't3_a' }), now),
      incrementSuppressedReportMetric(redis, target({ id: 't3_b' }), now),
    ]);
    await Promise.all([
      recordLockCreatedMetric(redis, target({ id: 't3_c' }), now),
      recordLockCreatedMetric(redis, target({ id: 't3_d' }), now),
    ]);
    await Promise.all([
      incrementReopenedMetric(redis, target({ id: 't3_e' }), now),
      incrementReopenedMetric(redis, target({ id: 't3_f' }), now),
    ]);

    expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toMatchObject({
      reportsSuppressed: 2,
      locksCreated: 2,
      locksReopened: 2,
    });
    expect(await getTargetMetrics(redis, 'alpha', 't3_a')).toMatchObject({
      reportsSuppressed: 1,
    });
    expect(await getTargetMetrics(redis, 'alpha', 't3_b')).toMatchObject({
      reportsSuppressed: 1,
    });
  });

  it('orders daily and top target metrics', async () => {
    const redis = new InMemoryRedisStore();

    await incrementSuppressedReportMetric(
      redis,
      target({ id: 't3_low' }),
      '2026-05-23T01:00:00.000Z',
    );
    await incrementSuppressedReportMetric(
      redis,
      target({ id: 't3_high' }),
      '2026-05-24T01:00:00.000Z',
    );
    await incrementSuppressedReportMetric(
      redis,
      target({ id: 't3_high' }),
      '2026-05-24T02:00:00.000Z',
    );

    expect((await listDailyMetrics(redis, 'alpha')).map((entry) => entry.date)).toEqual([
      '2026-05-24',
      '2026-05-23',
    ]);
    expect((await listTopTargetMetrics(redis, 'alpha')).map((entry) => entry.targetId)[0]).toBe(
      't3_high',
    );
  });

  it('skips malformed daily and target metric records', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(keys.metricsDaily('alpha', '2026-05-24'), '{');
    await redis.set(
      keys.metricsDaily('alpha', '2026-05-25'),
      JSON.stringify({ date: '2026-05-25' }),
    );
    await redis.zAdd(keys.metricsDailyIndex('alpha'), {
      member: '2026-05-24',
      score: Date.parse('2026-05-24T00:00:00.000Z'),
    });
    await redis.zAdd(keys.metricsDailyIndex('alpha'), {
      member: '2026-05-25',
      score: Date.parse('2026-05-25T00:00:00.000Z'),
    });
    await redis.set(keys.metricsTarget('alpha', 't3_bad'), '{');
    await redis.set(
      keys.metricsTarget('alpha', 't3_wrong_shape'),
      JSON.stringify({ targetId: 't3_wrong_shape' }),
    );
    await redis.zAdd(keys.metricsTargetIndex('alpha'), {
      member: 't3_bad',
      score: 10,
    });
    await redis.zAdd(keys.metricsTargetIndex('alpha'), {
      member: 't3_wrong_shape',
      score: 20,
    });

    expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toBeUndefined();
    expect(await getDailyMetrics(redis, 'alpha', '2026-05-25')).toBeUndefined();
    expect(await listDailyMetrics(redis, 'alpha')).toEqual([]);
    expect(await getTargetMetrics(redis, 'alpha', 't3_bad')).toBeUndefined();
    expect(await getTargetMetrics(redis, 'alpha', 't3_wrong_shape')).toBeUndefined();
    expect(await listTopTargetMetrics(redis, 'alpha')).toEqual([]);
  });
});
