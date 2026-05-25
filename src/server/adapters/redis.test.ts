import { describe, expect, it } from 'vitest';
import { createDevvitRedisStore, InMemoryRedisStore, type SortedSetEntry } from './redis';

describe('InMemoryRedisStore', () => {
  it('supports strings, hashes, and sorted sets', async () => {
    const redis = new InMemoryRedisStore();

    await redis.set('key', 'value');
    await redis.hset('hash', { count: '1' });
    await redis.zAdd('set', { member: 'a', score: 1 });
    await redis.zAdd('set', { member: 'b', score: 2 });

    expect(await redis.get('key')).toBe('value');
    expect(await redis.hgetall('hash')).toEqual({ count: '1' });
    expect(await redis.zRange('set', 0, 0, true)).toEqual([{ member: 'b', score: 2 }]);
  });

  it('increments hash and sorted set values', async () => {
    const redis = new InMemoryRedisStore();

    await redis.hincrby('hash', 'count', 2);
    await redis.zIncrBy('set', 3, 'target');

    expect(await redis.hgetall('hash')).toEqual({ count: '2' });
    expect(await redis.zRange('set', 0, -1)).toEqual([{ member: 'target', score: 3 }]);
  });

  it('sets a string only when the key does not already exist', async () => {
    const redis = new InMemoryRedisStore();

    expect(await redis.setIfNotExists('dedupe', 'first')).toBe(true);
    expect(await redis.setIfNotExists('dedupe', 'second')).toBe(false);
    expect(await redis.get('dedupe')).toBe('first');
  });

  it('passes explicit rank options for Devvit reverse sorted-set reads', async () => {
    const zRangeCalls: unknown[] = [];
    const store = createDevvitRedisStore({
      get: async () => undefined,
      set: async () => undefined,
      del: async () => undefined,
      exists: async () => false,
      expire: async () => undefined,
      hGetAll: async () => ({}),
      hSet: async () => undefined,
      hDel: async () => undefined,
      hIncrBy: async () => 0,
      zAdd: async () => undefined,
      zRange: async (
        key: string,
        start: number | string,
        stop: number | string,
        options?: { by: 'score' | 'lex' | 'rank'; reverse?: boolean },
      ): Promise<SortedSetEntry[]> => {
        zRangeCalls.push({ key, start, stop, options });
        return [];
      },
      zRem: async () => undefined,
      zIncrBy: async () => 0,
    });

    await store.zRange('set', 0, 10, true);
    await store.zRange('set', 0, 10);

    expect(zRangeCalls).toEqual([
      { key: 'set', start: 0, stop: 10, options: { by: 'rank', reverse: true } },
      { key: 'set', start: 0, stop: 10, options: { by: 'rank' } },
    ]);
  });

  it('treats Devvit empty-string NX results as lock acquisition failures', async () => {
    const setCalls: unknown[] = [];
    const store = createDevvitRedisStore({
      get: async () => undefined,
      set: async (key: string, value: string, options?: { nx?: boolean }) => {
        setCalls.push({ key, value, options });
        return setCalls.length === 1 ? 'OK' : '';
      },
      del: async () => undefined,
      exists: async () => false,
      expire: async () => undefined,
      hGetAll: async () => ({}),
      hSet: async () => undefined,
      hDel: async () => undefined,
      hIncrBy: async () => 0,
      zAdd: async () => undefined,
      zRange: async (): Promise<SortedSetEntry[]> => [],
      zRem: async () => undefined,
      zIncrBy: async () => 0,
    });

    await expect(store.setIfNotExists('guard', 'first')).resolves.toBe(true);
    await expect(store.setIfNotExists('guard', 'second')).resolves.toBe(false);
    expect(setCalls).toEqual([
      { key: 'guard', value: 'first', options: { nx: true } },
      { key: 'guard', value: 'second', options: { nx: true } },
    ]);
  });
});
