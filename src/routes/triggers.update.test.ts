import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../shared/schema';
import { fingerprintTarget } from '../server/services/fingerprint';
import { saveLock } from '../server/services/locks';
import { listOpenReopenEvents } from '../server/services/reopenQueue';
import { createUpdateTriggersRouter } from './triggers.update';

const target = (body = 'Reviewed body'): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body,
  edited: body !== 'Reviewed body',
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

describe('update trigger routes', () => {
  it('accepts post update payloads and returns reopen result', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const router = createUpdateTriggersRouter({
      reddit: new FakeRedditAdapter([target('Edited body')]),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-update', {
      method: 'POST',
      body: JSON.stringify({ postId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'reopened' });
  });

  it('accepts comment update payloads and reopens changed comments', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock(commentTarget()));
    const reddit = new FakeRedditAdapter([commentTarget('Edited comment')]);
    const router = createUpdateTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-comment-update', {
      method: 'POST',
      body: JSON.stringify({ commentId: 't1_comment' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'reopened' });
    expect(reddit.calls).toEqual(['unignoreReports:t1_comment']);
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed', targetKind: 'comment' }),
    ]);
  });

  it('maps flair update route to flair_changed reopen reason', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock({ ...target(), flairText: 'Discussion' }));
    const reddit = new FakeRedditAdapter([{ ...target(), flairText: 'News' }]);
    const router = createUpdateTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-flair-update', {
      method: 'POST',
      body: JSON.stringify({ postId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      ok: true,
      action: 'reopened',
      event: { reason: 'flair_changed' },
    });
  });
});
