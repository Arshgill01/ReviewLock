import type { RedisStore } from '../adapters/redis';
import {
  isDailyMetrics,
  isTargetMetrics,
  type DailyMetrics,
  type ReviewLockTarget,
  type TargetMetrics,
} from '../../shared/schema';
import { keys } from './keys';

const parseJson = (value: string | undefined): unknown => {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const parseDailyMetrics = (
  value: string | undefined,
  expectedSubreddit: string,
  expectedDate: string,
): DailyMetrics | undefined => {
  const parsed = parseJson(value);
  if (!isDailyMetrics(parsed)) {
    return undefined;
  }

  return parsed.subreddit === expectedSubreddit && parsed.date === expectedDate ? parsed : undefined;
};

const parseTargetMetrics = (
  value: string | undefined,
  expectedSubreddit: string,
  expectedTargetId: string,
): TargetMetrics | undefined => {
  const parsed = parseJson(value);
  if (!isTargetMetrics(parsed)) {
    return undefined;
  }

  return parsed.subreddit === expectedSubreddit && parsed.targetId === expectedTargetId
    ? parsed
    : undefined;
};

const emptyDailyMetrics = (subreddit: string, date: string, demo = false): DailyMetrics => ({
  subreddit,
  date,
  locksCreated: 0,
  reportsSuppressed: 0,
  locksReopened: 0,
  demo,
});

const emptyTargetMetrics = (
  target: ReviewLockTarget,
  now: string,
  demo = false,
): TargetMetrics => ({
  subreddit: target.subreddit,
  targetId: target.id,
  targetKind: target.kind,
  reportsSuppressed: 0,
  locksCreated: 0,
  locksReopened: 0,
  lastActivityAt: now,
  demo,
});

const METRICS_MUTEX_SECONDS = 5;
const METRICS_MUTEX_ATTEMPTS = 20;
const METRICS_MUTEX_WAIT_MS = 5;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const withMetricsMutation = async <T>(
  redis: RedisStore,
  subreddit: string,
  now: string,
  mutation: () => Promise<T>,
): Promise<T> => {
  const mutexKey = keys.metricsMutation(subreddit);
  const ownerToken = `${now}:${Date.now()}:${Math.random()}`;

  for (let attempt = 0; attempt < METRICS_MUTEX_ATTEMPTS; attempt += 1) {
    if (await redis.setIfNotExists(mutexKey, ownerToken)) {
      try {
        await redis.expire(mutexKey, METRICS_MUTEX_SECONDS);
      } catch {
        if ((await redis.get(mutexKey).catch(() => undefined)) === ownerToken) {
          await redis.del(mutexKey).catch(() => undefined);
        }

        throw new Error(`ReviewLock could not set a Redis lease for ${mutexKey}.`);
      }

      try {
        return await mutation();
      } finally {
        if ((await redis.get(mutexKey).catch(() => undefined)) === ownerToken) {
          await redis.del(mutexKey).catch(() => undefined);
        }
      }
    }

    await wait(METRICS_MUTEX_WAIT_MS);
  }

  throw new Error('ReviewLock metrics mutation is already in progress.');
};

const saveDailyMetrics = async (
  redis: RedisStore,
  metrics: DailyMetrics,
): Promise<DailyMetrics> => {
  await redis.set(keys.metricsDaily(metrics.subreddit, metrics.date), JSON.stringify(metrics));
  await redis.zAdd(keys.metricsDailyIndex(metrics.subreddit), {
    member: metrics.date,
    score: Date.parse(`${metrics.date}T00:00:00.000Z`),
  });
  return metrics;
};

const saveTargetMetrics = async (
  redis: RedisStore,
  metrics: TargetMetrics,
): Promise<TargetMetrics> => {
  await redis.set(keys.metricsTarget(metrics.subreddit, metrics.targetId), JSON.stringify(metrics));
  await redis.zAdd(keys.metricsTargetIndex(metrics.subreddit), {
    member: metrics.targetId,
    score: metrics.reportsSuppressed,
  });
  return metrics;
};

const restoreDailyMetrics = async (
  redis: RedisStore,
  subreddit: string,
  date: string,
  previous: DailyMetrics | undefined,
): Promise<void> => {
  if (previous) {
    await saveDailyMetrics(redis, previous);
    return;
  }

  await redis.del(keys.metricsDaily(subreddit, date));
  await redis.zRem(keys.metricsDailyIndex(subreddit), date);
};

const restoreTargetMetrics = async (
  redis: RedisStore,
  subreddit: string,
  targetId: string,
  previous: TargetMetrics | undefined,
): Promise<void> => {
  if (previous) {
    await saveTargetMetrics(redis, previous);
    return;
  }

  await redis.del(keys.metricsTarget(subreddit, targetId));
  await redis.zRem(keys.metricsTargetIndex(subreddit), targetId);
};

export const getDailyMetrics = async (
  redis: RedisStore,
  subreddit: string,
  date: string,
): Promise<DailyMetrics | undefined> =>
  parseDailyMetrics(await redis.get(keys.metricsDaily(subreddit, date)), subreddit, date);

export const listDailyMetrics = async (
  redis: RedisStore,
  subreddit: string,
  limit = 30,
): Promise<DailyMetrics[]> => {
  const entries = await redis.zRange(
    keys.metricsDailyIndex(subreddit),
    0,
    Math.max(0, limit - 1),
    true,
  );
  const metrics = await Promise.all(
    entries.map((entry) => getDailyMetrics(redis, subreddit, entry.member)),
  );

  return metrics.filter((entry): entry is DailyMetrics => entry !== undefined);
};

export const sumDailyMetrics = async (
  redis: RedisStore,
  subreddit: string,
): Promise<Pick<DailyMetrics, 'locksCreated' | 'reportsSuppressed' | 'locksReopened'>> => {
  const entries = await redis.zRange(keys.metricsDailyIndex(subreddit), 0, -1, true);
  const metrics = await Promise.all(
    entries.map((entry) => getDailyMetrics(redis, subreddit, entry.member)),
  );

  return metrics.reduce(
    (total, entry) => ({
      locksCreated: total.locksCreated + (entry?.locksCreated ?? 0),
      reportsSuppressed: total.reportsSuppressed + (entry?.reportsSuppressed ?? 0),
      locksReopened: total.locksReopened + (entry?.locksReopened ?? 0),
    }),
    { locksCreated: 0, reportsSuppressed: 0, locksReopened: 0 },
  );
};

export const getTargetMetrics = async (
  redis: RedisStore,
  subreddit: string,
  targetId: string,
): Promise<TargetMetrics | undefined> =>
  parseTargetMetrics(await redis.get(keys.metricsTarget(subreddit, targetId)), subreddit, targetId);

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
): Promise<void> =>
  withMetricsMutation(redis, target.subreddit, now, async () => {
    const date = now.slice(0, 10);
    const previousDaily = await getDailyMetrics(redis, target.subreddit, date);
    const previousTargetMetrics = await getTargetMetrics(redis, target.subreddit, target.id);
    const daily = previousDaily ?? emptyDailyMetrics(target.subreddit, date, demo);
    const targetMetrics = previousTargetMetrics ?? emptyTargetMetrics(target, now, demo);

    try {
      await saveDailyMetrics(redis, { ...daily, locksCreated: daily.locksCreated + 1 });
      await saveTargetMetrics(redis, {
        ...targetMetrics,
        locksCreated: targetMetrics.locksCreated + 1,
        lastActivityAt: now,
      });
    } catch (error) {
      await restoreDailyMetrics(redis, target.subreddit, date, previousDaily).catch(
        () => undefined,
      );
      await restoreTargetMetrics(
        redis,
        target.subreddit,
        target.id,
        previousTargetMetrics,
      ).catch(() => undefined);
      throw error;
    }
  });

export const decrementLockCreatedMetric = async (
  redis: RedisStore,
  target: ReviewLockTarget,
  now: string,
): Promise<void> =>
  withMetricsMutation(redis, target.subreddit, now, async () => {
    const date = now.slice(0, 10);
    const daily = await getDailyMetrics(redis, target.subreddit, date);
    const targetMetrics = await getTargetMetrics(redis, target.subreddit, target.id);

    if (daily) {
      await saveDailyMetrics(redis, {
        ...daily,
        locksCreated: Math.max(0, daily.locksCreated - 1),
      });
    }

    if (targetMetrics) {
      await saveTargetMetrics(redis, {
        ...targetMetrics,
        locksCreated: Math.max(0, targetMetrics.locksCreated - 1),
      });
    }
  });

export const incrementSuppressedReportMetric = async (
  redis: RedisStore,
  target: ReviewLockTarget,
  now: string,
  demo = false,
): Promise<void> =>
  withMetricsMutation(redis, target.subreddit, now, async () => {
    const date = now.slice(0, 10);
    const previousDaily = await getDailyMetrics(redis, target.subreddit, date);
    const previousTargetMetrics = await getTargetMetrics(redis, target.subreddit, target.id);
    const daily = previousDaily ?? emptyDailyMetrics(target.subreddit, date, demo);
    const targetMetrics = previousTargetMetrics ?? emptyTargetMetrics(target, now, demo);

    try {
      await saveDailyMetrics(redis, { ...daily, reportsSuppressed: daily.reportsSuppressed + 1 });
      await saveTargetMetrics(redis, {
        ...targetMetrics,
        reportsSuppressed: targetMetrics.reportsSuppressed + 1,
        lastActivityAt: now,
      });
    } catch (error) {
      await restoreDailyMetrics(redis, target.subreddit, date, previousDaily).catch(
        () => undefined,
      );
      await restoreTargetMetrics(
        redis,
        target.subreddit,
        target.id,
        previousTargetMetrics,
      ).catch(() => undefined);
      throw error;
    }
  });

export const decrementSuppressedReportMetric = async (
  redis: RedisStore,
  target: ReviewLockTarget,
  now: string,
): Promise<void> =>
  withMetricsMutation(redis, target.subreddit, now, async () => {
    const date = now.slice(0, 10);
    const daily = await getDailyMetrics(redis, target.subreddit, date);
    const targetMetrics = await getTargetMetrics(redis, target.subreddit, target.id);

    if (daily) {
      await saveDailyMetrics(redis, {
        ...daily,
        reportsSuppressed: Math.max(0, daily.reportsSuppressed - 1),
      });
    }

    if (targetMetrics) {
      await saveTargetMetrics(redis, {
        ...targetMetrics,
        reportsSuppressed: Math.max(0, targetMetrics.reportsSuppressed - 1),
      });
    }
  });

export const incrementReopenedMetric = async (
  redis: RedisStore,
  target: ReviewLockTarget,
  now: string,
  demo = false,
): Promise<void> =>
  withMetricsMutation(redis, target.subreddit, now, async () => {
    const date = now.slice(0, 10);
    const previousDaily = await getDailyMetrics(redis, target.subreddit, date);
    const previousTargetMetrics = await getTargetMetrics(redis, target.subreddit, target.id);
    const daily = previousDaily ?? emptyDailyMetrics(target.subreddit, date, demo);
    const targetMetrics = previousTargetMetrics ?? emptyTargetMetrics(target, now, demo);

    try {
      await saveDailyMetrics(redis, { ...daily, locksReopened: daily.locksReopened + 1 });
      await saveTargetMetrics(redis, {
        ...targetMetrics,
        locksReopened: targetMetrics.locksReopened + 1,
        lastActivityAt: now,
      });
    } catch (error) {
      await restoreDailyMetrics(redis, target.subreddit, date, previousDaily).catch(
        () => undefined,
      );
      await restoreTargetMetrics(
        redis,
        target.subreddit,
        target.id,
        previousTargetMetrics,
      ).catch(() => undefined);
      throw error;
    }
  });
