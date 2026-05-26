import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { handleReportTrigger } from '../server/services/reportTriggers';
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
  nestedRecord(body, 'postReport'),
  nestedRecord(body, 'commentReport'),
].filter((payload): payload is TriggerBody => payload !== undefined);

const first = <T>(values: (T | undefined)[]): T | undefined =>
  values.find((value): value is T => value !== undefined);

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const reportCountValue = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

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

const eventId = (body: TriggerBody): string | undefined =>
  first(payloads(body).map((payload) => stringValue(payload.eventId) ?? stringValue(payload.id)));

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

const reportCount = (body: TriggerBody, kind: TargetKind): number | undefined =>
  first(
    payloads(body).flatMap((payload) => {
      const post = nestedRecord(payload, 'post');
      const comment = nestedRecord(payload, 'comment');

      return kind === 'post'
        ? [
            reportCountValue(payload.reportCount),
            reportCountValue(post?.numberOfReports),
            reportCountValue(post?.numReports),
          ]
        : [
            reportCountValue(comment?.numberOfReports),
            reportCountValue(comment?.numReports),
            reportCountValue(payload.reportCount),
            reportCountValue(post?.numberOfReports),
            reportCountValue(post?.numReports),
          ];
    }),
  );

const reportedAt = (body: TriggerBody): string | undefined =>
  first(
    payloads(body).map(
      (payload) => stringValue(payload.reportedAt) ?? stringValue(payload.timestamp),
    ),
  );

export const createReportTriggersRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  const handler = (kind: TargetKind) => async (context: Context) => {
    if (!deps.reddit || !deps.redis || !deps.clock) {
      return context.json({ ok: false, error: 'ReviewLock dependencies are not configured.' }, 503);
    }

    const body = await readBody(context);
    logTriggerPayloadShape(
      deps.logger,
      kind === 'post' ? 'on-post-report' : 'on-comment-report',
      kind,
      body,
    );
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
          reportCount: reportCount(body, kind),
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
