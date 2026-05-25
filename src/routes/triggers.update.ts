import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { handleUpdateTrigger, type UpdateTriggerKind } from '../server/services/updateTriggers';
import { normalizeTargetId } from '../server/services/targetResolver';
import type { TargetKind } from '../shared/schema';
import { logTriggerPayloadShape, type TriggerPayloadLogger } from './triggerPayloadLog';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
  logger?: TriggerPayloadLogger;
}

interface TriggerBody {
  targetId?: string;
  postId?: string;
  commentId?: string;
  subreddit?: string | { name?: string };
  post?: {
    id?: string;
    subredditName?: string;
  };
  comment?: {
    id?: string;
    subredditName?: string;
  };
  postUpdate?: TriggerBody;
  commentUpdate?: TriggerBody;
  postFlairUpdate?: TriggerBody;
  postNsfwUpdate?: TriggerBody;
  postSpoilerUpdate?: TriggerBody;
  nsfwPostUpdate?: TriggerBody;
  spoilerPostUpdate?: TriggerBody;
}

const readBody = async (context: Context): Promise<TriggerBody> => {
  try {
    return (await context.req.json()) as TriggerBody;
  } catch {
    return {};
  }
};

const payloads = (body: TriggerBody): TriggerBody[] => [
  body,
  ...(body.postUpdate ? [body.postUpdate] : []),
  ...(body.commentUpdate ? [body.commentUpdate] : []),
  ...(body.postFlairUpdate ? [body.postFlairUpdate] : []),
  ...(body.postNsfwUpdate ? [body.postNsfwUpdate] : []),
  ...(body.postSpoilerUpdate ? [body.postSpoilerUpdate] : []),
  ...(body.nsfwPostUpdate ? [body.nsfwPostUpdate] : []),
  ...(body.spoilerPostUpdate ? [body.spoilerPostUpdate] : []),
];

const first = <T>(values: (T | undefined)[]): T | undefined =>
  values.find((value): value is T => value !== undefined);

const targetId = (body: TriggerBody, kind: TargetKind): string | undefined =>
  normalizeTargetId(
    kind,
    first(
      payloads(body).flatMap((payload) =>
        kind === 'post'
          ? [payload.targetId, payload.postId, payload.post?.id]
          : [payload.commentId, payload.comment?.id, payload.targetId],
      ),
    ),
  );

const subreddit = (body: TriggerBody): string | undefined =>
  first(
    payloads(body).flatMap((payload) => [
      typeof payload.subreddit === 'string' ? payload.subreddit : payload.subreddit?.name,
      payload.post?.subredditName,
      payload.comment?.subredditName,
    ]),
  );

const registerUpdate = (
  router: Hono,
  path: string,
  targetKind: TargetKind,
  triggerKind: UpdateTriggerKind,
  deps: RouteDeps,
) => {
  router.post(path, async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }

    const body = await readBody(context);
    logTriggerPayloadShape(deps.logger, path.slice(1), targetKind, body);
    const id = targetId(body, targetKind);

    if (!id) {
      return context.json({ ok: false, error: 'Update trigger target id is required.' }, 400);
    }

    return context.json(
      await handleUpdateTrigger(
        { reddit: deps.reddit, redis: deps.redis, clock: deps.clock },
        { targetId: id, subreddit: subreddit(body), triggerKind },
      ),
    );
  });
};

export const createUpdateTriggersRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  registerUpdate(router, '/on-post-update', 'post', 'post_update', deps);
  registerUpdate(router, '/on-comment-update', 'comment', 'comment_update', deps);
  registerUpdate(router, '/on-post-nsfw-update', 'post', 'post_nsfw_update', deps);
  registerUpdate(router, '/on-post-spoiler-update', 'post', 'post_spoiler_update', deps);
  registerUpdate(router, '/on-post-flair-update', 'post', 'post_flair_update', deps);

  return router;
};

export const updateTriggersRouter = createUpdateTriggersRouter();
