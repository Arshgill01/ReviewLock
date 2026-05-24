import type { RedisStore } from '../adapters/redis';
import type { LockStatus, ReviewLockRecord } from '../../shared/schema';
import { keys } from './keys';

const parseJson = <T>(value: string | undefined): T | undefined => {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const scoreFromIso = (value: string | undefined): number =>
  value ? Date.parse(value) : Date.now();

export const saveLock = async (redis: RedisStore, lock: ReviewLockRecord): Promise<void> => {
  await redis.set(keys.lock(lock.subreddit, lock.id), JSON.stringify(lock));

  if (lock.status === 'active') {
    await redis.zAdd(keys.activeLocks(lock.subreddit), {
      member: lock.id,
      score: scoreFromIso(lock.lockedAt),
    });
    await redis.hset(keys.activeLocksByTarget(lock.subreddit), { [lock.targetId]: lock.id });
    await redis.set(keys.targetLock(lock.subreddit, lock.targetId), lock.id);
  }
};

export const getLock = async (
  redis: RedisStore,
  subreddit: string,
  lockId: string,
): Promise<ReviewLockRecord | undefined> =>
  parseJson(await redis.get(keys.lock(subreddit, lockId)));

export const getActiveLockByTarget = async (
  redis: RedisStore,
  subreddit: string,
  targetId: string,
): Promise<ReviewLockRecord | undefined> => {
  const lockId = await redis.get(keys.targetLock(subreddit, targetId));

  if (!lockId) {
    return undefined;
  }

  const lock = await getLock(redis, subreddit, lockId);
  return lock?.status === 'active' ? lock : undefined;
};

export const updateLock = async (
  redis: RedisStore,
  lock: ReviewLockRecord,
): Promise<ReviewLockRecord> => {
  await saveLock(redis, lock);

  if (lock.status !== 'active') {
    await removeActiveLockIndexes(redis, lock);
  }

  return lock;
};

export const removeActiveLockIndexes = async (
  redis: RedisStore,
  lock: Pick<ReviewLockRecord, 'subreddit' | 'id' | 'targetId'>,
): Promise<void> => {
  await redis.zRem(keys.activeLocks(lock.subreddit), lock.id);
  await redis.hdel(keys.activeLocksByTarget(lock.subreddit), lock.targetId);
  await redis.del(keys.targetLock(lock.subreddit, lock.targetId));
};

export const removeLock = async (redis: RedisStore, lock: ReviewLockRecord): Promise<void> => {
  await removeActiveLockIndexes(redis, lock);
  await redis.del(keys.lock(lock.subreddit, lock.id));
};

export const updateLockStatus = async (
  redis: RedisStore,
  subreddit: string,
  lockId: string,
  status: LockStatus,
  updates: Partial<ReviewLockRecord> = {},
): Promise<ReviewLockRecord | undefined> => {
  const lock = await getLock(redis, subreddit, lockId);

  if (!lock) {
    return undefined;
  }

  return updateLock(redis, { ...lock, ...updates, status });
};

export const listActiveLocks = async (
  redis: RedisStore,
  subreddit: string,
  limit = 50,
): Promise<ReviewLockRecord[]> => {
  const entries = await redis.zRange(keys.activeLocks(subreddit), 0, Math.max(0, limit - 1), true);
  const locks = await Promise.all(entries.map((entry) => getLock(redis, subreddit, entry.member)));

  return locks.filter((lock): lock is ReviewLockRecord => lock?.status === 'active');
};

export const incrementLockSuppression = async (
  redis: RedisStore,
  lock: ReviewLockRecord,
  lastSuppressedAt: string,
  lastReportCount: number,
): Promise<ReviewLockRecord> =>
  updateLock(redis, {
    ...lock,
    suppressedReportCount: lock.suppressedReportCount + 1,
    lastSuppressedAt,
    lastReportCount,
  });
