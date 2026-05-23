import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { ReopenEvent, ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { saveLock } from './locks';
import { incrementSuppressedReportMetric } from './metrics';
import { enqueueReopenEvent } from './reopenQueue';
import { getDashboardData } from './dashboard';

const target = (id: string, reports = 0): ReviewLockTarget => ({
  id,
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: `/r/alpha/comments/${id}`,
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: reports,
});

const lock = (id: string, targetId: string): ReviewLockRecord => ({
  id,
  subreddit: 'alpha',
  targetId,
  targetKind: 'post',
  targetAuthor: 'u_author',
  permalink: `/r/alpha/comments/${targetId}`,
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

const reopenEvent = (): ReopenEvent => ({
  id: 'event-1',
  lockId: 'lock-old',
  subreddit: 'alpha',
  targetId: 't3_old',
  targetKind: 'post',
  oldContentHash: 'old',
  newContentHash: 'new',
  reason: 'content_changed',
  createdAt: '2026-05-24T01:00:00.000Z',
  summary: 'Changed after review.',
  runtimeWarnings: [],
  demo: false,
});

describe('dashboard aggregation', () => {
  it('returns useful empty state', async () => {
    const data = await getDashboardData(new InMemoryRedisStore(), {
      subreddit: 'alpha',
      now: '2026-05-24T00:00:00.000Z',
    });

    expect(data.overview).toMatchObject({
      activeLockCount: 0,
      reportsSuppressed: 0,
      reopenedAfterEditCount: 0,
    });
    expect(data.overview.runtimeStatus.overall).toBe('unverified');
  });

  it('aggregates active locks, suppressed reports, reopened events, and churn ordering', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock('lock-1', 't3_low'));
    await saveLock(redis, lock('lock-2', 't3_high'));
    await incrementSuppressedReportMetric(redis, target('t3_low'), '2026-05-24T00:10:00.000Z');
    await incrementSuppressedReportMetric(redis, target('t3_high'), '2026-05-24T00:20:00.000Z');
    await incrementSuppressedReportMetric(redis, target('t3_high'), '2026-05-24T00:30:00.000Z');
    await enqueueReopenEvent(redis, reopenEvent());

    const data = await getDashboardData(redis, {
      subreddit: 'alpha',
      now: '2026-05-24T02:00:00.000Z',
    });

    expect(data.overview.activeLockCount).toBe(2);
    expect(data.overview.reportsSuppressed).toBe(3);
    expect(data.overview.reopenedAfterEditCount).toBe(1);
    expect(data.overview.latestReopenEvent).toMatchObject({ id: 'event-1' });
    expect(data.overview.topChurnTargets[0]?.targetId).toBe('t3_high');
  });

  it('propagates demo flag without exposing reporter identities', async () => {
    const data = await getDashboardData(new InMemoryRedisStore(), {
      subreddit: 'alpha',
      demo: true,
      now: '2026-05-24T00:00:00.000Z',
    });

    expect(data.demo).toBe(true);
    expect(JSON.stringify(data)).not.toContain('reporter');
  });
});
