import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { handleReportTrigger } from '../server/services/reportTriggers';

interface RouteDeps {
  reddit?: RedditAdapter;
  redis?: RedisStore;
  clock?: Clock;
}

interface TriggerBody {
  targetId?: string;
  postId?: string;
  commentId?: string;
  eventId?: string;
  reportedAt?: string;
  reportCount?: number;
  subreddit?: string;
}

const readBody = async (context: Context): Promise<TriggerBody> => {
  try {
    return (await context.req.json()) as TriggerBody;
  } catch {
    return {};
  }
};

const targetId = (body: TriggerBody): string | undefined => body.targetId ?? body.postId ?? body.commentId;

export const createReportTriggersRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  const handler = async (context: Context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }

    const body = await readBody(context);
    const id = targetId(body);

    if (!id) {
      return context.json({ ok: false, error: 'Report trigger target id is required.' }, 400);
    }

    return context.json(
      await handleReportTrigger(
        { reddit: deps.reddit, redis: deps.redis, clock: deps.clock },
        {
          targetId: id,
          eventId: body.eventId,
          reportedAt: body.reportedAt,
          reportCount: body.reportCount,
          subreddit: body.subreddit,
        },
      ),
    );
  };

  router.post('/on-post-report', handler);
  router.post('/on-comment-report', handler);

  return router;
};

export const reportTriggersRouter = createReportTriggersRouter();
