import { serve } from '@hono/node-server';
import { context, createServer, getServerPort, reddit, redis } from '@devvit/web/server';
import { createApp } from './app';
import { createDevvitRedisStore } from './server/adapters/redis';
import { createRedditAdapterFromContext } from './server/adapters/reddit';

export { createApp } from './app';

const app = createApp({
  redis: createDevvitRedisStore(redis),
  reddit: createRedditAdapterFromContext({ reddit }),
  getCurrentSubredditName: () => context.subredditName,
  logger: console,
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
