import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { fixedClock } from '../server/adapters/clock';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { loadRuntimeProofStatus } from '../server/services/runtimeProof';
import { createApiRouter } from './api';

const createContractApp = () =>
  createApp({
    redis: new InMemoryRedisStore(),
    reddit: new FakeRedditAdapter(),
    clock: fixedClock('2026-05-24T00:00:00.000Z'),
    getCurrentSubredditName: () => 'alpha',
  });

describe('API/client route contract', () => {
  it('serves every endpoint used by the dashboard client', async () => {
    const app = createContractApp();
    const checks: Array<{ method: 'GET' | 'POST'; path: string; body?: unknown }> = [
      { method: 'GET', path: '/api/context' },
      { method: 'GET', path: '/api/overview?subreddit=alpha&demo=false' },
      { method: 'GET', path: '/api/locks?subreddit=alpha&demo=false' },
      { method: 'GET', path: '/api/reopen-queue?subreddit=alpha&demo=false' },
      { method: 'GET', path: '/api/audit?subreddit=alpha&demo=false' },
      { method: 'GET', path: '/api/runtime?subreddit=alpha&demo=false' },
      { method: 'POST', path: '/api/smoke/redis?subreddit=alpha' },
      { method: 'POST', path: '/api/smoke/reddit?subreddit=alpha' },
      { method: 'POST', path: '/api/demo/enable' },
      { method: 'POST', path: '/api/demo/disable?subreddit=reviewlock_demo' },
      { method: 'POST', path: '/api/locks/unlock', body: {} },
      { method: 'POST', path: '/api/reopen-queue/dismiss', body: {} },
      { method: 'POST', path: '/internal/form/unlock-review-submit', body: {} },
      { method: 'POST', path: '/internal/form/reopen-action-submit', body: {} },
    ];

    for (const check of checks) {
      const response = await app.request(check.path, {
        method: check.method,
        headers: check.body ? { 'Content-Type': 'application/json' } : undefined,
        body: check.body ? JSON.stringify(check.body) : undefined,
      });

      expect(response.status, `${check.method} ${check.path}`).not.toBe(404);
      expect(response.status, `${check.method} ${check.path}`).not.toBe(405);
      await expect(response.json(), `${check.method} ${check.path}`).resolves.toBeTruthy();
    }
  });

  it('returns empty arrays for empty dashboard collections', async () => {
    const app = createContractApp();

    await expect(
      (await app.request('/api/locks?subreddit=alpha&demo=false')).json(),
    ).resolves.toMatchObject({ ok: true, locks: [] });
    await expect(
      (await app.request('/api/reopen-queue?subreddit=alpha&demo=false')).json(),
    ).resolves.toMatchObject({ ok: true, events: [] });
    await expect(
      (await app.request('/api/audit?subreddit=alpha&demo=false')).json(),
    ).resolves.toMatchObject({ ok: true, events: [] });
    await expect(
      (await app.request('/api/runtime?subreddit=alpha&demo=false')).json(),
    ).resolves.toMatchObject({
      ok: true,
      runtime: { overall: 'unverified' },
      dailyMetrics: [],
      topChurnTargets: [],
    });
  });

  it('rejects dashboard namespaces that do not match the runtime subreddit', async () => {
    const response = await createContractApp().request('/api/locks?subreddit=other&demo=false');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Dashboard subreddit scope does not match the Devvit runtime subreddit.',
    });
  });

  it('rejects runtime smoke namespaces that do not match the runtime subreddit', async () => {
    const response = await createContractApp().request('/api/smoke/redis?subreddit=other', {
      method: 'POST',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Runtime smoke subreddit scope does not match the Devvit runtime subreddit.',
    });
  });

  it('rejects runtime smoke when neither runtime nor client provides a subreddit', async () => {
    const app = createApp({
      redis: new InMemoryRedisStore(),
      reddit: new FakeRedditAdapter([], 'mod_test', ''),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });

    const response = await app.request('/api/smoke/redis', { method: 'POST' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Runtime smoke subreddit context is required.',
    });
  });

  it('does not fall back to the app-name namespace when runtime context is unavailable', async () => {
    const app = createApp({
      redis: new InMemoryRedisStore(),
      reddit: new FakeRedditAdapter([], 'mod_test', ''),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });

    const dashboardResponse = await app.request('/api/locks?subreddit=reviewlock&demo=false');
    const smokeResponse = await app.request('/api/smoke/redis?subreddit=reviewlock', {
      method: 'POST',
    });

    expect(dashboardResponse.status).toBe(400);
    await expect(dashboardResponse.json()).resolves.toMatchObject({
      ok: false,
      error: 'Dashboard subreddit context is required.',
    });
    expect(smokeResponse.status).toBe(400);
    await expect(smokeResponse.json()).resolves.toMatchObject({
      ok: false,
      error: 'Runtime smoke subreddit context is required.',
    });
  });

  it('records failed Redis smoke proof when Redis readback does not match', async () => {
    class ReadMismatchRedisStore extends InMemoryRedisStore {
      override async get(key: string): Promise<string | undefined> {
        if (key.includes(':runtime:smoke:')) {
          return 'unexpected-smoke-value';
        }

        return super.get(key);
      }
    }

    const redis = new ReadMismatchRedisStore();
    const app = createApp({
      redis,
      reddit: new FakeRedditAdapter(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
      getCurrentSubredditName: () => 'alpha',
    });

    const response = await app.request('/api/smoke/redis?subreddit=alpha', { method: 'POST' });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      capability: 'redis',
      status: 'failed',
      error: 'Redis smoke read did not match the written value.',
    });
    await expect(loadRuntimeProofStatus(redis, 'alpha')).resolves.toMatchObject({
      overall: 'failed',
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'redis',
          status: 'failed',
          evidence:
            'POST /api/smoke/redis could not complete the namespaced Redis operation check.',
        }),
      ]),
    });
  });

  it('records failed Redis smoke proof when sorted-set ordering is wrong', async () => {
    class WrongOrderRedisStore extends InMemoryRedisStore {
      override async zRange(key: string, start: number, stop: number, reverse?: boolean) {
        void reverse;
        return super.zRange(key, start, stop, false);
      }
    }

    const redis = new WrongOrderRedisStore();
    const app = createApp({
      redis,
      reddit: new FakeRedditAdapter(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
      getCurrentSubredditName: () => 'alpha',
    });

    const response = await app.request('/api/smoke/redis?subreddit=alpha', { method: 'POST' });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      capability: 'redis',
      status: 'failed',
      error: 'Redis sorted-set smoke order did not match newest-first order.',
    });
    expect(await redis.exists('reviewlock:alpha:runtime:smoke:zset:1779552000000')).toBe(false);
    await expect(loadRuntimeProofStatus(redis, 'alpha')).resolves.toMatchObject({
      overall: 'failed',
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'redis',
          status: 'failed',
          evidence:
            'POST /api/smoke/redis could not complete the namespaced Redis operation check.',
        }),
      ]),
    });
  });

  it('records failed Redis smoke proof when hash readback is wrong', async () => {
    class HashMismatchRedisStore extends InMemoryRedisStore {
      override async hgetall(key: string): Promise<Record<string, string>> {
        if (key.includes(':runtime:smoke:hash:')) {
          return { lockId: 'unexpected-lock', targetId: 't3_smoke' };
        }

        return super.hgetall(key);
      }
    }

    const redis = new HashMismatchRedisStore();
    const app = createApp({
      redis,
      reddit: new FakeRedditAdapter(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
      getCurrentSubredditName: () => 'alpha',
    });

    const response = await app.request('/api/smoke/redis?subreddit=alpha', { method: 'POST' });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      capability: 'redis',
      status: 'failed',
      error: 'Redis hash smoke read did not match the written values.',
    });
    expect(await redis.exists('reviewlock:alpha:runtime:smoke:hash:1779552000000')).toBe(false);
    await expect(loadRuntimeProofStatus(redis, 'alpha')).resolves.toMatchObject({
      overall: 'failed',
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'redis',
          status: 'failed',
          evidence:
            'POST /api/smoke/redis could not complete the namespaced Redis operation check.',
        }),
      ]),
    });
  });

  it('records failed Reddit smoke proof when Reddit context cannot return a username', async () => {
    class MissingUsernameRedditAdapter extends FakeRedditAdapter {
      override async getCurrentUsername(): Promise<string | undefined> {
        return undefined;
      }
    }

    const redis = new InMemoryRedisStore();
    const app = createApp({
      redis,
      reddit: new MissingUsernameRedditAdapter(),
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
      getCurrentSubredditName: () => 'alpha',
    });

    const response = await app.request('/api/smoke/reddit?subreddit=alpha', { method: 'POST' });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      capability: 'redditContext',
      status: 'failed',
      error: 'Reddit context did not return a current username.',
    });
    await expect(loadRuntimeProofStatus(redis, 'alpha')).resolves.toMatchObject({
      overall: 'failed',
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'redditContext',
          status: 'failed',
          evidence: 'POST /api/smoke/reddit could not confirm the Devvit Reddit context.',
        }),
      ]),
    });
  });

  it('returns structured non-200 JSON when API dependencies are missing', async () => {
    const response = await createApiRouter().request('/locks?subreddit=alpha&demo=false');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Redis adapter is not configured.',
      requestId: expect.any(String),
    });
  });
});
