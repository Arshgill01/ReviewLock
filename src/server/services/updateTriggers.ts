import type { ReopenReason } from '../../shared/schema';
import type { ReopenFlowDependencies, BreakLockResult } from './reopenFlow';
import { breakLockForChangedContent } from './reopenFlow';

export type UpdateTriggerKind =
  | 'post_update'
  | 'comment_update'
  | 'post_nsfw_update'
  | 'post_spoiler_update'
  | 'post_flair_update';

export interface UpdateTriggerInput {
  targetId: string;
  subreddit?: string;
  triggerKind: UpdateTriggerKind;
}

export const reasonForUpdateTrigger = (triggerKind: UpdateTriggerKind): ReopenReason => {
  if (triggerKind === 'post_flair_update') {
    return 'flair_changed';
  }

  if (triggerKind === 'post_nsfw_update') {
    return 'nsfw_changed';
  }

  if (triggerKind === 'post_spoiler_update') {
    return 'spoiler_changed';
  }

  return 'content_changed';
};

export const handleUpdateTrigger = (
  deps: ReopenFlowDependencies,
  input: UpdateTriggerInput,
): Promise<BreakLockResult> =>
  breakLockForChangedContent(deps, {
    targetId: input.targetId,
    subreddit: input.subreddit,
    reasonHint: reasonForUpdateTrigger(input.triggerKind),
  });
