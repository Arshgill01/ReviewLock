import { Hono } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import { createDashboardApiRouter } from './api.dashboard';
import { createDemoApiRouter } from './api.demo';

interface ApiDeps {
  redis?: RedisStore;
  clock?: Clock;
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
  router.route('/', createDashboardApiRouter(deps));
  router.route('/', createDemoApiRouter(deps));

  return router;
};

export const apiRouter = createApiRouter();
