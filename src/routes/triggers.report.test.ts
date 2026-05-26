import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../shared/schema';
import { fingerprintTarget } from '../server/services/fingerprint';
import { getActiveLockByTarget, saveLock } from '../server/services/locks';
import { listAuditEvents } from '../server/services/audit';
import { listOpenReopenEvents } from '../server/services/reopenQueue';
import { loadRuntimeProofStatus } from '../server/services/runtimeProof';
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
    expect(await loadRuntimeProofStatus(redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'postReportTrigger',
          status: 'verified',
          evidence: 'post report trigger processed for t3_post',
        }),
      ]),
    });
    expect(await loadRuntimeProofStatus(redis, 'alpha')).not.toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'commentReportTrigger', status: 'verified' }),
      ]),
    });
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

  it('normalizes bare Devvit post report ids before resolving targets', async () => {
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
        id: 'evt-bare-post',
        post: { id: 'post', numberOfReports: 6 },
        subreddit: { name: 'alpha' },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
  });

  it('accepts Devvit TriggerEvent-wrapped post report payloads', async () => {
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
        id: 'evt-wrapper-post',
        timestamp: '2026-05-24T01:00:00.000Z',
        subreddit: 'alpha',
        postReport: {
          post: { id: 't3_post', numReports: 8 },
          subreddit: { name: 'alpha' },
          reason: 'spam',
        },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
  });

  it('uses nested wrapped report event ids for dedupe', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const reddit = new FakeRedditAdapter([target()]);
    const router = createReportTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const firstResponse = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({
        postReport: {
          id: 'evt-nested-report-a',
          timestamp: '2026-05-24T01:00:00.000Z',
          post: { id: 't3_post', numReports: 8 },
          subreddit: { name: 'alpha' },
        },
      }),
    });
    const secondResponse = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({
        postReport: {
          id: 'evt-nested-report-b',
          timestamp: '2026-05-24T01:00:30.000Z',
          post: { id: 't3_post', numReports: 8 },
          subreddit: { name: 'alpha' },
        },
      }),
    });

    expect(await firstResponse.json()).toMatchObject({
      ok: true,
      action: 'suppress_unchanged',
    });
    expect(await secondResponse.json()).toMatchObject({
      ok: true,
      action: 'suppress_unchanged',
    });
    expect(reddit.calls).toEqual(['ignoreReports:t3_post', 'ignoreReports:t3_post']);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({
      suppressedReportCount: 2,
    });
    expect(await listAuditEvents(redis, 'alpha')).toHaveLength(2);
  });

  it('uses nested wrapped report timestamps for audit time', async () => {
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
        postReport: {
          id: 'evt-nested-report-timestamp',
          timestamp: '2026-05-23T23:59:00.000Z',
          post: { id: 't3_post', numReports: 9 },
          subreddit: { name: 'alpha' },
        },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        createdAt: '2026-05-23T23:59:00.000Z',
        kind: 'report_suppressed',
      }),
    ]);
  });

  it('logs sanitized report payload shape without raw ids, content, or report reasons', async () => {
    const redis = new InMemoryRedisStore();
    const logs: Record<string, unknown>[] = [];
    await saveLock(redis, lock());
    const router = createReportTriggersRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
      logger: {
        info: (_message, data) => {
          logs.push(data);
        },
      },
    });
    const response = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({
        id: 'evt-private-report',
        timestamp: '2026-05-24T01:00:00.000Z',
        postReport: {
          post: {
            id: 't3_post',
            subredditName: 'alpha',
            numberOfReports: 9,
            body: 'private reported content',
          },
          subreddit: { name: 'alpha' },
          reason: 'private report reason',
        },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(logs).toEqual([
      expect.objectContaining({
        route: 'on-post-report',
        targetKind: 'post',
        postReport: expect.objectContaining({
          present: true,
          reason: true,
          post: expect.objectContaining({
            present: true,
            id: true,
            subredditName: true,
            numberOfReports: true,
          }),
        }),
      }),
    ]);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('evt-private-report');
    expect(serialized).not.toContain('t3_post');
    expect(serialized).not.toContain('alpha');
    expect(serialized).not.toContain('private reported content');
    expect(serialized).not.toContain('private report reason');
  });

  it('uses wrapped report subreddit for retryable runtime uncertainty when refetch fails', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const router = createReportTriggersRouter({
      reddit: new FakeRedditAdapter([]),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({
        id: 'evt-wrapper-runtime-uncertain',
        postReport: {
          post: { id: 't3_post' },
          subreddit: { name: 'alpha' },
          reason: 'spam',
        },
      }),
    });

    expect(await response.json()).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({
      status: 'active',
      runtimeWarnings: ['target_resolution_failed'],
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([]);
  });

  it('accepts Devvit TriggerEvent-wrapped comment report payloads', async () => {
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
        id: 'evt-wrapper-comment',
        commentReport: {
          comment: { id: 't1_comment', numReports: 5 },
          subreddit: { name: 'alpha' },
          reason: 'spam',
        },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(reddit.calls).toEqual(['ignoreReports:t1_comment']);
    expect(await loadRuntimeProofStatus(redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'commentReportTrigger',
          status: 'verified',
          evidence: 'comment report trigger processed for t1_comment',
        }),
      ]),
    });
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

  it('prefers comment ids over sibling post ids on comment report payloads', async () => {
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
        id: 'evt-comment-sibling-post',
        post: { id: 't3_parent_post' },
        comment: { id: 't1_comment', numReports: 5 },
        subreddit: { name: 'alpha' },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(reddit.calls).toEqual(['ignoreReports:t1_comment']);
  });

  it('prefers comment-specific ids over generic target ids on comment report payloads', async () => {
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
        eventId: 'evt-comment-generic-target',
        targetId: 't3_parent_post',
        commentId: 't1_comment',
        subreddit: { name: 'alpha' },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(reddit.calls).toEqual(['ignoreReports:t1_comment']);
  });

  it('rejects post target ids sent as the only comment report target', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const reddit = new FakeRedditAdapter([target()]);
    const router = createReportTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-comment-report', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 'evt-wrong-kind-comment-report',
        targetId: 't3_parent_post',
        subreddit: { name: 'alpha' },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'Report trigger target id is required.',
    });
    expect(reddit.calls).toEqual([]);
    expect(await loadRuntimeProofStatus(redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'commentReportTrigger', status: 'unverified' }),
      ]),
    });
  });

  it('rejects malformed non-string target ids without touching reddit', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target()]);
    const router = createReportTriggersRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({ targetId: { id: 't3_post' }, eventId: 'evt-bad-target' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'Report trigger target id is required.',
    });
    expect(reddit.calls).toEqual([]);
  });

  it('uses comment report counts before parent post report counts on comment reports', async () => {
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
        id: 'evt-comment-count-conflict',
        post: { id: 't3_parent_post', numReports: 99 },
        comment: { id: 't1_comment', numReports: 5 },
        subreddit: { name: 'alpha' },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(await getActiveLockByTarget(redis, 'alpha', 't1_comment')).toMatchObject({
      lastReportCount: 5,
    });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'report_suppressed',
        data: expect.objectContaining({ reportCount: 5 }),
      }),
    ]);
  });

  it('ignores malformed report counts and falls back to the refetched target count', async () => {
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
        id: 'evt-malformed-report-count',
        post: { id: 't3_post', numberOfReports: '99' },
        reportCount: -1,
        subreddit: { name: 'alpha' },
      }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({
      lastReportCount: 5,
    });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'report_suppressed',
        data: expect.objectContaining({ reportCount: 5 }),
      }),
    ]);
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

  it('normalizes bare Devvit comment report ids before resolving targets', async () => {
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
        id: 'evt-bare-comment',
        comment: { id: 'comment', numReports: 3 },
        subreddit: { name: 'alpha' },
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
