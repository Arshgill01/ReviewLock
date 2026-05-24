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
import { handleUpdateTrigger } from './updateTriggers';
import { keys } from './keys';

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
    const first = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      eventId: 'evt-1',
    });
    const duplicate = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      eventId: 'evt-1',
    });

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

  it('sets a bounded TTL on successful report dedupe markers', async () => {
    class ExpiringRedisStore extends InMemoryRedisStore {
      readonly expireCalls: Array<{ key: string; seconds: number }> = [];

      override async expire(key: string, seconds: number): Promise<void> {
        this.expireCalls.push({ key, seconds });
        await super.expire(key, seconds);
      }
    }

    const redis = new ExpiringRedisStore();
    await saveLock(redis, lock());

    await expect(
      handleReportTrigger(
        {
          redis,
          reddit: new FakeRedditAdapter([target()]),
          clock: fixedClock('2026-05-24T01:00:00.000Z'),
        },
        { targetId: 't3_post', eventId: 'evt-expiring-dedupe' },
      ),
    ).resolves.toMatchObject({ action: 'suppress_unchanged' });

    expect(redis.expireCalls).toContainEqual({
      key: 'reviewlock:alpha:report:dedupe:evt-expiring-dedupe',
      seconds: 604800,
    });
  });

  it('does not double-count concurrent duplicate report deliveries', async () => {
    const dependencies = await deps();
    const results = await Promise.all([
      handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-race' }),
      handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-race' }),
    ]);

    expect(results.map((result) => result.action).sort()).toEqual([
      'duplicate',
      'suppress_unchanged',
    ]);
    expect(dependencies.reddit.calls).toEqual(['ignoreReports:t3_post']);
    expect(await getLock(dependencies.redis, 'alpha', 'lock-t3_post')).toMatchObject({
      suppressedReportCount: 1,
    });
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      reportsSuppressed: 1,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toHaveLength(1);
  });

  it('dedupes duplicate changed-content report event ids before reopening twice', async () => {
    const dependencies = await deps(target('Edited body'));
    const first = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      eventId: 'evt-reopen-duplicate',
    });
    const duplicate = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      eventId: 'evt-reopen-duplicate',
    });

    expect(first.action).toBe('reopen_changed');
    expect(duplicate.action).toBe('duplicate');
    expect(dependencies.reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
      reportsSuppressed: 0,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toHaveLength(1);
  });

  it('uses report count to avoid undercounting distinct no-id report deliveries', async () => {
    const dependencies = await deps();
    const first = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      reportCount: 5,
    });
    const duplicateSameCount = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      reportCount: 5,
    });
    const nextReportCount = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      reportCount: 6,
    });

    expect(first.action).toBe('suppress_unchanged');
    expect(duplicateSameCount.action).toBe('duplicate');
    expect(nextReportCount.action).toBe('suppress_unchanged');
    expect(dependencies.reddit.calls).toEqual(['ignoreReports:t3_post', 'ignoreReports:t3_post']);
    expect(await getLock(dependencies.redis, 'alpha', 'lock-t3_post')).toMatchObject({
      suppressedReportCount: 2,
      lastReportCount: 6,
    });
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      reportsSuppressed: 2,
      locksReopened: 0,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      reportsSuppressed: 2,
      locksReopened: 0,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toHaveLength(2);
  });

  it('handles a high-volume burst of distinct unchanged reports deterministically', async () => {
    const dependencies = await deps();
    const reportCount = 50;

    for (let index = 0; index < reportCount; index += 1) {
      await expect(
        handleReportTrigger(dependencies, {
          targetId: 't3_post',
          eventId: `evt-burst-${index}`,
          reportCount: index + 1,
        }),
      ).resolves.toMatchObject({ action: 'suppress_unchanged' });
    }

    expect(dependencies.reddit.calls).toHaveLength(reportCount);
    expect(await getLock(dependencies.redis, 'alpha', 'lock-t3_post')).toMatchObject({
      suppressedReportCount: reportCount,
      lastReportCount: reportCount,
    });
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      reportsSuppressed: reportCount,
      locksReopened: 0,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      reportsSuppressed: reportCount,
      locksReopened: 0,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toHaveLength(reportCount);
  });

  it('collapses a high-volume duplicate delivery storm to one suppression', async () => {
    const dependencies = await deps();
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        handleReportTrigger(dependencies, {
          targetId: 't3_post',
          eventId: 'evt-duplicate-storm',
          reportCount: 5,
        }),
      ),
    );
    const actions = results.map((result) => result.action);

    expect(actions.filter((action) => action === 'suppress_unchanged')).toHaveLength(1);
    expect(actions.filter((action) => action === 'duplicate')).toHaveLength(49);
    expect(dependencies.reddit.calls).toEqual(['ignoreReports:t3_post']);
    expect(await getLock(dependencies.redis, 'alpha', 'lock-t3_post')).toMatchObject({
      suppressedReportCount: 1,
    });
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      reportsSuppressed: 1,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toHaveLength(1);
  });

  it('suppresses unchanged comment reports with the comment moderation operation', async () => {
    const dependencies = await deps(commentTarget());
    const result = await handleReportTrigger(dependencies, {
      targetId: 't1_comment',
      eventId: 'evt-comment-1',
    });

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
    const result = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      eventId: 'evt-2',
    });

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

  it('removes active indexes when changed-report status write fails after queueing reopen event', async () => {
    class ReopenStatusWriteFailingRedisStore extends InMemoryRedisStore {
      failLockStatusWrites = false;

      override async set(key: string, value: string): Promise<void> {
        if (this.failLockStatusWrites && key === keys.lock('alpha', 'lock-t3_post')) {
          throw new Error('lock status down');
        }

        await super.set(key, value);
      }
    }

    const redis = new ReopenStatusWriteFailingRedisStore();
    await saveLock(redis, lock());
    redis.failLockStatusWrites = true;

    const result = await handleReportTrigger(
      {
        redis,
        reddit: new FakeRedditAdapter([target('Edited body')]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-reopen-status-fail' },
    );

    expect(result).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
      warnings: ['redis_write_failed'],
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed' }),
    ]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
  });

  it('reopens changed comment reports with the comment moderation operation', async () => {
    const dependencies = await deps(commentTarget('Edited comment'));
    const result = await handleReportTrigger(dependencies, {
      targetId: 't1_comment',
      eventId: 'evt-comment-2',
    });

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

  it('reopens as runtime uncertain when a report target cannot be loaded but the active lock is known', async () => {
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
    expect(result.reopenEvent).toMatchObject({ reason: 'runtime_uncertain' });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await getLock(redis, 'alpha', 'lock-t3_post')).toMatchObject({
      status: 'reopened',
      reopenReason: 'runtime_uncertain',
      runtimeWarnings: ['target_resolution_failed'],
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'runtime_uncertain' }),
    ]);
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ kind: 'lock_reopened' }),
    ]);
  });

  it('does not keep a dedupe marker after target resolution fails without enough scope to find a lock', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter();
    await saveLock(redis, lock());

    const first = await handleReportTrigger(
      {
        redis,
        reddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-resolution-retry' },
    );
    expect(first).toMatchObject({ ok: false, action: 'runtime_uncertain' });
    expect(await redis.exists('reviewlock:unknown:report:dedupe:evt-resolution-retry')).toBe(false);

    reddit.setTarget(target());
    const retry = await handleReportTrigger(
      {
        redis,
        reddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-resolution-retry', subreddit: 'alpha' },
    );

    expect(retry).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(reddit.calls).toEqual(['ignoreReports:t3_post']);
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
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      status: 'active',
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ kind: 'runtime_failure' }),
    ]);
  });

  it('does not keep a dedupe marker after ignoreReports fails so trigger retry can succeed', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const failingReddit = new FakeRedditAdapter([target()]);
    failingReddit.failOperation('ignoreReports', 'temporary permission failure');

    const first = await handleReportTrigger(
      {
        redis,
        reddit: failingReddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-ignore-retry' },
    );
    expect(first).toMatchObject({ ok: false, action: 'runtime_uncertain' });
    expect(await redis.exists('reviewlock:alpha:report:dedupe:evt-ignore-retry')).toBe(false);

    const retryReddit = new FakeRedditAdapter([target()]);
    const retry = await handleReportTrigger(
      {
        redis,
        reddit: retryReddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-ignore-retry' },
    );

    expect(retry).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(retryReddit.calls).toEqual(['ignoreReports:t3_post']);
  });

  it('rolls back ignoreReports when Redis fails after suppression', async () => {
    class FailingLockWriteRedisStore extends InMemoryRedisStore {
      failLockWrites = false;

      override async set(key: string, value: string): Promise<void> {
        if (this.failLockWrites && key.includes(':lock:lock-')) {
          throw new Error('redis down during suppression');
        }

        await super.set(key, value);
      }
    }

    const redis = new FailingLockWriteRedisStore();
    await saveLock(redis, lock());
    redis.failLockWrites = true;
    const reddit = new FakeRedditAdapter([target()]);
    const result = await handleReportTrigger(
      {
        redis,
        reddit,
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-redis-fail' },
    );

    expect(result).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
      warnings: ['redis_write_failed'],
    });
    expect(reddit.calls).toEqual(['ignoreReports:t3_post', 'unignoreReports:t3_post']);
  });

  it('keeps report-then-update ordering idempotent for changed content', async () => {
    const dependencies = await deps(target('Edited body'));
    const reportResult = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      eventId: 'evt-report-first',
    });
    const updateResult = await handleUpdateTrigger(dependencies, {
      targetId: 't3_post',
      triggerKind: 'post_update',
    });

    expect(reportResult.action).toBe('reopen_changed');
    expect(updateResult.action).toBe('no_lock');
    expect(dependencies.reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
      reportsSuppressed: 0,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toHaveLength(1);
  });

  it('keeps update-then-report ordering idempotent for changed content', async () => {
    const dependencies = await deps(target('Edited body'));
    const updateResult = await handleUpdateTrigger(dependencies, {
      targetId: 't3_post',
      triggerKind: 'post_update',
    });
    const reportResult = await handleReportTrigger(dependencies, {
      targetId: 't3_post',
      eventId: 'evt-report-second',
    });

    expect(updateResult.action).toBe('reopened');
    expect(reportResult.action).toBe('no_lock');
    expect(dependencies.reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
      reportsSuppressed: 0,
    });
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toHaveLength(1);
  });
});
