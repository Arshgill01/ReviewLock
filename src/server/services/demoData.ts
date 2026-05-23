import { DEMO_SCENARIO } from '../fixtures/demoScenario';
import type { DemoScenario } from '../../shared/schema';

export const loadDemoScenario = (): DemoScenario => DEMO_SCENARIO;

export const summarizeDemoScenario = (scenario: DemoScenario = DEMO_SCENARIO) => ({
  subreddit: scenario.subreddit,
  locks: scenario.locks.length,
  activeLocks: scenario.locks.filter((lock) => lock.status === 'active').length,
  reopenedLocks: scenario.locks.filter((lock) => lock.status === 'reopened').length,
  reopenEvents: scenario.reopenEvents.length,
  reportsSuppressed: scenario.locks.reduce((total, lock) => total + lock.suppressedReportCount, 0),
  runtimeWarnings: scenario.locks.filter((lock) => lock.runtimeWarnings.length > 0).length,
});
