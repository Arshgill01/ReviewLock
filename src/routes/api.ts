import { Hono } from 'hono';

export const apiRouter = new Hono();

apiRouter.get('/health', (context) =>
  context.json({
    ok: true,
    service: 'reviewlock',
    status: 'scaffolded',
  }),
);
