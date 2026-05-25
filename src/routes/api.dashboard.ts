import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Clock } from '../server/adapters/clock';
import type { RedisStore } from '../server/adapters/redis';
import type { RedditAdapter } from '../server/adapters/reddit';
import { DEMO_SUBREDDIT } from '../shared/constants';
import { appendAuditEvent } from '../server/services/audit';
import {
  getActiveLocksData,
  getAuditLogData,
  getDashboardData,
  getReopenQueueData,
} from '../server/services/dashboard';
import { listDailyMetrics, listTopTargetMetrics } from '../server/services/metrics';
import { dismissReopenEvent, getReopenEvent } from '../server/services/reopenQueue';
import { normalizeRuntimeSubreddit } from '../server/services/runtimeHardening';
import { loadRuntimeProofStatus } from '../server/services/runtimeProof';
import { unlockReviewedContent } from '../server/services/unlockFlow';

interface RouteDeps {
  redis?: RedisStore;
  clock?: Clock;
  reddit?: RedditAdapter;
  getCurrentSubredditName?: () => string | undefined;
}

interface UnlockBody {
  targetId?: string;
  lockId?: string;
  actor?: string;
}

interface DismissReopenBody {
  eventId?: string;
  actor?: string;
  subreddit?: string;
}

const requestedSubredditFrom = (context: Context, override?: string): string | undefined =>
  override ?? context.req.query('subreddit') ?? context.req.header('x-subreddit') ?? undefined;

const demoFrom = (context: Context): boolean => context.req.query('demo') === 'true';

const generatedAt = (deps: RouteDeps): string => deps.clock?.now() ?? new Date().toISOString();

const requestId = (): string => `req-${Date.now()}`;

const readJson = async <T>(context: Context): Promise<T> => {
  try {
    return (await context.req.json()) as T;
  } catch {
    return {} as T;
  }
};

const actorFromReddit = async (
  reddit: RedditAdapter | undefined,
  fallback?: string,
): Promise<string> => {
  const fallbackActor = fallback?.trim() || 'unknown_moderator';

  try {
    return (await reddit?.getCurrentUsername()) || fallbackActor;
  } catch {
    return fallbackActor;
  }
};

const currentSubredditFromRuntime = async (deps: RouteDeps): Promise<string | undefined> => {
  const configured = deps.getCurrentSubredditName?.();

  if (configured) {
    return configured;
  }

  try {
    return await deps.reddit?.getCurrentSubredditName();
  } catch {
    return undefined;
  }
};

const resolveScopedSubreddit = async (
  context: Context,
  deps: RouteDeps,
  requested?: string,
): Promise<{ ok: true; subreddit: string } | { ok: false; response: Response }> => {
  let clientSubreddit: string | undefined;
  let runtimeSubreddit: string | undefined;

  try {
    const supplied = requestedSubredditFrom(context, requested);
    clientSubreddit = supplied ? normalizeRuntimeSubreddit(supplied) : undefined;
    const current = await currentSubredditFromRuntime(deps);
    runtimeSubreddit = current ? normalizeRuntimeSubreddit(current) : undefined;
  } catch (error) {
    return {
      ok: false,
      response: context.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Invalid subreddit scope.',
          requestId: requestId(),
        },
        400,
      ),
    };
  }

  if (demoFrom(context) && clientSubreddit && clientSubreddit !== DEMO_SUBREDDIT) {
    return {
      ok: false,
      response: context.json(
        {
          ok: false,
          error: 'Demo dashboard requests must use the isolated ReviewLock demo namespace.',
          requestId: requestId(),
        },
        403,
      ),
    };
  }

  if (
    !demoFrom(context) &&
    (clientSubreddit === DEMO_SUBREDDIT || runtimeSubreddit === DEMO_SUBREDDIT)
  ) {
    return {
      ok: false,
      response: context.json(
        {
          ok: false,
          error: 'ReviewLock demo data must be requested with demo mode enabled.',
          requestId: requestId(),
        },
        403,
      ),
    };
  }

  if (runtimeSubreddit && clientSubreddit && runtimeSubreddit !== clientSubreddit) {
    if (demoFrom(context) && clientSubreddit === DEMO_SUBREDDIT) {
      return { ok: true, subreddit: DEMO_SUBREDDIT };
    }

    return {
      ok: false,
      response: context.json(
        {
          ok: false,
          error: 'Dashboard subreddit scope does not match the Devvit runtime subreddit.',
          requestId: requestId(),
        },
        403,
      ),
    };
  }

  if (demoFrom(context)) {
    return { ok: true, subreddit: clientSubreddit ?? DEMO_SUBREDDIT };
  }

  if (!runtimeSubreddit) {
    return {
      ok: false,
      response: context.json(
        {
          ok: false,
          error: 'Dashboard subreddit context is required.',
          requestId: requestId(),
        },
        400,
      ),
    };
  }

  return {
    ok: true,
    subreddit: runtimeSubreddit,
  };
};

const withErrors = async (context: Context, action: () => Promise<Response>): Promise<Response> => {
  try {
    return await action();
  } catch (error) {
    return context.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown dashboard API error',
        requestId: requestId(),
      },
      500,
    );
  }
};

export const createDashboardApiRouter = (deps: RouteDeps = {}): Hono => {
  const router = new Hono();

  router.get('/overview', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json(
          { ok: false, error: 'Redis adapter is not configured.', requestId: requestId() },
          503,
        );
      }

      const scope = await resolveScopedSubreddit(context, deps);

      if (!scope.ok) {
        return scope.response;
      }

      const data = await getDashboardData(deps.redis, {
        subreddit: scope.subreddit,
        demo: demoFrom(context),
        now: generatedAt(deps),
      });

      return context.json({
        ok: true,
        demo: data.demo,
        generatedAt: data.generatedAt,
        overview: data.overview,
      });
    }),
  );

  router.get('/locks', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json(
          { ok: false, error: 'Redis adapter is not configured.', requestId: requestId() },
          503,
        );
      }

      const scope = await resolveScopedSubreddit(context, deps);

      if (!scope.ok) {
        return scope.response;
      }

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        locks: await getActiveLocksData(deps.redis, { subreddit: scope.subreddit }),
      });
    }),
  );

  router.get('/reopen-queue', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json(
          { ok: false, error: 'Redis adapter is not configured.', requestId: requestId() },
          503,
        );
      }

      const scope = await resolveScopedSubreddit(context, deps);

      if (!scope.ok) {
        return scope.response;
      }

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        events: await getReopenQueueData(deps.redis, { subreddit: scope.subreddit }),
      });
    }),
  );

  router.get('/audit', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json(
          { ok: false, error: 'Redis adapter is not configured.', requestId: requestId() },
          503,
        );
      }

      const scope = await resolveScopedSubreddit(context, deps);

      if (!scope.ok) {
        return scope.response;
      }

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        events: await getAuditLogData(deps.redis, { subreddit: scope.subreddit }),
      });
    }),
  );

  router.get('/runtime', (context) =>
    withErrors(context, async () => {
      if (!deps.redis) {
        return context.json(
          { ok: false, error: 'Redis adapter is not configured.', requestId: requestId() },
          503,
        );
      }

      const scope = await resolveScopedSubreddit(context, deps);

      if (!scope.ok) {
        return scope.response;
      }

      return context.json({
        ok: true,
        demo: demoFrom(context),
        generatedAt: generatedAt(deps),
        runtime: await loadRuntimeProofStatus(deps.redis, scope.subreddit, generatedAt(deps)),
        dailyMetrics: await listDailyMetrics(deps.redis, scope.subreddit),
        topChurnTargets: await listTopTargetMetrics(deps.redis, scope.subreddit),
      });
    }),
  );

  router.post('/locks/unlock', (context) =>
    withErrors(context, async () => {
      if (!deps.redis || !deps.reddit || !deps.clock) {
        return context.json(
          {
            ok: false,
            error: 'ReviewLock dependencies are not configured.',
            requestId: requestId(),
          },
          503,
        );
      }

      const body = await readJson<UnlockBody>(context);

      if (!body.targetId || !body.lockId) {
        return context.json({
          ok: false,
          message: 'Target and lock are required.',
          requestId: requestId(),
        });
      }

      const scope = await resolveScopedSubreddit(context, deps);

      if (!scope.ok) {
        return scope.response;
      }

      const result = await unlockReviewedContent(
        { reddit: deps.reddit, redis: deps.redis, clock: deps.clock },
        {
          targetId: body.targetId,
          lockId: body.lockId,
          expectedSubreddit: scope.subreddit,
          actor: await actorFromReddit(deps.reddit, body.actor),
        },
      );

      return context.json(
        {
          ok: result.ok,
          message: result.message,
          warnings: result.warnings,
        },
        result.warnings.includes('subreddit_scope_mismatch') ? 403 : 200,
      );
    }),
  );

  router.post('/reopen-queue/dismiss', (context) =>
    withErrors(context, async () => {
      if (!deps.redis || !deps.clock) {
        return context.json(
          {
            ok: false,
            error: 'ReviewLock dependencies are not configured.',
            requestId: requestId(),
          },
          503,
        );
      }

      const body = await readJson<DismissReopenBody>(context);
      const scope = await resolveScopedSubreddit(context, deps, body.subreddit);

      if (!scope.ok) {
        return scope.response;
      }

      const dismissedAt = generatedAt(deps);

      if (!body.eventId) {
        return context.json({
          ok: false,
          message: 'Reopen event is required.',
          requestId: requestId(),
        });
      }

      const actor = await actorFromReddit(deps.reddit, body.actor);
      const event = await getReopenEvent(deps.redis, scope.subreddit, body.eventId);

      if (!event) {
        return context.json({ ok: false, message: 'Reopen event was not found.' });
      }

      await appendAuditEvent(deps.redis, {
        id: `audit-reopen-dismissed-${Date.parse(dismissedAt)}-${event.id}`,
        kind: 'reopen_dismissed',
        subreddit: event.subreddit,
        targetId: event.targetId,
        targetKind: event.targetKind,
        lockId: event.lockId,
        actor,
        createdAt: dismissedAt,
        message: 'Reopened item dismissed from the ReviewLock queue.',
        data: { reopenReason: event.reason },
        demo: event.demo,
      });
      await dismissReopenEvent(deps.redis, scope.subreddit, body.eventId, dismissedAt, actor);

      return context.json({
        ok: true,
        message: 'ReviewLock dismissed this reopened item.',
      });
    }),
  );

  return router;
};

export const dashboardApiRouter = createDashboardApiRouter();
