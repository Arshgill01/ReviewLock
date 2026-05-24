import { Hono } from 'hono';
import type { Clock } from './server/adapters/clock';
import { systemClock } from './server/adapters/clock';
import { InMemoryRedisStore, type RedisStore } from './server/adapters/redis';
import type { RedditAdapter } from './server/adapters/reddit';
import { createApiRouter } from './routes/api';
import { createFormsRouter } from './routes/forms';
import { createMenuRouter } from './routes/menu';
import { createTriggersRouter } from './routes/triggers';

export interface ReviewLockAppDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
  getCurrentSubredditName?: () => string | undefined;
}

export const createApp = (deps: ReviewLockAppDeps = {}): Hono => {
  const app = new Hono();
  const resolvedDeps = {
    redis: deps.redis ?? new InMemoryRedisStore(),
    clock: deps.clock ?? systemClock,
    reddit: deps.reddit,
    getCurrentSubredditName: deps.getCurrentSubredditName,
  };

  app.route('/api', createApiRouter(resolvedDeps));
  app.route('/internal/menu', createMenuRouter(resolvedDeps));
  app.route('/internal/form', createFormsRouter(resolvedDeps));
  app.route('/internal/triggers', createTriggersRouter(resolvedDeps));

  return app;
};
