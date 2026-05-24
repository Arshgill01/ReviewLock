import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import { isTriggerConcurrencyError, triggerMutexKey, withTriggerMutex } from './triggerMutex';

describe('withTriggerMutex', () => {
  it('blocks a second mutation while the target mutex is held', async () => {
    const redis = new InMemoryRedisStore();
    const mutexKey = triggerMutexKey('alpha', 't3_post');

    const result = await withTriggerMutex(
      redis,
      'alpha',
      't3_post',
      '2026-05-24T01:00:00.000Z',
      async () => {
        const blocked = await withTriggerMutex(
          redis,
          'alpha',
          't3_post',
          '2026-05-24T01:00:00.000Z',
          async () => 'should-not-run',
        ).catch((error: unknown) => error);

        expect(isTriggerConcurrencyError(blocked)).toBe(true);
        expect(await redis.get(mutexKey)).toEqual(expect.stringContaining('t3_post'));
        return 'first-won';
      },
    );

    expect(result).toBe('first-won');
    expect(await redis.get(mutexKey)).toBeUndefined();
    await expect(
      withTriggerMutex(
        redis,
        'alpha',
        't3_post',
        '2026-05-24T01:00:01.000Z',
        async () => 'released',
      ),
    ).resolves.toBe('released');
  });

  it('continues and releases the mutex when setting the TTL fails', async () => {
    class ExpireFailingRedisStore extends InMemoryRedisStore {
      override async expire(): Promise<void> {
        throw new Error('expire down');
      }
    }

    const redis = new ExpireFailingRedisStore();
    const mutexKey = triggerMutexKey('alpha', 't3_post');

    await expect(
      withTriggerMutex(
        redis,
        'alpha',
        't3_post',
        '2026-05-24T01:00:00.000Z',
        async () => 'operation-ran',
      ),
    ).resolves.toBe('operation-ran');
    expect(await redis.get(mutexKey)).toBeUndefined();
  });
});
