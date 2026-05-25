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

  const currentSubredditFromRuntime = async (): Promise<string | undefined> => {
    const configured = deps.getCurrentSubredditName?.();

    if (configured) {
      return configured;
    }

    try {
      return await deps.reddit?.getCurrentSubredditName();
    } catch {
      return undefined;
    }
  };

  const resolveSmokeSubreddit = async (
    requested: string | null | undefined,
  ): Promise<{ ok: true; subreddit: string } | { ok: false; response: Response }> => {
    let clientSubreddit: string | undefined;
    let runtimeSubreddit: string | undefined;

    try {
      clientSubreddit = requested ? normalizeRuntimeSubreddit(requested) : undefined;
      const current = await currentSubredditFromRuntime();
      runtimeSubreddit = current ? normalizeRuntimeSubreddit(current) : undefined;
    } catch (error) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : 'Invalid subreddit scope.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }

    if (runtimeSubreddit && clientSubreddit && runtimeSubreddit !== clientSubreddit) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            ok: false,
            error: 'Runtime smoke subreddit scope does not match the Devvit runtime subreddit.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }

    if (!runtimeSubreddit) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            ok: false,
            error: 'Runtime smoke subreddit context is required.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }

    return { ok: true, subreddit: runtimeSubreddit };
  };

  router.get('/health', (context) =>
    context.json({
      ok: true,
      service: 'reviewlock',
      status: 'integrated',
    }),
  );

  router.get('/context', async (context) => {
    const subreddit =
      deps.getCurrentSubredditName?.() ?? (await deps.reddit?.getCurrentSubredditName());

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
    let smokeSubreddit: string | undefined;

    try {
      const scope = await resolveSmokeSubreddit(context.req.query('subreddit'));

      if (!scope.ok) {
        return scope.response;
      }

      const subreddit = scope.subreddit;
      smokeSubreddit = subreddit;
      const smokeKey = key(subreddit, `runtime:smoke:${Date.parse(checkedAt)}`);
      const sortedSetSmokeKey = key(subreddit, `runtime:smoke:zset:${Date.parse(checkedAt)}`);
      const value = `reviewlock-smoke:${checkedAt}`;

      await deps.redis.set(smokeKey, value);
      const observed = await deps.redis.get(smokeKey);
      await deps.redis.del(smokeKey);

      if (observed !== value) {
        throw new Error('Redis smoke read did not match the written value.');
      }

      try {
        await deps.redis.zAdd(sortedSetSmokeKey, { member: 'oldest', score: 1 });
        await deps.redis.zAdd(sortedSetSmokeKey, { member: 'middle', score: 2 });
        await deps.redis.zAdd(sortedSetSmokeKey, { member: 'newest', score: 3 });
        const observedOrder = (await deps.redis.zRange(sortedSetSmokeKey, 0, 2, true)).map(
          (entry) => entry.member,
        );

        if (observedOrder.join(',') !== 'newest,middle,oldest') {
          throw new Error('Redis sorted-set smoke order did not match newest-first order.');
        }
      } finally {
        await deps.redis.del(sortedSetSmokeKey).catch(() => undefined);
      }

      const result = verifiedSmokeResult(
        'redis',
        'POST /api/smoke/redis verified namespaced string and sorted-set operations.',
        [`key=${smokeKey}`, `zset=${sortedSetSmokeKey}`, 'zRange=newest,middle,oldest'],
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

      return context.json({
        ok: true,
        subreddit,
        capability: result.capability,
        status: result.status,
      });
    } catch (error) {
      const result = failedSmokeResult(
        'redis',
        'POST /api/smoke/redis could not complete the namespaced Redis operation check.',
        error,
        checkedAt,
      );
      if (smokeSubreddit) {
        await recordCapabilityStatus(
          deps.redis,
          smokeSubreddit,
          {
            name: result.capability,
            status: result.status,
            checkedAt: result.checkedAt,
            evidence: result.evidence,
            notes: result.notes,
          },
          checkedAt,
        ).catch(() => undefined);
      }

      return context.json(
        { ok: false, capability: result.capability, status: result.status, error: result.notes[0] },
        500,
      );
    }
  });

  router.post('/smoke/reddit', async (context) => {
    if (!deps.reddit) {
      return context.json({ ok: false, error: 'Reddit adapter is not configured.' }, 503);
    }

    const checkedAt = deps.clock?.now() ?? new Date().toISOString();
    let smokeSubreddit: string | undefined;

    try {
      const scope = await resolveSmokeSubreddit(context.req.query('subreddit'));

      if (!scope.ok) {
        return scope.response;
      }

      const subreddit = scope.subreddit;
      smokeSubreddit = subreddit;
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
      if (deps.redis && smokeSubreddit) {
        await recordCapabilityStatus(
          deps.redis,
          smokeSubreddit,
          {
            name: result.capability,
            status: result.status,
            checkedAt: result.checkedAt,
            evidence: result.evidence,
            notes: result.notes,
          },
          checkedAt,
        ).catch(() => undefined);
      }

      return context.json(
        { ok: false, capability: result.capability, status: result.status, error: result.notes[0] },
        500,
      );
    }
  });

  router.route('/', createDashboardApiRouter(deps));
  router.route('/', createDemoApiRouter(deps));

  return router;
};

export const apiRouter = createApiRouter();
