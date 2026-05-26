import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { ReviewLockTarget } from '../../shared/schema';
import { key } from './keys';
import {
  consumeFormBinding,
  consumeFormBindingByContext,
  createFormBinding,
} from './formBindings';

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
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');

    expect(binding.reviewedContentHash).toEqual(expect.any(String));
    expect(await consumeFormBinding(redis, 'alpha', binding.token)).toMatchObject({
      action: 'lock',
      targetId: 't3_post',
      reviewedFingerprintVersion: 'content-v1',
    });
    expect(await consumeFormBinding(redis, 'alpha', binding.token)).toBeUndefined();
  });

  it('creates and consumes lock bindings by context without exposing the token', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');

    expect(
      await consumeFormBindingByContext(
        redis,
        'alpha',
        'lock',
        't3_post',
        binding.createdAt,
      ),
    ).toMatchObject({
      action: 'lock',
      targetId: 't3_post',
      token: binding.token,
      reviewedFingerprintVersion: 'content-v1',
    });
    expect(
      await consumeFormBindingByContext(
        redis,
        'alpha',
        'lock',
        't3_post',
        binding.createdAt,
      ),
    ).toBeUndefined();
  });

  it('allows only one concurrent context consumer to use a form binding', async () => {
    class PausingContextReadRedisStore extends InMemoryRedisStore {
      private firstBindingRead = true;
      private firstBindingReadResolver: (() => void) | undefined;
      private releaseFirstBindingReadResolver: (() => void) | undefined;

      readonly firstBindingReadStarted = new Promise<void>((resolve) => {
        this.firstBindingReadResolver = resolve;
      });

      releaseFirstBindingRead(): void {
        this.releaseFirstBindingReadResolver?.();
      }

      override async get(keyName: string): Promise<string | undefined> {
        const value = await super.get(keyName);

        if (keyName.startsWith('reviewlock:alpha:form:form-unlock-') && this.firstBindingRead) {
          this.firstBindingRead = false;
          this.firstBindingReadResolver?.();
          await new Promise<void>((resolve) => {
            this.releaseFirstBindingReadResolver = resolve;
          });
        }

        return value;
      }
    }

    const redis = new PausingContextReadRedisStore();
    const binding = await createFormBinding(
      redis,
      'unlock',
      target(),
      '2026-05-24T00:00:00.000Z',
      'lock-1',
    );

    const firstPromise = consumeFormBindingByContext(
      redis,
      'alpha',
      'unlock',
      't3_post',
      binding.createdAt,
      'lock-1',
    );
    await redis.firstBindingReadStarted;
    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'unlock',
        't3_post',
        binding.createdAt,
        'lock-1',
      ),
    ).resolves.toBeUndefined();
    redis.releaseFirstBindingRead();
    await expect(firstPromise).resolves.toMatchObject({
      action: 'unlock',
      targetId: 't3_post',
      lockId: 'lock-1',
    });
    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'unlock',
        't3_post',
        binding.createdAt,
        'lock-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('does not burn a valid context binding when a stale lock id is submitted', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(
      redis,
      'unlock',
      target(),
      '2026-05-24T00:00:00.000Z',
      'lock-1',
    );

    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'unlock',
        't3_post',
        binding.createdAt,
        'old-lock',
      ),
    ).resolves.toBeUndefined();
    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'unlock',
        't3_post',
        binding.createdAt,
        'lock-1',
      ),
    ).resolves.toMatchObject({
      action: 'unlock',
      lockId: 'lock-1',
    });
  });

  it('keeps same-target contexts separate by opened timestamp', async () => {
    const redis = new InMemoryRedisStore();
    const first = await createFormBinding(
      redis,
      'lock',
      target(),
      '2026-05-24T00:00:00.000Z',
    );
    const second = await createFormBinding(
      redis,
      'lock',
      target(),
      '2026-05-24T00:01:00.000Z',
    );

    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'lock',
        't3_post',
        first.createdAt,
      ),
    ).resolves.toMatchObject({ token: first.token });
    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'lock',
        't3_post',
        second.createdAt,
      ),
    ).resolves.toMatchObject({ token: second.token });
  });

  it('keeps same-target contexts separate when forms open in the same millisecond', async () => {
    const redis = new InMemoryRedisStore();
    const openedAt = '2026-05-24T00:00:00.000Z';
    const first = await createFormBinding(redis, 'lock', target(), openedAt);
    const second = await createFormBinding(redis, 'lock', target(), openedAt);

    expect(first.createdAt).toBe(openedAt);
    expect(second.createdAt).toBe('2026-05-24T00:00:00.001Z');
    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'lock',
        't3_post',
        first.createdAt,
      ),
    ).resolves.toMatchObject({ token: first.token });
    await expect(
      consumeFormBindingByContext(
        redis,
        'alpha',
        'lock',
        't3_post',
        second.createdAt,
      ),
    ).resolves.toMatchObject({ token: second.token });
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

  it('deletes valid-shaped bindings whose stored token does not match the consumed key', async () => {
    const redis = new InMemoryRedisStore();
    const token = 'form-lock-visible';
    const bindingKey = key('alpha', `form:${token}`);
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    await redis.set(bindingKey, JSON.stringify({ ...binding, token: 'form-lock-other' }));

    expect(await consumeFormBinding(redis, 'alpha', token)).toBeUndefined();
    expect(await redis.exists(bindingKey)).toBe(false);
  });

  it('deletes valid-shaped bindings whose stored subreddit does not match the consumed key', async () => {
    const redis = new InMemoryRedisStore();
    const token = 'form-lock-cross-subreddit';
    const bindingKey = key('alpha', `form:${token}`);
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    await redis.set(bindingKey, JSON.stringify({ ...binding, token, subreddit: 'beta' }));

    expect(await consumeFormBinding(redis, 'alpha', token)).toBeUndefined();
    expect(await redis.exists(bindingKey)).toBe(false);
  });

  it('deletes malformed context bindings and their context pointer', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const bindingKey = key('alpha', `form:${binding.token}`);
    const contextKey = key('alpha', `form-context:lock:t3_post:${binding.createdAt}`);
    await redis.set(bindingKey, JSON.stringify({ action: 'lock', targetId: 123 }));

    await expect(
      consumeFormBindingByContext(redis, 'alpha', 'lock', 't3_post', binding.createdAt),
    ).resolves.toBeUndefined();
    expect(await redis.exists(bindingKey)).toBe(false);
    expect(await redis.exists(contextKey)).toBe(false);
  });

  it('deletes context bindings whose stored subreddit does not match the consumed namespace', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const bindingKey = key('alpha', `form:${binding.token}`);
    const contextKey = key('alpha', `form-context:lock:t3_post:${binding.createdAt}`);
    await redis.set(bindingKey, JSON.stringify({ ...binding, subreddit: 'beta' }));

    await expect(
      consumeFormBindingByContext(redis, 'alpha', 'lock', 't3_post', binding.createdAt),
    ).resolves.toBeUndefined();
    expect(await redis.exists(bindingKey)).toBe(false);
    expect(await redis.exists(contextKey)).toBe(false);
  });

  it('allows only one concurrent consumer to use a form binding', async () => {
    class PausingBindingReadRedisStore extends InMemoryRedisStore {
      private firstBindingRead = true;
      private firstBindingReadResolver: (() => void) | undefined;
      private releaseFirstBindingReadResolver: (() => void) | undefined;

      readonly firstBindingReadStarted = new Promise<void>((resolve) => {
        this.firstBindingReadResolver = resolve;
      });

      releaseFirstBindingRead(): void {
        this.releaseFirstBindingReadResolver?.();
      }

      override async get(keyName: string): Promise<string | undefined> {
        const value = await super.get(keyName);

        if (keyName.startsWith('reviewlock:alpha:form:form-unlock-') && this.firstBindingRead) {
          this.firstBindingRead = false;
          this.firstBindingReadResolver?.();
          await new Promise<void>((resolve) => {
            this.releaseFirstBindingReadResolver = resolve;
          });
        }

        return value;
      }
    }

    const redis = new PausingBindingReadRedisStore();
    const binding = await createFormBinding(
      redis,
      'unlock',
      target(),
      '2026-05-24T00:00:00.000Z',
      'lock-1',
    );

    const firstPromise = consumeFormBinding(redis, 'alpha', binding.token);
    await redis.firstBindingReadStarted;
    await expect(consumeFormBinding(redis, 'alpha', binding.token)).resolves.toBeUndefined();
    redis.releaseFirstBindingRead();
    await expect(firstPromise).resolves.toMatchObject({
      action: 'unlock',
      targetId: 't3_post',
      lockId: 'lock-1',
    });
    await expect(consumeFormBinding(redis, 'alpha', binding.token)).resolves.toBeUndefined();
  });

  it('keeps the binding retryable if the consume lease expiry cannot be set', async () => {
    class ConsumeExpireFailingRedisStore extends InMemoryRedisStore {
      override async expire(keyName: string, seconds: number): Promise<void> {
        if (keyName.endsWith(':consume')) {
          throw new Error('consume expire down');
        }

        await super.expire(keyName, seconds);
      }
    }

    const redis = new ConsumeExpireFailingRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');

    await expect(consumeFormBinding(redis, 'alpha', binding.token)).resolves.toBeUndefined();
    expect(await redis.exists(key('alpha', `form:${binding.token}`))).toBe(true);
    expect(await redis.exists(key('alpha', `form:${binding.token}:consume`))).toBe(false);
  });

  it('keeps the binding retryable if the consume lease cannot be reserved', async () => {
    class ConsumeReservationFailingRedisStore extends InMemoryRedisStore {
      override async setIfNotExists(keyName: string, value: string): Promise<boolean> {
        if (keyName.endsWith(':consume')) {
          throw new Error('consume reservation down');
        }

        return super.setIfNotExists(keyName, value);
      }
    }

    const redis = new ConsumeReservationFailingRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');

    await expect(consumeFormBinding(redis, 'alpha', binding.token)).resolves.toBeUndefined();
    expect(await redis.exists(key('alpha', `form:${binding.token}`))).toBe(true);
    expect(await redis.exists(key('alpha', `form:${binding.token}:consume`))).toBe(false);
  });

  it('rolls back the binding write if setting the expiry fails', async () => {
    class ExpireFailingRedisStore extends InMemoryRedisStore {
      readonly setKeys: string[] = [];
      readonly reservedKeys: string[] = [];

      override async set(keyName: string, value: string): Promise<void> {
        this.setKeys.push(keyName);
        await super.set(keyName, value);
      }

      override async setIfNotExists(keyName: string, value: string): Promise<boolean> {
        this.reservedKeys.push(keyName);
        return super.setIfNotExists(keyName, value);
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
    expect(redis.reservedKeys).toHaveLength(1);
    await Promise.all(
      [...redis.setKeys, ...redis.reservedKeys].map(async (keyName) => {
        expect(await redis.exists(keyName)).toBe(false);
      }),
    );
  });

  it('rolls back the binding write if context reservation fails', async () => {
    class ContextReservationFailingRedisStore extends InMemoryRedisStore {
      readonly setKeys: string[] = [];

      override async set(keyName: string, value: string): Promise<void> {
        this.setKeys.push(keyName);
        await super.set(keyName, value);
      }

      override async setIfNotExists(keyName: string, value: string): Promise<boolean> {
        if (keyName.includes(':form-context:')) {
          throw new Error('context reservation down');
        }

        return super.setIfNotExists(keyName, value);
      }
    }

    const redis = new ContextReservationFailingRedisStore();

    await expect(
      createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z'),
    ).rejects.toThrow('context reservation down');
    await Promise.all(
      redis.setKeys.map(async (keyName) => {
        expect(await redis.exists(keyName)).toBe(false);
      }),
    );
  });
});
