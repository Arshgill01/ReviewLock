import { Hono } from 'hono';
import type { Context } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { isIsoTimestamp, type LockReasonPreset } from '../shared/schema';
import { LOCK_REASON_PRESETS } from '../shared/constants';
import { appendAuditEvent } from '../server/services/audit';
import { consumeFormBinding } from '../server/services/formBindings';
import { keys } from '../server/services/keys';
import { lockReviewedContent } from '../server/services/lockFlow';
import { dismissReopenEvent, getReopenEvent } from '../server/services/reopenQueue';
import { normalizeRuntimeSubreddit } from '../server/services/runtimeHardening';
import { unlockReviewedContent } from '../server/services/unlockFlow';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

interface LockSubmitBody {
  targetId?: unknown;
  subreddit?: unknown;
  formToken?: unknown;
  actor?: unknown;
  lockReason?: unknown;
  customNote?: unknown;
  expiresAt?: unknown;
}

interface UnlockSubmitBody {
  targetId?: unknown;
  subreddit?: unknown;
  formToken?: unknown;
  lockId?: unknown;
  actor?: unknown;
}

interface ReopenActionBody {
  eventId?: unknown;
  action?: unknown;
  actor?: unknown;
  subreddit?: unknown;
}

interface DashboardPostRecord {
  permalink: string;
  createdAt: string;
}

const DASHBOARD_POST_CREATION_GUARD_SECONDS = 30;

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

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const actorFromReddit = async (reddit: RedditAdapter, fallback?: unknown): Promise<string> => {
  const fallbackActor = stringValue(fallback)?.trim() || 'unknown_moderator';

  try {
    return (await reddit.getCurrentUsername()) || fallbackActor;
  } catch {
    return fallbackActor;
  }
};

const selectedLockReason = (value: unknown): LockReasonPreset | undefined => {
  const selected = Array.isArray(value) ? value[0] : value;
  return typeof selected === 'string' ? (selected as LockReasonPreset) : undefined;
};

const validLockReason = (value: string | undefined): value is LockReasonPreset =>
  LOCK_REASON_PRESETS.includes(value as LockReasonPreset);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseDashboardPostRecord = (value: string | undefined): DashboardPostRecord | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) {
      return undefined;
    }

    const permalink = stringValue(parsed.permalink)?.trim();
    const createdAt = stringValue(parsed.createdAt)?.trim();

    if (!permalink || !createdAt || !isIsoTimestamp(createdAt)) {
      return undefined;
    }

    return { permalink, createdAt };
  } catch {
    return undefined;
  }
};

const absoluteRedditPermalink = (permalink: string): string =>
  permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;

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

  return runtimeSubreddit;
};

export const createFormsRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  router.post('/lock-review-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json<UiResponse>(uiToast('ReviewLock dependencies are not configured.'));
    }
    const flowDeps = { reddit: deps.reddit, redis: deps.redis, clock: deps.clock };

    const body = await readJson<LockSubmitBody>(context);
    const targetId = stringValue(body.targetId);
    const subredditInput = stringValue(body.subreddit);
    const formToken = stringValue(body.formToken);
    const customNote = stringValue(body.customNote);
    const expiresAt = stringValue(body.expiresAt);
    const lockReason = selectedLockReason(body.lockReason);

    if (!formToken || !subredditInput || !lockReason) {
      return context.json<UiResponse>(uiToast('ReviewLock form token and reason are required.'));
    }

    if (!validLockReason(lockReason)) {
      return context.json<UiResponse>(uiToast('ReviewLock lock reason is not valid.'));
    }

    if (expiresAt && !isIsoTimestamp(expiresAt)) {
      return context.json<UiResponse>(uiToast('ReviewLock lock expiry is not valid.'));
    }

    const subreddit = await scopedFormSubreddit(deps.reddit, subredditInput);

    if (!subreddit) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form subreddit does not match the current Devvit context.'),
      );
    }

    const binding = await consumeFormBinding(deps.redis, subreddit, formToken);

    if (!binding || binding.action !== 'lock') {
      return context.json<UiResponse>(
        uiToast('ReviewLock form expired. Reopen the menu and try again.'),
      );
    }

    if (targetId && targetId !== binding.targetId) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form target changed. Reopen the menu and try again.'),
      );
    }

    if (!binding.reviewedContentHash || !binding.reviewedFingerprintVersion) {
      return context.json<UiResponse>(
        uiToast('ReviewLock could not verify the reviewed snapshot. Reopen the menu and try again.'),
      );
    }

    const result = await lockReviewedContent(flowDeps, {
      targetId: binding.targetId,
      actor: await actorFromReddit(deps.reddit, body.actor),
      lockReason,
      customNote,
      expiresAt,
      expectedContentHash: binding.reviewedContentHash,
      expectedFingerprintVersion: binding.reviewedFingerprintVersion,
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
    const targetId = stringValue(body.targetId);
    const lockId = stringValue(body.lockId);
    const subredditInput = stringValue(body.subreddit);
    const formToken = stringValue(body.formToken);

    if (!formToken || !subredditInput) {
      return context.json<UiResponse>(uiToast('ReviewLock form token and lock are required.'));
    }

    const subreddit = await scopedFormSubreddit(deps.reddit, subredditInput);

    if (!subreddit) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form subreddit does not match the current Devvit context.'),
      );
    }

    const binding = await consumeFormBinding(deps.redis, subreddit, formToken);

    if (!binding || binding.action !== 'unlock' || !binding.lockId) {
      return context.json<UiResponse>(
        uiToast('ReviewLock form expired. Reopen the menu and try again.'),
      );
    }

    if (
      (targetId && targetId !== binding.targetId) ||
      (lockId && lockId !== binding.lockId)
    ) {
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

    if (!deps.reddit?.submitDashboardPost || !deps.redis || !deps.clock) {
      return context.json<UiResponse>(
        uiToast('ReviewLock dashboard launch is not available in this runtime.'),
      );
    }

    const subredditName = await scopedFormSubreddit(deps.reddit);

    if (!subredditName) {
      return context.json<UiResponse>(
        uiToast('ReviewLock could not determine the current subreddit for dashboard launch.'),
      );
    }

    const dashboardKey = keys.dashboardPost(subredditName);
    let existingRecord: DashboardPostRecord | undefined;

    try {
      existingRecord = parseDashboardPostRecord(await deps.redis.get(dashboardKey));
    } catch {
      return context.json<UiResponse>(
        uiToast('ReviewLock could not load the dashboard launch record. Try again.'),
      );
    }

    if (existingRecord) {
      return context.json<UiResponse>({
        navigateTo: absoluteRedditPermalink(existingRecord.permalink),
        showToast: {
          text: 'Opening ReviewLock dashboard',
          appearance: 'success',
        },
      });
    }

    const guardKey = keys.dashboardPostCreation(subredditName);
    const guardToken = `${deps.clock.now()}:${subredditName}:dashboard`;
    let guardAcquired = false;

    try {
      guardAcquired = await deps.redis.setIfNotExists(guardKey, guardToken);
    } catch {
      return context.json<UiResponse>(
        uiToast('ReviewLock could not reserve dashboard creation. Try again.'),
      );
    }

    if (!guardAcquired) {
      let inFlightRecord: DashboardPostRecord | undefined;

      try {
        inFlightRecord = parseDashboardPostRecord(await deps.redis.get(dashboardKey));
      } catch {
        return context.json<UiResponse>(
          uiToast('ReviewLock dashboard creation is already in progress. Try again in a moment.'),
        );
      }

      if (inFlightRecord) {
        return context.json<UiResponse>({
          navigateTo: absoluteRedditPermalink(inFlightRecord.permalink),
          showToast: {
            text: 'Opening ReviewLock dashboard',
            appearance: 'success',
          },
        });
      }

      return context.json<UiResponse>(
        uiToast('ReviewLock dashboard creation is already in progress. Try again in a moment.'),
      );
    }

    try {
      await deps.redis.expire(guardKey, DASHBOARD_POST_CREATION_GUARD_SECONDS);
    } catch {
      if ((await deps.redis.get(guardKey).catch(() => undefined)) === guardToken) {
        await deps.redis.del(guardKey).catch(() => undefined);
      }

      return context.json<UiResponse>(
        uiToast('ReviewLock could not reserve dashboard creation. Try again.'),
      );
    }

    try {
      const post = await deps.reddit.submitDashboardPost({
        subredditName,
        title: 'ReviewLock dashboard',
      });
      const permalink = absoluteRedditPermalink(post.permalink);

      try {
        await deps.redis.set(
          dashboardKey,
          JSON.stringify({
            permalink,
            createdAt: deps.clock.now(),
          } satisfies DashboardPostRecord),
        );
      } catch {
        return context.json<UiResponse>({
          navigateTo: permalink,
          showToast: {
            text: 'Opening ReviewLock dashboard; reuse record could not be saved.',
            appearance: 'neutral',
          },
        });
      }

      return context.json<UiResponse>({
        navigateTo: permalink,
        showToast: {
          text: 'Opening ReviewLock dashboard',
          appearance: 'success',
        },
      });
    } finally {
      if ((await deps.redis.get(guardKey).catch(() => undefined)) === guardToken) {
        await deps.redis.del(guardKey).catch(() => undefined);
      }
    }
  });
  router.post('/reopen-action-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json<UiResponse>(uiToast('ReviewLock dependencies are not configured.'));
    }

    const body = await readJson<ReopenActionBody>(context);
    const eventId = stringValue(body.eventId);
    const action = stringValue(body.action);
    const subredditInput = stringValue(body.subreddit);

    if (!eventId || action !== 'dismiss' || !subredditInput) {
      return context.json<UiResponse>(uiToast('Reopen event, action, and subreddit are required.'));
    }

    const subreddit = await scopedFormSubreddit(deps.reddit, subredditInput);

    if (!subreddit) {
      return context.json<UiResponse>(
        uiToast('Reopen action subreddit does not match the current Devvit context.'),
      );
    }

    const actor = await actorFromReddit(deps.reddit, body.actor);
    const dismissedAt = deps.clock.now();
    const event = await getReopenEvent(deps.redis, subreddit, eventId);

    if (!event) {
      return context.json<UiResponse>(uiToast('Reopen event was not found.'));
    }

    if (event.runtimeWarnings.length > 0) {
      return context.json<UiResponse>(
        uiToast('ReviewLock cannot dismiss this reopened item until runtime warnings are resolved.'),
      );
    }

    try {
      await appendAuditEvent(deps.redis, {
        id: `audit-reopen-dismissed-${Date.parse(dismissedAt)}-${event.id}`,
        kind: 'reopen_dismissed',
        subreddit: event.subreddit,
        targetId: event.targetId,
        targetKind: event.targetKind,
        lockId: event.lockId,
        actor,
        createdAt: dismissedAt,
        message: 'Reopened item dismissed from the ReviewLock queue.',
        data: { reopenReason: event.reason },
        demo: event.demo,
      });
    } catch {
      return context.json<UiResponse>(
        uiToast('ReviewLock could not record the dismissal audit; reopened item was not dismissed.'),
      );
    }
    try {
      await dismissReopenEvent(deps.redis, subreddit, eventId, dismissedAt, actor);
    } catch (error) {
      await appendAuditEvent(deps.redis, {
        id: `audit-reopen-dismiss-failed-${Date.parse(dismissedAt)}-${event.id}`,
        kind: 'runtime_failure',
        subreddit: event.subreddit,
        targetId: event.targetId,
        targetKind: event.targetKind,
        lockId: event.lockId,
        actor,
        createdAt: dismissedAt,
        message:
          'ReviewLock recorded dismissal intent but could not update the reopen queue.',
        data: {
          operation: 'dismissReopenEvent',
          error: error instanceof Error ? error.message : 'unknown error',
        },
        demo: event.demo,
      }).catch(() => undefined);

      return context.json<UiResponse>(
        uiToast('ReviewLock recorded the dismissal audit but could not update the reopen queue.'),
      );
    }

    return context.json<UiResponse>(uiToast('ReviewLock dismissed this reopened item.', 'success'));
  });

  return router;
};

export const formsRouter = createFormsRouter();
