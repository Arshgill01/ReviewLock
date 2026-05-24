import type { Clock } from '../adapters/clock';
import type { RedisStore } from '../adapters/redis';
import type { RedditAdapter } from '../adapters/reddit';
import type { ReopenEvent, ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { appendAuditEvent } from './audit';
import { fingerprintTarget } from './fingerprint';
import { key } from './keys';
import { getActiveLockByTarget, incrementLockSuppression, updateLockStatus } from './locks';
import { incrementReopenedMetric, incrementSuppressedReportMetric } from './metrics';
import { ignoreReportsForReviewLock, unignoreReportsForReviewLock } from './moderation';
import { enqueueReopenEvent } from './reopenQueue';
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

const dedupeKey = (input: ReportTriggerInput, now: string): string => {
  const bucket = now.slice(0, 16);
  const id = input.eventId ?? `${input.targetId}:${bucket}`;
  return key(input.subreddit ?? 'unknown', `report:dedupe:${id}`);
};

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

const markDedupe = async (
  redis: RedisStore,
  input: ReportTriggerInput,
  now: string,
): Promise<boolean> => {
  const dedupe = dedupeKey(input, now);

  return redis.setIfNotExists(dedupe, now);
};

export const handleReportTrigger = async (
  deps: ReportTriggerDependencies,
  input: ReportTriggerInput,
): Promise<ReportTriggerResult> => {
  const now = input.reportedAt ?? deps.clock.now();
  const resolution = await resolveTargetById(deps.reddit, input.targetId);
  const subreddit = resolution.target?.subreddit ?? input.subreddit ?? 'unknown';
  const dedupeInput = { ...input, subreddit };

  try {
    return await withTriggerMutex(deps.redis, subreddit, input.targetId, now, async () => {
      if (!(await markDedupe(deps.redis, dedupeInput, now))) {
        return {
          ok: true,
          action: 'duplicate',
          message: 'Duplicate report trigger ignored.',
          warnings: [],
        };
      }

      if (!resolution.ok || !resolution.target) {
        await appendAuditEvent(deps.redis, {
          id: `audit-report-runtime-${Date.parse(now)}-${input.targetId}`,
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

        if (!ignoreResult.ok) {
          await appendAuditEvent(deps.redis, {
            id: `audit-report-ignore-failed-${Date.parse(now)}-${lock.id}`,
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

          return {
            ok: false,
            action: 'runtime_uncertain',
            message: 'ignoreReports failed; reports were not suppressed.',
            warnings: ignoreResult.warnings,
          };
        }

        try {
          await incrementLockSuppression(
            deps.redis,
            lock,
            now,
            input.reportCount ?? resolution.target.reportCount,
          );
          await incrementSuppressedReportMetric(deps.redis, resolution.target, now, lock.demo);
          await appendAuditEvent(deps.redis, {
            id: `audit-report-suppressed-${Date.parse(now)}-${lock.id}`,
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
          await deps.reddit.unignoreReports(resolution.target).catch(() => undefined);

          return {
            ok: false,
            action: 'runtime_uncertain',
            message:
              error instanceof Error
                ? error.message
                : 'Redis failed after ignoreReports; ReviewLock attempted to unignore reports.',
            warnings: ['redis_write_failed'],
          };
        }

        return {
          ok: true,
          action: 'suppress_unchanged',
          message: 'Repeat report suppressed because reviewed content was unchanged.',
          warnings: [],
        };
      }

      if (decision.action === 'reopen_changed') {
        const unignoreResult = await unignoreReportsForReviewLock(deps.reddit, resolution.target);
        const warnings = unignoreResult.warnings;
        const reopenEvent = buildReopenFromReportDecision(lock, resolution.target, now, warnings);
        await updateLockStatus(deps.redis, lock.subreddit, lock.id, 'reopened', {
          reopenedAt: now,
          reopenReason: 'content_changed',
          reopenEventId: reopenEvent.id,
          runtimeWarnings: [...lock.runtimeWarnings, ...warnings],
        });
        await enqueueReopenEvent(deps.redis, reopenEvent);
        await incrementReopenedMetric(deps.redis, resolution.target, now, lock.demo);
        await appendAuditEvent(deps.redis, {
          id: `audit-report-reopened-${Date.parse(now)}-${lock.id}`,
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

        return {
          ok: true,
          action: 'reopen_changed',
          message: 'Lock reopened because reviewed content changed.',
          reopenEvent,
          warnings,
        };
      }

      await appendAuditEvent(deps.redis, {
        id: `audit-report-uncertain-${Date.parse(now)}-${lock.id}`,
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

      return {
        ok: false,
        action: 'runtime_uncertain',
        message: 'Content integrity was uncertain; reports were not suppressed.',
        warnings: ['fingerprint_uncertain'],
      };
    });
  } catch (error) {
    if (isTriggerConcurrencyError(error)) {
      return {
        ok: true,
        action: 'duplicate',
        message:
          'Concurrent report trigger ignored while ReviewLock is already processing this target.',
        warnings: ['concurrent_trigger_in_progress'],
      };
    }

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
