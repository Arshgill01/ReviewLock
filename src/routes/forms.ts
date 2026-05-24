import { Hono } from 'hono';
import type { Context } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import type { LockReasonPreset } from '../shared/schema';
import { appendAuditEvent } from '../server/services/audit';
import { lockReviewedContent } from '../server/services/lockFlow';
import { dismissReopenEvent } from '../server/services/reopenQueue';
import { unlockReviewedContent } from '../server/services/unlockFlow';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

interface LockSubmitBody {
  targetId?: string;
  actor?: string;
  lockReason?: LockReasonPreset | LockReasonPreset[];
  customNote?: string;
  expiresAt?: string;
}

interface UnlockSubmitBody {
  targetId?: string;
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

const actorFromReddit = async (reddit: RedditAdapter, fallback?: string): Promise<string> =>
  fallback?.trim() || (await reddit.getCurrentUsername()) || 'unknown_moderator';

const selectedLockReason = (value: LockSubmitBody['lockReason']): LockReasonPreset | undefined =>
  Array.isArray(value) ? value[0] : value;

export const createFormsRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  router.post('/lock-review-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json<UiResponse>(uiToast('ReviewLock dependencies are not configured.'));
    }
    const flowDeps = { reddit: deps.reddit, redis: deps.redis, clock: deps.clock };

    const body = await readJson<LockSubmitBody>(context);

    const lockReason = selectedLockReason(body.lockReason);

    if (!body.targetId || !lockReason) {
      return context.json<UiResponse>(uiToast('Target and reason are required.'));
    }

    const result = await lockReviewedContent(flowDeps, {
      targetId: body.targetId,
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

    if (!body.targetId) {
      return context.json<UiResponse>(uiToast('Target is required.'));
    }

    const result = await unlockReviewedContent(flowDeps, {
      targetId: body.targetId,
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

    const subredditName = (await deps.reddit.getCurrentSubredditName()) ?? 'reviewlock_dev';
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

    const actor = await actorFromReddit(deps.reddit, body.actor);
    const dismissed = await dismissReopenEvent(
      deps.redis,
      body.subreddit,
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
