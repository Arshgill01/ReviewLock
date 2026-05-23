import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from './demoScenario';

describe('demo scenario fixture', () => {
  it('contains enough deterministic records for the dashboard story', () => {
    expect(DEMO_SCENARIO.locks).toHaveLength(12);
    expect(DEMO_SCENARIO.locks.every((lock) => lock.demo)).toBe(true);
    expect(DEMO_SCENARIO.reopenEvents).toHaveLength(3);
    expect(DEMO_SCENARIO.auditEvents.some((event) => event.kind === 'runtime_failure')).toBe(true);
  });

  it('contains post and comment examples', () => {
    const kinds = new Set(DEMO_SCENARIO.locks.map((lock) => lock.targetKind));

    expect(kinds.has('post')).toBe(true);
    expect(kinds.has('comment')).toBe(true);
  });

  it('includes at least five suppressed report events by count', () => {
    const suppressed = DEMO_SCENARIO.locks.reduce(
      (total, lock) => total + lock.suppressedReportCount,
      0,
    );

    expect(suppressed).toBeGreaterThanOrEqual(5);
  });

  it('shows the four-beat demo story', () => {
    const beats = new Set(DEMO_SCENARIO.auditEvents.map((event) => event.data.beat));

    expect(beats.has('lock')).toBe(true);
    expect(beats.has('reports_suppressed')).toBe(true);
    expect(beats.has('edit')).toBe(true);
    expect(beats.has('reopen')).toBe(true);
  });
});
