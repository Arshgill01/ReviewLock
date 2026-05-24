import { describe, expect, it } from 'vitest';
import {
  MAX_ACTIVE_LOCKS,
  MAX_AUDIT_EVENTS,
  MAX_DAILY_METRICS,
  MAX_REOPEN_EVENTS,
} from '../../shared/constants';
import { InMemoryRedisStore } from '../adapters/redis';
import type {
  AuditEvent,
  ReopenEvent,
  ReviewLockRecord,
  ReviewLockTarget,
} from '../../shared/schema';
import { appendAuditEvent } from './audit';
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

const isoAt = (base: string, minutesToAdd: number): string =>
  new Date(Date.parse(base) + minutesToAdd * 60_000).toISOString();

const dateAt = (base: string, daysToAdd: number): string =>
  new Date(Date.parse(base) + daysToAdd * 86_400_000).toISOString().slice(0, 10);

const lock = (
  id: string,
  targetId: string,
  overrides: Partial<ReviewLockRecord> = {},
): ReviewLockRecord => ({
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
  ...overrides,
});

const reopenEvent = (overrides: Partial<ReopenEvent> = {}): ReopenEvent => ({
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
  ...overrides,
});

const auditEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'audit-1',
  kind: 'report_suppressed',
  subreddit: 'alpha',
  targetId: 't3_old',
  targetKind: 'post',
  lockId: 'lock-old',
  actor: 'reviewlock',
  createdAt: '2026-05-24T00:00:00.000Z',
  message: 'Repeat report suppressed because reviewed content was unchanged.',
  data: {},
  demo: false,
  ...overrides,
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

  it('keeps high-volume dashboard data bounded and newest-first', async () => {
    const redis = new InMemoryRedisStore();
    const lockCount = MAX_ACTIVE_LOCKS + 20;
    const reopenCount = MAX_REOPEN_EVENTS + 15;
    const auditCount = MAX_AUDIT_EVENTS + 15;
    const dailyCount = MAX_DAILY_METRICS + 5;

    for (let index = 0; index < lockCount; index += 1) {
      const padded = String(index).padStart(3, '0');
      await saveLock(
        redis,
        lock(`lock-${padded}`, `t3_lock_${padded}`, {
          lockedAt: isoAt('2026-05-24T00:00:00.000Z', index),
          title: `Reviewed post ${padded}`,
        }),
      );
    }

    for (let index = 0; index < reopenCount; index += 1) {
      const padded = String(index).padStart(3, '0');
      await enqueueReopenEvent(
        redis,
        reopenEvent({
          id: `event-${padded}`,
          lockId: `lock-reopen-${padded}`,
          targetId: `t3_reopen_${padded}`,
          createdAt: isoAt('2026-05-24T01:00:00.000Z', index),
        }),
      );
    }

    for (let index = 0; index < auditCount; index += 1) {
      const padded = String(index).padStart(3, '0');
      await appendAuditEvent(
        redis,
        auditEvent({
          id: `audit-${padded}`,
          createdAt: isoAt('2026-05-24T02:00:00.000Z', index),
        }),
      );
    }

    for (let index = 0; index < dailyCount; index += 1) {
      await incrementSuppressedReportMetric(
        redis,
        target(`t3_daily_${index}`),
        `${dateAt('2026-04-01T00:00:00.000Z', index)}T00:00:00.000Z`,
      );
    }

    for (let targetIndex = 1; targetIndex <= 15; targetIndex += 1) {
      for (let reportIndex = 0; reportIndex < targetIndex; reportIndex += 1) {
        await incrementSuppressedReportMetric(
          redis,
          target(`t3_churn_${targetIndex}`),
          isoAt('2026-05-24T03:00:00.000Z', reportIndex),
        );
      }
    }

    const data = await getDashboardData(redis, {
      subreddit: 'alpha',
      now: '2026-05-24T04:00:00.000Z',
    });

    expect(data.activeLocks).toHaveLength(MAX_ACTIVE_LOCKS);
    expect(data.reopenQueue).toHaveLength(MAX_REOPEN_EVENTS);
    expect(data.auditEvents).toHaveLength(MAX_AUDIT_EVENTS);
    expect(data.dailyMetrics).toHaveLength(MAX_DAILY_METRICS);
    expect(data.overview.topChurnTargets).toHaveLength(10);
    expect(data.activeLocks[0]?.id).toBe('lock-069');
    expect(data.reopenQueue[0]?.id).toBe('event-064');
    expect(data.auditEvents[0]?.id).toBe('audit-114');
    expect(data.dailyMetrics[0]?.date).toBe('2026-05-24');
    expect(data.overview.latestReopenEvent?.id).toBe('event-064');
    expect(data.overview.topChurnTargets.map((entry) => entry.targetId).slice(0, 3)).toEqual([
      't3_churn_15',
      't3_churn_14',
      't3_churn_13',
    ]);
  });
});
