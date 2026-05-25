import type { Clock } from '../adapters/clock';
import type { RedisStore } from '../adapters/redis';
import type { RedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord } from '../../shared/schema';
import { appendAuditEvent } from './audit';
import {
  getActiveLockByTarget,
  removeActiveLockIndexes,
  updateLock,
  updateLockStatus,
} from './locks';
import { unignoreReportsForReviewLock } from './moderation';
import { recordModerationOperationStatus } from './runtimeProof';
import { resolveTargetById } from './targetResolver';

export interface UnlockReviewInput {
  targetId: string;
  lockId?: string;
  expectedSubreddit?: string;
  actor: string;
}

export interface UnlockFlowDependencies {
  reddit: RedditAdapter;
  redis: RedisStore;
  clock: Clock;
}

export interface UnlockFlowResult {
  ok: boolean;
  lock?: ReviewLockRecord;
  message: string;
  warnings: string[];
}

export const unlockReviewedContent = async (
  deps: UnlockFlowDependencies,
  input: UnlockReviewInput,
): Promise<UnlockFlowResult> => {
  const resolution = await resolveTargetById(deps.reddit, input.targetId);

  if (!resolution.ok || !resolution.target) {
    return {
      ok: false,
      message: resolution.error ?? 'Target could not be resolved.',
      warnings: [],
    };
  }

  if (input.expectedSubreddit && input.expectedSubreddit !== resolution.target.subreddit) {
    return {
      ok: false,
      message: 'ReviewLock target is outside the current subreddit context.',
      warnings: ['subreddit_scope_mismatch'],
    };
  }

  const activeLock = await getActiveLockByTarget(
    deps.redis,
    resolution.target.subreddit,
    resolution.target.id,
  );

  if (!activeLock) {
    return {
      ok: true,
      message: 'No active ReviewLock lock was found for this content.',
      warnings: [],
    };
  }

  if (input.lockId && input.lockId !== activeLock.id) {
    return {
      ok: false,
      lock: activeLock,
      message:
        'ReviewLock lock changed before unlock could be confirmed. Refresh and confirm again.',
      warnings: ['stale_unlock_confirmation'],
    };
  }

  const now = deps.clock.now();
  const unignoreResult = await unignoreReportsForReviewLock(deps.reddit, resolution.target);
  await recordModerationOperationStatus(
    deps.redis,
    activeLock.subreddit,
    unignoreResult,
    now,
  ).catch(() => undefined);

  if (!unignoreResult.ok) {
    const warnedLock = await updateLock(deps.redis, {
      ...activeLock,
      runtimeWarnings: [...activeLock.runtimeWarnings, ...unignoreResult.warnings],
    });

    await appendAuditEvent(deps.redis, {
      id: `audit-${activeLock.id}-unignore-failed-${Date.parse(now)}`,
      kind: 'runtime_failure',
      subreddit: activeLock.subreddit,
      targetId: activeLock.targetId,
      targetKind: activeLock.targetKind,
      lockId: activeLock.id,
      actor: input.actor,
      createdAt: now,
      message: 'ReviewLock could not return reports to normal handling; lock remains active.',
      data: { operation: 'unignoreReports', error: unignoreResult.errorMessage },
      demo: false,
    });

    return {
      ok: false,
      lock: warnedLock,
      message:
        'ReviewLock could not return reports to normal handling; the lock remains active for retry.',
      warnings: unignoreResult.warnings,
    };
  }

  let unlocked: ReviewLockRecord | undefined;

  try {
    unlocked = await updateLockStatus(deps.redis, activeLock.subreddit, activeLock.id, 'unlocked', {
      reopenedAt: now,
      reopenReason: 'manual_unlock',
      runtimeWarnings: [...activeLock.runtimeWarnings, ...unignoreResult.warnings],
    });
  } catch (error) {
    await removeActiveLockIndexes(deps.redis, activeLock).catch(() => undefined);
    await appendAuditEvent(deps.redis, {
      id: `audit-${activeLock.id}-unlock-status-failed-${Date.parse(now)}`,
      kind: 'runtime_failure',
      subreddit: activeLock.subreddit,
      targetId: activeLock.targetId,
      targetKind: activeLock.targetKind,
      lockId: activeLock.id,
      actor: input.actor,
      createdAt: now,
      message:
        'ReviewLock returned reports to normal handling but could not persist the manual unlock.',
      data: {
        operation: 'unlockStatusWrite',
        error: error instanceof Error ? error.message : 'unknown error',
      },
      demo: activeLock.demo,
    }).catch(() => undefined);

    return {
      ok: false,
      lock: {
        ...activeLock,
        runtimeWarnings: [...activeLock.runtimeWarnings, 'redis_write_failed'],
      },
      message:
        'Reports were returned to normal handling, but ReviewLock could not persist the unlock. The active index was cleared to avoid resuppressing future reports.',
      warnings: ['redis_write_failed'],
    };
  }

  try {
    await appendAuditEvent(deps.redis, {
      id: `audit-${activeLock.id}-unlocked-${Date.parse(now)}`,
      kind: 'lock_unlocked',
      subreddit: activeLock.subreddit,
      targetId: activeLock.targetId,
      targetKind: activeLock.targetKind,
      lockId: activeLock.id,
      actor: input.actor,
      createdAt: now,
      message: 'ReviewLock lock manually unlocked.',
      data: { unignoreReportsOk: unignoreResult.ok },
      demo: false,
    });
  } catch (error) {
    await appendAuditEvent(deps.redis, {
      id: `audit-${activeLock.id}-unlock-audit-failed-${Date.parse(now)}`,
      kind: 'runtime_failure',
      subreddit: activeLock.subreddit,
      targetId: activeLock.targetId,
      targetKind: activeLock.targetKind,
      lockId: activeLock.id,
      actor: input.actor,
      createdAt: now,
      message: 'ReviewLock unlocked the lock, but the unlock audit failed.',
      data: {
        operation: 'lockUnlockedAudit',
        error: error instanceof Error ? error.message : 'unknown error',
      },
      demo: activeLock.demo,
    }).catch(() => undefined);

    return {
      ok: false,
      lock: unlocked,
      message:
        'ReviewLock lock was removed, but ReviewLock could not persist the required unlock audit.',
      warnings: [...unignoreResult.warnings, 'redis_write_failed'],
    };
  }

  return {
    ok: true,
    lock: unlocked,
    message: 'ReviewLock lock removed and reports returned to normal handling.',
    warnings: unignoreResult.warnings,
  };
};
