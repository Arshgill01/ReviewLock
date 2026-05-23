import type { RedditAdapter } from '../adapters/reddit';
import type { ReviewLockTarget } from '../../shared/schema';

export interface ModerationOperationResult {
  ok: boolean;
  operation: 'approve' | 'ignoreReports' | 'unignoreReports';
  targetId: string;
  warnings: string[];
  errorMessage?: string;
}

const messageFromError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown moderation operation failure';

const runOperation = async (
  operation: ModerationOperationResult['operation'],
  target: ReviewLockTarget,
  action: () => Promise<void>,
): Promise<ModerationOperationResult> => {
  try {
    await action();
    return {
      ok: true,
      operation,
      targetId: target.id,
      warnings: [],
    };
  } catch (error) {
    return {
      ok: false,
      operation,
      targetId: target.id,
      warnings: [`${operation} failed for ${target.id}`],
      errorMessage: messageFromError(error),
    };
  }
};

export const approveForReviewLock = (
  reddit: RedditAdapter,
  target: ReviewLockTarget,
): Promise<ModerationOperationResult> =>
  runOperation('approve', target, () => reddit.approveTarget(target));

export const ignoreReportsForReviewLock = (
  reddit: RedditAdapter,
  target: ReviewLockTarget,
): Promise<ModerationOperationResult> =>
  runOperation('ignoreReports', target, () => reddit.ignoreReports(target));

export const unignoreReportsForReviewLock = (
  reddit: RedditAdapter,
  target: ReviewLockTarget,
): Promise<ModerationOperationResult> =>
  runOperation('unignoreReports', target, () => reddit.unignoreReports(target));
