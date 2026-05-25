import { Hono } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import type { TriggerPayloadLogger } from './triggerPayloadLog';
import { createReportTriggersRouter } from './triggers.report';
import { createUpdateTriggersRouter } from './triggers.update';

interface TriggerDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
  logger?: TriggerPayloadLogger;
}

export const createTriggersRouter = (deps: TriggerDeps = {}): Hono => {
  const router = new Hono();

  router.post('/on-app-install', (context) =>
    context.json({ ok: true, trigger: 'onAppInstall', message: 'ReviewLock installed.' }),
  );
  router.post('/on-app-upgrade', (context) =>
    context.json({ ok: true, trigger: 'onAppUpgrade', message: 'ReviewLock upgraded.' }),
  );
  router.route('/', createReportTriggersRouter(deps));
  router.route('/', createUpdateTriggersRouter(deps));

  return router;
};

export const triggersRouter = createTriggersRouter();
