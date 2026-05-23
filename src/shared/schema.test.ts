import { describe, expect, it } from 'vitest';
import {
  isAuditEventKind,
  isLockStatus,
  isReopenReason,
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
});
