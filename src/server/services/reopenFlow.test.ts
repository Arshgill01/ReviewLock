import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { fingerprintTarget } from './fingerprint';
import { getActiveLockByTarget, saveLock } from './locks';
import { getDailyMetrics, getTargetMetrics } from './metrics';
import { handleReportTrigger } from './reportTriggers';
import { breakLockForChangedContent } from './reopenFlow';
import { listOpenReopenEvents } from './reopenQueue';

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

describe('breakLockForChangedContent', () => {
  it('leaves unchanged content locked', async () => {
    const dependencies = await deps();
    const result = await breakLockForChangedContent(dependencies, { targetId: 't3_post' });

    expect(result.action).toBe('unchanged');
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeDefined();
  });

  it('reopens content edits and queues an event', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    const result = await breakLockForChangedContent(dependencies, { targetId: 't3_post' });

    expect(result.action).toBe('reopened');
    expect(result.event).toMatchObject({ reason: 'content_changed' });
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeUndefined();
  });

  it('records unignore failure but still shows reopened item', async () => {
    const dependencies = await deps(target({ body: 'Edited body', edited: true }));
    dependencies.reddit.failOperation('unignoreReports', 'permission denied');
    const result = await breakLockForChangedContent(dependencies, { targetId: 't3_post' });

    expect(result.action).toBe('reopened');
    expect(result.warnings).toContain('unignoreReports failed for t3_post');
    expect(await listOpenReopenEvents(dependencies.redis, 'alpha')).toHaveLength(1);
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
    expect(actions.some((action) => action === 'duplicate' || action === 'no_lock')).toBe(true);
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
});
