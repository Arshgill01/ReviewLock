import { Hono } from 'hono';
import type { Context } from 'hono';
import type { FormField, MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { getActiveLockByTarget } from '../server/services/locks';
import { resolveTargetById } from '../server/services/targetResolver';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

type ReviewLockMenuRequest = Partial<MenuItemRequest> & {
  postId?: string;
  commentId?: string;
};

const readMenuBody = async (context: Context): Promise<ReviewLockMenuRequest> => {
  try {
    return (await context.req.json()) as ReviewLockMenuRequest;
  } catch {
    return {};
  }
};

const targetIdFromBody = (body: ReviewLockMenuRequest): string | undefined =>
  body.targetId ?? body.postId ?? body.commentId;

const targetSummary = (target: {
  id: string;
  kind: string;
  authorName: string;
  reportCount: number;
  edited: boolean;
  permalink: string;
  body?: string;
  title?: string;
}): string =>
  [
    `${target.kind} ${target.id}`,
    `Author: ${target.authorName}`,
    `Reports now: ${target.reportCount}`,
    `Edited: ${target.edited ? 'yes' : 'no'}`,
    `Permalink: ${target.permalink}`,
    `Preview: ${(target.body ?? target.title ?? '').slice(0, 240)}`,
  ].join('\n');

export const buildLockReviewForm = (target: Parameters<typeof targetSummary>[0]) => ({
  title: 'Lock review',
  description: 'Lock reviewed content until it changes.',
  fields: [
    {
      name: 'targetId',
      label: 'Target ID',
      type: 'string',
      required: true,
      defaultValue: target.id,
    },
    {
      name: 'targetSummary',
      label: 'Reviewed content',
      type: 'paragraph',
      defaultValue: targetSummary(target),
      disabled: true,
    },
    {
      name: 'lockReason',
      label: 'Reason',
      type: 'select',
      required: true,
      defaultValue: ['reviewed_policy_compliant'],
      options: [
        { label: 'Reviewed and policy-compliant', value: 'reviewed_policy_compliant' },
        { label: 'Repeat false reports', value: 'repeat_false_reports' },
        { label: 'Context verified', value: 'context_verified' },
        { label: 'Moderator consensus', value: 'moderator_consensus' },
      ],
    },
    {
      name: 'customNote',
      label: 'Moderator note',
      type: 'paragraph',
      defaultValue: '',
      helpText: 'Optional. Stored only for moderation workflow context.',
    },
  ] satisfies FormField[],
  acceptLabel: 'Lock review',
  cancelLabel: 'Cancel',
});

export const buildUnlockReviewForm = (targetId: string, lockId: string) => ({
  title: 'Unlock review',
  description: 'Unlock this reviewed item and allow reports to surface again.',
  fields: [
    {
      name: 'targetId',
      label: 'Target ID',
      type: 'string',
      required: true,
      defaultValue: targetId,
    },
    {
      name: 'lockId',
      label: 'Current lock ID',
      type: 'string',
      required: true,
      defaultValue: lockId,
    },
    {
      name: 'confirmation',
      label: 'Confirmation',
      type: 'paragraph',
      defaultValue: 'Unlock review',
      disabled: true,
    },
  ] satisfies FormField[],
  acceptLabel: 'Unlock review',
  cancelLabel: 'Cancel',
});

export const createMenuRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  const lockHandler = async (context: Context) => {
    if (!deps.reddit) {
      return context.json<UiResponse>({
        showToast: { text: 'ReviewLock could not resolve Reddit context.', appearance: 'neutral' },
      });
    }

    const body = await readMenuBody(context);
    const resolution = await resolveTargetById(deps.reddit, targetIdFromBody(body));

    if (!resolution.ok || !resolution.target) {
      return context.json<UiResponse>({
        showToast: { text: resolution.error ?? 'ReviewLock could not resolve this target.', appearance: 'neutral' },
      });
    }

    return context.json<UiResponse>({
      showForm: { name: 'lockReview', form: buildLockReviewForm(resolution.target) },
    });
  };

  const unlockHandler = async (context: Context) => {
    if (!deps.reddit || !deps.redis) {
      return context.json<UiResponse>({
        showToast: { text: 'ReviewLock dependencies are not configured.', appearance: 'neutral' },
      });
    }

    const body = await readMenuBody(context);
    const resolution = await resolveTargetById(deps.reddit, targetIdFromBody(body));

    if (!resolution.ok || !resolution.target) {
      return context.json<UiResponse>({
        showToast: { text: resolution.error ?? 'ReviewLock could not resolve this target.', appearance: 'neutral' },
      });
    }

    const lock = await getActiveLockByTarget(deps.redis, resolution.target.subreddit, resolution.target.id);

    if (!lock) {
      return context.json<UiResponse>({
        showToast: { text: 'No active ReviewLock lock was found for this content.', appearance: 'neutral' },
      });
    }

    return context.json<UiResponse>({
      showForm: { name: 'unlockReview', form: buildUnlockReviewForm(resolution.target.id, lock.id) },
    });
  };

  router.post('/lock-post', lockHandler);
  router.post('/lock-comment', lockHandler);
  router.post('/unlock-post', unlockHandler);
  router.post('/unlock-comment', unlockHandler);
  router.post('/open-dashboard', (context) =>
    context.json<UiResponse>({
      showForm: {
        name: 'dashboardLaunch',
        form: {
          title: 'Open ReviewLock dashboard',
          fields: [
            {
              name: 'copy',
              label: 'ReviewLock',
              type: 'paragraph',
              defaultValue:
                'This creates a visible ReviewLock dashboard custom post in this subreddit. Lock reviewed content until it changes.',
              disabled: true,
            },
          ],
          acceptLabel: 'Create dashboard post',
          cancelLabel: 'Cancel',
        },
      },
    }),
  );

  return router;
};

export const menuRouter = createMenuRouter();
