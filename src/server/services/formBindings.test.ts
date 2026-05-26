import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { ReviewLockTarget } from '../../shared/schema';
import { key } from './keys';
import { consumeFormBinding, createFormBinding } from './formBindings';

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: 0,
});

describe('form bindings', () => {
  it('creates and consumes lock bindings once', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(
      redis,
      'lock',
      target(),
      '2026-05-24T00:00:00.000Z',
    );

    expect(binding.reviewedContentHash).toEqual(expect.any(String));
    expect(await consumeFormBinding(redis, 'alpha', binding.token)).toMatchObject({
      action: 'lock',
      targetId: 't3_post',
      reviewedFingerprintVersion: 'content-v1',
    });
    expect(await consumeFormBinding(redis, 'alpha', binding.token)).toBeUndefined();
  });

  it('stores mixed-case target subreddits under the canonical lowercase binding key', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(
      redis,
      'lock',
      { ...target(), subreddit: 'Alpha' },
      '2026-05-24T00:00:00.000Z',
    );

    expect(binding.subreddit).toBe('alpha');
    expect(await redis.exists(key('alpha', `form:${binding.token}`))).toBe(true);
    expect(await redis.exists(key('Alpha', `form:${binding.token}`))).toBe(false);
    await expect(consumeFormBinding(redis, 'alpha', binding.token)).resolves.toMatchObject({
      subreddit: 'alpha',
      targetId: 't3_post',
    });
  });

  it('deletes malformed binding JSON instead of returning an unchecked shape', async () => {
    const redis = new InMemoryRedisStore();
    const token = 'form-lock-corrupt';
    const bindingKey = key('alpha', `form:${token}`);
    await redis.set(bindingKey, JSON.stringify({ action: 'lock', targetId: 123 }));

    expect(await consumeFormBinding(redis, 'alpha', token)).toBeUndefined();
    expect(await redis.exists(bindingKey)).toBe(false);
  });

  it('rolls back the binding write if setting the expiry fails', async () => {
    class ExpireFailingRedisStore extends InMemoryRedisStore {
      readonly setKeys: string[] = [];

      override async set(keyName: string, value: string): Promise<void> {
        this.setKeys.push(keyName);
        await super.set(keyName, value);
      }

      override async expire(): Promise<void> {
        throw new Error('expire down');
      }
    }

    const redis = new ExpireFailingRedisStore();

    await expect(
      createFormBinding(redis, 'unlock', target(), '2026-05-24T00:00:00.000Z', 'lock-1'),
    ).rejects.toThrow('expire down');
    expect(redis.setKeys).toHaveLength(1);
    expect(await redis.exists(redis.setKeys[0] ?? '')).toBe(false);
  });
});
