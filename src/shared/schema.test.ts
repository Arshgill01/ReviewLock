import { describe, expect, it } from 'vitest';
import {
  isAuditEventKind,
  isDailyMetrics,
  isLockStatus,
  isReopenReason,
  isReviewLockRecord,
  isReviewLockConfig,
  isTargetMetrics,
  isTargetKind,
} from './schema';

describe('domain validators', () => {
  it('accepts valid target kinds and rejects unknown values', () => {
    expect(isTargetKind('post')).toBe(true);
    expect(isTargetKind('comment')).toBe(true);
    expect(isTargetKind('message')).toBe(false);
  });

  it('validates lock statuses', () => {
    expect(isLockStatus('active')).toBe(true);
    expect(isLockStatus('reopened')).toBe(true);
    expect(isLockStatus('ignored')).toBe(false);
  });

  it('validates reopen reasons', () => {
    expect(isReopenReason('content_changed')).toBe(true);
    expect(isReopenReason('runtime_uncertain')).toBe(true);
    expect(isReopenReason('report_arrived')).toBe(false);
  });

  it('validates audit event kinds', () => {
    expect(isAuditEventKind('report_suppressed')).toBe(true);
    expect(isAuditEventKind('demo_reset')).toBe(true);
    expect(isAuditEventKind('reporter_saved')).toBe(false);
  });

  it('validates ReviewLock config shape', () => {
    expect(
      isReviewLockConfig({
        subreddit: 'alpha',
        lockExpiryDays: 30,
        demoModeEnabled: false,
        reasonPresets: ['reviewed_policy_compliant', 'repeat_report_churn'],
        updatedAt: '2026-05-24T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      isReviewLockConfig({
        subreddit: 'alpha',
        lockExpiryDays: 0,
        demoModeEnabled: false,
        reasonPresets: ['reviewed_policy_compliant'],
        updatedAt: '2026-05-24T00:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      isReviewLockConfig({
        subreddit: 'alpha',
        lockExpiryDays: 30,
        demoModeEnabled: false,
        reasonPresets: ['unexpected_reason'],
        updatedAt: '2026-05-24T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('rejects negative persisted counters', () => {
    expect(
      isDailyMetrics({
        subreddit: 'alpha',
        date: '2026-05-24',
        locksCreated: 0,
        reportsSuppressed: -1,
        locksReopened: 0,
        demo: false,
      }),
    ).toBe(false);
    expect(
      isTargetMetrics({
        subreddit: 'alpha',
        targetId: 't3_post',
        targetKind: 'post',
        reportsSuppressed: 0,
        locksCreated: 1.5,
        locksReopened: 0,
        lastActivityAt: '2026-05-24T00:00:00.000Z',
        demo: false,
      }),
    ).toBe(false);
    expect(
      isReviewLockRecord({
        id: 'lock-1',
        subreddit: 'alpha',
        targetId: 't3_post',
        targetKind: 'post',
        targetAuthor: 'u_author',
        permalink: '/r/alpha/comments/post',
        contentPreview: 'reviewed',
        contentHash: 'hash',
        fingerprintVersion: 'content-v1',
        lockedBy: 'mod',
        lockedAt: '2026-05-24T00:00:00.000Z',
        lockReason: 'reviewed_policy_compliant',
        status: 'active',
        lastKnownEdited: false,
        lastReportCount: -1,
        suppressedReportCount: 0,
        runtimeWarnings: [],
        demo: false,
      }),
    ).toBe(false);
  });
});
