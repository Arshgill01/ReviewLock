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

  it('skips malformed reopen event records', async () => {
    const redis = new InMemoryRedisStore();
    await enqueueReopenEvent(redis, event({ id: 'good' }));
    await redis.set(keys.reopenEvent('alpha', 'bad'), '{');
    await redis.zAdd(keys.reopenQueue('alpha'), {
      member: 'bad',
      score: Date.parse('2026-05-24T01:00:00.000Z'),
    });

    expect(await getReopenEvent(redis, 'alpha', 'bad')).toBeUndefined();
    expect((await listOpenReopenEvents(redis, 'alpha')).map((entry) => entry.id)).toEqual(['good']);
  });
});
