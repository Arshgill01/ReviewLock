import { Hono } from 'hono';

export const menuRouter = new Hono();

const placeholderMenuResponse = (action: string) => ({
  ok: true,
  action,
  message: 'ReviewLock route scaffolded; implementation is owned by a later wave.',
});

menuRouter.post('/lock-post', (context) => context.json(placeholderMenuResponse('lock-post')));
menuRouter.post('/lock-comment', (context) => context.json(placeholderMenuResponse('lock-comment')));
menuRouter.post('/unlock-post', (context) => context.json(placeholderMenuResponse('unlock-post')));
menuRouter.post('/unlock-comment', (context) => context.json(placeholderMenuResponse('unlock-comment')));
menuRouter.post('/open-dashboard', (context) => context.json(placeholderMenuResponse('open-dashboard')));
