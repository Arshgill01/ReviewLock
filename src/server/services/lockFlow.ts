import type { Clock } from '../adapters/clock';
import type { RedisStore } from '../adapters/redis';
import type { RedditAdapter } from '../adapters/reddit';
import type { LockReasonPreset, ReviewLockRecord } from '../../shared/schema';
import { appendAuditEvent } from './audit';
import { fingerprintTarget } from './fingerprint';
import { removeLock, saveLock, updateLock } from './locks';
import { recordLockCreatedMetric } from './metrics';
import {
  approveForReviewLock,
  ignoreReportsForReviewLock,
  unignoreReportsForReviewLock,
} from './moderation';
import { recordModerationOperationStatus } from './runtimeProof';
import { resolveTargetById } from './targetResolver';

export interface LockReviewInput {
  targetId: string;
  actor: string;
  lockReason: LockReasonPreset;
  customNote?: string;
  expiresAt?: string;
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

  try {
    await saveLock(deps.redis, lock);
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
    await recordLockCreatedMetric(deps.redis, resolution.target, now);
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
};
