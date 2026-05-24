import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { fixedClock } from '../server/adapters/clock';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import { InMemoryRedisStore } from '../server/adapters/redis';
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
