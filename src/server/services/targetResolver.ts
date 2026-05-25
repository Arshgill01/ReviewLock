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

export const normalizeTargetId = (kind: TargetKind, id: unknown): string | undefined => {
  if (typeof id !== 'string') {
    return undefined;
  }

  const targetId = id.trim();

  if (!targetId) {
    return undefined;
  }

  if (targetId.startsWith('t1_') || targetId.startsWith('t3_')) {
    return inferTargetKind(targetId) === kind ? targetId : undefined;
  }

  return kind === 'post' ? `t3_${targetId}` : `t1_${targetId}`;
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

  let target: ReviewLockTarget | undefined;
  try {
    target =
      targetKind === 'post'
        ? await reddit.getPostById(targetId)
        : await reddit.getCommentById(targetId);
  } catch (error) {
    return {
      ok: false,
      targetKind,
      error:
        error instanceof Error
          ? `Target refetch failed: ${error.message}`
          : 'Target refetch failed.',
    };
  }

  if (!target) {
    return {
      ok: false,
      targetKind,
      error: `Target not found: ${targetId}`,
    };
  }

  return { ok: true, target, targetKind };
};
