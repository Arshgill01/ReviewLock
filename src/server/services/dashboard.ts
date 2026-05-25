import {
  MAX_ACTIVE_LOCKS,
  MAX_AUDIT_EVENTS,
  MAX_DAILY_METRICS,
  MAX_REOPEN_EVENTS,
} from '../../shared/constants';
import type {
  AuditEvent,
  DashboardOverview,
  DailyMetrics,
  ReopenEvent,
  ReviewLockRecord,
  RuntimeProofStatus,
  TargetMetrics,
} from '../../shared/schema';
import type { RedisStore } from '../adapters/redis';
import { listAuditEvents } from './audit';
import { countActiveLocks, listActiveLocks } from './locks';
import { listDailyMetrics, listTopTargetMetrics, sumDailyMetrics } from './metrics';
import { listOpenReopenEvents } from './reopenQueue';
import { loadRuntimeProofStatus } from './runtimeProof';

export interface DashboardDataOptions {
  subreddit: string;
  demo?: boolean;
  now?: string;
  limit?: number;
}

export const aggregateDashboardOverview = (
  activeLocks: ReviewLockRecord[],
  reopenQueue: ReopenEvent[],
  metricTotals: { reportsSuppressed: number; locksReopened: number },
  topChurnTargets: TargetMetrics[],
  runtimeStatus: RuntimeProofStatus,
  activeLockCount = activeLocks.length,
): DashboardOverview => ({
  activeLockCount,
  reportsSuppressed: metricTotals.reportsSuppressed,
  reopenedAfterEditCount: Math.max(metricTotals.locksReopened, reopenQueue.length),
  latestReopenEvent: reopenQueue[0],
  topChurnTargets,
  runtimeStatus,
});

export const getDashboardData = async (
  redis: RedisStore,
  options: DashboardDataOptions,
): Promise<{
  generatedAt: string;
  demo: boolean;
  overview: DashboardOverview;
  activeLocks: ReviewLockRecord[];
  reopenQueue: ReopenEvent[];
  auditEvents: AuditEvent[];
  dailyMetrics: DailyMetrics[];
}> => {
  const limit = options.limit ?? MAX_ACTIVE_LOCKS;
  const [
    activeLocks,
    activeLockCount,
    reopenQueue,
    auditEvents,
    dailyMetrics,
    metricTotals,
    topChurnTargets,
    runtimeStatus,
  ] = await Promise.all([
    listActiveLocks(redis, options.subreddit, limit),
    countActiveLocks(redis, options.subreddit),
    listOpenReopenEvents(redis, options.subreddit, MAX_REOPEN_EVENTS),
    listAuditEvents(redis, options.subreddit, MAX_AUDIT_EVENTS),
    listDailyMetrics(redis, options.subreddit, MAX_DAILY_METRICS),
    sumDailyMetrics(redis, options.subreddit),
    listTopTargetMetrics(redis, options.subreddit, 10),
    loadRuntimeProofStatus(redis, options.subreddit, options.now),
  ]);

  return {
    generatedAt: options.now ?? new Date().toISOString(),
    demo: options.demo ?? false,
    overview: aggregateDashboardOverview(
      activeLocks,
      reopenQueue,
      metricTotals,
      topChurnTargets,
      runtimeStatus,
      activeLockCount,
    ),
    activeLocks,
    reopenQueue,
    auditEvents,
    dailyMetrics,
  };
};

export const getActiveLocksData = async (
  redis: RedisStore,
  options: DashboardDataOptions,
): Promise<ReviewLockRecord[]> =>
  listActiveLocks(redis, options.subreddit, options.limit ?? MAX_ACTIVE_LOCKS);

export const getReopenQueueData = async (
  redis: RedisStore,
  options: DashboardDataOptions,
): Promise<ReopenEvent[]> =>
  listOpenReopenEvents(redis, options.subreddit, options.limit ?? MAX_REOPEN_EVENTS);

export const getAuditLogData = async (
  redis: RedisStore,
  options: DashboardDataOptions,
): Promise<AuditEvent[]> =>
  listAuditEvents(redis, options.subreddit, options.limit ?? MAX_AUDIT_EVENTS);

export const getDailyMetricsData = async (
  redis: RedisStore,
  options: DashboardDataOptions,
): Promise<DailyMetrics[]> =>
  listDailyMetrics(redis, options.subreddit, options.limit ?? MAX_DAILY_METRICS);
