import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { handleReportTrigger } from '../server/services/reportTriggers';
import { normalizeTargetId } from '../server/services/targetResolver';
import type { TargetKind } from '../shared/schema';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

interface TriggerBody {
  targetId?: string;
  postId?: string;
  commentId?: string;
  id?: string;
  eventId?: string;
  timestamp?: string;
  reportedAt?: string;
  reportCount?: number;
  subreddit?: string | { name?: string };
  post?: {
    id?: string;
    subredditName?: string;
    numberOfReports?: number;
    numReports?: number;
  };
  comment?: {
    id?: string;
    subredditName?: string;
    numberOfReports?: number;
    numReports?: number;
  };
  postReport?: TriggerBody;
  commentReport?: TriggerBody;
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
  ...(body.postReport ? [body.postReport] : []),
  ...(body.commentReport ? [body.commentReport] : []),
];

const first = <T>(values: (T | undefined)[]): T | undefined =>
  values.find((value): value is T => value !== undefined);

const targetId = (body: TriggerBody, kind: TargetKind): string | undefined =>
  normalizeTargetId(
    kind,
    first(
    payloads(body).flatMap((payload) => [
      payload.targetId,
      payload.postId,
      payload.commentId,
      payload.post?.id,
      payload.comment?.id,
    ]),
    ),
  );

const eventId = (body: TriggerBody): string | undefined => body.eventId ?? body.id;

const subreddit = (body: TriggerBody): string | undefined =>
  first(
    payloads(body).flatMap((payload) => [
      typeof payload.subreddit === 'string' ? payload.subreddit : payload.subreddit?.name,
      payload.post?.subredditName,
      payload.comment?.subredditName,
    ]),
  );

const reportCount = (body: TriggerBody): number | undefined =>
  first(
    payloads(body).flatMap((payload) => [
      payload.reportCount,
      payload.post?.numberOfReports,
      payload.post?.numReports,
      payload.comment?.numberOfReports,
      payload.comment?.numReports,
    ]),
  );

const reportedAt = (body: TriggerBody): string | undefined => body.reportedAt ?? body.timestamp;

export const createReportTriggersRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  const handler = (kind: TargetKind) => async (context: Context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }

    const body = await readBody(context);
    const id = targetId(body, kind);

    if (!id) {
      return context.json({ ok: false, error: 'Report trigger target id is required.' }, 400);
    }

    return context.json(
      await handleReportTrigger(
        { reddit: deps.reddit, redis: deps.redis, clock: deps.clock },
        {
          targetId: id,
          eventId: eventId(body),
          reportedAt: reportedAt(body),
          reportCount: reportCount(body),
          subreddit: subreddit(body),
        },
      ),
    );
  };

  router.post('/on-post-report', handler('post'));
  router.post('/on-comment-report', handler('comment'));

  return router;
};

export const reportTriggersRouter = createReportTriggersRouter();
