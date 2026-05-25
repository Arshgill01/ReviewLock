import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockTarget } from '../../shared/schema';
import { listAuditEvents } from './audit';
import { getActiveLockByTarget, getLock, listActiveLocks } from './locks';
import { lockReviewedContent } from './lockFlow';
import { getDailyMetrics, getTargetMetrics } from './metrics';
import { listOpenReopenEvents } from './reopenQueue';
import { loadRuntimeProofStatus } from './runtimeProof';
import { keys } from './keys';

const target = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: 4,
  ...overrides,
});

const deps = (reddit = new FakeRedditAdapter([target()])) => ({
  reddit,
  redis: new InMemoryRedisStore(),
  clock: fixedClock('2026-05-24T00:00:00.000Z'),
});

describe('lockReviewedContent', () => {
  it('approves, ignores reports, persists lock, audit, and metrics on success', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    const dependencies = deps(reddit);
    const result = await lockReviewedContent(dependencies, {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant',
    });

    expect(result).toMatchObject({
      ok: true,
      message: 'Reviewed content locked until it changes.',
    });
    expect(reddit.calls).toEqual(['approve:t3_post', 'ignoreReports:t3_post']);
    expect(await getLock(dependencies.redis, 'alpha', result.lock?.id ?? '')).toMatchObject({
      contentHash: expect.any(String),
      targetId: 't3_post',
    });
    await expect(loadRuntimeProofStatus(dependencies.redis, 'alpha')).resolves.toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'approve', status: 'verified' }),
        expect.objectContaining({ name: 'ignoreReports', status: 'verified' }),
      ]),
    });
  });

  it('fails when target cannot be resolved', async () => {
    const result = await lockReviewedContent(deps(new FakeRedditAdapter()), {
      targetId: 't3_missing',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant',
    });

    expect(result).toMatchObject({ ok: false, message: 'Target not found: t3_missing' });
  });

  it('stores a failed lock when approve succeeds but ignore reports fails', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    reddit.failOperation('ignoreReports', 'permission denied');
    const dependencies = deps(reddit);
    const result = await lockReviewedContent(dependencies, {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant',
    });

    expect(result).toMatchObject({
      ok: false,
      message: 'Reports were not locked because ignoreReports failed.',
    });
    expect(await getLock(dependencies.redis, 'alpha', result.lock?.id ?? '')).toMatchObject({
      status: 'failed',
    });
    await expect(loadRuntimeProofStatus(dependencies.redis, 'alpha')).resolves.toMatchObject({
      overall: 'failed',
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'approve', status: 'verified' }),
        expect.objectContaining({ name: 'ignoreReports', status: 'failed' }),
      ]),
    });
  });

  it('returns the existing active lock on duplicate lock attempts without double-counting', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    const times = ['2026-05-24T00:00:00.000Z', '2026-05-24T00:05:00.000Z'];
    const dependencies = {
      reddit,
      redis: new InMemoryRedisStore(),
      clock: { now: () => times.shift() ?? '2026-05-24T00:10:00.000Z' },
    };
    const input = {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant' as const,
    };

    const first = await lockReviewedContent(dependencies, input);
    const second = await lockReviewedContent(dependencies, input);

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({
      ok: true,
      lock: { id: first.lock?.id },
      message: 'Reviewed content is already locked until it changes.',
    });
    expect(reddit.calls).toEqual(['approve:t3_post', 'ignoreReports:t3_post']);
    expect(await listActiveLocks(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksCreated: 1,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      locksCreated: 1,
    });
  });

  it('rejects concurrent in-flight lock creation without double-counting or duplicate moderation calls', async () => {
    class PausingIgnoreReportsRedditAdapter extends FakeRedditAdapter {
      private firstIgnoreStartedResolver: (() => void) | undefined;
      private releaseFirstIgnoreResolver: (() => void) | undefined;
      private firstIgnorePaused = false;

      readonly firstIgnoreStarted = new Promise<void>((resolve) => {
        this.firstIgnoreStartedResolver = resolve;
      });

      releaseFirstIgnore(): void {
        this.releaseFirstIgnoreResolver?.();
      }

      override async ignoreReports(target: ReviewLockTarget): Promise<void> {
        if (!this.firstIgnorePaused) {
          this.firstIgnorePaused = true;
          this.firstIgnoreStartedResolver?.();
          await new Promise<void>((resolve) => {
            this.releaseFirstIgnoreResolver = resolve;
          });
        }

        await super.ignoreReports(target);
      }
    }

    const reddit = new PausingIgnoreReportsRedditAdapter([target()]);
    const times = ['2026-05-24T00:00:00.000Z', '2026-05-24T00:05:00.000Z'];
    const dependencies = {
      reddit,
      redis: new InMemoryRedisStore(),
      clock: { now: () => times.shift() ?? '2026-05-24T00:10:00.000Z' },
    };
    const input = {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant' as const,
    };

    const firstPromise = lockReviewedContent(dependencies, input);
    await reddit.firstIgnoreStarted;
    const second = await lockReviewedContent(dependencies, input);
    reddit.releaseFirstIgnore();
    const first = await firstPromise;

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({
      ok: false,
      message:
        'Another ReviewLock lock is already being created for this content. Try again in a moment.',
      warnings: ['lock_creation_in_progress'],
    });
    expect(reddit.calls).toEqual(['approve:t3_post', 'ignoreReports:t3_post']);
    expect(await listActiveLocks(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksCreated: 1,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      locksCreated: 1,
    });
  });

  it('does not delete a newer lock creation guard when an older owner finishes', async () => {
    class PausingIgnoreReportsRedditAdapter extends FakeRedditAdapter {
      private firstIgnoreStartedResolver: (() => void) | undefined;
      private releaseFirstIgnoreResolver: (() => void) | undefined;

      readonly firstIgnoreStarted = new Promise<void>((resolve) => {
        this.firstIgnoreStartedResolver = resolve;
      });

      releaseFirstIgnore(): void {
        this.releaseFirstIgnoreResolver?.();
      }

      override async ignoreReports(target: ReviewLockTarget): Promise<void> {
        this.firstIgnoreStartedResolver?.();
        await new Promise<void>((resolve) => {
          this.releaseFirstIgnoreResolver = resolve;
        });
        await super.ignoreReports(target);
      }
    }

    const reddit = new PausingIgnoreReportsRedditAdapter([target()]);
    const redis = new InMemoryRedisStore();
    const dependencies = {
      reddit,
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    };

    const firstPromise = lockReviewedContent(dependencies, {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant',
    });
    await reddit.firstIgnoreStarted;
    await redis.set(keys.targetLockCreation('alpha', 't3_post'), 'newer-owner-token');
    reddit.releaseFirstIgnore();
    await expect(firstPromise).resolves.toMatchObject({ ok: true });

    await expect(redis.get(keys.targetLockCreation('alpha', 't3_post'))).resolves.toBe(
      'newer-owner-token',
    );
  });

  it('reopens a stale active lock before relocking changed content from the lock form', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    const times = ['2026-05-24T00:00:00.000Z', '2026-05-24T00:05:00.000Z'];
    const dependencies = {
      reddit,
      redis: new InMemoryRedisStore(),
      clock: { now: () => times.shift() ?? '2026-05-24T00:10:00.000Z' },
    };
    const input = {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant' as const,
    };

    const first = await lockReviewedContent(dependencies, input);
    reddit.setTarget(target({ body: 'Edited body', edited: true, reportCount: 6 }));
    const second = await lockReviewedContent(dependencies, input);

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({
      ok: true,
      message: 'Reviewed content locked until it changes.',
    });
    expect(second.lock?.id).not.toBe(first.lock?.id);
    expect(reddit.calls).toEqual([
      'approve:t3_post',
      'ignoreReports:t3_post',
      'unignoreReports:t3_post',
      'approve:t3_post',
      'ignoreReports:t3_post',
    ]);
    expect(await getLock(dependencies.redis, 'alpha', first.lock?.id ?? '')).toMatchObject({
      status: 'reopened',
      reopenReason: 'content_changed',
    });
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      id: second.lock?.id,
      status: 'active',
      lastKnownEdited: true,
    });
    expect(await listActiveLocks(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ id: second.lock?.id }),
    ]);
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ lockId: first.lock?.id, reason: 'content_changed' }),
    ]);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksCreated: 2,
      locksReopened: 1,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      locksCreated: 2,
      locksReopened: 1,
    });
  });

  it('unignores reports before stale relock replacement failure can leave reports suppressed', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    const times = ['2026-05-24T00:00:00.000Z', '2026-05-24T00:05:00.000Z'];
    const dependencies = {
      reddit,
      redis: new InMemoryRedisStore(),
      clock: { now: () => times.shift() ?? '2026-05-24T00:10:00.000Z' },
    };
    const input = {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant' as const,
    };

    const first = await lockReviewedContent(dependencies, input);
    reddit.setTarget(target({ body: 'Edited body', edited: true, reportCount: 6 }));
    reddit.failOperation('ignoreReports', 'replacement ignore denied');
    const second = await lockReviewedContent(dependencies, input);

    expect(second).toMatchObject({
      ok: false,
      lock: { status: 'failed' },
      message: 'Reports were not locked because ignoreReports failed.',
    });
    expect(reddit.calls).toEqual([
      'approve:t3_post',
      'ignoreReports:t3_post',
      'unignoreReports:t3_post',
      'approve:t3_post',
      'ignoreReports:t3_post',
    ]);
    expect(await getLock(dependencies.redis, 'alpha', first.lock?.id ?? '')).toMatchObject({
      status: 'reopened',
      reopenReason: 'content_changed',
    });
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await getLock(dependencies.redis, 'alpha', second.lock?.id ?? '')).toMatchObject({
      status: 'failed',
    });
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({ lockId: first.lock?.id, reason: 'content_changed' }),
    ]);
  });

  it('returns structured failure when stale relock reopening persistence fails before replacement', async () => {
    class StaleReopenMetricsFailingRedisStore extends InMemoryRedisStore {
      failReopenMetrics = false;

      override async set(key: string, value: string): Promise<void> {
        if (this.failReopenMetrics && key === keys.metricsDaily('alpha', '2026-05-24')) {
          throw new Error('reopen metrics down');
        }

        await super.set(key, value);
      }
    }

    const reddit = new FakeRedditAdapter([target()]);
    const redis = new StaleReopenMetricsFailingRedisStore();
    const times = ['2026-05-24T00:00:00.000Z', '2026-05-24T00:05:00.000Z'];
    const dependencies = {
      reddit,
      redis,
      clock: { now: () => times.shift() ?? '2026-05-24T00:10:00.000Z' },
    };
    const input = {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant' as const,
    };

    const first = await lockReviewedContent(dependencies, input);
    redis.failReopenMetrics = true;
    reddit.setTarget(target({ body: 'Edited body', edited: true, reportCount: 6 }));
    const second = await lockReviewedContent(dependencies, input);

    expect(second).toMatchObject({
      ok: false,
      message:
        'ReviewLock reopened the stale lock or attempted to, but could not durably create the replacement lock. Reopen the menu and try again.',
      warnings: ['redis_write_failed'],
    });
    expect(reddit.calls).toEqual([
      'approve:t3_post',
      'ignoreReports:t3_post',
      'unignoreReports:t3_post',
    ]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ lockId: first.lock?.id, reason: 'content_changed' }),
    ]);
    expect(await listAuditEvents(redis, 'alpha')).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'lock_created' }),
      expect.objectContaining({
        kind: 'runtime_failure',
        message:
          'Lock review found changed content but could not complete stale relock replacement.',
        data: expect.objectContaining({
          operation: 'staleRelockReopen',
          error: 'reopen metrics down',
        }),
      }),
    ]));
  });

  it('keeps the stale lock active when stale unignore fails before replacement', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    const times = ['2026-05-24T00:00:00.000Z', '2026-05-24T00:05:00.000Z'];
    const dependencies = {
      reddit,
      redis: new InMemoryRedisStore(),
      clock: { now: () => times.shift() ?? '2026-05-24T00:10:00.000Z' },
    };
    const input = {
      targetId: 't3_post',
      actor: 'mod',
      lockReason: 'reviewed_policy_compliant' as const,
    };

    const first = await lockReviewedContent(dependencies, input);
    reddit.setTarget(target({ body: 'Edited body', edited: true, reportCount: 6 }));
    reddit.failOperation('unignoreReports', 'stale unignore denied');
    reddit.failOperation('ignoreReports', 'replacement ignore denied');
    const second = await lockReviewedContent(dependencies, input);

    expect(second).toMatchObject({
      ok: false,
      lock: { id: first.lock?.id, status: 'active' },
      message:
        'ReviewLock found changed content but could not return reports to normal handling; the stale lock remains active for retry.',
      warnings: ['unignoreReports failed for t3_post'],
    });
    expect(reddit.calls).toEqual([
      'approve:t3_post',
      'ignoreReports:t3_post',
      'unignoreReports:t3_post',
    ]);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      id: first.lock?.id,
      status: 'active',
      lastKnownEdited: true,
      lastReportCount: 6,
      runtimeWarnings: ['unignoreReports failed for t3_post'],
    });
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toEqual([]);
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'lock_created' }),
      expect.objectContaining({
        kind: 'runtime_failure',
        message:
          'Lock review found changed content, but unignoreReports failed; lock remains active for retry.',
        data: expect.objectContaining({
          operation: 'unignoreReports',
          error: 'stale unignore denied',
          source: 'stale_lock_relock',
        }),
      }),
    ]));
    await expect(loadRuntimeProofStatus(dependencies.redis, 'alpha')).resolves.toMatchObject({
      overall: 'failed',
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'unignoreReports', status: 'failed' }),
      ]),
    });
  });

  it('rolls back ignore reports if Redis persistence fails', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    class FailingRedisStore extends InMemoryRedisStore {
      override async set(): Promise<void> {
        throw new Error('redis down');
      }
    }
    const result = await lockReviewedContent(
      { reddit, redis: new FailingRedisStore(), clock: fixedClock('2026-05-24T00:00:00.000Z') },
      {
        targetId: 't3_post',
        actor: 'mod',
        lockReason: 'reviewed_policy_compliant',
      },
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      message: 'redis down',
      warnings: ['redis_write_failed'],
    });
    expect(reddit.calls).toEqual([
      'approve:t3_post',
      'ignoreReports:t3_post',
      'unignoreReports:t3_post',
    ]);
  });

  it('cleans up partially saved lock indexes if a later Redis write fails', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    class MetricsFailingRedisStore extends InMemoryRedisStore {
      override async set(key: string, value: string): Promise<void> {
        if (key.includes(':metrics:')) {
          throw new Error('metrics down');
        }

        await super.set(key, value);
      }
    }
    const redis = new MetricsFailingRedisStore();
    const result = await lockReviewedContent(
      { reddit, redis, clock: fixedClock('2026-05-24T00:00:00.000Z') },
      {
        targetId: 't3_post',
        actor: 'mod',
        lockReason: 'reviewed_policy_compliant',
      },
    );

    expect(result).toMatchObject({
      ok: false,
      message: 'metrics down',
      warnings: ['redis_write_failed'],
    });
    expect(reddit.calls).toEqual([
      'approve:t3_post',
      'ignoreReports:t3_post',
      'unignoreReports:t3_post',
    ]);
    expect(await getLock(redis, 'alpha', result.lock?.id ?? '')).toBeUndefined();
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(
      (await listAuditEvents(redis, 'alpha')).some(
        (event) => event.kind === 'lock_created' && event.lockId === result.lock?.id,
      ),
    ).toBe(false);
  });

  it('keeps a visible failed lock when Redis persistence fails and unignore rollback also fails', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    reddit.failOperation('unignoreReports', 'rollback denied');
    class MetricsFailingRedisStore extends InMemoryRedisStore {
      override async set(key: string, value: string): Promise<void> {
        if (key.includes(':metrics:')) {
          throw new Error('metrics down');
        }

        await super.set(key, value);
      }
    }
    const redis = new MetricsFailingRedisStore();
    const result = await lockReviewedContent(
      { reddit, redis, clock: fixedClock('2026-05-24T00:00:00.000Z') },
      {
        targetId: 't3_post',
        actor: 'mod',
        lockReason: 'reviewed_policy_compliant',
      },
    );

    expect(result).toMatchObject({
      ok: false,
      message: 'ReviewLock could not persist the lock, and unignoreReports rollback failed.',
      warnings: expect.arrayContaining([
        'redis_write_failed',
        'unignoreReports failed for t3_post',
      ]),
    });
    expect(reddit.calls).toEqual([
      'approve:t3_post',
      'ignoreReports:t3_post',
      'unignoreReports:t3_post',
    ]);
    expect(await getLock(redis, 'alpha', result.lock?.id ?? '')).toMatchObject({
      status: 'failed',
      runtimeWarnings: expect.arrayContaining([
        'redis_write_failed',
        'unignoreReports failed for t3_post',
      ]),
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    await expect(loadRuntimeProofStatus(redis, 'alpha')).resolves.toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'unignoreReports', status: 'failed' }),
      ]),
    });
  });
});
