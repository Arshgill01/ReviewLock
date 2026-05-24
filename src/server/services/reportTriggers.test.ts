import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { listAuditEvents } from './audit';
import { getActiveLockByTarget, getLock, saveLock } from './locks';
import { getDailyMetrics, getTargetMetrics } from './metrics';
import { listOpenReopenEvents } from './reopenQueue';
import { fingerprintTarget } from './fingerprint';
import { handleReportTrigger } from './reportTriggers';

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

const deps = async (currentTarget = target()) => {
  const redis = new InMemoryRedisStore();
  await saveLock(redis, lock(currentTarget.kind === 'comment' ? commentTarget() : target()));
  return {
    redis,
    reddit: new FakeRedditAdapter([currentTarget]),
    clock: fixedClock('2026-05-24T01:00:00.000Z'),
  };
};

describe('handleReportTrigger', () => {
  it('does nothing when no lock exists', async () => {
    const redis = new InMemoryRedisStore();
    const result = await handleReportTrigger(
      {
        redis,
        reddit: new FakeRedditAdapter([target()]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-1' },
    );

    expect(result.action).toBe('no_lock');
  });

  it('suppresses unchanged content and increments metrics once', async () => {
    const dependencies = await deps();
    const first = await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-1' });
    const duplicate = await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-1' });

    expect(first.action).toBe('suppress_unchanged');
    expect(duplicate.action).toBe('duplicate');
    expect(dependencies.reddit.calls).toEqual(['ignoreReports:t3_post']);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      status: 'active',
    });
    expect(await getLock(dependencies.redis, 'alpha', 'lock-t3_post')).toMatchObject({
      suppressedReportCount: 1,
      lastReportCount: 5,
    });
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      reportsSuppressed: 1,
      locksReopened: 0,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      reportsSuppressed: 1,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'report_suppressed',
        message: 'Repeat report suppressed because reviewed content was unchanged.',
      }),
    ]);
  });

  it('suppresses unchanged comment reports with the comment moderation operation', async () => {
    const dependencies = await deps(commentTarget());
    const result = await handleReportTrigger(dependencies, { targetId: 't1_comment', eventId: 'evt-comment-1' });

    expect(result.action).toBe('suppress_unchanged');
    expect(dependencies.reddit.calls).toEqual(['ignoreReports:t1_comment']);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't1_comment')).toMatchObject({
      status: 'active',
    });
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      reportsSuppressed: 1,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't1_comment')).toMatchObject({
      reportsSuppressed: 1,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ kind: 'report_suppressed', targetKind: 'comment' }),
    ]);
  });

  it('reopens changed content and removes active lock index', async () => {
    const dependencies = await deps(target('Edited body'));
    const result = await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-2' });

    expect(result.action).toBe('reopen_changed');
    expect(result.reopenEvent).toMatchObject({ reason: 'content_changed' });
    expect(dependencies.reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await getLock(dependencies.redis, 'alpha', 'lock-t3_post')).toMatchObject({
      status: 'reopened',
      reopenReason: 'content_changed',
      reopenEventId: result.reopenEvent?.id,
    });
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ id: result.reopenEvent?.id, reason: 'content_changed' }),
    ]);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      locksReopened: 1,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'lock_reopened',
        message: 'Report trigger reopened the lock because reviewed content changed.',
      }),
    ]);
  });

  it('reopens changed comment reports with the comment moderation operation', async () => {
    const dependencies = await deps(commentTarget('Edited comment'));
    const result = await handleReportTrigger(dependencies, { targetId: 't1_comment', eventId: 'evt-comment-2' });

    expect(result.action).toBe('reopen_changed');
    expect(dependencies.reddit.calls).toEqual(['unignoreReports:t1_comment']);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't1_comment')).toBeUndefined();
    expect(await getLock(dependencies.redis, 'alpha', 'lock-t1_comment')).toMatchObject({
      status: 'reopened',
      reopenReason: 'content_changed',
    });
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed', targetKind: 'comment' }),
    ]);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't1_comment')).toMatchObject({
      locksReopened: 1,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ kind: 'lock_reopened', targetKind: 'comment' }),
    ]);
  });

  it('fails open when the target cannot be loaded', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter();
    await saveLock(redis, lock());
    const result = await handleReportTrigger(
      {
        redis,
        reddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-3', subreddit: 'alpha' },
    );

    expect(result).toMatchObject({ ok: false, action: 'runtime_uncertain' });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({ status: 'active' });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ kind: 'runtime_failure' }),
    ]);
  });

  it('records runtime failure when ignore reports fails', async () => {
    const dependencies = await deps();
    dependencies.reddit.failOperation('ignoreReports', 'permission denied');

    expect(
      await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-4' }),
    ).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
    });
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toMatchObject({ status: 'active' });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ kind: 'runtime_failure' }),
    ]);
  });
});
