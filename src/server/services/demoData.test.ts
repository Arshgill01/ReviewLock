import { describe, expect, it } from 'vitest';
import { loadDemoScenario, summarizeDemoScenario } from './demoData';

describe('demo data helpers', () => {
  it('summarizes deterministic four-beat scenario data', () => {
    const scenario = loadDemoScenario();
    const summary = summarizeDemoScenario(scenario);

    expect(summary.locks).toBe(18);
    expect(summary.activeLocks).toBe(12);
    expect(summary.reopenedLocks).toBe(5);
    expect(summary.reopenEvents).toBe(5);
    expect(summary.reportsSuppressed).toBeGreaterThanOrEqual(40);
    expect(summary.runtimeWarnings).toBeGreaterThanOrEqual(1);
  });
});
