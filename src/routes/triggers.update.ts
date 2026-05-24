import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { handleUpdateTrigger, type UpdateTriggerKind } from '../server/services/updateTriggers';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
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
}

const readBody = async (context: Context): Promise<TriggerBody> => {
  try {
    return (await context.req.json()) as TriggerBody;
  } catch {
    return {};
  }
};

const targetId = (body: TriggerBody): string | undefined =>
  body.targetId ?? body.postId ?? body.commentId ?? body.post?.id ?? body.comment?.id;

const subreddit = (body: TriggerBody): string | undefined =>
  (typeof body.subreddit === 'string' ? body.subreddit : body.subreddit?.name) ??
  body.post?.subredditName ??
  body.comment?.subredditName;

const registerUpdate = (
  router: Hono,
  path: string,
  triggerKind: UpdateTriggerKind,
  deps: RouteDeps,
) => {
  router.post(path, async (context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }

    const body = await readBody(context);
    const id = targetId(body);

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

  registerUpdate(router, '/on-post-update', 'post_update', deps);
  registerUpdate(router, '/on-comment-update', 'comment_update', deps);
  registerUpdate(router, '/on-post-nsfw-update', 'post_nsfw_update', deps);
  registerUpdate(router, '/on-post-spoiler-update', 'post_spoiler_update', deps);
  registerUpdate(router, '/on-post-flair-update', 'post_flair_update', deps);

  return router;
};

export const updateTriggersRouter = createUpdateTriggersRouter();
