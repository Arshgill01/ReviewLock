import type { Clock } from '../adapters/clock';
import type { RedisStore } from '../adapters/redis';
import type { RedditAdapter } from '../adapters/reddit';
import type { LockReasonPreset, ReopenEvent, ReviewLockRecord } from '../../shared/schema';
import { appendAuditEvent } from './audit';
import { fingerprintTarget } from './fingerprint';
import { keys } from './keys';
import {
  getActiveLockByTarget,
  removeActiveLockIndexes,
  removeLock,
  saveLock,
  updateLock,
  updateLockStatus,
} from './locks';
import {
  decrementLockCreatedMetric,
  incrementReopenedMetric,
  recordLockCreatedMetric,
} from './metrics';
import {
  approveForReviewLock,
  ignoreReportsForReviewLock,
  unignoreReportsForReviewLock,
} from './moderation';
import { enqueueReopenEvent } from './reopenQueue';
import { recordModerationOperationStatus } from './runtimeProof';
import { resolveTargetById } from './targetResolver';

export interface LockReviewInput {
  targetId: string;
  actor: string;
  lockReason: LockReasonPreset;
  customNote?: string;
  expiresAt?: string;
  expectedContentHash?: string;
  expectedFingerprintVersion?: string;
}

export interface LockFlowDependencies {
  reddit: RedditAdapter;
  redis: RedisStore;
  clock: Clock;
}

export interface LockFlowResult {
  ok: boolean;
  lock?: ReviewLockRecord;
  message: string;
  warnings: string[];
}

const LOCK_CREATION_GUARD_SECONDS = 30;

const safeIdPart = (value: string): string => value.replace(/[^a-zA-Z0-9_]+/g, '-');

const recordRuntimeProof = async (
  deps: LockFlowDependencies,
  subreddit: string,
  result: Awaited<ReturnType<typeof approveForReviewLock>>,
  now: string,
): Promise<void> => {
  await recordModerationOperationStatus(deps.redis, subreddit, result, now).catch(() => undefined);
};

export const createLockRecord = (
  input: LockReviewInput,
  target: NonNullable<Awaited<ReturnType<typeof resolveTargetById>>['target']>,
  contentHash: string,
  fingerprintVersion: string,
  lockedAt: string,
  warnings: string[] = [],
): ReviewLockRecord => ({
  id: `lock-${safeIdPart(target.id)}-${Date.parse(lockedAt)}`,
  subreddit: target.subreddit,
  targetId: target.id,
  targetKind: target.kind,
  targetAuthor: target.authorName,
  permalink: target.permalink,
  title: target.title,
  contentPreview: (target.body ?? target.title ?? target.url ?? '').slice(0, 240),
  contentHash,
  fingerprintVersion,
  lockedBy: input.actor,
  lockedAt,
  lockReason: input.lockReason,
  customNote: input.customNote,
  expiresAt: input.expiresAt,
  status: 'active',
  lastKnownEdited: target.edited,
  lastReportCount: target.reportCount,
  suppressedReportCount: 0,
  runtimeWarnings: warnings,
  demo: false,
});

const buildReopenEventForStaleLock = (
  lock: ReviewLockRecord,
  newContentHash: string,
  now: string,
): ReopenEvent => ({
  id: `reopen-${lock.id}-lock-review-${Date.parse(now)}`,
  lockId: lock.id,
  subreddit: lock.subreddit,
  targetId: lock.targetId,
  targetKind: lock.targetKind,
  oldContentHash: lock.contentHash,
  newContentHash,
  reason: 'content_changed',
  createdAt: now,
  summary: 'Lock review found that the previously reviewed content changed.',
  runtimeWarnings: [],
  demo: lock.demo,
});

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

const removeQueuedReopenEventIfLockStillActive = async (
  redis: RedisStore,
  lock: ReviewLockRecord,
  event: ReopenEvent,
): Promise<void> => {
  const activeLock = await getActiveLockByTarget(redis, lock.subreddit, lock.targetId).catch(
    () => undefined,
  );

  if (activeLock?.id !== lock.id) {
    return;
  }

  await Promise.all([
    redis.del(keys.reopenEvent(event.subreddit, event.id)).catch(() => undefined),
    redis.zRem(keys.reopenQueue(event.subreddit), event.id).catch(() => undefined),
  ]);
};

export const lockReviewedContent = async (
  deps: LockFlowDependencies,
  input: LockReviewInput,
): Promise<LockFlowResult> => {
  const now = deps.clock.now();
  const resolution = await resolveTargetById(deps.reddit, input.targetId);

  if (!resolution.ok || !resolution.target) {
    return {
      ok: false,
      message: resolution.error ?? 'Target could not be resolved.',
      warnings: [],
    };
  }

  const fingerprint = fingerprintTarget(resolution.target, now);

  if (!fingerprint) {
    return {
      ok: false,
      message: 'ReviewLock could not fingerprint the current content, so reports were not locked.',
      warnings: ['fingerprint_uncertain'],
    };
  }

  if (
    input.expectedContentHash &&
    input.expectedFingerprintVersion &&
    (input.expectedContentHash !== fingerprint.hash ||
      input.expectedFingerprintVersion !== fingerprint.version)
  ) {
    return {
      ok: false,
      message:
        'Reviewed content changed after the form opened. Reopen ReviewLock and review the updated content before locking.',
      warnings: ['stale_review_confirmation'],
    };
  }

  const guardKey = keys.targetLockCreation(resolution.target.subreddit, resolution.target.id);
  const guardToken = `${now}:${resolution.target.id}:${Date.now()}:${Math.random()}`;
  const guardAcquired = await deps.redis.setIfNotExists(
    guardKey,
    guardToken,
  );

  if (!guardAcquired) {
    const inFlightLock = await getActiveLockByTarget(
      deps.redis,
      resolution.target.subreddit,
      resolution.target.id,
    );

    if (
      inFlightLock &&
      inFlightLock.contentHash === fingerprint.hash &&
      inFlightLock.fingerprintVersion === fingerprint.version
    ) {
      return {
        ok: true,
        lock: inFlightLock,
        message: 'Reviewed content is already locked until it changes.',
        warnings: inFlightLock.runtimeWarnings,
      };
    }

    return {
      ok: false,
      message:
        'Another ReviewLock lock is already being created for this content. Try again in a moment.',
      warnings: ['lock_creation_in_progress'],
    };
  }

  await deps.redis.expire(guardKey, LOCK_CREATION_GUARD_SECONDS).catch(() => undefined);

  try {
    const existingLock = await getActiveLockByTarget(
      deps.redis,
      resolution.target.subreddit,
      resolution.target.id,
    );

    if (existingLock) {
      if (
        existingLock.contentHash === fingerprint.hash &&
        existingLock.fingerprintVersion === fingerprint.version
      ) {
        return {
          ok: true,
          lock: existingLock,
          message: 'Reviewed content is already locked until it changes.',
          warnings: existingLock.runtimeWarnings,
        };
      }

      const staleUnignoreResult = await unignoreReportsForReviewLock(deps.reddit, resolution.target);
      await recordRuntimeProof(deps, existingLock.subreddit, staleUnignoreResult, now);

      if (!staleUnignoreResult.ok) {
        const updatedLock = await updateLock(deps.redis, {
          ...existingLock,
          lastKnownEdited: resolution.target.edited,
          lastReportCount: resolution.target.reportCount,
          runtimeWarnings: [...existingLock.runtimeWarnings, ...staleUnignoreResult.warnings],
        });
        await appendAuditEvent(deps.redis, {
          id: `audit-${existingLock.id}-stale-unignore-failed-${Date.parse(now)}`,
          kind: 'runtime_failure',
          subreddit: existingLock.subreddit,
          targetId: existingLock.targetId,
          targetKind: existingLock.targetKind,
          lockId: existingLock.id,
          actor: input.actor,
          createdAt: now,
          message:
            'Lock review found changed content, but unignoreReports failed; lock remains active for retry.',
          data: {
            operation: 'unignoreReports',
            error: staleUnignoreResult.errorMessage,
            source: 'stale_lock_relock',
          },
          demo: existingLock.demo,
        });

        return {
          ok: false,
          lock: updatedLock,
          message:
            'ReviewLock found changed content but could not return reports to normal handling; the stale lock remains active for retry.',
          warnings: staleUnignoreResult.warnings,
        };
      }

      const reopenEvent = {
        ...buildReopenEventForStaleLock(existingLock, fingerprint.hash, now),
        runtimeWarnings: staleUnignoreResult.warnings,
      };
      let reopenEventQueued = false;
      try {
        await enqueueReopenEvent(deps.redis, reopenEvent);
        reopenEventQueued = true;
        await markLockReopenedAfterQueue(deps.redis, existingLock, {
          reopenedAt: now,
          reopenReason: 'content_changed',
          reopenEventId: reopenEvent.id,
          runtimeWarnings: [...existingLock.runtimeWarnings, ...staleUnignoreResult.warnings],
        });
        await incrementReopenedMetric(deps.redis, resolution.target, now, existingLock.demo);
        await appendAuditEvent(deps.redis, {
          id: `audit-${existingLock.id}-lock-review-reopened-${Date.parse(now)}`,
          kind: 'lock_reopened',
          subreddit: existingLock.subreddit,
          targetId: existingLock.targetId,
          targetKind: existingLock.targetKind,
          lockId: existingLock.id,
          actor: input.actor,
          createdAt: now,
          message: 'Lock review reopened a stale lock because reviewed content changed.',
          data: {
            reason: 'content_changed',
            source: 'lock_review',
            unignoreReportsOk: staleUnignoreResult.ok,
          },
          demo: existingLock.demo,
        });
      } catch (error) {
        if (reopenEventQueued) {
          await removeQueuedReopenEventIfLockStillActive(
            deps.redis,
            existingLock,
            reopenEvent,
          );
        }

        await appendAuditEvent(deps.redis, {
          id: `audit-${existingLock.id}-stale-relock-failed-${Date.parse(now)}`,
          kind: 'runtime_failure',
          subreddit: existingLock.subreddit,
          targetId: existingLock.targetId,
          targetKind: existingLock.targetKind,
          lockId: existingLock.id,
          actor: input.actor,
          createdAt: now,
          message:
            'Lock review found changed content but could not complete stale relock replacement.',
          data: {
            operation: 'staleRelockReopen',
            error: error instanceof Error ? error.message : 'unknown error',
          },
          demo: existingLock.demo,
        }).catch(() => undefined);

        return {
          ok: false,
          lock: {
            ...existingLock,
            runtimeWarnings: [
              ...existingLock.runtimeWarnings,
              ...staleUnignoreResult.warnings,
              'redis_write_failed',
            ],
          },
          message:
            'ReviewLock reopened the stale lock or attempted to, but could not durably create the replacement lock. Reopen the menu and try again.',
          warnings: [...staleUnignoreResult.warnings, 'redis_write_failed'],
        };
      }
    }

    const approveResult = await approveForReviewLock(deps.reddit, resolution.target);
    const ignoreResult = await ignoreReportsForReviewLock(deps.reddit, resolution.target);
    const warnings = [...approveResult.warnings, ...ignoreResult.warnings];

    if (!ignoreResult.ok) {
      const failedLock = createLockRecord(
        input,
        resolution.target,
        fingerprint.hash,
        fingerprint.version,
        now,
        warnings,
      );
      failedLock.status = 'failed';
      await updateLock(deps.redis, failedLock);
      await appendAuditEvent(deps.redis, {
        id: `audit-${failedLock.id}-failure`,
        kind: 'runtime_failure',
        subreddit: failedLock.subreddit,
        targetId: failedLock.targetId,
        targetKind: failedLock.targetKind,
        lockId: failedLock.id,
        actor: input.actor,
        createdAt: now,
        message: 'ReviewLock could not ignore reports, so the review was not locked.',
        data: { operation: 'ignoreReports', error: ignoreResult.errorMessage },
        demo: false,
      });
      await recordRuntimeProof(deps, failedLock.subreddit, approveResult, now);
      await recordRuntimeProof(deps, failedLock.subreddit, ignoreResult, now);

      return {
        ok: false,
        lock: failedLock,
        message: 'Reports were not locked because ignoreReports failed.',
        warnings,
      };
    }

    const lock = createLockRecord(
      input,
      resolution.target,
      fingerprint.hash,
      fingerprint.version,
      now,
      warnings,
    );

    let lockCreatedMetricRecorded = false;

    try {
      await saveLock(deps.redis, lock);
      await recordLockCreatedMetric(deps.redis, resolution.target, now);
      lockCreatedMetricRecorded = true;
      await appendAuditEvent(deps.redis, {
        id: `audit-${lock.id}-created`,
        kind: 'lock_created',
        subreddit: lock.subreddit,
        targetId: lock.targetId,
        targetKind: lock.targetKind,
        lockId: lock.id,
        actor: input.actor,
        createdAt: now,
        message: 'Reviewed content locked until it changes.',
        data: { lockReason: input.lockReason, reportCount: resolution.target.reportCount },
        demo: false,
      });
      await recordRuntimeProof(deps, lock.subreddit, approveResult, now);
      await recordRuntimeProof(deps, lock.subreddit, ignoreResult, now);

      return {
        ok: true,
        lock,
        message: 'Reviewed content locked until it changes.',
        warnings,
      };
    } catch (error) {
      const rollbackResult = await unignoreReportsForReviewLock(deps.reddit, resolution.target);
      await recordRuntimeProof(deps, lock.subreddit, rollbackResult, now);

      if (rollbackResult.ok) {
        await removeLock(deps.redis, lock).catch(() => undefined);
        if (lockCreatedMetricRecorded) {
          await decrementLockCreatedMetric(deps.redis, resolution.target, now).catch(
            () => undefined,
          );
        }
      } else {
        const failedLock: ReviewLockRecord = {
          ...lock,
          status: 'failed',
          runtimeWarnings: [...warnings, 'redis_write_failed', ...rollbackResult.warnings],
        };

        await updateLock(deps.redis, failedLock).catch(() => undefined);
        await appendAuditEvent(deps.redis, {
          id: `audit-${lock.id}-rollback-failure`,
          kind: 'runtime_failure',
          subreddit: lock.subreddit,
          targetId: lock.targetId,
          targetKind: lock.targetKind,
          lockId: lock.id,
          actor: input.actor,
          createdAt: now,
          message:
            'ReviewLock could not persist the lock and could not unignore reports during rollback.',
          data: { operation: 'unignoreReports', error: rollbackResult.errorMessage },
          demo: false,
        }).catch(() => undefined);
      }

      return {
        ok: false,
        lock,
        message: rollbackResult.ok
          ? error instanceof Error
            ? error.message
            : 'ReviewLock could not persist the lock.'
          : 'ReviewLock could not persist the lock, and unignoreReports rollback failed.',
        warnings: [...warnings, 'redis_write_failed', ...rollbackResult.warnings],
      };
    }
  } finally {
    const currentToken = await deps.redis.get(guardKey).catch(() => undefined);

    if (currentToken === guardToken) {
      await deps.redis.del(guardKey).catch(() => undefined);
    }
  }
};
