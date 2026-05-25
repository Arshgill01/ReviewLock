import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import { listAuditEvents } from '../server/services/audit';
import { createFormBinding } from '../server/services/formBindings';
import { getActiveLockByTarget, saveLock } from '../server/services/locks';
import {
  enqueueReopenEvent,
  getReopenEvent,
  listOpenReopenEvents,
} from '../server/services/reopenQueue';
import type { ReopenEvent, ReviewLockRecord, ReviewLockTarget } from '../shared/schema';
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

const lock = (): ReviewLockRecord => ({
  id: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_post',
  targetKind: 'post',
  targetAuthor: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
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

describe('form routes', () => {
  it('submits a lock review form through orchestration', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const router = createFormsRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
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

  it('rejects stale lock forms when content changed after review summary render', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const reddit = new FakeRedditAdapter([
      { ...target(), body: 'Edited after form opened', edited: true },
    ]);
    const router = createFormsRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T00:01:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        actor: 'mod',
        lockReason: 'reviewed_policy_compliant',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text:
          'Reviewed content changed after the form opened. Reopen ReviewLock and review the updated content before locking.',
      },
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
  });

  it('validates required lock form token and reason fields', async () => {
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
        text: 'ReviewLock form token and reason are required.',
      },
    });
  });

  it('rejects changed lock form target identity', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const router = createFormsRouter({
      reddit: new FakeRedditAdapter([target(), { ...target(), id: 't3_other' }]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_other',
        subreddit: 'alpha',
        formToken: binding.token,
        lockReason: 'reviewed_policy_compliant',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock form target changed. Reopen the menu and try again.',
      },
    });
  });

  it('rejects unknown lock reasons', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const router = createFormsRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        lockReason: 'repeat_false_reports',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock lock reason is not valid.',
      },
    });
  });

  it('rejects lock form submissions outside the current runtime subreddit before moderation', async () => {
    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const reddit = new FakeRedditAdapter([target()], 'mod_test', 'beta');
    const router = createFormsRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        lockReason: 'reviewed_policy_compliant',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock form subreddit does not match the current Devvit context.',
      },
    });
    expect(reddit.calls).toEqual([]);
    expect(await redis.exists(`reviewlock:alpha:form:${binding.token}`)).toBe(true);
  });

  it('rejects lock form submissions when runtime subreddit context is missing', async () => {
    class MissingSubredditRedditAdapter extends FakeRedditAdapter {
      override async getCurrentSubredditName(): Promise<string | undefined> {
        return undefined;
      }
    }

    const redis = new InMemoryRedisStore();
    const binding = await createFormBinding(redis, 'lock', target(), '2026-05-24T00:00:00.000Z');
    const reddit = new MissingSubredditRedditAdapter([target()]);
    const router = createFormsRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        lockReason: 'reviewed_policy_compliant',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock form subreddit does not match the current Devvit context.',
      },
    });
    expect(reddit.calls).toEqual([]);
    expect(await redis.exists(`reviewlock:alpha:form:${binding.token}`)).toBe(true);
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

  it('does not create a dashboard post when runtime subreddit context is missing', async () => {
    class MissingSubredditRedditAdapter extends FakeRedditAdapter {
      async getCurrentSubredditName(): Promise<string | undefined> {
        return undefined;
      }
    }

    const reddit = new MissingSubredditRedditAdapter([target()]);
    const router = createFormsRouter({
      reddit,
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/dashboard-launch-submit', { method: 'POST' });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock could not determine the current subreddit for dashboard launch.',
      },
    });
    expect(reddit.calls).toEqual([]);
  });

  it('submits an unlock form only for the confirmed lock id', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const binding = await createFormBinding(
      redis,
      'unlock',
      target(),
      '2026-05-24T00:00:00.000Z',
      'lock-1',
    );
    const reddit = new FakeRedditAdapter([target()]);
    const router = createFormsRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/unlock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        lockId: 'lock-1',
        actor: 'client_supplied_actor',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        appearance: 'success',
        text: 'ReviewLock unlocked this reviewed content.',
      },
    });
    expect(reddit.calls).toContain('unignoreReports:t3_post');
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
  });

  it('rejects stale unlock form submissions', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const binding = await createFormBinding(
      redis,
      'unlock',
      target(),
      '2026-05-24T00:00:00.000Z',
      'lock-1',
    );
    const reddit = new FakeRedditAdapter([target()]);
    const router = createFormsRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/unlock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        lockId: 'old-lock',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock form target changed. Reopen the menu and try again.',
      },
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({ id: 'lock-1' });
  });

  it('rejects unlock form submissions outside the current runtime subreddit before moderation', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const binding = await createFormBinding(
      redis,
      'unlock',
      target(),
      '2026-05-24T00:00:00.000Z',
      'lock-1',
    );
    const reddit = new FakeRedditAdapter([target()], 'mod_test', 'beta');
    const router = createFormsRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/unlock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        lockId: 'lock-1',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock form subreddit does not match the current Devvit context.',
      },
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({ id: 'lock-1' });
    expect(await redis.exists(`reviewlock:alpha:form:${binding.token}`)).toBe(true);
  });

  it('rejects unlock form submissions when runtime subreddit lookup throws', async () => {
    class ThrowingSubredditRedditAdapter extends FakeRedditAdapter {
      override async getCurrentSubredditName(): Promise<string | undefined> {
        throw new Error('context unavailable');
      }
    }

    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const binding = await createFormBinding(
      redis,
      'unlock',
      target(),
      '2026-05-24T00:00:00.000Z',
      'lock-1',
    );
    const reddit = new ThrowingSubredditRedditAdapter([target()]);
    const router = createFormsRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/unlock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        formToken: binding.token,
        lockId: 'lock-1',
      }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock form subreddit does not match the current Devvit context.',
      },
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({ id: 'lock-1' });
    expect(await redis.exists(`reviewlock:alpha:form:${binding.token}`)).toBe(true);
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
        actor: 'client_supplied_actor',
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
      dismissedBy: 'mod_test',
    });
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'reopen_dismissed',
        targetId: 't3_post',
        actor: 'mod_test',
      }),
    ]);
  });

  it('keeps reopened items visible when form dismiss audit write fails', async () => {
    class AuditFailingRedisStore extends InMemoryRedisStore {
      override async zAdd(key: string, entry: { member: string; score: number }): Promise<void> {
        if (key === 'reviewlock:alpha:audit') {
          throw new Error('audit unavailable');
        }

        await super.zAdd(key, entry);
      }
    }

    const redis = new AuditFailingRedisStore();
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
        actor: 'client_supplied_actor',
        subreddit: 'alpha',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock could not record the dismissal audit; reopened item was not dismissed.',
      },
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({ id: 'reopen-1' }),
    ]);
  });
});
