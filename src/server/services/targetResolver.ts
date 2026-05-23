import type { RedditAdapter } from '../adapters/reddit';
import type { ReviewLockTarget, TargetKind } from '../../shared/schema';

export interface TargetResolution {
  ok: boolean;
  target?: ReviewLockTarget;
  targetKind?: TargetKind;
  error?: string;
}

export const inferTargetKind = (id: string | undefined): TargetKind | undefined => {
  if (!id) {
    return undefined;
  }

  if (id.startsWith('t3_')) {
    return 'post';
  }

  if (id.startsWith('t1_')) {
    return 'comment';
  }

  return undefined;
};

export const resolveTargetById = async (
  reddit: RedditAdapter,
  targetId: string | undefined,
): Promise<TargetResolution> => {
  const targetKind = inferTargetKind(targetId);

  if (!targetId || !targetKind) {
    return {
      ok: false,
      error: `Unsupported target id: ${targetId ?? 'missing'}`,
    };
  }

  const target =
    targetKind === 'post' ? await reddit.getPostById(targetId) : await reddit.getCommentById(targetId);

  if (!target) {
    return {
      ok: false,
      targetKind,
      error: `Target not found: ${targetId}`,
    };
  }

  return { ok: true, target, targetKind };
};
