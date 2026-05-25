import { describe, expect, it } from 'vitest';
import {
  isAuditEventKind,
  isLockStatus,
  isReopenReason,
  isReviewLockConfig,
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
});
