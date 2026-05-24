import { Hono } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import {
  failedSmokeResult,
  normalizeRuntimeSubreddit,
  verifiedSmokeResult,
} from '../server/services/runtimeHardening';
import { key } from '../server/services/keys';
import { recordCapabilityStatus } from '../server/services/runtimeProof';
import { createDashboardApiRouter } from './api.dashboard';
import { createDemoApiRouter } from './api.demo';

interface ApiDeps {
  redis?: RedisStore;
  reddit?: RedditAdapter;
  clock?: Clock;
  getCurrentSubredditName?: () => string | undefined;
}

export const createApiRouter = (deps: ApiDeps = {}): Hono => {
  const router = new Hono();

  router.get('/health', (context) =>
    context.json({
      ok: true,
      service: 'reviewlock',
      status: 'integrated',
    }),
  );

  router.get('/context', async (context) => {
    const subreddit = deps.getCurrentSubredditName?.() ?? (await deps.reddit?.getCurrentSubredditName());

    return context.json({
      ok: true,
      subreddit: subreddit ?? null,
    });
  });

  router.post('/smoke/redis', async (context) => {
    if (!deps.redis) {
      return context.json({ ok: false, error: 'Redis adapter is not configured.' }, 503);
    }

    const checkedAt = deps.clock?.now() ?? new Date().toISOString();

    try {
      const subreddit = normalizeRuntimeSubreddit(context.req.query('subreddit'));
      const smokeKey = key(subreddit, `runtime:smoke:${Date.parse(checkedAt)}`);
      const value = `reviewlock-smoke:${checkedAt}`;

      await deps.redis.set(smokeKey, value);
      const observed = await deps.redis.get(smokeKey);
      await deps.redis.del(smokeKey);

      if (observed !== value) {
        throw new Error('Redis smoke read did not match the written value.');
      }

      const result = verifiedSmokeResult(
        'redis',
        'POST /api/smoke/redis wrote, read, and deleted a namespaced smoke key.',
        [`key=${smokeKey}`],
        checkedAt,
      );
      await recordCapabilityStatus(
        deps.redis,
        subreddit,
        {
          name: result.capability,
          status: result.status,
          checkedAt: result.checkedAt,
          evidence: result.evidence,
          notes: result.notes,
        },
        checkedAt,
      );

      return context.json({ ok: true, subreddit, capability: result.capability, status: result.status });
    } catch (error) {
      const result = failedSmokeResult(
        'redis',
        'POST /api/smoke/redis could not complete the namespaced write/read/delete check.',
        error,
        checkedAt,
      );

      return context.json({ ok: false, capability: result.capability, status: result.status, error: result.notes[0] }, 500);
    }
  });

  router.post('/smoke/reddit', async (context) => {
    if (!deps.reddit) {
      return context.json({ ok: false, error: 'Reddit adapter is not configured.' }, 503);
    }

    const checkedAt = deps.clock?.now() ?? new Date().toISOString();

    try {
      const subreddit = normalizeRuntimeSubreddit(context.req.query('subreddit'));
      const username = await deps.reddit.getCurrentUsername();

      if (!username) {
        throw new Error('Reddit context did not return a current username.');
      }

      const result = verifiedSmokeResult(
        'redditContext',
        'POST /api/smoke/reddit confirmed the Devvit Reddit context returned a current user.',
        ['usernamePresent=true'],
        checkedAt,
      );

      if (deps.redis) {
        await recordCapabilityStatus(
          deps.redis,
          subreddit,
          {
            name: result.capability,
            status: result.status,
            checkedAt: result.checkedAt,
            evidence: result.evidence,
            notes: result.notes,
          },
          checkedAt,
        );
      }

      return context.json({
        ok: true,
        subreddit,
        capability: result.capability,
        status: result.status,
        usernamePresent: true,
      });
    } catch (error) {
      const result = failedSmokeResult(
        'redditContext',
        'POST /api/smoke/reddit could not confirm the Devvit Reddit context.',
        error,
        checkedAt,
      );

      return context.json({ ok: false, capability: result.capability, status: result.status, error: result.notes[0] }, 500);
    }
  });

  router.route('/', createDashboardApiRouter(deps));
  router.route('/', createDemoApiRouter(deps));

  return router;
};

export const apiRouter = createApiRouter();
