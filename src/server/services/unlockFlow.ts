import type { Clock } from '../adapters/clock';
import type { RedisStore } from '../adapters/redis';
import type { RedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord } from '../../shared/schema';
import { appendAuditEvent } from './audit';
import { getActiveLockByTarget, updateLockStatus } from './locks';
import { unignoreReportsForReviewLock } from './moderation';
import { resolveTargetById } from './targetResolver';

export interface UnlockReviewInput {
  targetId: string;
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

  const activeLock = await getActiveLockByTarget(deps.redis, resolution.target.subreddit, resolution.target.id);

  if (!activeLock) {
    return {
      ok: true,
      message: 'No active ReviewLock lock was found for this content.',
      warnings: [],
    };
  }

  const now = deps.clock.now();
  const unignoreResult = await unignoreReportsForReviewLock(deps.reddit, resolution.target);
  const unlocked = await updateLockStatus(deps.redis, activeLock.subreddit, activeLock.id, 'unlocked', {
    reopenedAt: now,
    reopenReason: 'manual_unlock',
    runtimeWarnings: [...activeLock.runtimeWarnings, ...unignoreResult.warnings],
  });

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

  return {
    ok: unignoreResult.ok,
    lock: unlocked,
    message: unignoreResult.ok
      ? 'ReviewLock lock removed and reports returned to normal handling.'
      : 'ReviewLock lock was removed, but unignoreReports needs moderator attention.',
    warnings: unignoreResult.warnings,
  };
};
