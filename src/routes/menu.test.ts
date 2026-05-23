import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import type { ReviewLockTarget } from '../shared/schema';
import { saveLock } from '../server/services/locks';
import { buildLockReviewForm, createMenuRouter } from './menu';

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: true,
  reportCount: 4,
});

describe('menu routes', () => {
  it('builds lock review form fields with target context', () => {
    expect(buildLockReviewForm(target())).toMatchObject({
      form: 'lockReview',
      fields: {
        targetId: 't3_post',
        edited: true,
        reportCount: 4,
        reasonPreset: 'reviewed_policy_compliant',
      },
    });
  });

  it('serves a lock form for post menu requests', async () => {
    const router = createMenuRouter({ reddit: new FakeRedditAdapter([target()]) });
    const response = await router.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, form: { form: 'lockReview' } });
  });

  it('returns neutral unlock response when no lock exists', async () => {
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis: new InMemoryRedisStore(),
    });
    const response = await router.request('/unlock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      ok: true,
      message: 'No active ReviewLock lock was found for this content.',
    });
  });

  it('serves unlock form when an active lock exists', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, {
      id: 'lock-1',
      subreddit: 'alpha',
      targetId: 't3_post',
      targetKind: 'post',
      targetAuthor: 'u_author',
      permalink: '/r/alpha/comments/post',
      contentPreview: 'Reviewed body',
      contentHash: 'hash',
      fingerprintVersion: 'content-v1',
      lockedBy: 'mod',
      lockedAt: '2026-05-24T00:00:00.000Z',
      lockReason: 'reviewed_policy_compliant',
      status: 'active',
      lastKnownEdited: false,
      lastReportCount: 4,
      suppressedReportCount: 0,
      runtimeWarnings: [],
      demo: false,
    });

    const router = createMenuRouter({ reddit: new FakeRedditAdapter([target()]), redis });
    const response = await router.request('/unlock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({ ok: true, form: { form: 'unlockReview' } });
  });
});
