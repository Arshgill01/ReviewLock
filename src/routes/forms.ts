import { Hono } from 'hono';

export const formsRouter = new Hono();

const placeholderFormResponse = (form: string) => ({
  ok: true,
  form,
  message: 'ReviewLock form scaffolded; implementation is owned by a later wave.',
});

formsRouter.post('/lock-review-submit', (context) =>
  context.json(placeholderFormResponse('lockReview')),
);
formsRouter.post('/unlock-review-submit', (context) =>
  context.json(placeholderFormResponse('unlockReview')),
);
formsRouter.post('/dashboard-launch-submit', (context) =>
  context.json(placeholderFormResponse('dashboardLaunch')),
);
formsRouter.post('/reopen-action-submit', (context) =>
  context.json(placeholderFormResponse('reopenAction')),
);
