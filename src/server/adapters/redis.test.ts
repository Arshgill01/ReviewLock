import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from './redis';

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
});
