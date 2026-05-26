import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import type { ReviewLockTarget } from '../shared/schema';
import { defaultConfig, saveConfig } from '../server/services/config';
import { keys } from '../server/services/keys';
import { getActiveLockByTarget, saveLock } from '../server/services/locks';
import { createFormsRouter } from './forms';
import { buildLockReviewForm, createMenuRouter } from './menu';

const target = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: true,
  reportCount: 4,
  ...overrides,
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

const fieldValue = (
  body: unknown,
  name: string,
): string | undefined => {
  return formField(body, name)?.defaultValue;
};

const formField = (
  body: unknown,
  name: string,
): {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
  isSecret?: boolean;
  scope?: string;
} | undefined => {
  const fields = (body as {
    showForm?: {
      form?: {
        fields?: Array<{
          name?: string;
          defaultValue?: string;
          disabled?: boolean;
          isSecret?: boolean;
          scope?: string;
        }>;
      };
    };
  }).showForm?.form?.fields ?? [];

  return fields.find((field) => field.name === name);
};

describe('menu routes', () => {
  it('builds lock review form fields with target context', () => {
    expect(buildLockReviewForm(target())).toMatchObject({
      title: 'Lock review',
      fields: expect.arrayContaining([
        expect.objectContaining({ name: 'targetId', defaultValue: 't3_post' }),
        expect.objectContaining({
          name: 'reviewOpenedAt',
          defaultValue: '',
        }),
        expect.objectContaining({ name: 'lockReason' }),
      ]),
    });
    expect(formField({ showForm: { form: buildLockReviewForm(target()) } }, 'targetId')?.disabled)
      .not.toBe(true);
    expect(buildLockReviewForm(target()).fields.some((field) => field.name === 'formToken'))
      .toBe(false);
  });

  it('builds lock review form reason options from subreddit config', () => {
    expect(
      buildLockReviewForm(target(), '2026-05-24T00:00:00.000Z', {
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

  it('normalizes mixed-case target subreddits across menu lock form submission', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target({ subreddit: 'Alpha' })], 'mod_test', 'Alpha');
    const clock = fixedClock('2026-05-24T00:00:00.000Z');
    const menuRouter = createMenuRouter({ reddit, redis, clock });
    const formsRouter = createFormsRouter({ reddit, redis, clock });
    const menuResponse = await menuRouter.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });
    const menuBody = await menuResponse.json();

    expect(fieldValue(menuBody, 'subreddit')).toBe('alpha');
    expect(formField(menuBody, 'formToken')).toBeUndefined();
    expect(formField(menuBody, 'targetId')?.disabled).not.toBe(true);
    expect(fieldValue(menuBody, 'reviewOpenedAt')).toBe('2026-05-24T00:00:00.000Z');

    const submitResponse = await formsRouter.request('/lock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        subreddit: 'alpha',
        reviewOpenedAt: fieldValue(menuBody, 'reviewOpenedAt'),
        lockReason: 'reviewed_policy_compliant',
      }),
    });

    expect(await submitResponse.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock locked this reviewed content until it changes.',
      },
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toMatchObject({
      status: 'active',
    });
    expect(await getActiveLockByTarget(redis, 'Alpha', 't3_post')).toBeUndefined();
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
    expect(fields.some((field) => field.name === 'formToken')).toBe(false);
  });

  it('returns a neutral toast when lock form preparation cannot reserve Redis state', async () => {
    class FormBindingFailingRedisStore extends InMemoryRedisStore {
      override async set(keyName: string, value: string): Promise<void> {
        if (keyName.startsWith('reviewlock:alpha:form:')) {
          throw new Error('form binding down');
        }

        await super.set(keyName, value);
      }
    }

    const router = createMenuRouter({
      reddit: new FakeRedditAdapter([target()]),
      redis: new FormBindingFailingRedisStore(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });
    const response = await router.request('/lock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });

    expect(await response.json()).toEqual({
      showToast: {
        text: 'ReviewLock could not prepare the confirmation form. Reopen the menu and try again.',
        appearance: 'neutral',
      },
    });
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
          ]),
        },
      },
    });
  });

  it('returns a neutral toast when unlock form preparation cannot reserve Redis state', async () => {
    class FormBindingFailingRedisStore extends InMemoryRedisStore {
      override async set(keyName: string, value: string): Promise<void> {
        if (keyName.startsWith('reviewlock:alpha:form:')) {
          throw new Error('form binding down');
        }

        await super.set(keyName, value);
      }
    }

    const redis = new FormBindingFailingRedisStore();
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

    expect(await response.json()).toEqual({
      showToast: {
        text: 'ReviewLock could not prepare the confirmation form. Reopen the menu and try again.',
        appearance: 'neutral',
      },
    });
  });

  it('normalizes mixed-case target subreddits across menu unlock form submission', async () => {
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

    const reddit = new FakeRedditAdapter([target({ subreddit: 'Alpha' })], 'mod_test', 'Alpha');
    const clock = fixedClock('2026-05-24T00:00:00.000Z');
    const menuRouter = createMenuRouter({ reddit, redis, clock });
    const formsRouter = createFormsRouter({ reddit, redis, clock });
    const menuResponse = await menuRouter.request('/unlock-post', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post' }),
    });
    const menuBody = await menuResponse.json();

    expect(fieldValue(menuBody, 'subreddit')).toBe('alpha');
    expect(formField(menuBody, 'formToken')).toBeUndefined();
    expect(formField(menuBody, 'targetId')?.disabled).not.toBe(true);
    expect(formField(menuBody, 'lockId')?.disabled).not.toBe(true);
    expect(fieldValue(menuBody, 'reviewOpenedAt')).toBe('2026-05-24T00:00:00.000Z');

    const submitResponse = await formsRouter.request('/unlock-review-submit', {
      method: 'POST',
      body: JSON.stringify({
        targetId: 't3_post',
        lockId: 'lock-1',
        subreddit: 'alpha',
        reviewOpenedAt: fieldValue(menuBody, 'reviewOpenedAt'),
      }),
    });

    expect(await submitResponse.json()).toMatchObject({
      showToast: {
        text: 'ReviewLock unlocked this reviewed content.',
      },
    });
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_post')).toBeUndefined();
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
