import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockTarget } from '../../shared/schema';
import { getActiveLockByTarget, getLock } from './locks';
import { lockReviewedContent } from './lockFlow';
import { loadRuntimeProofStatus } from './runtimeProof';

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
  });
});
