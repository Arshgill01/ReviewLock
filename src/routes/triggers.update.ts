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

type TriggerBody = Record<string, unknown>;

const isRecord = (value: unknown): value is TriggerBody =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readBody = async (context: Context): Promise<TriggerBody> => {
  try {
    const body = (await context.req.json()) as unknown;
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
};

const nestedRecord = (body: TriggerBody, key: string): TriggerBody | undefined =>
  isRecord(body[key]) ? body[key] : undefined;

const payloads = (body: TriggerBody): TriggerBody[] => [
  body,
  nestedRecord(body, 'postUpdate'),
  nestedRecord(body, 'commentUpdate'),
  nestedRecord(body, 'postFlairUpdate'),
  nestedRecord(body, 'postNsfwUpdate'),
  nestedRecord(body, 'postSpoilerUpdate'),
  nestedRecord(body, 'nsfwPostUpdate'),
  nestedRecord(body, 'spoilerPostUpdate'),
].filter((payload): payload is TriggerBody => payload !== undefined);

const first = <T>(values: (T | undefined)[]): T | undefined =>
  values.find((value): value is T => value !== undefined);

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const targetId = (body: TriggerBody, kind: TargetKind): string | undefined =>
  normalizeTargetId(
    kind,
    first(
      payloads(body).flatMap((payload) => {
        const post = nestedRecord(payload, 'post');
        const comment = nestedRecord(payload, 'comment');

        return kind === 'post'
          ? [payload.targetId, payload.postId, post?.id]
          : [payload.commentId, comment?.id, payload.targetId];
      }),
    ),
  );

const subredditFromPayload = (payload: TriggerBody): string | undefined => {
  const subreddit = payload.subreddit;
  const post = nestedRecord(payload, 'post');
  const comment = nestedRecord(payload, 'comment');

  return first([
    stringValue(subreddit),
    isRecord(subreddit) ? stringValue(subreddit.name) : undefined,
    stringValue(post?.subredditName),
    stringValue(comment?.subredditName),
  ]);
};

const subreddit = (body: TriggerBody): string | undefined =>
  first(payloads(body).map((payload) => subredditFromPayload(payload)));

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
