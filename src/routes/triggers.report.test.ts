import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import type { ReviewLockRecord, ReviewLockTarget } from '../shared/schema';
import { fingerprintTarget } from '../server/services/fingerprint';
import { saveLock } from '../server/services/locks';
import { createReportTriggersRouter } from './triggers.report';

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
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

describe('report trigger routes', () => {
  it('accepts post report payloads and returns trigger result', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const router = createReportTriggersRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });
    const response = await router.request('/on-post-report', {
      method: 'POST',
      body: JSON.stringify({ postId: 't3_post', eventId: 'evt-1' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, action: 'suppress_unchanged' });
  });
});
