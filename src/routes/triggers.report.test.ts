import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../shared/schema';
import { fingerprintTarget } from '../server/services/fingerprint';
import { saveLock } from '../server/services/locks';
import { listOpenReopenEvents } from '../server/services/reopenQueue';
import { createReportTriggersRouter } from './triggers.report';

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: 5,
});

const commentTarget = (body = 'Reviewed comment'): ReviewLockTarget => ({
  id: 't1_comment',
  kind: 'comment',
  subreddit: 'alpha',
  authorName: 'u_commenter',
  permalink: '/r/alpha/comments/post/-/comment',
  body,
  edited: body !== 'Reviewed comment',
  reportCount: 2,
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

describe('report trigger routes', () => {
  it('accepts post report payloads and returns trigger result', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const router = createReportTriggersRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({ postId: 't3_post', eventId: 'evt-1' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
  });

  it('accepts Devvit nested post report payloads', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const router = createReportTriggersRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({
        id: 'evt-nested-post',
        post: { id: 't3_post', numberOfReports: 6 },
        subreddit: { name: 'alpha' },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
  });

  it('accepts comment report payloads and suppresses unchanged comments', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock(commentTarget()));
    const reddit = new FakeRedditAdapter([commentTarget()]);
    const router = createReportTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-comment-report', {
      method: 'POST',
      body: JSON.stringify({ commentId: 't1_comment', eventId: 'evt-comment-route-1' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(reddit.calls).toEqual(['ignoreReports:t1_comment']);
  });

  it('accepts Devvit nested comment report payloads', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock(commentTarget()));
    const reddit = new FakeRedditAdapter([commentTarget()]);
    const router = createReportTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-comment-report', {
      method: 'POST',
      body: JSON.stringify({
        id: 'evt-nested-comment',
        comment: { id: 't1_comment', subredditName: 'alpha', numReports: 3 },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(reddit.calls).toEqual(['ignoreReports:t1_comment']);
  });

  it('reopens changed report payloads and writes the reopen queue', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const reddit = new FakeRedditAdapter([{ ...target(), body: 'Edited body', edited: true }]);
    const router = createReportTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({ postId: 't3_post', eventId: 'evt-route-reopen' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'reopen_changed' });
    expect(reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed' }),
    ]);
  });
});
