import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import type { ReviewLockTarget } from '../shared/schema';
import { defaultConfig, saveConfig } from '../server/services/config';
import { keys } from '../server/services/keys';
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

const commentTarget = (): ReviewLockTarget => ({
  id: 't1_comment',
  kind: 'comment',
  subreddit: 'alpha',
  authorName: 'u_commenter',
  permalink: '/r/alpha/comments/post/-/comment',
  body: 'Reviewed comment',
  edited: false,
  reportCount: 2,
});

describe('menu routes', () => {
  it('builds lock review form fields with target context', () => {
    expect(buildLockReviewForm(target())).toMatchObject({
      title: 'Lock review',
      fields: expect.arrayContaining([
        expect.objectContaining({ name: 'targetId', defaultValue: 't3_post' }),
        expect.objectContaining({ name: 'formToken' }),
        expect.objectContaining({ name: 'lockReason' }),
      ]),
    });
  });

  it('builds lock review form reason options from subreddit config', () => {
    expect(
      buildLockReviewForm(target(), 'token-1', {
        ...defaultConfig('alpha', '2026-05-24T00:00:00.000Z'),
        reasonPresets: ['repeat_report_churn', 'custom'],
      }),
    ).toMatchObject({
      fields: expect.arrayContaining([
        expect.objectContaining({
          name: 'lockReason',
          defaultValue: ['repeat_report_churn'],
          options: [
            { label: 'Repeat report churn', value: 'repeat_report_churn' },
            { label: 'Custom reason', value: 'custom' },
          ],
        }),
      ]),
    });
  });

  it('serves a lock form for post menu requests', async () => {
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      showForm: {
        name: 'lockReview',
        form: { title: 'Lock review' },
      },
    });
  });

  it('serves configured lock reason options for post menu requests', async () => {
    const redis = new InMemoryRedisStore();
    await saveConfig(redis, {
      ...defaultConfig('alpha', '2026-05-24T00:00:00.000Z'),
      reasonPresets: ['repeat_report_churn', 'custom'],
    });
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      showForm: {
        form: {
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'lockReason',
              defaultValue: ['repeat_report_churn'],
              options: [
                { label: 'Repeat report churn', value: 'repeat_report_churn' },
                { label: 'Custom reason', value: 'custom' },
              ],
            }),
          ]),
        },
      },
    });
  });

  it('falls back to default lock reasons when config cannot be read', async () => {
    class ConfigReadFailingRedisStore extends InMemoryRedisStore {
      override async get(key: string): Promise<string | undefined> {
        if (key === keys.config('alpha')) {
          throw new Error('config read failed');
        }

        return super.get(key);
      }
    }

    const redis = new ConfigReadFailingRedisStore();
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });
    const body = (await response.json()) as {
      showForm?: {
        form?: {
          fields?: Array<{
            name?: string;
            defaultValue?: string | string[];
            options?: Array<{ value?: string }>;
          }>;
        };
      };
    };
    const fields = body.showForm?.form?.fields ?? [];
    const token = fields.find((field) => field.name === 'formToken')?.defaultValue;

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'lockReason',
          defaultValue: ['reviewed_policy_compliant'],
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'reviewed_policy_compliant' }),
            expect.objectContaining({ value: 'custom' }),
          ]),
        }),
      ]),
    );
    expect(typeof token).toBe('string');
    expect(await redis.exists(`reviewlock:alpha:form:${typeof token === 'string' ? token : ''}`))
      .toBe(true);
  });

  it('normalizes bare post ids from Devvit menu payloads', async () => {
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ postId: 'post' }),
    });

    expect(await response.json()).toMatchObject({
      showForm: {
        form: {
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'targetId', defaultValue: 't3_post' }),
          ]),
        },
      },
    });
  });

  it('prefers comment ids for comment lock menu payload fallbacks', async () => {
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target(), commentTarget()]),
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-comment', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post', commentId: 'comment' }),
    });

    expect(await response.json()).toMatchObject({
      showForm: {
        form: {
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'targetId', defaultValue: 't1_comment' }),
          ]),
        },
      },
    });
  });

  it('rejects post target ids sent as the only comment lock menu target', async () => {
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target(), commentTarget()]),
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-comment', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'Unsupported target id: missing',
      },
    });
  });

  it('rejects malformed non-string menu target ids without resolving content', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    const router = createMenuRouter({
      reddit,
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: { id: 't3_post' } }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'Unsupported target id: missing',
      },
    });
    expect(reddit.calls).toEqual([]);
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
      showToast: {
        text: 'No active ReviewLock lock was found for this content.',
      },
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

    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/unlock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      showForm: {
        name: 'unlockReview',
        form: {
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'targetId', defaultValue: 't3_post' }),
            expect.objectContaining({ name: 'lockId', defaultValue: 'lock-1' }),
            expect.objectContaining({ name: 'formToken' }),
          ]),
        },
      },
    });
  });

  it('prefers comment ids for comment unlock menu payload fallbacks', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, {
      id: 'lock-comment',
      subreddit: 'alpha',
      targetId: 't1_comment',
      targetKind: 'comment',
      targetAuthor: 'u_commenter',
      permalink: '/r/alpha/comments/post/-/comment',
      contentPreview: 'Reviewed comment',
      contentHash: 'hash',
      fingerprintVersion: 'content-v1',
      lockedBy: 'mod',
      lockedAt: '2026-05-24T00:00:00.000Z',
      lockReason: 'reviewed_policy_compliant',
      status: 'active',
      lastKnownEdited: false,
      lastReportCount: 2,
      suppressedReportCount: 0,
      runtimeWarnings: [],
      demo: false,
    });

    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target(), commentTarget()]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/unlock-comment', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post', commentId: 'comment' }),
    });

    expect(await response.json()).toMatchObject({
      showForm: {
        name: 'unlockReview',
        form: {
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'targetId', defaultValue: 't1_comment' }),
            expect.objectContaining({ name: 'lockId', defaultValue: 'lock-comment' }),
          ]),
        },
      },
    });
  });

  it('rejects post target ids sent as the only comment unlock menu target', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, {
      id: 'lock-post',
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
    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target(), commentTarget()]),
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/unlock-comment', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toMatchObject({
      showToast: {
        text: 'Unsupported target id: missing',
      },
    });
  });

  it('serves target-level Open ReviewLock menu actions', async () => {
    const router = createMenuRouter();

    await expect(
      (await router.request('/open-post', { method: 'POST' })).json(),
    ).resolves.toMatchObject({
      showForm: { name: 'dashboardLaunch' },
    });
    await expect(
      (await router.request('/open-comment', { method: 'POST' })).json(),
    ).resolves.toMatchObject({
      showForm: { name: 'dashboardLaunch' },
    });
  });

  it('describes dashboard launch as reuse-first instead of every-click creation', async () => {
    const router = createMenuRouter();
    const response = await router.request('/open-dashboard', { method: 'POST' });

    expect(await response.json()).toMatchObject({
      showForm: {
        name: 'dashboardLaunch',
        form: {
          acceptLabel: 'Open dashboard',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'copy',
              defaultValue: expect.stringContaining('then reuses it for future launches'),
            }),
          ]),
        },
      },
    });
  });
});
