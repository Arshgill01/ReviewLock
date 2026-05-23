import { Hono } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import { DEMO_SUBREDDIT } from '../shared/constants';
import {
  disableDemoMode,
  enableDemoMode,
  getDemoModeStatus,
  resetDemoMode,
} from '../server/services/demoMode';

interface RouteDeps {
  redis?: RedisStore;
  clock?: Clock;
}

const requestId = (): string => `req-${Date.now()}`;

const configured = (deps: RouteDeps): deps is { redis: RedisStore; clock: Clock } =>
  deps.redis !== undefined && deps.clock !== undefined;

export const createDemoApiRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  router.get('/demo/status', async (context) => {
    if (!deps.redis) {
      return context.json({ ok: false, demo: true, error: 'Redis adapter is not configured.', requestId: requestId() }, 503);
    }

    const subreddit = context.req.query('subreddit') ?? DEMO_SUBREDDIT;
    return context.json({ ok: true, demo: true, status: await getDemoModeStatus(deps.redis, subreddit) });
  });

  router.post('/demo/enable', async (context) => {
    if (!configured(deps)) {
      return context.json({ ok: false, demo: true, error: 'Demo dependencies are not configured.', requestId: requestId() }, 503);
    }

    return context.json({ ok: true, demo: true, status: await enableDemoMode(deps.redis, deps.clock.now()) });
  });

  router.post('/demo/reset', async (context) => {
    if (!configured(deps)) {
      return context.json({ ok: false, demo: true, error: 'Demo dependencies are not configured.', requestId: requestId() }, 503);
    }

    return context.json({ ok: true, demo: true, status: await resetDemoMode(deps.redis, deps.clock.now()) });
  });

  router.post('/demo/disable', async (context) => {
    if (!configured(deps)) {
      return context.json({ ok: false, demo: true, error: 'Demo dependencies are not configured.', requestId: requestId() }, 503);
    }

    const subreddit = context.req.query('subreddit') ?? DEMO_SUBREDDIT;
    return context.json({
      ok: true,
      demo: true,
      status: await disableDemoMode(deps.redis, subreddit, deps.clock.now()),
    });
  });

  return router;
};

export const demoApiRouter = createDemoApiRouter();
