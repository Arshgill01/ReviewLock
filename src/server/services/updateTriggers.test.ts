import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { fingerprintTarget } from './fingerprint';
import { listAuditEvents } from './audit';
import { getActiveLockByTarget, getLock, saveLock } from './locks';
import { getDailyMetrics, getTargetMetrics } from './metrics';
import { listOpenReopenEvents } from './reopenQueue';
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

const lock = (reviewedTarget: ReviewLockTarget = target()): ReviewLockRecord => {
  const fingerprint = fingerprintTarget(reviewedTarget, '2026-05-24T00:00:00.000Z');

  return {
    id: `lock-${reviewedTarget.id}`,
    subreddit: reviewedTarget.subreddit,
    targetId: reviewedTarget.id,
    targetKind: reviewedTarget.kind,
    targetAuthor: reviewedTarget.authorName,
    permalink: reviewedTarget.permalink,
    title: reviewedTarget.title,
    contentPreview: reviewedTarget.body ?? reviewedTarget.title ?? '',
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
      const reddit = new FakeRedditAdapter([currentTarget]);
      const result = await handleUpdateTrigger(
        {
          redis,
          reddit,
          clock: fixedClock('2026-05-24T01:00:00.000Z'),
        },
        { targetId: 't3_post', triggerKind },
      );

      expect(result.event).toMatchObject({ reason });
      expect(reddit.calls).toEqual(['unignoreReports:t3_post']);
      expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
      expect(await getLock(redis, 'alpha', 'lock-t3_post')).toMatchObject({
        status: 'reopened',
        reopenReason: reason,
      });
      expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
        expect.objectContaining({ reason }),
      ]);
      expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toMatchObject({
        locksReopened: 1,
      });
      expect(await getTargetMetrics(redis, 'alpha', 't3_post')).toMatchObject({
        locksReopened: 1,
      });
      expect(await listAuditEvents(redis, 'alpha')).toEqual([
        expect.objectContaining({ kind: 'lock_reopened' }),
      ]);
    }
  });

  it('keeps unchanged post updates active without moderation or audit writes', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const reddit = new FakeRedditAdapter([target()]);
    const result = await handleUpdateTrigger(
      {
        redis,
        reddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', triggerKind: 'post_update' },
    );

    expect(result.action).toBe('unchanged');
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({
      status: 'active',
    });
    expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toBeUndefined();
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([]);
    expect(await listAuditEvents(redis, 'alpha')).toEqual([]);
  });

  it('reopens post body updates and records Redis-visible proof', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const reddit = new FakeRedditAdapter([target({ body: 'Edited body', edited: true })]);
    const result = await handleUpdateTrigger(
      {
        redis,
        reddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', triggerKind: 'post_update' },
    );

    expect(result.action).toBe('reopened');
    expect(reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await getLock(redis, 'alpha', 'lock-t3_post')).toMatchObject({
      status: 'reopened',
      reopenReason: 'content_changed',
      reopenEventId: result.event?.id,
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed', targetKind: 'post' }),
    ]);
    expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
    });
    expect(await getTargetMetrics(redis, 'alpha', 't3_post')).toMatchObject({
      locksReopened: 1,
    });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'lock_reopened',
        message: 'Lock reopened after reviewed content changed or became uncertain.',
      }),
    ]);
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
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock(comment));
    const reddit = new FakeRedditAdapter([{ ...comment, body: 'Edited comment', edited: true }]);

    const result = await handleUpdateTrigger(
      {
        redis,
        reddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't1_comment', triggerKind: 'comment_update' },
    );

    expect(result.event).toMatchObject({ reason: 'content_changed' });
    expect(reddit.calls).toEqual(['unignoreReports:t1_comment']);
    expect(await getActiveLockByTarget(redis, 'alpha', 't1_comment')).toBeUndefined();
    expect(await getLock(redis, 'alpha', 'lock-t1_comment')).toMatchObject({
      status: 'reopened',
      reopenReason: 'content_changed',
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed', targetKind: 'comment' }),
    ]);
    expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
    });
    expect(await getTargetMetrics(redis, 'alpha', 't1_comment')).toMatchObject({
      locksReopened: 1,
    });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ kind: 'lock_reopened', targetKind: 'comment' }),
    ]);
  });
});
