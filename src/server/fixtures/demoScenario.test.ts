import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from './demoScenario';

describe('demo scenario fixture', () => {
  it('contains enough deterministic records for the dashboard story', () => {
    expect(DEMO_SCENARIO.locks).toHaveLength(18);
    expect(DEMO_SCENARIO.locks.every((lock) => lock.demo)).toBe(true);
    expect(DEMO_SCENARIO.locks.filter((lock) => lock.status === 'active')).toHaveLength(12);
    expect(DEMO_SCENARIO.locks.filter((lock) => lock.status === 'reopened')).toHaveLength(5);
    expect(DEMO_SCENARIO.locks.filter((lock) => lock.status === 'failed')).toHaveLength(1);
    expect(DEMO_SCENARIO.reopenEvents).toHaveLength(5);
    expect(DEMO_SCENARIO.auditEvents.some((event) => event.kind === 'runtime_failure')).toBe(true);
  });

  it('contains post and comment examples', () => {
    const kinds = new Set(DEMO_SCENARIO.locks.map((lock) => lock.targetKind));

    expect(kinds.has('post')).toBe(true);
    expect(kinds.has('comment')).toBe(true);
  });

  it('includes a convincing amount of report churn by count', () => {
    const suppressed = DEMO_SCENARIO.locks.reduce(
      (total, lock) => total + lock.suppressedReportCount,
      0,
    );

    expect(suppressed).toBeGreaterThanOrEqual(40);
  });

  it('covers the material reopen reasons moderators need to see', () => {
    const reasons = new Set(DEMO_SCENARIO.reopenEvents.map((event) => event.reason));

    expect(reasons.has('content_changed')).toBe(true);
    expect(reasons.has('flair_changed')).toBe(true);
    expect(reasons.has('nsfw_changed')).toBe(true);
    expect(reasons.has('spoiler_changed')).toBe(true);
  });

  it('keeps aggregate demo metrics aligned with the seeded ledger', () => {
    const lockSuppressed = DEMO_SCENARIO.locks.reduce(
      (total, lock) => total + lock.suppressedReportCount,
      0,
    );
    const dailySuppressed = DEMO_SCENARIO.dailyMetrics.reduce(
      (total, metrics) => total + metrics.reportsSuppressed,
      0,
    );
    const locksCreated = DEMO_SCENARIO.dailyMetrics.reduce(
      (total, metrics) => total + metrics.locksCreated,
      0,
    );
    const locksReopened = DEMO_SCENARIO.dailyMetrics.reduce(
      (total, metrics) => total + metrics.locksReopened,
      0,
    );

    expect(DEMO_SCENARIO.dailyMetrics).toHaveLength(3);
    expect(DEMO_SCENARIO.targetMetrics).toHaveLength(DEMO_SCENARIO.locks.length);
    expect(dailySuppressed).toBe(lockSuppressed);
    expect(locksCreated).toBe(DEMO_SCENARIO.locks.length);
    expect(locksReopened).toBe(DEMO_SCENARIO.reopenEvents.length);
  });

  it('shows the four-beat demo story', () => {
    const beats = new Set(DEMO_SCENARIO.auditEvents.map((event) => event.data.beat));

    expect(beats.has('lock')).toBe(true);
    expect(beats.has('reports_suppressed')).toBe(true);
    expect(beats.has('edit')).toBe(true);
    expect(beats.has('reopen')).toBe(true);
  });
});
