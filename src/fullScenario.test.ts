import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { InMemoryRedisStore } from './server/adapters/redis';
import { FakeRedditAdapter } from './server/adapters/reddit';
import { listAuditEvents } from './server/services/audit';
import { createFormBinding } from './server/services/formBindings';
import { getActiveLockByTarget, getLock } from './server/services/locks';
import { getDailyMetrics, getTargetMetrics } from './server/services/metrics';
import { listOpenReopenEvents } from './server/services/reopenQueue';
import type { ReviewLockTarget } from './shared/schema';

const postTarget = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't3_scenario_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'post_author',
  permalink: '/r/alpha/comments/scenario_post',
  title: 'Scenario post',
  body: 'Reviewed post body',
  edited: false,
  reportCount: 2,
  ...overrides,
});

const commentTarget = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't1_scenario_comment',
  kind: 'comment',
  subreddit: 'alpha',
  authorName: 'comment_author',
  permalink: '/r/alpha/comments/scenario_post/-/scenario_comment',
  body: 'Reviewed comment body',
  edited: false,
  reportCount: 1,
  ...overrides,
});

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
});

const readJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

describe('full ReviewLock scenario walkthrough', () => {
  it('locks, suppresses repeat reports, reopens after edit, and updates dashboard output for posts and comments', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([postTarget(), commentTarget()]);
    let currentTime = '2026-05-24T01:00:00.000Z';
    const app = createApp({
      redis,
      reddit,
      clock: { now: () => currentTime },
    });

    const postBinding = await createFormBinding(redis, 'lock', postTarget(), currentTime);
    const postLockResponse = await app.request(
      '/internal/form/lock-review-submit',
      jsonPost({
        targetId: 't3_scenario_post',
        subreddit: 'alpha',
        reviewOpenedAt: postBinding.createdAt,
        actor: 'mod_alex',
        lockReason: 'reviewed_policy_compliant',
      }),
    );
    expect(await readJson(postLockResponse)).toMatchObject({
      showToast: {
        appearance: 'success',
        text: 'ReviewLock locked this reviewed content until it changes.',
      },
    });

    let postLock = await getActiveLockByTarget(redis, 'alpha', 't3_scenario_post');
    expect(postLock).toMatchObject({
      status: 'active',
      targetId: 't3_scenario_post',
      suppressedReportCount: 0,
    });

    currentTime = '2026-05-24T01:01:00.000Z';
    const firstReport = await app.request(
      '/internal/triggers/on-post-report',
      jsonPost({
        targetId: 't3_scenario_post',
        eventId: 'evt-post-repeat-1',
        reportCount: 3,
        subreddit: 'alpha',
      }),
    );
    const secondReport = await app.request(
      '/internal/triggers/on-post-report',
      jsonPost({
        targetId: 't3_scenario_post',
        eventId: 'evt-post-repeat-2',
        reportCount: 4,
        subreddit: 'alpha',
      }),
    );
    expect(await readJson(firstReport)).toMatchObject({ ok: true, action: 'suppress_unchanged' });
    expect(await readJson(secondReport)).toMatchObject({ ok: true, action: 'suppress_unchanged' });

    postLock = await getActiveLockByTarget(redis, 'alpha', 't3_scenario_post');
    expect(await getLock(redis, 'alpha', postLock?.id ?? '')).toMatchObject({
      suppressedReportCount: 2,
      lastReportCount: 4,
      status: 'active',
    });
    expect(await getTargetMetrics(redis, 'alpha', 't3_scenario_post')).toMatchObject({
      locksCreated: 1,
      reportsSuppressed: 2,
      locksReopened: 0,
    });

    const postOverviewBeforeEdit = await readJson<{
      overview: {
        activeLockCount: number;
        reportsSuppressed: number;
        reopenedAfterEditCount: number;
      };
    }>(await app.request('/api/overview?subreddit=alpha'));
    expect(postOverviewBeforeEdit.overview).toMatchObject({
      activeLockCount: 1,
      reportsSuppressed: 2,
      reopenedAfterEditCount: 0,
    });

    currentTime = '2026-05-24T01:02:00.000Z';
    reddit.setTarget(postTarget({ body: 'Edited post body', edited: true, reportCount: 5 }));
    const postUpdate = await app.request(
      '/internal/triggers/on-post-update',
      jsonPost({ targetId: 't3_scenario_post', subreddit: 'alpha' }),
    );
    expect(await readJson(postUpdate)).toMatchObject({ ok: true, action: 'reopened' });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_scenario_post')).toBeUndefined();
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        targetId: 't3_scenario_post',
        reason: 'content_changed',
      }),
    ]);

    currentTime = '2026-05-24T01:03:00.000Z';
    const commentBinding = await createFormBinding(redis, 'lock', commentTarget(), currentTime);
    const commentLockResponse = await app.request(
      '/internal/form/lock-review-submit',
      jsonPost({
        targetId: 't1_scenario_comment',
        subreddit: 'alpha',
        reviewOpenedAt: commentBinding.createdAt,
        actor: 'mod_alex',
        lockReason: 'reviewed_policy_compliant',
      }),
    );
    expect(await readJson(commentLockResponse)).toMatchObject({
      showToast: {
        appearance: 'success',
      },
    });

    currentTime = '2026-05-24T01:04:00.000Z';
    const commentReport = await app.request(
      '/internal/triggers/on-comment-report',
      jsonPost({
        targetId: 't1_scenario_comment',
        eventId: 'evt-comment-repeat-1',
        reportCount: 2,
        subreddit: 'alpha',
      }),
    );
    expect(await readJson(commentReport)).toMatchObject({
      ok: true,
      action: 'suppress_unchanged',
    });

    currentTime = '2026-05-24T01:05:00.000Z';
    reddit.setTarget(commentTarget({ body: 'Edited comment body', edited: true, reportCount: 3 }));
    const commentUpdate = await app.request(
      '/internal/triggers/on-comment-update',
      jsonPost({ targetId: 't1_scenario_comment', subreddit: 'alpha' }),
    );
    expect(await readJson(commentUpdate)).toMatchObject({ ok: true, action: 'reopened' });

    const reopenQueue = await listOpenReopenEvents(redis, 'alpha');
    expect(reopenQueue.map((event) => event.targetId).sort()).toEqual([
      't1_scenario_comment',
      't3_scenario_post',
    ]);
    expect(await getDailyMetrics(redis, 'alpha', '2026-05-24')).toMatchObject({
      locksCreated: 2,
      reportsSuppressed: 3,
      locksReopened: 2,
    });

    const finalOverview = await readJson<{
      overview: {
        activeLockCount: number;
        reportsSuppressed: number;
        reopenedAfterEditCount: number;
        latestReopenEvent?: { targetId: string };
      };
    }>(await app.request('/api/overview?subreddit=alpha'));
    expect(finalOverview.overview).toMatchObject({
      activeLockCount: 0,
      reportsSuppressed: 3,
      reopenedAfterEditCount: 2,
    });
    expect(finalOverview.overview.latestReopenEvent?.targetId).toBe('t1_scenario_comment');

    const locksResponse = await readJson<{ locks: unknown[] }>(
      await app.request('/api/locks?subreddit=alpha'),
    );
    const queueResponse = await readJson<{ events: unknown[] }>(
      await app.request('/api/reopen-queue?subreddit=alpha'),
    );
    const auditResponse = await readJson<{ events: { kind: string }[] }>(
      await app.request('/api/audit?subreddit=alpha'),
    );

    expect(locksResponse.locks).toHaveLength(0);
    expect(queueResponse.events).toHaveLength(2);
    expect(auditResponse.events.filter((event) => event.kind === 'lock_created')).toHaveLength(2);
    expect(auditResponse.events.filter((event) => event.kind === 'report_suppressed')).toHaveLength(
      3,
    );
    expect(auditResponse.events.filter((event) => event.kind === 'lock_reopened')).toHaveLength(2);
    expect(await listAuditEvents(redis, 'alpha')).toHaveLength(7);
    expect(reddit.calls).toEqual([
      'approve:t3_scenario_post',
      'ignoreReports:t3_scenario_post',
      'ignoreReports:t3_scenario_post',
      'ignoreReports:t3_scenario_post',
      'unignoreReports:t3_scenario_post',
      'approve:t1_scenario_comment',
      'ignoreReports:t1_scenario_comment',
      'ignoreReports:t1_scenario_comment',
      'unignoreReports:t1_scenario_comment',
    ]);
  });
});
