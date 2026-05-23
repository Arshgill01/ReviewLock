import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { getActiveLockByTarget, saveLock } from './locks';
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
      { targetId: 't3_post', actor: 'mod' },
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
      { targetId: 't3_post', actor: 'mod' },
    );

    expect(result.ok).toBe(true);
    expect(reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
  });
});
