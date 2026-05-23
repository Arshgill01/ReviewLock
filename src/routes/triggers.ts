import { Hono } from 'hono';

export const triggersRouter = new Hono();

const placeholderTriggerResponse = (trigger: string) => ({
  ok: true,
  trigger,
  message: 'ReviewLock trigger scaffolded; implementation is owned by a later wave.',
});

triggersRouter.post('/on-app-install', (context) =>
  context.json(placeholderTriggerResponse('onAppInstall')),
);
triggersRouter.post('/on-app-upgrade', (context) =>
  context.json(placeholderTriggerResponse('onAppUpgrade')),
);
triggersRouter.post('/on-post-report', (context) =>
  context.json(placeholderTriggerResponse('onPostReport')),
);
triggersRouter.post('/on-comment-report', (context) =>
  context.json(placeholderTriggerResponse('onCommentReport')),
);
triggersRouter.post('/on-post-update', (context) =>
  context.json(placeholderTriggerResponse('onPostUpdate')),
);
triggersRouter.post('/on-comment-update', (context) =>
  context.json(placeholderTriggerResponse('onCommentUpdate')),
);
triggersRouter.post('/on-post-nsfw-update', (context) =>
  context.json(placeholderTriggerResponse('onPostNsfwUpdate')),
);
triggersRouter.post('/on-post-spoiler-update', (context) =>
  context.json(placeholderTriggerResponse('onPostSpoilerUpdate')),
);
triggersRouter.post('/on-post-flair-update', (context) =>
  context.json(placeholderTriggerResponse('onPostFlairUpdate')),
);
