import { describe, expect, it } from 'vitest';
import { loadDemoScenario, summarizeDemoScenario } from './demoData';

describe('demo data helpers', () => {
  it('summarizes deterministic four-beat scenario data', () => {
    const scenario = loadDemoScenario();
    const summary = summarizeDemoScenario(scenario);

    expect(summary.locks).toBe(12);
    expect(summary.reopenedLocks).toBeGreaterThanOrEqual(3);
    expect(summary.reportsSuppressed).toBeGreaterThanOrEqual(5);
    expect(summary.runtimeWarnings).toBeGreaterThanOrEqual(1);
  });
});
