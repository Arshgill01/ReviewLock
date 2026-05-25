export const key = (subreddit: string, suffix: string): string => `reviewlock:${subreddit}:${suffix}`;

export const keys = {
  config: (subreddit: string) => key(subreddit, 'config'),
  activeLocks: (subreddit: string) => key(subreddit, 'locks:active'),
  activeLocksByTarget: (subreddit: string) => key(subreddit, 'locks:activeByTarget'),
  lock: (subreddit: string, lockId: string) => key(subreddit, `lock:${lockId}`),
  targetLock: (subreddit: string, targetId: string) => key(subreddit, `target:${targetId}:lock`),
  targetLockCreation: (subreddit: string, targetId: string) =>
    key(subreddit, `target:${targetId}:lock:create`),
  reopenQueue: (subreddit: string) => key(subreddit, 'reopen:queue'),
  reopenEvent: (subreddit: string, eventId: string) => key(subreddit, `reopen:${eventId}`),
  audit: (subreddit: string) => key(subreddit, 'audit'),
  auditEvent: (subreddit: string, eventId: string) => key(subreddit, `audit:${eventId}`),
  metricsDailyIndex: (subreddit: string) => key(subreddit, 'metrics:daily'),
  metricsDaily: (subreddit: string, date: string) => key(subreddit, `metrics:daily:${date}`),
  metricsMutation: (subreddit: string) => key(subreddit, 'metrics:mutation'),
  metricsTargetIndex: (subreddit: string) => key(subreddit, 'metrics:targets'),
  metricsTarget: (subreddit: string, targetId: string) => key(subreddit, `metrics:target:${targetId}`),
  runtime: (subreddit: string) => key(subreddit, 'runtime'),
  demo: (subreddit: string) => key(subreddit, 'demo'),
};
