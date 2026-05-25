import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { listAuditEvents } from './audit';
import { getActiveLockByTarget, saveLock } from './locks';
import { keys } from './keys';
import { loadRuntimeProofStatus } from './runtimeProof';
import { unlockReviewedContent } from './unlockFlow';

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: 4,
});

const lock = (): ReviewLockRecord => ({
  id: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_post',
  targetKind: 'post',
  targetAuthor: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  contentPreview: 'Reviewed body',
  contentHash: 'hash',
  fingerprintVersion: 'content-v1',
  lockedBy: 'mod',
  lockedAt: '2026-05-24T00:00:00.000Z',
  lockReason: 'reviewed_policy_compliant',
  status: 'active',
  lastKnownEdited: false,
  lastReportCount: 4,
  suppressedReportCount: 0,
  runtimeWarnings: [],
  demo: false,
});

describe('unlockReviewedContent', () => {
  it('returns neutral success when no active lock exists', async () => {
    const result = await unlockReviewedContent(
      {
        reddit: new FakeRedditAdapter([target()]),
        redis: new InMemoryRedisStore(),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', actor: 'mod', lockId: 'lock-1' },
    );

    expect(result).toMatchObject({
      ok: true,
      message: 'No active ReviewLock lock was found for this content.',
    });
  });

  it('unignores reports and removes active indexes', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target()]);
    await saveLock(redis, lock());

    const result = await unlockReviewedContent(
      { reddit, redis, clock: fixedClock('2026-05-24T01:00:00.000Z') },
      { targetId: 't3_post', actor: 'mod', lockId: 'lock-1' },
    );

    expect(result.ok).toBe(true);
    expect(reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    await expect(loadRuntimeProofStatus(redis, 'alpha')).resolves.toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'unignoreReports', status: 'verified' }),
      ]),
    });
  });

  it('clears active indexes when unlock status persistence fails after unignoreReports', async () => {
    class UnlockStatusFailingRedisStore extends InMemoryRedisStore {
      failUnlockStatusWrite = false;

      override async set(key: string, value: string): Promise<void> {
        if (this.failUnlockStatusWrite && key === keys.lock('alpha', 'lock-1')) {
          throw new Error('lock status down');
        }

        await super.set(key, value);
      }
    }

    const redis = new UnlockStatusFailingRedisStore();
    const reddit = new FakeRedditAdapter([target()]);
    await saveLock(redis, lock());
    redis.failUnlockStatusWrite = true;

    const result = await unlockReviewedContent(
      { reddit, redis, clock: fixedClock('2026-05-24T01:00:00.000Z') },
      { targetId: 't3_post', actor: 'mod', lockId: 'lock-1' },
    );

    expect(result).toMatchObject({
      ok: false,
      warnings: ['redis_write_failed'],
    });
    expect(reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'runtime_failure',
        message:
          'ReviewLock returned reports to normal handling but could not persist the manual unlock.',
      }),
    ]);
  });

  it('rejects stale unlock confirmations before calling Reddit', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target()]);
    await saveLock(redis, lock());

    const result = await unlockReviewedContent(
      { reddit, redis, clock: fixedClock('2026-05-24T01:00:00.000Z') },
      { targetId: 't3_post', actor: 'mod', lockId: 'old-lock' },
    );

    expect(result).toMatchObject({
      ok: false,
      message:
        'ReviewLock lock changed before unlock could be confirmed. Refresh and confirm again.',
      warnings: ['stale_unlock_confirmation'],
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({ id: 'lock-1' });
  });

  it('rejects unlock when the target is outside the expected subreddit', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target()]);
    await saveLock(redis, lock());

    const result = await unlockReviewedContent(
      { reddit, redis, clock: fixedClock('2026-05-24T01:00:00.000Z') },
      {
        targetId: 't3_post',
        actor: 'mod',
        lockId: 'lock-1',
        expectedSubreddit: 'beta',
      },
    );

    expect(result).toMatchObject({
      ok: false,
      message: 'ReviewLock target is outside the current subreddit context.',
      warnings: ['subreddit_scope_mismatch'],
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({ id: 'lock-1' });
  });

  it('keeps the lock active when unignoreReports fails', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target()]);
    reddit.failOperation('unignoreReports', 'permission denied');
    await saveLock(redis, lock());

    const result = await unlockReviewedContent(
      { reddit, redis, clock: fixedClock('2026-05-24T01:00:00.000Z') },
      { targetId: 't3_post', actor: 'mod', lockId: 'lock-1' },
    );

    expect(result).toMatchObject({
      ok: false,
      message:
        'ReviewLock could not return reports to normal handling; the lock remains active for retry.',
      warnings: ['unignoreReports failed for t3_post'],
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({
      id: 'lock-1',
      status: 'active',
      runtimeWarnings: ['unignoreReports failed for t3_post'],
    });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'runtime_failure',
        message: 'ReviewLock could not return reports to normal handling; lock remains active.',
      }),
    ]);
    await expect(loadRuntimeProofStatus(redis, 'alpha')).resolves.toMatchObject({
      overall: 'failed',
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'unignoreReports', status: 'failed' }),
      ]),
    });
  });
});
