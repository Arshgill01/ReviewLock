import { Hono } from 'hono';
import type { Context } from 'hono';
import type { FormField, UiResponse } from '@devvit/web/shared';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { loadConfig } from '../server/services/config';
import { createFormBinding } from '../server/services/formBindings';
import { getActiveLockByTarget } from '../server/services/locks';
import { normalizeTargetId, resolveTargetById } from '../server/services/targetResolver';
import { LOCK_REASON_PRESETS } from '../shared/constants';
import type { LockReasonPreset, ReviewLockConfig, TargetKind } from '../shared/schema';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readMenuBody = async (context: Context): Promise<Record<string, unknown>> => {
  try {
    const body = (await context.req.json()) as unknown;
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
};

const targetIdFromBody = (
  body: Record<string, unknown>,
  kind: TargetKind,
): string | undefined =>
  normalizeTargetId(
    kind,
    kind === 'post' ? body.targetId ?? body.postId : body.commentId ?? body.targetId,
  );

const targetSummary = (target: {
  id: string;
  kind: string;
  subreddit: string;
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

const lockReasonLabels: Record<LockReasonPreset, string> = {
  reviewed_policy_compliant: 'Reviewed and policy-compliant',
  approved_context_known: 'Approved with known context',
  repeat_report_churn: 'Repeat report churn',
  mod_team_consensus: 'Mod team consensus',
  custom: 'Custom reason',
};

const configuredReasonPresets = (config?: ReviewLockConfig): LockReasonPreset[] =>
  config?.reasonPresets.length ? config.reasonPresets : [...LOCK_REASON_PRESETS];

export const buildLockReviewForm = (
  target: Parameters<typeof targetSummary>[0],
  token = '',
  config?: ReviewLockConfig,
) => {
  const reasonPresets = configuredReasonPresets(config);

  return {
    title: 'Lock review',
    description: 'Lock reviewed content until it changes.',
    fields: [
      {
        name: 'targetId',
        label: 'Target ID',
        type: 'string',
        required: true,
        defaultValue: target.id,
        disabled: true,
      },
      {
        name: 'subreddit',
        label: 'Subreddit',
        type: 'string',
        required: true,
        defaultValue: target.subreddit,
      },
      {
        name: 'formToken',
        label: 'Review token',
        type: 'string',
        required: true,
        defaultValue: token,
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
        defaultValue: [reasonPresets[0]],
        options: reasonPresets.map((preset) => ({
          label: lockReasonLabels[preset],
          value: preset,
        })),
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
  };
};

export const buildUnlockReviewForm = (
  targetId: string,
  lockId: string,
  subreddit = '',
  token = '',
) => ({
  title: 'Unlock review',
  description: 'Unlock this reviewed item and allow reports to surface again.',
  fields: [
    {
      name: 'targetId',
      label: 'Target ID',
      type: 'string',
      required: true,
      defaultValue: targetId,
      disabled: true,
    },
    {
      name: 'lockId',
      label: 'Current lock ID',
      type: 'string',
      required: true,
      defaultValue: lockId,
      disabled: true,
    },
    {
      name: 'subreddit',
      label: 'Subreddit',
      type: 'string',
      required: true,
      defaultValue: subreddit,
    },
    {
      name: 'formToken',
      label: 'Review token',
      type: 'string',
      required: true,
      defaultValue: token,
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

  const dashboardLaunchResponse = (): UiResponse => ({
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
  });

  const lockHandler = (kind: TargetKind) => async (context: Context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json<UiResponse>({
        showToast: { text: 'ReviewLock dependencies are not configured.', appearance: 'neutral' },
      });
    }

    const body = await readMenuBody(context);
    const resolution = await resolveTargetById(deps.reddit, targetIdFromBody(body, kind));

    if (!resolution.ok || !resolution.target) {
      return context.json<UiResponse>({
        showToast: {
          text: resolution.error ?? 'ReviewLock could not resolve this target.',
          appearance: 'neutral',
        },
      });
    }

    const binding = await createFormBinding(
      deps.redis,
      'lock',
      resolution.target,
      deps.clock.now(),
    );
    const config = await loadConfig(deps.redis, resolution.target.subreddit);

    return context.json<UiResponse>({
      showForm: {
        name: 'lockReview',
        form: buildLockReviewForm(resolution.target, binding.token, config),
      },
    });
  };

  const unlockHandler = (kind: TargetKind) => async (context: Context) => {
    if (!deps.reddit || !deps.redis) {
      return context.json<UiResponse>({
        showToast: { text: 'ReviewLock dependencies are not configured.', appearance: 'neutral' },
      });
    }

    const body = await readMenuBody(context);
    const resolution = await resolveTargetById(deps.reddit, targetIdFromBody(body, kind));

    if (!resolution.ok || !resolution.target) {
      return context.json<UiResponse>({
        showToast: {
          text: resolution.error ?? 'ReviewLock could not resolve this target.',
          appearance: 'neutral',
        },
      });
    }

    const lock = await getActiveLockByTarget(
      deps.redis,
      resolution.target.subreddit,
      resolution.target.id,
    );

    if (!lock) {
      return context.json<UiResponse>({
        showToast: {
          text: 'No active ReviewLock lock was found for this content.',
          appearance: 'neutral',
        },
      });
    }

    const binding = await createFormBinding(
      deps.redis,
      'unlock',
      resolution.target,
      deps.clock?.now() ?? new Date().toISOString(),
      lock.id,
    );

    return context.json<UiResponse>({
      showForm: {
        name: 'unlockReview',
        form: buildUnlockReviewForm(
          resolution.target.id,
          lock.id,
          resolution.target.subreddit,
          binding.token,
        ),
      },
    });
  };

  router.post('/lock-post', lockHandler('post'));
  router.post('/lock-comment', lockHandler('comment'));
  router.post('/unlock-post', unlockHandler('post'));
  router.post('/unlock-comment', unlockHandler('comment'));
  router.post('/open-post', (context) => context.json<UiResponse>(dashboardLaunchResponse()));
  router.post('/open-comment', (context) => context.json<UiResponse>(dashboardLaunchResponse()));
  router.post('/open-dashboard', (context) => context.json<UiResponse>(dashboardLaunchResponse()));

  return router;
};

export const menuRouter = createMenuRouter();
