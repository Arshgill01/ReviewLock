import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import type { LockReasonPreset } from '../shared/schema';
import { lockReviewedContent } from '../server/services/lockFlow';
import { unlockReviewedContent } from '../server/services/unlockFlow';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

interface LockSubmitBody {
  targetId?: string;
  actor?: string;
  lockReason?: LockReasonPreset;
  customNote?: string;
  expiresAt?: string;
}

interface UnlockSubmitBody {
  targetId?: string;
  actor?: string;
}

const readJson = async <T>(context: Context): Promise<T> => {
  try {
    return (await context.req.json()) as T;
  } catch {
    return {} as T;
  }
};

export const createFormsRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  router.post('/lock-review-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }
    const flowDeps = { reddit: deps.reddit, redis: deps.redis, clock: deps.clock };

    const body = await readJson<LockSubmitBody>(context);

    if (!body.targetId || !body.actor || !body.lockReason) {
      return context.json({ ok: false, message: 'Target, actor, and reason are required.' }, 400);
    }

    const result = await lockReviewedContent(flowDeps, {
      targetId: body.targetId,
      actor: body.actor,
      lockReason: body.lockReason,
      customNote: body.customNote,
      expiresAt: body.expiresAt,
    });

    return context.json(result, result.ok ? 200 : 400);
  });

  router.post('/unlock-review-submit', async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }
    const flowDeps = { reddit: deps.reddit, redis: deps.redis, clock: deps.clock };

    const body = await readJson<UnlockSubmitBody>(context);

    if (!body.targetId || !body.actor) {
      return context.json({ ok: false, message: 'Target and actor are required.' }, 400);
    }

    return context.json(await unlockReviewedContent(flowDeps, { targetId: body.targetId, actor: body.actor }));
  });

  router.post('/dashboard-launch-submit', (context) =>
    context.json({
      ok: true,
      message: 'ReviewLock dashboard can be opened from the subreddit app surface.',
    }),
  );
  router.post('/reopen-action-submit', (context) =>
    context.json({
      ok: true,
      message: 'Reopen actions are wired by the reopen flow wave.',
    }),
  );

  return router;
};

export const formsRouter = createFormsRouter();
