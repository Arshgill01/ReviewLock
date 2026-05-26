import { describe, expect, it } from 'vitest';
import { key, keys } from './keys';

describe('reviewlock redis keys', () => {
  it('namespaces every key by subreddit', () => {
    expect(key('modteam', 'locks:active')).toBe('reviewlock:modteam:locks:active');
    expect(keys.lock('modteam', 'lock-1')).toBe('reviewlock:modteam:lock:lock-1');
    expect(keys.targetLock('modteam', 't3_abc')).toBe('reviewlock:modteam:target:t3_abc:lock');
  });

  it('keeps every declared key under reviewlock:{subreddit}:', () => {
    const subreddit = 'alpha';
    const generatedKeys = [
      keys.config(subreddit),
      keys.activeLocks(subreddit),
      keys.activeLocksByTarget(subreddit),
      keys.lock(subreddit, 'lock-1'),
      keys.targetLock(subreddit, 't3_abc'),
      keys.reopenQueue(subreddit),
      keys.reopenEvent(subreddit, 'reopen-1'),
      keys.audit(subreddit),
      keys.auditEvent(subreddit, 'audit-1'),
      keys.metricsDailyIndex(subreddit),
      keys.metricsDaily(subreddit, '2026-05-24'),
      keys.metricsTargetIndex(subreddit),
      keys.metricsTarget(subreddit, 't3_abc'),
      keys.runtime(subreddit),
      keys.demo(subreddit),
      keys.dashboardPost(subreddit),
      keys.dashboardPostCreation(subreddit),
    ];

    expect(generatedKeys).toHaveLength(17);
    for (const generatedKey of generatedKeys) {
      expect(generatedKey).toMatch(/^reviewlock:alpha:/);
    }
  });

  it('keeps subreddits isolated', () => {
    expect(keys.config('alpha')).not.toBe(keys.config('beta'));
  });
});
