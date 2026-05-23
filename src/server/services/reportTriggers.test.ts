import { describe, expect, it } from 'vitest';
import { fixedClock } from '../adapters/clock';
import { InMemoryRedisStore } from '../adapters/redis';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { getActiveLockByTarget, getLock, saveLock } from './locks';
import { getTargetMetrics } from './metrics';
import { fingerprintTarget } from './fingerprint';
import { handleReportTrigger } from './reportTriggers';

const target = (body = 'Reviewed body'): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body,
  edited: body !== 'Reviewed body',
  reportCount: 5,
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

const deps = async (currentTarget = target()) => {
  const redis = new InMemoryRedisStore();
  await saveLock(redis, lock());
  return {
    redis,
    reddit: new FakeRedditAdapter([currentTarget]),
    clock: fixedClock('2026-05-24T01:00:00.000Z'),
  };
};

describe('handleReportTrigger', () => {
  it('does nothing when no lock exists', async () => {
    const redis = new InMemoryRedisStore();
    const result = await handleReportTrigger(
      {
        redis,
        reddit: new FakeRedditAdapter([target()]),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-1' },
    );

    expect(result.action).toBe('no_lock');
  });

  it('suppresses unchanged content and increments metrics once', async () => {
    const dependencies = await deps();
    const first = await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-1' });
    const duplicate = await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-1' });

    expect(first.action).toBe('suppress_unchanged');
    expect(duplicate.action).toBe('duplicate');
    expect(await getLock(dependencies.redis, 'alpha', 'lock-1')).toMatchObject({
      suppressedReportCount: 1,
      lastReportCount: 5,
    });
    expect(await getTargetMetrics(dependencies.redis, 'alpha', 't3_post')).toMatchObject({
      reportsSuppressed: 1,
    });
  });

  it('reopens changed content and removes active lock index', async () => {
    const dependencies = await deps(target('Edited body'));
    const result = await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-2' });

    expect(result.action).toBe('reopen_changed');
    expect(result.reopenEvent).toMatchObject({ reason: 'content_changed' });
    expect(await getActiveLockByTarget(dependencies.redis, 'alpha', 't3_post')).toBeUndefined();
  });

  it('fails open when the target cannot be loaded', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const result = await handleReportTrigger(
      {
        redis,
        reddit: new FakeRedditAdapter(),
        clock: fixedClock('2026-05-24T01:00:00.000Z'),
      },
      { targetId: 't3_post', eventId: 'evt-3', subreddit: 'alpha' },
    );

    expect(result).toMatchObject({ ok: false, action: 'runtime_uncertain' });
  });

  it('records runtime failure when ignore reports fails', async () => {
    const dependencies = await deps();
    dependencies.reddit.failOperation('ignoreReports', 'permission denied');

    expect(
      await handleReportTrigger(dependencies, { targetId: 't3_post', eventId: 'evt-4' }),
    ).toMatchObject({
      ok: false,
      action: 'runtime_uncertain',
    });
  });
});
