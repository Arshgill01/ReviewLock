import { Hono } from 'hono';
import type { Context } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import type { LockReasonPreset } from '../shared/schema';
import { LOCK_REASON_PRESETS } from '../shared/constants';
import { appendAuditEvent } from '../server/services/audit';
import { consumeFormBinding } from '../server/services/formBindings';
import { lockReviewedContent } from '../server/services/lockFlow';
import { dismissReopenEvent } from '../server/services/reopenQueue';
import { normalizeRuntimeSubreddit } from '../server/services/runtimeHardening';
import { unlockReviewedContent } from '../server/services/unlockFlow';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

interface LockSubmitBody {
  targetId?: string;
  subreddit?: string;
  formToken?: string;
  actor?: string;
  lockReason?: LockReasonPreset | LockReasonPreset[];
  customNote?: string;
  expiresAt?: string;
}

interface UnlockSubmitBody {
  targetId?: string;
  subreddit?: string;
  formToken?: string;
  lockId?: string;
  actor?: string;
}

interface ReopenActionBody {
  eventId?: string;
  action?: 'dismiss';
  actor?: string;
  subreddit?: string;
}

const readJson = async <T>(context: Context): Promise<T> => {
  try {
    return (await context.req.json()) as T;
  } catch {
    return {} as T;
  }
};

const uiToast = (text: string, appearance: 'neutral' | 'success' = 'neutral'): UiResponse => ({
  showToast: { text, appearance },
});

const actorFromReddit = async (reddit: RedditAdapter, fallback?: string): Promise<string> => {
  const fallbackActor = fallback?.trim() || 'unknown_moderator';

  try {
    return (await reddit.getCurrentUsername()) || fallbackActor;
  } catch {
    return fallbackActor;
  }
};

const selectedLockReason = (value: LockSubmitBody['lockReason']): LockReasonPreset | undefined =>
  Array.isArray(value) ? value[0] : value;

const validLockReason = (value: string | undefined): value is LockReasonPreset =>
  LOCK_REASON_PRESETS.includes(value as LockReasonPreset);

const currentSubredditFromReddit = async (reddit: RedditAdapter): Promise<string | undefined> => {
  try {
    return await reddit.getCurrentSubredditName();
  } catch {
    return undefined;
  }
};

const scopedFormSubreddit = async (
  reddit: RedditAdapter,
  requested?: string,
): Promise<string | undefined> => {
  let runtimeSubreddit: string | undefined;
  let requestedSubreddit: string | undefined;

  try {
    const current = await currentSubredditFromReddit(reddit);
    runtimeSubreddit = current ? normalizeRuntimeSubreddit(current) : undefined;
    requestedSubreddit = requested ? normalizeRuntimeSubreddit(requested) : undefined;
  } catch {
    return undefined;
  }

  if (runtimeSubreddit && requestedSubreddit && runtimeSubreddit !== requestedSubreddit) {
    return undefined;
  }

  return runtimeSubreddit ?? requestedSubreddit;
};

export const createFormsRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  router.post('/lock-review-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json<UiResponse>(uiToast('ReviewLock dependencies are not configured.'));
    }
    const flowDeps = { reddit: deps.reddit, redis: deps.redis, clock: deps.clock };

    const body = await readJson<LockSubmitBody>(context);

    const lockReason = selectedLockReason(body.lockReason);

    if (!body.formToken || !body.subreddit || !lockReason) {
      return context.json<UiResponse>(uiToast('ReviewLock form token and reason are required.'));
    }

    if (!validLockReason(lockReason)) {
      return context.json<UiResponse>(uiToast('ReviewLock lock reason is not valid.'));
    }

    const subreddit = await scopedFormSubreddit(deps.reddit, body.subreddit);

    if (!subreddit) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form subreddit does not match the current Devvit context.'),
      );
    }

    const binding = await consumeFormBinding(deps.redis, subreddit, body.formToken);

    if (!binding || binding.action !== 'lock') {
      return context.json<UiResponse>(
        uiToast('ReviewLock form expired. Reopen the menu and try again.'),
      );
    }

    if (body.targetId && body.targetId !== binding.targetId) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form target changed. Reopen the menu and try again.'),
      );
    }

    const result = await lockReviewedContent(flowDeps, {
      targetId: binding.targetId,
      actor: await actorFromReddit(deps.reddit, body.actor),
      lockReason,
      customNote: body.customNote,
      expiresAt: body.expiresAt,
    });

    return context.json<UiResponse>(
      result.ok
        ? uiToast('ReviewLock locked this reviewed content until it changes.', 'success')
        : uiToast(result.message),
    );
  });

  router.post('/unlock-review-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json<UiResponse>(uiToast('ReviewLock dependencies are not configured.'));
    }
    const flowDeps = { reddit: deps.reddit, redis: deps.redis, clock: deps.clock };

    const body = await readJson<UnlockSubmitBody>(context);

    if (!body.formToken || !body.subreddit || !body.lockId) {
      return context.json<UiResponse>(uiToast('ReviewLock form token and lock are required.'));
    }

    const subreddit = await scopedFormSubreddit(deps.reddit, body.subreddit);

    if (!subreddit) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form subreddit does not match the current Devvit context.'),
      );
    }

    const binding = await consumeFormBinding(deps.redis, subreddit, body.formToken);

    if (!binding || binding.action !== 'unlock' || !binding.lockId) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form expired. Reopen the menu and try again.'),
      );
    }

    if ((body.targetId && body.targetId !== binding.targetId) || body.lockId !== binding.lockId) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form target changed. Reopen the menu and try again.'),
      );
    }

    const result = await unlockReviewedContent(flowDeps, {
      targetId: binding.targetId,
      lockId: binding.lockId,
      expectedSubreddit: binding.subreddit,
      actor: await actorFromReddit(deps.reddit, body.actor),
    });

    return context.json<UiResponse>(
      result.ok
        ? uiToast('ReviewLock unlocked this reviewed content.', 'success')
        : uiToast(result.message),
    );
  });

  router.post('/dashboard-launch-submit', async (context) => {
    await readJson(context);

    if (!deps.reddit?.submitDashboardPost) {
      return context.json<UiResponse>(
        uiToast('ReviewLock dashboard launch is not available in this runtime.'),
      );
    }

    let subredditName: string | undefined;

    try {
      subredditName = await deps.reddit.getCurrentSubredditName();
    } catch {
      subredditName = undefined;
    }

    if (!subredditName) {
      return context.json<UiResponse>(
        uiToast('ReviewLock could not determine the current subreddit for dashboard launch.'),
      );
    }

    const post = await deps.reddit.submitDashboardPost({
      subredditName,
      title: 'ReviewLock dashboard',
    });
    const permalink = post.permalink.startsWith('http')
      ? post.permalink
      : `https://www.reddit.com${post.permalink}`;

    return context.json<UiResponse>({
      navigateTo: permalink,
      showToast: {
        text: 'Opening ReviewLock dashboard',
        appearance: 'success',
      },
    });
  });
  router.post('/reopen-action-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json<UiResponse>(uiToast('ReviewLock dependencies are not configured.'));
    }

    const body = await readJson<ReopenActionBody>(context);

    if (!body.eventId || body.action !== 'dismiss' || !body.subreddit) {
      return context.json<UiResponse>(uiToast('Reopen event, action, and subreddit are required.'));
    }

    const subreddit = await scopedFormSubreddit(deps.reddit, body.subreddit);

    if (!subreddit) {
      return context.json<UiResponse>(
        uiToast('Reopen action subreddit does not match the current Devvit context.'),
      );
    }

    const actor = await actorFromReddit(deps.reddit, body.actor);
    const dismissed = await dismissReopenEvent(
      deps.redis,
      subreddit,
      body.eventId,
      deps.clock.now(),
      actor,
    );

    if (!dismissed) {
      return context.json<UiResponse>(uiToast('Reopen event was not found.'));
    }

    await appendAuditEvent(deps.redis, {
      id: `audit-reopen-dismissed-${Date.parse(dismissed.dismissedAt ?? deps.clock.now())}-${dismissed.id}`,
      kind: 'reopen_dismissed',
      subreddit: dismissed.subreddit,
      targetId: dismissed.targetId,
      targetKind: dismissed.targetKind,
      lockId: dismissed.lockId,
      actor,
      createdAt: dismissed.dismissedAt ?? deps.clock.now(),
      message: 'Reopened item dismissed from the ReviewLock queue.',
      data: { reopenReason: dismissed.reason },
      demo: dismissed.demo,
    });

    return context.json<UiResponse>(uiToast('ReviewLock dismissed this reopened item.', 'success'));
  });

  return router;
};

export const formsRouter = createFormsRouter();
