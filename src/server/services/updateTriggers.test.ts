import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { fingerprintTarget } from './fingerprint';
import { saveLock } from './locks';
import { handleUpdateTrigger, reasonForUpdateTrigger } from './updateTriggers';

const target = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  flairText: 'Discussion',
  isNsfw: false,
  isSpoiler: false,
  edited: false,
  reportCount: 5,
  ...overrides,
});

const lock = (): ReviewLockRecord => {
  const fingerprint = fingerprintTarget(target(), '2026-05-24T00:00:00.000Z');

  return {
    id: 'lock-1',
    subreddit: 'alpha',
    targetId: 't3_post',
    targetKind: 'post',
    targetAuthor: 'u_author',
    permalink: '/r/alpha/comments/post',
    title: 'Reviewed post',
    contentPreview: 'Reviewed body',
    contentHash: fingerprint?.hash ?? '',
    fingerprintVersion: fingerprint?.version ?? 'content-v1',
    lockedBy: 'mod',
    lockedAt: '2026-05-24T00:00:00.000Z',
    lockReason: 'reviewed_policy_compliant',
    status: 'active',
    lastKnownEdited: false,
    lastReportCount: 4,
    suppressedReportCount: 0,
    runtimeWarnings: [],
    demo: false,
  };
};

describe('update triggers', () => {
  it('maps trigger kinds to reopen reasons', () => {
    expect(reasonForUpdateTrigger('post_flair_update')).toBe('flair_changed');
    expect(reasonForUpdateTrigger('post_nsfw_update')).toBe('nsfw_changed');
    expect(reasonForUpdateTrigger('post_spoiler_update')).toBe('spoiler_changed');
    expect(reasonForUpdateTrigger('comment_update')).toBe('content_changed');
  });

  it('reopens flair, nsfw, and spoiler changes with the trigger reason', async () => {
    for (const [triggerKind, currentTarget, reason] of [
      ['post_flair_update', target({ flairText: 'News' }), 'flair_changed'],
      ['post_nsfw_update', target({ isNsfw: true }), 'nsfw_changed'],
      ['post_spoiler_update', target({ isSpoiler: true }), 'spoiler_changed'],
    ] as const) {
      const redis = new InMemoryRedisStore();
      await saveLock(redis, lock());
      const result = await handleUpdateTrigger(
        {
          redis,
          reddit: new FakeRedditAdapter([currentTarget]),
          clock: fixedClock('2026-05-24T01:00:00.000Z'),
        },
        { targetId: 't3_post', triggerKind },
      );

      expect(result.event).toMatchObject({ reason });
    }
  });

  it('reopens comment edits', async () => {
    const comment: ReviewLockTarget = {
      id: 't1_comment',
      kind: 'comment',
      subreddit: 'alpha',
      authorName: 'u_author',
      permalink: '/r/alpha/comments/post/-/comment',
      body: 'Reviewed comment',
      edited: false,
      reportCount: 1,
    };
    const fingerprint = fingerprintTarget(comment, '2026-05-24T00:00:00.000Z');
    const redis = new InMemoryRedisStore();
    await saveLock(redis, {
      ...lock(),
      id: 'lock-comment',
      targetId: 't1_comment',
      targetKind: 'comment',
      contentHash: fingerprint?.hash ?? '',
      fingerprintVersion: fingerprint?.version ?? 'content-v1',
    });

    const result = await handleUpdateTrigger(
      {
        redis,
        reddit: new FakeRedditAdapter([{ ...comment, body: 'Edited comment', edited: true }]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't1_comment', triggerKind: 'comment_update' },
    );

    expect(result.event).toMatchObject({ reason: 'content_changed' });
  });
});
