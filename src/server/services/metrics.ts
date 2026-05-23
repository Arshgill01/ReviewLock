import type { RedisStore } from '../adapters/redis';
import type { DailyMetrics, ReviewLockTarget, TargetMetrics } from '../../shared/schema';
import { keys } from './keys';

const parseJson = <T>(value: string | undefined): T | undefined =>
  value === undefined ? undefined : (JSON.parse(value) as T);

const emptyDailyMetrics = (subreddit: string, date: string, demo = false): DailyMetrics => ({
  subreddit,
  date,
  locksCreated: 0,
  reportsSuppressed: 0,
  locksReopened: 0,
  demo,
});

const emptyTargetMetrics = (target: ReviewLockTarget, now: string, demo = false): TargetMetrics => ({
  subreddit: target.subreddit,
  targetId: target.id,
  targetKind: target.kind,
  reportsSuppressed: 0,
  locksCreated: 0,
  locksReopened: 0,
  lastActivityAt: now,
  demo,
});

const saveDailyMetrics = async (redis: RedisStore, metrics: DailyMetrics): Promise<DailyMetrics> => {
  await redis.set(keys.metricsDaily(metrics.subreddit, metrics.date), JSON.stringify(metrics));
  await redis.zAdd(keys.metricsDailyIndex(metrics.subreddit), {
    member: metrics.date,
    score: Date.parse(`${metrics.date}T00:00:00.000Z`),
  });
  return metrics;
};

const saveTargetMetrics = async (redis: RedisStore, metrics: TargetMetrics): Promise<TargetMetrics> => {
  await redis.set(keys.metricsTarget(metrics.subreddit, metrics.targetId), JSON.stringify(metrics));
  await redis.zAdd(keys.metricsTargetIndex(metrics.subreddit), {
    member: metrics.targetId,
    score: metrics.reportsSuppressed,
  });
  return metrics;
};

export const getDailyMetrics = async (
  redis: RedisStore,
  subreddit: string,
  date: string,
): Promise<DailyMetrics | undefined> => parseJson(await redis.get(keys.metricsDaily(subreddit, date)));

export const listDailyMetrics = async (
  redis: RedisStore,
  subreddit: string,
  limit = 30,
): Promise<DailyMetrics[]> => {
  const entries = await redis.zRange(keys.metricsDailyIndex(subreddit), 0, Math.max(0, limit - 1), true);
  const metrics = await Promise.all(
    entries.map((entry) => getDailyMetrics(redis, subreddit, entry.member)),
  );

  return metrics.filter((entry): entry is DailyMetrics => entry !== undefined);
};

export const getTargetMetrics = async (
  redis: RedisStore,
  subreddit: string,
  targetId: string,
): Promise<TargetMetrics | undefined> => parseJson(await redis.get(keys.metricsTarget(subreddit, targetId)));

export const listTopTargetMetrics = async (
  redis: RedisStore,
  subreddit: string,
  limit = 10,
): Promise<TargetMetrics[]> => {
  const entries = await redis.zRange(
    keys.metricsTargetIndex(subreddit),
    0,
    Math.max(0, limit - 1),
    true,
  );
  const metrics = await Promise.all(
    entries.map((entry) => getTargetMetrics(redis, subreddit, entry.member)),
  );

  return metrics.filter((entry): entry is TargetMetrics => entry !== undefined);
};

export const recordLockCreatedMetric = async (
  redis: RedisStore,
  target: ReviewLockTarget,
  now: string,
  demo = false,
): Promise<void> => {
  const date = now.slice(0, 10);
  const daily = (await getDailyMetrics(redis, target.subreddit, date)) ?? emptyDailyMetrics(target.subreddit, date, demo);
  const targetMetrics =
    (await getTargetMetrics(redis, target.subreddit, target.id)) ?? emptyTargetMetrics(target, now, demo);

  await saveDailyMetrics(redis, { ...daily, locksCreated: daily.locksCreated + 1 });
  await saveTargetMetrics(redis, {
    ...targetMetrics,
    locksCreated: targetMetrics.locksCreated + 1,
    lastActivityAt: now,
  });
};

export const incrementSuppressedReportMetric = async (
  redis: RedisStore,
  target: ReviewLockTarget,
  now: string,
  demo = false,
): Promise<void> => {
  const date = now.slice(0, 10);
  const daily = (await getDailyMetrics(redis, target.subreddit, date)) ?? emptyDailyMetrics(target.subreddit, date, demo);
  const targetMetrics =
    (await getTargetMetrics(redis, target.subreddit, target.id)) ?? emptyTargetMetrics(target, now, demo);

  await saveDailyMetrics(redis, { ...daily, reportsSuppressed: daily.reportsSuppressed + 1 });
  await saveTargetMetrics(redis, {
    ...targetMetrics,
    reportsSuppressed: targetMetrics.reportsSuppressed + 1,
    lastActivityAt: now,
  });
};

export const incrementReopenedMetric = async (
  redis: RedisStore,
  target: ReviewLockTarget,
  now: string,
  demo = false,
): Promise<void> => {
  const date = now.slice(0, 10);
  const daily = (await getDailyMetrics(redis, target.subreddit, date)) ?? emptyDailyMetrics(target.subreddit, date, demo);
  const targetMetrics =
    (await getTargetMetrics(redis, target.subreddit, target.id)) ?? emptyTargetMetrics(target, now, demo);

  await saveDailyMetrics(redis, { ...daily, locksReopened: daily.locksReopened + 1 });
  await saveTargetMetrics(redis, {
    ...targetMetrics,
    locksReopened: targetMetrics.locksReopened + 1,
    lastActivityAt: now,
  });
};
