import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import { listAuditEvents } from '../server/services/audit';
import {
  enqueueReopenEvent,
  getReopenEvent,
  listOpenReopenEvents,
} from '../server/services/reopenQueue';
import type { ReopenEvent, ReviewLockTarget } from '../shared/schema';
import { createFormsRouter } from './forms';

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: 4,
});

const reopenEvent = (): ReopenEvent => ({
  id: 'reopen-1',
  lockId: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_post',
  targetKind: 'post',
  oldContentHash: 'old',
  newContentHash: 'new',
  reason: 'content_changed',
  createdAt: '2026-05-24T00:30:00.000Z',
  summary: 'Content changed after review.',
  runtimeWarnings: [],
  demo: false,
});

describe('form routes', () => {
  it('submits a lock review form through orchestration', async () => {
    const router = createFormsRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        actor: 'mod',
        lockReason: 'reviewed_policy_compliant',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock locked this reviewed content until it changes.',
        appearance: 'success',
      },
    });
  });

  it('validates required lock fields', async () => {
    const router = createFormsRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'Target and reason are required.',
      },
    });
  });

  it('creates a dashboard post and navigates to it', async () => {
    const router = createFormsRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/dashboard-launch-submit', { method: 'POST' });

    expect(await response.json()).toMatchObject({
      navigateTo: 'https://www.reddit.com/r/alpha/comments/reviewlock_dashboard/',
      showToast: {
        text: 'Opening ReviewLock dashboard',
      },
    });
  });

  it('dismisses a reopened item and records audit output', async () => {
    const redis = new InMemoryRedisStore();
    await enqueueReopenEvent(redis, reopenEvent());
    const router = createFormsRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/reopen-action-submit', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 'reopen-1',
        action: 'dismiss',
        actor: 'mod',
        subreddit: 'alpha',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        appearance: 'success',
        text: 'ReviewLock dismissed this reopened item.',
      },
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([]);
    expect(await getReopenEvent(redis, 'alpha', 'reopen-1')).toMatchObject({
      dismissedAt: '2026-05-24T01:00:00.000Z',
      dismissedBy: 'mod',
    });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'reopen_dismissed',
        targetId: 't3_post',
        actor: 'mod',
      }),
    ]);
  });
});
