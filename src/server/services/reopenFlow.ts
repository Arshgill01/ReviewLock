import type { Clock } from '../adapters/clock';
import type { RedisStore } from '../adapters/redis';
import type { RedditAdapter } from '../adapters/reddit';
import type {
  ReopenEvent,
  ReopenReason,
  ReviewLockRecord,
  ReviewLockTarget,
} from '../../shared/schema';
import { appendAuditEvent } from './audit';
import { compareFingerprints, fingerprintTarget } from './fingerprint';
import { getActiveLockByTarget, removeActiveLockIndexes, updateLockStatus } from './locks';
import { incrementReopenedMetric } from './metrics';
import { unignoreReportsForReviewLock } from './moderation';
import { enqueueReopenEvent } from './reopenQueue';
import { recordCapabilityStatus, recordModerationOperationStatus } from './runtimeProof';
import { resolveTargetById } from './targetResolver';
import { isTriggerConcurrencyError, withTriggerMutex } from './triggerMutex';

export interface ReopenFlowDependencies {
  reddit: RedditAdapter;
  redis: RedisStore;
  clock: Clock;
}

export interface BreakLockInput {
  targetId: string;
  subreddit?: string;
  reasonHint?: ReopenReason;
  triggerCapabilityName?: string;
}

export interface BreakLockResult {
  ok: boolean;
  action: 'no_lock' | 'unchanged' | 'reopened' | 'runtime_uncertain';
  message: string;
  event?: ReopenEvent;
  warnings: string[];
}

const fingerprintComparison = (lock: ReviewLockRecord, target: ReviewLockTarget | undefined) =>
  compareFingerprints(
    {
      version: lock.fingerprintVersion,
      targetKind: lock.targetKind,
      hash: lock.contentHash,
      input: '',
      computedAt: lock.lockedAt,
    },
    fingerprintTarget(target),
  );

const buildReopenEvent = (
  lock: ReviewLockRecord,
  currentTarget: ReviewLockTarget | undefined,
  reason: ReopenReason,
  now: string,
  warnings: string[],
): ReopenEvent => ({
  id: `reopen-${lock.id}-${reason}`,
  lockId: lock.id,
  subreddit: lock.subreddit,
  targetId: lock.targetId,
  targetKind: lock.targetKind,
  oldContentHash: lock.contentHash,
  newContentHash: currentTarget
    ? (fingerprintTarget(currentTarget, now)?.hash ?? 'runtime_uncertain')
    : 'runtime_uncertain',
  reason,
  createdAt: now,
  summary:
    reason === 'runtime_uncertain'
      ? 'ReviewLock could not verify current content, so the lock reopened.'
      : 'Reviewed content changed after the lock was created.',
  runtimeWarnings: warnings,
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

const recordUpdateTriggerProcessed = async (
  deps: ReopenFlowDependencies,
  subreddit: string,
  capabilityName: string | undefined,
  targetId: string,
  now: string,
): Promise<void> => {
  if (!capabilityName) {
    return;
  }

  await recordCapabilityStatus(
    deps.redis,
    subreddit,
    {
      name: capabilityName,
      status: 'verified',
      checkedAt: now,
      evidence: `${capabilityName} processed for ${targetId}`,
      notes: [`${capabilityName} resolved and processed for ${targetId}.`],
    },
    now,
  ).catch(() => undefined);
};

export const breakLockForChangedContent = async (
  deps: ReopenFlowDependencies,
  input: BreakLockInput,
): Promise<BreakLockResult> => {
  const now = deps.clock.now();
  const resolution = await resolveTargetById(deps.reddit, input.targetId);
  const subreddit = resolution.target?.subreddit ?? input.subreddit;

  if (!subreddit) {
    return {
      ok: false,
      action: 'runtime_uncertain',
      message: 'Subreddit was unavailable, so ReviewLock could not locate the active lock.',
      warnings: ['subreddit_missing'],
    };
  }

  try {
    return await withTriggerMutex(deps.redis, subreddit, input.targetId, now, async () => {
      const lock = await getActiveLockByTarget(deps.redis, subreddit, input.targetId);

      if (!lock) {
        if (resolution.target) {
          await recordUpdateTriggerProcessed(
            deps,
            subreddit,
            input.triggerCapabilityName,
            input.targetId,
            now,
          );
        }

        return {
          ok: true,
          action: 'no_lock',
          message: 'No active ReviewLock lock exists for this update.',
          warnings: [],
        };
      }

      const comparison = resolution.target
        ? fingerprintComparison(lock, resolution.target)
        : 'uncertain';

      if (comparison === 'unchanged') {
        await recordUpdateTriggerProcessed(
          deps,
          lock.subreddit,
          input.triggerCapabilityName,
          lock.targetId,
          now,
        );

        return {
          ok: true,
          action: 'unchanged',
          message: 'Reviewed content is unchanged; lock remains active.',
          warnings: [],
        };
      }

      const reason =
        comparison === 'uncertain' ? 'runtime_uncertain' : (input.reasonHint ?? 'content_changed');
      const unignoreResult = resolution.target
        ? await unignoreReportsForReviewLock(deps.reddit, resolution.target)
        : undefined;
      if (unignoreResult) {
        await recordModerationOperationStatus(
          deps.redis,
          lock.subreddit,
          unignoreResult,
          now,
        ).catch(() => undefined);
      }
      const warnings = unignoreResult?.warnings ?? ['target_resolution_failed'];
      const event = buildReopenEvent(lock, resolution.target, reason, now, warnings);

      await enqueueReopenEvent(deps.redis, event);
      await markLockReopenedAfterQueue(deps.redis, lock, {
        reopenedAt: now,
        reopenReason: reason,
        reopenEventId: event.id,
        runtimeWarnings: [...lock.runtimeWarnings, ...warnings],
      });

      if (resolution.target) {
        await incrementReopenedMetric(deps.redis, resolution.target, now, lock.demo);
      }

      await appendAuditEvent(deps.redis, {
        id: `audit-update-reopened-${Date.parse(now)}-${lock.id}`,
        kind: 'lock_reopened',
        subreddit: lock.subreddit,
        targetId: lock.targetId,
        targetKind: lock.targetKind,
        lockId: lock.id,
        actor: 'reviewlock',
        createdAt: now,
        message: 'Lock reopened after reviewed content changed or became uncertain.',
        data: { reason, unignoreReportsOk: unignoreResult?.ok ?? false },
        demo: lock.demo,
      });

      if (resolution.target) {
        await recordUpdateTriggerProcessed(
          deps,
          lock.subreddit,
          input.triggerCapabilityName,
          lock.targetId,
          now,
        );
      }

      return {
        ok: true,
        action: comparison === 'uncertain' ? 'runtime_uncertain' : 'reopened',
        message:
          comparison === 'uncertain'
            ? 'Lock reopened because current content could not be verified.'
            : 'Lock reopened because reviewed content changed.',
        event,
        warnings,
      };
    });
  } catch (error) {
    if (isTriggerConcurrencyError(error)) {
      return {
        ok: false,
        action: 'runtime_uncertain',
        message:
          'Concurrent trigger is already processing this target; retry this update delivery.',
        warnings: ['concurrent_trigger_in_progress'],
      };
    }

    return {
      ok: false,
      action: 'runtime_uncertain',
      message:
        error instanceof Error
          ? error.message
          : 'Redis failed while processing the update trigger.',
      warnings: ['redis_write_failed'],
    };
  }
};
