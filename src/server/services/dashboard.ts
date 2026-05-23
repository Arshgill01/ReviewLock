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
import { listActiveLocks } from './locks';
import { listDailyMetrics, listTopTargetMetrics } from './metrics';
import { listOpenReopenEvents } from './reopenQueue';
import { loadRuntimeProofStatus } from './runtimeProof';

export interface DashboardDataOptions {
  subreddit: string;
  demo?: boolean;
  now?: string;
  limit?: number;
}

const totalSuppressed = (metrics: DailyMetrics[]): number =>
  metrics.reduce((total, metric) => total + metric.reportsSuppressed, 0);

const totalReopened = (metrics: DailyMetrics[], reopenQueue: ReopenEvent[]): number => {
  const metricsTotal = metrics.reduce((total, metric) => total + metric.locksReopened, 0);
  return Math.max(metricsTotal, reopenQueue.length);
};

export const aggregateDashboardOverview = (
  activeLocks: ReviewLockRecord[],
  reopenQueue: ReopenEvent[],
  dailyMetrics: DailyMetrics[],
  topChurnTargets: TargetMetrics[],
  runtimeStatus: RuntimeProofStatus,
): DashboardOverview => ({
  activeLockCount: activeLocks.length,
  reportsSuppressed: totalSuppressed(dailyMetrics),
  reopenedAfterEditCount: totalReopened(dailyMetrics, reopenQueue),
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
  const [activeLocks, reopenQueue, auditEvents, dailyMetrics, topChurnTargets, runtimeStatus] =
    await Promise.all([
      listActiveLocks(redis, options.subreddit, limit),
      listOpenReopenEvents(redis, options.subreddit, MAX_REOPEN_EVENTS),
      listAuditEvents(redis, options.subreddit, MAX_AUDIT_EVENTS),
      listDailyMetrics(redis, options.subreddit, MAX_DAILY_METRICS),
      listTopTargetMetrics(redis, options.subreddit, 10),
      loadRuntimeProofStatus(redis, options.subreddit, options.now),
    ]);

  return {
    generatedAt: options.now ?? new Date().toISOString(),
    demo: options.demo ?? false,
    overview: aggregateDashboardOverview(
      activeLocks,
      reopenQueue,
      dailyMetrics,
      topChurnTargets,
      runtimeStatus,
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
