import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { listAuditEvents } from './audit';
import { fingerprintTarget } from './fingerprint';
import { getActiveLockByTarget, saveLock } from './locks';
import { getDailyMetrics, getTargetMetrics } from './metrics';
import { handleReportTrigger } from './reportTriggers';
import { breakLockForChangedContent } from './reopenFlow';
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
  flairText: 'Discussion',
  isNsfw: false,
  isSpoiler: false,
  edited: false,
  reportCount: 5,
  ...overrides,
});

const lock = (): ReviewLockRecord => {
  const fingerprint = fingerprintTarget(target(), '2026-05-24T00:00:00.000Z');

  return {
    id: 'lock-1',
    subreddit: 'alpha',
    targetId: 't3_post',
    targetKind: 'post',
    targetAuthor: 'u_author',
    permalink: '/r/alpha/comments/post',
    title: 'Reviewed post',
    contentPreview: 'Reviewed body',
    contentHash: fingerprint?.hash ?? '',
    fingerprintVersion: fingerprint?.version ?? 'content-v1',
    lockedBy: 'mod',
    lockedAt: '2026-05-24T00:00:00.000Z',
    lockReason: 'reviewed_policy_compliant',
    status: 'active',
    lastKnownEdited: false,
    lastReportCount: 4,
    suppressedReportCount: 0,
    runtimeWarnings: [],
    demo: false,
  };
};

const deps = async (currentTarget: ReviewLockTarget | null = target()) => {
  const redis = new InMemoryRedisStore();
  await saveLock(redis, lock());
  return {
    redis,
    reddit: new FakeRedditAdapter(currentTarget ? [currentTarget] : []),
    clock: fixedClock('2026-05-24T01:00:00.000Z'),
  };
};

class RefetchFailingRedditAdapter extends FakeRedditAdapter {
  override async getPostById(): Promise<ReviewLockTarget | undefined> {
    throw new Error('reddit unavailable');
  }
}

class PausingIgnoreRedditAdapter extends FakeRedditAdapter {
  readonly ignoreStarted: Promise<void>;
  private releaseIgnorePromise: Promise<void>;
  private resolveIgnoreStarted: () => void = () => undefined;
  private resolveReleaseIgnore: () => void = () => undefined;

  constructor(targets: ReviewLockTarget[]) {
    super(targets);
    this.ignoreStarted = new Promise((resolve) => {
      this.resolveIgnoreStarted = resolve;
    });
    this.releaseIgnorePromise = new Promise((resolve) => {
      this.resolveReleaseIgnore = resolve;
    });
  }

  override async ignoreReports(target: ReviewLockTarget): Promise<void> {
    await super.ignoreReports(target);
    this.resolveIgnoreStarted();
    await this.releaseIgnorePromise;
  }

  releaseIgnore(): void {
    this.resolveReleaseIgnore();
  }
}

describe('breakLockForChangedContent', () => {
  it('leaves unchanged content locked', async () => {
    const dependencies = await deps();
    const result = await breakLockForChangedContent(dependencies, {
      targetId: 't3_post',
      triggerCapabilityName: 'postFlairUpdateTrigger',
    });

    expect(result.action).toBe('unchanged');
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeDefined();
    expect(await loadRuntimeProofStatus(dependencies.redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'postFlairUpdateTrigger', status: 'unverified' }),
      ]),
    });
  });

  it('does not verify update trigger proof for no-lock no-op deliveries', async () => {
    const redis = new InMemoryRedisStore();
    const result = await breakLockForChangedContent(
      {
        redis,
        reddit: new FakeRedditAdapter([target()]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', triggerCapabilityName: 'postUpdateTrigger' },
    );

    expect(result.action).toBe('no_lock');
    expect(await loadRuntimeProofStatus(redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'postUpdateTrigger', status: 'unverified' }),
      ]),
    });
  });

  it('reopens content edits and queues an event', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    const result = await breakLockForChangedContent(dependencies, { targetId: 't3_post' });

    expect(result.action).toBe('reopened');
    expect(result.event).toMatchObject({ reason: 'content_changed' });
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await loadRuntimeProofStatus(dependencies.redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'unignoreReports',
          status: 'verified',
          evidence: 'unignoreReports on t3_post',
        }),
      ]),
    });
  });

  it('stores update trigger proof capability on reopen audit data', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    const result = await breakLockForChangedContent(dependencies, {
      targetId: 't3_post',
      reasonHint: 'flair_changed',
      triggerCapabilityName: 'postFlairUpdateTrigger',
    });

    expect(result.action).toBe('reopened');
    expect(await listAuditEvents(dependencies.redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'lock_reopened',
        data: expect.objectContaining({
          reason: 'flair_changed',
          triggerCapabilityName: 'postFlairUpdateTrigger',
        }),
      }),
    ]);
  });

  it('records unignore failure but still shows reopened item', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    dependencies.reddit.failOperation('unignoreReports', 'permission denied');
    const result = await breakLockForChangedContent(dependencies, {
      targetId: 't3_post',
      triggerCapabilityName: 'postUpdateTrigger',
    });

    expect(result.action).toBe('reopened');
    expect(result.warnings).toContain('unignoreReports failed for t3_post');
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await loadRuntimeProofStatus(dependencies.redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'postUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({
          name: 'unignoreReports',
          status: 'failed',
          evidence: 'unignoreReports on t3_post',
        }),
      ]),
    });
  });

  it('fails open to runtime uncertain when target cannot be refetched', async () => {
    const dependencies = await deps(null);
    const result = await breakLockForChangedContent(dependencies, {
      targetId: 't3_post',
      subreddit: 'alpha',
    });

    expect(result.action).toBe('runtime_uncertain');
    expect(result.event).toMatchObject({ reason: 'runtime_uncertain' });
  });

  it('fails open to runtime uncertain when Reddit refetch throws', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());

    const result = await breakLockForChangedContent(
      {
        redis,
        reddit: new RefetchFailingRedditAdapter(),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      {
        targetId: 't3_post',
        subreddit: 'alpha',
        triggerCapabilityName: 'postUpdateTrigger',
      },
    );

    expect(result).toMatchObject({
      ok: true,
      action: 'runtime_uncertain',
      warnings: ['target_resolution_failed'],
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        reason: 'runtime_uncertain',
        runtimeWarnings: ['target_resolution_failed'],
      }),
    ]);
    expect(await loadRuntimeProofStatus(redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'postUpdateTrigger', status: 'unverified' }),
      ]),
    });
  });

  it('does not enqueue duplicates after lock is no longer active', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    await breakLockForChangedContent(dependencies, { targetId: 't3_post' });
    const duplicate = await breakLockForChangedContent(dependencies, {
      targetId: 't3_post',
      subreddit: 'alpha',
    });

    expect(duplicate.action).toBe('no_lock');
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
  });

  it('increments reopen metrics when target exists', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    await breakLockForChangedContent(dependencies, { targetId: 't3_post' });

    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      locksReopened: 1,
    });
  });

  it('keeps a reopen event visible if removing active indexes fails', async () => {
    class ActiveIndexFailingRedisStore extends InMemoryRedisStore {
      override async hdel(): Promise<void> {
        throw new Error('active index down');
      }
    }
    const redis = new ActiveIndexFailingRedisStore();
    await saveLock(redis, lock());
    const result = await breakLockForChangedContent(
      {
        redis,
        reddit: new FakeRedditAdapter([target({ body: 'Edited body', edited: true })]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post' },
    );

    expect(result).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
      warnings: ['redis_write_failed'],
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed' }),
    ]);
  });

  it('removes active indexes if status write fails after queueing reopen event', async () => {
    class ReopenStatusWriteFailingRedisStore extends InMemoryRedisStore {
      failLockStatusWrites = false;

      override async set(key: string, value: string): Promise<void> {
        if (this.failLockStatusWrites && key === keys.lock('alpha', 'lock-1')) {
          throw new Error('lock status down');
        }

        await super.set(key, value);
      }
    }

    const redis = new ReopenStatusWriteFailingRedisStore();
    await saveLock(redis, lock());
    redis.failLockStatusWrites = true;

    const result = await breakLockForChangedContent(
      {
        redis,
        reddit: new FakeRedditAdapter([target({ body: 'Edited body', edited: true })]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post' },
    );

    expect(result).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
      warnings: ['redis_write_failed'],
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed' }),
    ]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
  });

  it('records runtime failure when update reopen audit fails after state is reopened', async () => {
    class ReopenAuditFailingRedisStore extends InMemoryRedisStore {
      override async set(key: string, value: string): Promise<void> {
        if (key.includes(':audit:audit-update-reopened-')) {
          throw new Error('reopen audit down');
        }

        await super.set(key, value);
      }
    }

    const redis = new ReopenAuditFailingRedisStore();
    await saveLock(redis, lock());
    const result = await breakLockForChangedContent(
      {
        redis,
        reddit: new FakeRedditAdapter([target({ body: 'Edited body', edited: true })]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post' },
    );

    expect(result).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
      warnings: ['redis_write_failed'],
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed' }),
    ]);
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'runtime_failure',
        message:
          'Lock reopened after reviewed content changed, but post-reopen persistence failed.',
        data: expect.objectContaining({
          operation: 'postReopenPersistence',
          error: 'reopen audit down',
        }),
      }),
    ]);
  });

  it('records runtime failure when update reopen metrics fail after state is reopened', async () => {
    class ReopenMetricsFailingRedisStore extends InMemoryRedisStore {
      override async set(key: string, value: string): Promise<void> {
        if (key === keys.metricsDaily('alpha', '2026-05-24')) {
          throw new Error('reopen metrics down');
        }

        await super.set(key, value);
      }
    }

    const redis = new ReopenMetricsFailingRedisStore();
    await saveLock(redis, lock());
    const result = await breakLockForChangedContent(
      {
        redis,
        reddit: new FakeRedditAdapter([target({ body: 'Edited body', edited: true })]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post' },
    );

    expect(result).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
      message: 'Lock reopened, but ReviewLock could not persist post-reopen proof.',
      warnings: ['redis_write_failed'],
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ reason: 'content_changed' }),
    ]);
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'runtime_failure',
        message:
          'Lock reopened after reviewed content changed, but post-reopen persistence failed.',
        data: expect.objectContaining({
          operation: 'postReopenPersistence',
          error: 'reopen metrics down',
        }),
      }),
    ]);
  });

  it('keeps report and update races idempotent for the same edited target', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    const [reportResult, updateResult] = await Promise.all([
      handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-update-report-race' }),
      breakLockForChangedContent(dependencies, { targetId: 't3_post' }),
    ]);
    const actions = [reportResult.action, updateResult.action];

    expect(actions.some((action) => action === 'reopen_changed' || action === 'reopened')).toBe(
      true,
    );
    expect(
      actions.some(
        (action) => action === 'duplicate' || action === 'no_lock' || action === 'runtime_uncertain',
      ),
    ).toBe(true);
    if (reportResult.action === 'runtime_uncertain') {
      expect(reportResult.warnings).toContain('concurrent_trigger_in_progress');
    }
    expect(dependencies.reddit.calls).toEqual(['unignoreReports:t3_post']);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeUndefined();
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getDailyMetrics(dependencies.redis, 'alpha', '2026-05-24')).toMatchObject({
      locksReopened: 1,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      locksReopened: 1,
    });
  });

  it('keeps update-trigger mutex contention retryable while a report suppresses unchanged content', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const clock = fixedClock('2026-05-24T01:00:00.000Z');
    const reportReddit = new PausingIgnoreRedditAdapter([target()]);
    const reportResultPromise = handleReportTrigger(
      {
        redis,
        reddit: reportReddit,
        clock,
      },
      { targetId: 't3_post', eventId: 'evt-paused-unchanged-report' },
    );

    await reportReddit.ignoreStarted;

    const updateResult = await breakLockForChangedContent(
      {
        redis,
        reddit: new FakeRedditAdapter([target({ body: 'Edited body', edited: true })]),
        clock,
      },
      { targetId: 't3_post' },
    );

    expect(updateResult).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
      warnings: ['concurrent_trigger_in_progress'],
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeDefined();

    reportReddit.releaseIgnore();
    await expect(reportResultPromise).resolves.toMatchObject({
      ok: true,
      action: 'suppress_unchanged',
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeDefined();
  });
});
