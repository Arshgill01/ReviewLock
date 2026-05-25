import type { RedisStore } from '../adapters/redis';
import { key } from './keys';

export class TriggerConcurrencyError extends Error {
  constructor(readonly mutexKey: string) {
    super(`A ReviewLock trigger is already processing ${mutexKey}.`);
    this.name = 'TriggerConcurrencyError';
  }
}

export class TriggerLeaseError extends Error {
  constructor(readonly mutexKey: string) {
    super(`ReviewLock could not set a Redis lease for ${mutexKey}.`);
    this.name = 'TriggerLeaseError';
  }
}

export const isTriggerConcurrencyError = (error: unknown): error is TriggerConcurrencyError =>
  error instanceof TriggerConcurrencyError;

export const triggerMutexKey = (subreddit: string, targetId: string): string =>
  key(subreddit, `trigger:mutex:${targetId}`);

export const withTriggerMutex = async <T>(
  redis: RedisStore,
  subreddit: string,
  targetId: string,
  now: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const mutexKey = triggerMutexKey(subreddit, targetId);
  const token = `${now}:${targetId}:${Date.now()}:${Math.random()}`;

  if (!(await redis.setIfNotExists(mutexKey, token))) {
    throw new TriggerConcurrencyError(mutexKey);
  }

  try {
    try {
      await redis.expire(mutexKey, 30);
    } catch {
      if ((await redis.get(mutexKey).catch(() => undefined)) === token) {
        await redis.del(mutexKey).catch(() => undefined);
      }

      throw new TriggerLeaseError(mutexKey);
    }

    return await operation();
  } finally {
    const currentToken = await redis.get(mutexKey).catch(() => undefined);

    if (currentToken === token) {
      await redis.del(mutexKey).catch(() => undefined);
    }
  }
};
