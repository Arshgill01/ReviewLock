import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { ReopenEvent } from '../../shared/schema';
import {
  dismissReopenEvent,
  enqueueReopenEvent,
  getReopenEvent,
  listOpenReopenEvents,
} from './reopenQueue';
import { keys } from './keys';

const event = (overrides: Partial<ReopenEvent> = {}): ReopenEvent => ({
  id: 'event-1',
  lockId: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_alpha',
  targetKind: 'post',
  oldContentHash: 'old',
  newContentHash: 'new',
  reason: 'content_changed',
  createdAt: '2026-05-24T00:00:00.000Z',
  summary: 'Content changed.',
  runtimeWarnings: [],
  demo: false,
  ...overrides,
});

describe('reopen queue', () => {
  it('enqueues and lists open events newest first', async () => {
    const redis = new InMemoryRedisStore();
    await enqueueReopenEvent(redis, event({ id: 'old', createdAt: '2026-05-23T00:00:00.000Z' }));
    await enqueueReopenEvent(redis, event({ id: 'new', createdAt: '2026-05-24T00:00:00.000Z' }));

    expect((await listOpenReopenEvents(redis, 'alpha')).map((entry) => entry.id)).toEqual([
      'new',
      'old',
    ]);
  });

  it('dismisses without deleting the event record', async () => {
    const redis = new InMemoryRedisStore();
    await enqueueReopenEvent(redis, event());
    await dismissReopenEvent(redis, 'alpha', 'event-1', '2026-05-24T01:00:00.000Z', 'mod');

    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([]);
    expect(await getReopenEvent(redis, 'alpha', 'event-1')).toMatchObject({ dismissedBy: 'mod' });
  });

  it('keeps the event open when queue removal fails during dismissal', async () => {
    class QueueFailingRedisStore extends InMemoryRedisStore {
      override async zRem(key: string, member: string): Promise<void> {
        if (key === keys.reopenQueue('alpha') && member === 'event-1') {
          throw new Error('queue unavailable');
        }

        await super.zRem(key, member);
      }
    }

    const redis = new QueueFailingRedisStore();
    await enqueueReopenEvent(redis, event());

    await expect(
      dismissReopenEvent(redis, 'alpha', 'event-1', '2026-05-24T01:00:00.000Z', 'mod'),
    ).rejects.toThrow('queue unavailable');
    expect(await getReopenEvent(redis, 'alpha', 'event-1')).not.toHaveProperty('dismissedAt');
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ id: 'event-1' }),
    ]);
  });

  it('restores queue visibility when dismissed record persistence fails', async () => {
    class RecordFailingRedisStore extends InMemoryRedisStore {
      failWrites = false;

      override async set(key: string, value: string): Promise<void> {
        if (this.failWrites && key === keys.reopenEvent('alpha', 'event-1')) {
          throw new Error('record unavailable');
        }

        await super.set(key, value);
      }
    }

    const failingRedis = new RecordFailingRedisStore();
    await enqueueReopenEvent(failingRedis, event());
    failingRedis.failWrites = true;

    await expect(
      dismissReopenEvent(failingRedis, 'alpha', 'event-1', '2026-05-24T01:00:00.000Z', 'mod'),
    ).rejects.toThrow('record unavailable');
    expect(await listOpenReopenEvents(failingRedis, 'alpha')).toEqual([
      expect.objectContaining({ id: 'event-1' }),
    ]);
  });

  it('skips malformed reopen event records', async () => {
    const redis = new InMemoryRedisStore();
    await enqueueReopenEvent(redis, event({ id: 'good' }));
    await redis.set(keys.reopenEvent('alpha', 'bad'), '{');
    await redis.set(keys.reopenEvent('alpha', 'wrong-shape'), JSON.stringify({ status: 'open' }));
    await redis.zAdd(keys.reopenQueue('alpha'), {
      member: 'bad',
      score: Date.parse('2026-05-24T01:00:00.000Z'),
    });
    await redis.zAdd(keys.reopenQueue('alpha'), {
      member: 'wrong-shape',
      score: Date.parse('2026-05-24T02:00:00.000Z'),
    });

    expect(await getReopenEvent(redis, 'alpha', 'bad')).toBeUndefined();
    expect(await getReopenEvent(redis, 'alpha', 'wrong-shape')).toBeUndefined();
    expect((await listOpenReopenEvents(redis, 'alpha')).map((entry) => entry.id)).toEqual(['good']);
  });
});
