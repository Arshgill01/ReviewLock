import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { ReviewLockRecord } from '../../shared/schema';
import { getActiveLockByTarget, getLock, listActiveLocks, saveLock, updateLockStatus } from './locks';

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
    await saveLock(redis, lock({ id: 'lock-old', targetId: 't3_old', lockedAt: '2026-05-23T00:00:00.000Z' }));
    await saveLock(redis, lock({ id: 'lock-new', targetId: 't3_new', lockedAt: '2026-05-24T00:00:00.000Z' }));

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
});
