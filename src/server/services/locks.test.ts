import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { ReviewLockRecord } from '../../shared/schema';
import {
  getActiveLockByTarget,
  getLock,
  listActiveLocks,
  saveLock,
  updateLockStatus,
} from './locks';
import { keys } from './keys';

const lock = (overrides: Partial<ReviewLockRecord> = {}): ReviewLockRecord => ({
  id: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_alpha',
  targetKind: 'post',
  targetAuthor: 'u_author',
  permalink: '/r/alpha/comments/alpha',
  title: 'Reviewed post',
  contentPreview: 'Reviewed content',
  contentHash: 'hash',
  fingerprintVersion: 'content-v1',
  lockedBy: 'mod',
  lockedAt: '2026-05-24T00:00:00.000Z',
  lockReason: 'reviewed_policy_compliant',
  status: 'active',
  lastKnownEdited: false,
  lastReportCount: 1,
  suppressedReportCount: 0,
  runtimeWarnings: [],
  demo: false,
  ...overrides,
});

describe('lock persistence', () => {
  it('saves and resolves active locks by id and target pointer', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());

    expect(await getLock(redis, 'alpha', 'lock-1')).toMatchObject({ targetId: 't3_alpha' });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_alpha')).toMatchObject({ id: 'lock-1' });
  });

  it('orders active locks newest first', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(
      redis,
      lock({ id: 'lock-old', targetId: 't3_old', lockedAt: '2026-05-23T00:00:00.000Z' }),
    );
    await saveLock(
      redis,
      lock({ id: 'lock-new', targetId: 't3_new', lockedAt: '2026-05-24T00:00:00.000Z' }),
    );

    expect((await listActiveLocks(redis, 'alpha')).map((entry) => entry.id)).toEqual([
      'lock-new',
      'lock-old',
    ]);
  });

  it('removes active indexes when status changes', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    await updateLockStatus(redis, 'alpha', 'lock-1', 'reopened');

    expect(await getActiveLockByTarget(redis, 'alpha', 't3_alpha')).toBeUndefined();
    expect(await listActiveLocks(redis, 'alpha')).toEqual([]);
  });

  it('keeps subreddit namespaces isolated', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());

    expect(await getActiveLockByTarget(redis, 'beta', 't3_alpha')).toBeUndefined();
  });

  it('degrades safely when a lock record is malformed', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(keys.lock('alpha', 'lock-bad'), '{');
    await redis.set(keys.lock('alpha', 'lock-wrong-shape'), JSON.stringify({ status: 'active' }));
    await redis.set(
      keys.lock('alpha', 'lock-negative-count'),
      JSON.stringify(lock({ id: 'lock-negative-count', suppressedReportCount: -1 })),
    );
    await redis.set(
      keys.lock('alpha', 'lock-bad-date'),
      JSON.stringify(lock({ id: 'lock-bad-date', targetId: 't3_bad_date', lockedAt: 'yesterday' })),
    );
    await redis.set(keys.targetLock('alpha', 't3_bad'), 'lock-bad');
    await redis.set(keys.targetLock('alpha', 't3_wrong_shape'), 'lock-wrong-shape');
    await redis.set(keys.targetLock('alpha', 't3_negative_count'), 'lock-negative-count');
    await redis.set(keys.targetLock('alpha', 't3_bad_date'), 'lock-bad-date');
    await redis.zAdd(keys.activeLocks('alpha'), {
      member: 'lock-bad',
      score: Date.parse('2026-05-24T00:00:00.000Z'),
    });
    await redis.zAdd(keys.activeLocks('alpha'), {
      member: 'lock-wrong-shape',
      score: Date.parse('2026-05-24T01:00:00.000Z'),
    });
    await redis.zAdd(keys.activeLocks('alpha'), {
      member: 'lock-negative-count',
      score: Date.parse('2026-05-24T02:00:00.000Z'),
    });
    await redis.zAdd(keys.activeLocks('alpha'), {
      member: 'lock-bad-date',
      score: Date.parse('2026-05-24T03:00:00.000Z'),
    });

    expect(await getLock(redis, 'alpha', 'lock-bad')).toBeUndefined();
    expect(await getLock(redis, 'alpha', 'lock-wrong-shape')).toBeUndefined();
    expect(await getLock(redis, 'alpha', 'lock-negative-count')).toBeUndefined();
    expect(await getLock(redis, 'alpha', 'lock-bad-date')).toBeUndefined();
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_bad')).toBeUndefined();
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_wrong_shape')).toBeUndefined();
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_negative_count')).toBeUndefined();
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_bad_date')).toBeUndefined();
    expect(await listActiveLocks(redis, 'alpha')).toEqual([]);
    expect(await updateLockStatus(redis, 'alpha', 'lock-bad', 'reopened')).toBeUndefined();
    expect(await updateLockStatus(redis, 'alpha', 'lock-wrong-shape', 'reopened')).toBeUndefined();
    expect(
      await updateLockStatus(redis, 'alpha', 'lock-negative-count', 'reopened'),
    ).toBeUndefined();
    expect(await updateLockStatus(redis, 'alpha', 'lock-bad-date', 'reopened')).toBeUndefined();
  });
});
