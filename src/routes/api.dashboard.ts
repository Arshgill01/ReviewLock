import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import {
  getActiveLocksData,
  getAuditLogData,
  getDashboardData,
  getReopenQueueData,
} from '../server/services/dashboard';
import { listDailyMetrics, listTopTargetMetrics } from '../server/services/metrics';
import { loadRuntimeProofStatus } from '../server/services/runtimeProof';

interface RouteDeps {
  redis?: RedisStore;
  clock?: Clock;
}

const subredditFrom = (context: Context): string =>
  context.req.query('subreddit') ?? context.req.header('x-subreddit') ?? 'reviewlock';

const demoFrom = (context: Context): boolean => context.req.query('demo') === 'true';

const generatedAt = (deps: RouteDeps): string => deps.clock?.now() ?? new Date().toISOString();

const requestId = (): string => `req-${Date.now()}`;

const withErrors = async (context: Context, action: () => Promise<Response>): Promise<Response> => {
  try {
    return await action();
  } catch (error) {
    return context.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown dashboard API error',
        requestId: requestId(),
      },
      500,
    );
  }
};

export const createDashboardApiRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  router.get('/overview', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json({ ok: false, error: 'Redis adapter is not configured.', requestId: requestId() }, 503);
      }

      const data = await getDashboardData(deps.redis, {
        subreddit: subredditFrom(context),
        demo: demoFrom(context),
        now: generatedAt(deps),
      });

      return context.json({
        ok: true,
        demo: data.demo,
        generatedAt: data.generatedAt,
        overview: data.overview,
      });
    }),
  );

  router.get('/locks', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json({ ok: false, error: 'Redis adapter is not configured.', requestId: requestId() }, 503);
      }

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        locks: await getActiveLocksData(deps.redis, { subreddit: subredditFrom(context) }),
      });
    }),
  );

  router.get('/reopen-queue', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json({ ok: false, error: 'Redis adapter is not configured.', requestId: requestId() }, 503);
      }

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        events: await getReopenQueueData(deps.redis, { subreddit: subredditFrom(context) }),
      });
    }),
  );

  router.get('/audit', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json({ ok: false, error: 'Redis adapter is not configured.', requestId: requestId() }, 503);
      }

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        events: await getAuditLogData(deps.redis, { subreddit: subredditFrom(context) }),
      });
    }),
  );

  router.get('/runtime', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json({ ok: false, error: 'Redis adapter is not configured.', requestId: requestId() }, 503);
      }

      const subreddit = subredditFrom(context);

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        runtime: await loadRuntimeProofStatus(deps.redis, subreddit, generatedAt(deps)),
        dailyMetrics: await listDailyMetrics(deps.redis, subreddit),
        topChurnTargets: await listTopTargetMetrics(deps.redis, subreddit),
      });
    }),
  );

  return router;
};

export const dashboardApiRouter = createDashboardApiRouter();
