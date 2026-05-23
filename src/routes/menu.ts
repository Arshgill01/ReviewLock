import { Hono } from 'hono';
import type { Context } from 'hono';
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

interface MenuRequestBody {
  targetId?: string;
  postId?: string;
  commentId?: string;
}

const readMenuBody = async (context: Context): Promise<MenuRequestBody> => {
  try {
    return (await context.req.json()) as MenuRequestBody;
  } catch {
    return {};
  }
};

const targetIdFromBody = (body: MenuRequestBody): string | undefined =>
  body.targetId ?? body.postId ?? body.commentId;

export const buildLockReviewForm = (target: {
  id: string;
  kind: string;
  authorName: string;
  reportCount: number;
  edited: boolean;
  permalink: string;
  body?: string;
  title?: string;
}) => ({
  form: 'lockReview',
  title: 'Lock review',
  fields: {
    targetId: target.id,
    targetKind: target.kind,
    author: target.authorName,
    reportCount: target.reportCount,
    edited: target.edited,
    permalink: target.permalink,
    contentPreview: (target.body ?? target.title ?? '').slice(0, 240),
    reasonPreset: 'reviewed_policy_compliant',
    customNote: '',
    expiryDays: 30,
  },
});

export const buildUnlockReviewForm = (lockId: string) => ({
  form: 'unlockReview',
  title: 'Unlock review',
  fields: {
    lockId,
    confirmation: 'Unlock review',
  },
});

export const createMenuRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  const lockHandler = async (context: Context) => {
    if (!deps.reddit) {
      return context.json({ ok: false, error: 'Reddit adapter is not configured.' }, 503);
    }

    const body = await readMenuBody(context);
    const resolution = await resolveTargetById(deps.reddit, targetIdFromBody(body));

    if (!resolution.ok || !resolution.target) {
      return context.json({ ok: false, message: resolution.error ?? 'Target not found.' }, 404);
    }

    return context.json({ ok: true, form: buildLockReviewForm(resolution.target) });
  };

  const unlockHandler = async (context: Context) => {
    if (!deps.reddit || !deps.redis) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }

    const body = await readMenuBody(context);
    const resolution = await resolveTargetById(deps.reddit, targetIdFromBody(body));

    if (!resolution.ok || !resolution.target) {
      return context.json({ ok: false, message: resolution.error ?? 'Target not found.' }, 404);
    }

    const lock = await getActiveLockByTarget(deps.redis, resolution.target.subreddit, resolution.target.id);

    if (!lock) {
      return context.json({ ok: true, message: 'No active ReviewLock lock was found for this content.' });
    }

    return context.json({ ok: true, form: buildUnlockReviewForm(lock.id) });
  };

  router.post('/lock-post', lockHandler);
  router.post('/lock-comment', lockHandler);
  router.post('/unlock-post', unlockHandler);
  router.post('/unlock-comment', unlockHandler);
  router.post('/open-dashboard', (context) =>
    context.json({
      ok: true,
      form: {
        form: 'dashboardLaunch',
        title: 'Open ReviewLock dashboard',
        fields: { copy: 'Lock reviewed content until it changes.' },
      },
    }),
  );

  return router;
};

export const menuRouter = createMenuRouter();
