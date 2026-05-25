import type { Clock } from '../adapters/clock';
import type { RedisStore } from '../adapters/redis';
import type { RedditAdapter } from '../adapters/reddit';
import type { ReopenEvent, ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { appendAuditEvent } from './audit';
import { fingerprintTarget } from './fingerprint';
import { key } from './keys';
import {
  getActiveLockByTarget,
  incrementLockSuppression,
  removeActiveLockIndexes,
  updateLock,
  updateLockStatus,
} from './locks';
import {
  decrementSuppressedReportMetric,
  incrementReopenedMetric,
  incrementSuppressedReportMetric,
} from './metrics';
import { ignoreReportsForReviewLock, unignoreReportsForReviewLock } from './moderation';
import { enqueueReopenEvent } from './reopenQueue';
import { recordCapabilityStatus, recordModerationOperationStatus } from './runtimeProof';
import { resolveTargetById } from './targetResolver';
import { isTriggerConcurrencyError, withTriggerMutex } from './triggerMutex';
import { decideReportTriggerAction, type ReportTriggerDecision } from './triggerDecisions';

export interface ReportTriggerInput {
  targetId: string;
  eventId?: string;
  reportedAt?: string;
  reportCount?: number;
  subreddit?: string;
}

export interface ReportTriggerDependencies {
  reddit: RedditAdapter;
  redis: RedisStore;
  clock: Clock;
}

export interface ReportTriggerResult {
  ok: boolean;
  action: ReportTriggerDecision['action'] | 'duplicate';
  message: string;
  reopenEvent?: ReopenEvent;
  warnings: string[];
}

const unknownCountDedupeWindow = (now: string): string => now.slice(0, 16);

const dedupeKey = (input: ReportTriggerInput, now: string): string => {
  const id =
    input.eventId ??
    (Number.isFinite(input.reportCount)
      ? `missing-event:${input.targetId}:count-${input.reportCount}`
      : `missing-event:${input.targetId}:unknown-count:${unknownCountDedupeWindow(now)}`);
  return key(input.subreddit ?? 'unknown', `report:dedupe:${id}`);
};

const safeIdPart = (value: string): string => value.replace(/[^a-zA-Z0-9_]+/g, '-');

const auditIdPart = (input: ReportTriggerInput, now: string): string =>
  safeIdPart(
    input.eventId ?? `${input.targetId}-count-${input.reportCount ?? 'unknown'}-${Date.parse(now)}`,
  );

const reportAuditId = (
  prefix: string,
  input: ReportTriggerInput,
  now: string,
  subjectId: string,
): string => `${prefix}-${Date.parse(now)}-${safeIdPart(subjectId)}-${auditIdPart(input, now)}`;

const REPORT_DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 7;

export const buildReopenFromReportDecision = (
  lock: ReviewLockRecord,
  target: ReviewLockTarget,
  now: string,
  warnings: string[] = [],
): ReopenEvent => ({
  id: `reopen-${lock.id}-${Date.parse(now)}`,
  lockId: lock.id,
  subreddit: lock.subreddit,
  targetId: lock.targetId,
  targetKind: lock.targetKind,
  oldContentHash: lock.contentHash,
  newContentHash: fingerprintTarget(target, now)?.hash ?? 'runtime_uncertain',
  reason: 'content_changed',
  createdAt: now,
  summary: 'Report arrived after the reviewed content changed.',
  runtimeWarnings: warnings,
  demo: lock.demo,
});

const buildRuntimeUncertainReopenFromReportFailure = (
  lock: ReviewLockRecord,
  input: ReportTriggerInput,
  now: string,
  warnings: string[],
): ReopenEvent => ({
  id: `reopen-${lock.id}-runtime-${Date.parse(now)}-${auditIdPart(input, now)}`,
  lockId: lock.id,
  subreddit: lock.subreddit,
  targetId: lock.targetId,
  targetKind: lock.targetKind,
  oldContentHash: lock.contentHash,
  newContentHash: 'runtime_uncertain',
  reason: 'runtime_uncertain',
  createdAt: now,
  summary: 'Report arrived, but ReviewLock could not verify current content.',
  runtimeWarnings: warnings,
  demo: lock.demo,
});

const markDedupe = async (
  redis: RedisStore,
  input: ReportTriggerInput,
  now: string,
): Promise<boolean> => {
  const dedupe = dedupeKey(input, now);
  const created = await redis.setIfNotExists(dedupe, now);

  if (created) {
    await redis.expire(dedupe, REPORT_DEDUPE_TTL_SECONDS);
  }

  return created;
};

const clearDedupe = async (
  redis: RedisStore,
  input: ReportTriggerInput,
  now: string,
): Promise<void> => {
  await redis.del(dedupeKey(input, now)).catch(() => undefined);
};

const markLockReopenedAfterQueue = async (
  redis: RedisStore,
  lock: ReviewLockRecord,
  updates: Partial<ReviewLockRecord>,
): Promise<void> => {
  try {
    await updateLockStatus(redis, lock.subreddit, lock.id, 'reopened', updates);
  } catch (error) {
    await removeActiveLockIndexes(redis, lock).catch(() => undefined);
    throw error;
  }
};

const recordRuntimeProof = async (
  deps: ReportTriggerDependencies,
  subreddit: string,
  result: Awaited<ReturnType<typeof ignoreReportsForReviewLock>>,
  now: string,
): Promise<void> => {
  await recordModerationOperationStatus(deps.redis, subreddit, result, now).catch(() => undefined);
};

const recordReportTriggerProcessed = async (
  deps: ReportTriggerDependencies,
  subreddit: string,
  targetKind: ReviewLockTarget['kind'],
  targetId: string,
  now: string,
): Promise<void> => {
  await recordCapabilityStatus(
    deps.redis,
    subreddit,
    {
      name: targetKind === 'post' ? 'postReportTrigger' : 'commentReportTrigger',
      status: 'verified',
      checkedAt: now,
      evidence: `${targetKind} report trigger processed for ${targetId}`,
      notes: [`${targetKind} report trigger resolved and processed for ${targetId}.`],
    },
    now,
  ).catch(() => undefined);
};

export const handleReportTrigger = async (
  deps: ReportTriggerDependencies,
  input: ReportTriggerInput,
): Promise<ReportTriggerResult> => {
  const now = input.reportedAt ?? deps.clock.now();
  const resolution = await resolveTargetById(deps.reddit, input.targetId);
  const subreddit = resolution.target?.subreddit ?? input.subreddit ?? 'unknown';
  const dedupeInput = { ...input, subreddit };

  if (!(await markDedupe(deps.redis, dedupeInput, now))) {
    return {
      ok: true,
      action: 'duplicate',
      message: 'Duplicate report trigger ignored.',
      warnings: [],
    };
  }

  try {
    return await withTriggerMutex(deps.redis, subreddit, input.targetId, now, async () => {
      if (!resolution.ok || !resolution.target) {
        if (input.subreddit) {
          const lock = await getActiveLockByTarget(deps.redis, input.subreddit, input.targetId);

          if (lock) {
            const warnings = ['target_resolution_failed'];
            const reopenEvent = buildRuntimeUncertainReopenFromReportFailure(
              lock,
              input,
              now,
              warnings,
            );
            await enqueueReopenEvent(deps.redis, reopenEvent);
            await markLockReopenedAfterQueue(deps.redis, lock, {
              reopenedAt: now,
              reopenReason: 'runtime_uncertain',
              reopenEventId: reopenEvent.id,
              runtimeWarnings: [...lock.runtimeWarnings, ...warnings],
            });
            await appendAuditEvent(deps.redis, {
              id: reportAuditId('audit-report-runtime-reopened', input, now, lock.id),
              kind: 'lock_reopened',
              subreddit: lock.subreddit,
              targetId: lock.targetId,
              targetKind: lock.targetKind,
              lockId: lock.id,
              actor: 'reviewlock',
              createdAt: now,
              message:
                'Report trigger reopened the lock because current content could not be loaded.',
              data: { reason: 'target_resolution_failed', unignoreReportsOk: false },
              demo: lock.demo,
            });

            return {
              ok: false,
              action: 'runtime_uncertain',
              message:
                'Current target could not be loaded; lock reopened because content integrity was uncertain.',
              reopenEvent,
              warnings,
            };
          }
        }

        await appendAuditEvent(deps.redis, {
          id: reportAuditId('audit-report-runtime', input, now, input.targetId),
          kind: 'runtime_failure',
          subreddit,
          targetId: input.targetId,
          actor: 'reviewlock',
          createdAt: now,
          message:
            'Report trigger could not resolve current content, so reports were not suppressed.',
          data: { error: resolution.error },
          demo: false,
        });
        await clearDedupe(deps.redis, dedupeInput, now);

        return {
          ok: false,
          action: 'runtime_uncertain',
          message: 'Current target could not be loaded; reports were not suppressed.',
          warnings: ['target_resolution_failed'],
        };
      }

      const lock = await getActiveLockByTarget(
        deps.redis,
        resolution.target.subreddit,
        resolution.target.id,
      );
      const decision = decideReportTriggerAction(lock, resolution.target);

      if (!lock || decision.action === 'no_lock') {
        return {
          ok: true,
          action: 'no_lock',
          message: 'No active ReviewLock lock exists for this report.',
          warnings: [],
        };
      }

      if (decision.action === 'suppress_unchanged') {
        const ignoreResult = await ignoreReportsForReviewLock(deps.reddit, resolution.target);
        await recordRuntimeProof(deps, lock.subreddit, ignoreResult, now);

        if (!ignoreResult.ok) {
          await appendAuditEvent(deps.redis, {
            id: reportAuditId('audit-report-ignore-failed', input, now, lock.id),
            kind: 'runtime_failure',
            subreddit: lock.subreddit,
            targetId: lock.targetId,
            targetKind: lock.targetKind,
            lockId: lock.id,
            actor: 'reviewlock',
            createdAt: now,
            message: 'Report trigger matched the lock, but ignoreReports failed.',
            data: { error: ignoreResult.errorMessage },
            demo: lock.demo,
          });
          await clearDedupe(deps.redis, dedupeInput, now);

          return {
            ok: false,
            action: 'runtime_uncertain',
            message: 'ignoreReports failed; reports were not suppressed.',
            warnings: ignoreResult.warnings,
          };
        }

        let lockCounterIncremented = false;
        let metricsIncremented = false;

        try {
          await incrementLockSuppression(
            deps.redis,
            lock,
            now,
            input.reportCount ?? resolution.target.reportCount,
          );
          lockCounterIncremented = true;
          await incrementSuppressedReportMetric(deps.redis, resolution.target, now, lock.demo);
          metricsIncremented = true;
          await appendAuditEvent(deps.redis, {
            id: reportAuditId('audit-report-suppressed', input, now, lock.id),
            kind: 'report_suppressed',
            subreddit: lock.subreddit,
            targetId: lock.targetId,
            targetKind: lock.targetKind,
            lockId: lock.id,
            actor: 'reviewlock',
            createdAt: now,
            message: 'Repeat report suppressed because reviewed content was unchanged.',
            data: { reportCount: input.reportCount ?? resolution.target.reportCount },
            demo: lock.demo,
          });
        } catch (error) {
          const rollbackResult = await unignoreReportsForReviewLock(deps.reddit, resolution.target);
          await recordRuntimeProof(deps, lock.subreddit, rollbackResult, now);

          if (lockCounterIncremented) {
            await updateLock(deps.redis, lock).catch(() => undefined);
          }

          if (metricsIncremented) {
            await decrementSuppressedReportMetric(deps.redis, resolution.target, now).catch(
              () => undefined,
            );
          }

          if (!rollbackResult.ok) {
            await appendAuditEvent(deps.redis, {
              id: reportAuditId('audit-report-rollback-failed', input, now, lock.id),
              kind: 'runtime_failure',
              subreddit: lock.subreddit,
              targetId: lock.targetId,
              targetKind: lock.targetKind,
              lockId: lock.id,
              actor: 'reviewlock',
              createdAt: now,
              message:
                'Redis failed after report suppression and unignoreReports rollback failed.',
              data: { operation: 'unignoreReports', error: rollbackResult.errorMessage },
              demo: lock.demo,
            }).catch(() => undefined);
          }

          await clearDedupe(deps.redis, dedupeInput, now);

          return {
            ok: false,
            action: 'runtime_uncertain',
            message: rollbackResult.ok
              ? error instanceof Error
                ? error.message
                : 'Redis failed after ignoreReports; ReviewLock attempted to unignore reports.'
              : 'Redis failed after ignoreReports, and unignoreReports rollback failed.',
            warnings: ['redis_write_failed', ...rollbackResult.warnings],
          };
        }

        await recordReportTriggerProcessed(
          deps,
          lock.subreddit,
          lock.targetKind,
          lock.targetId,
          now,
        );

        return {
          ok: true,
          action: 'suppress_unchanged',
          message: 'Repeat report suppressed because reviewed content was unchanged.',
          warnings: [],
        };
      }

      if (decision.action === 'reopen_changed') {
        const unignoreResult = await unignoreReportsForReviewLock(deps.reddit, resolution.target);
        await recordRuntimeProof(deps, lock.subreddit, unignoreResult, now);
        const warnings = unignoreResult.warnings;
        const reopenEvent = buildReopenFromReportDecision(lock, resolution.target, now, warnings);
        await enqueueReopenEvent(deps.redis, reopenEvent);
        await markLockReopenedAfterQueue(deps.redis, lock, {
          reopenedAt: now,
          reopenReason: 'content_changed',
          reopenEventId: reopenEvent.id,
          runtimeWarnings: [...lock.runtimeWarnings, ...warnings],
        });
        await incrementReopenedMetric(deps.redis, resolution.target, now, lock.demo);
        await appendAuditEvent(deps.redis, {
          id: reportAuditId('audit-report-reopened', input, now, lock.id),
          kind: 'lock_reopened',
          subreddit: lock.subreddit,
          targetId: lock.targetId,
          targetKind: lock.targetKind,
          lockId: lock.id,
          actor: 'reviewlock',
          createdAt: now,
          message: 'Report trigger reopened the lock because reviewed content changed.',
          data: { unignoreReportsOk: unignoreResult.ok },
          demo: lock.demo,
        });

        await recordReportTriggerProcessed(
          deps,
          lock.subreddit,
          lock.targetKind,
          lock.targetId,
          now,
        );

        return {
          ok: true,
          action: 'reopen_changed',
          message: 'Lock reopened because reviewed content changed.',
          reopenEvent,
          warnings,
        };
      }

      await appendAuditEvent(deps.redis, {
        id: reportAuditId('audit-report-uncertain', input, now, lock.id),
        kind: 'runtime_failure',
        subreddit: lock.subreddit,
        targetId: lock.targetId,
        targetKind: lock.targetKind,
        lockId: lock.id,
        actor: 'reviewlock',
        createdAt: now,
        message:
          'Report trigger could not verify content integrity, so reports were not suppressed.',
        data: { reason: decision.reason },
        demo: lock.demo,
      });
      await clearDedupe(deps.redis, dedupeInput, now);

      return {
        ok: false,
        action: 'runtime_uncertain',
        message: 'Content integrity was uncertain; reports were not suppressed.',
        warnings: ['fingerprint_uncertain'],
      };
    });
  } catch (error) {
    if (isTriggerConcurrencyError(error)) {
      await clearDedupe(deps.redis, dedupeInput, now);

      return {
        ok: false,
        action: 'runtime_uncertain',
        message:
          'Concurrent report trigger is already processing this target; retry this delivery.',
        warnings: ['concurrent_trigger_in_progress'],
      };
    }

    await clearDedupe(deps.redis, dedupeInput, now);

    return {
      ok: false,
      action: 'runtime_uncertain',
      message:
        error instanceof Error
          ? error.message
          : 'Redis failed while processing the report trigger.',
      warnings: ['redis_write_failed'],
    };
  }
};
