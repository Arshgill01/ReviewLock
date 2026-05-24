import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import { createDemoApiRouter } from './api.demo';

describe('demo API routes', () => {
  it('returns status and reset shapes with demo true', async () => {
    const redis = new InMemoryRedisStore();
    const router = createDemoApiRouter({
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });

    expect(await (await router.request('/demo/status')).json()).toMatchObject({
      ok: true,
      demo: true,
      status: { enabled: false },
    });

    expect(
      await (
        await router.request('/demo/reset', {
          method: 'POST',
        })
      ).json(),
    ).toMatchObject({
      ok: true,
      demo: true,
      status: { enabled: true, lockCount: 18, reopenEventCount: 5 },
    });
  });

  it('enables and disables demo mode', async () => {
    const redis = new InMemoryRedisStore();
    const router = createDemoApiRouter({
      redis,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });

    expect(await (await router.request('/demo/enable', { method: 'POST' })).json()).toMatchObject({
      ok: true,
      status: { enabled: true },
    });
    expect(await (await router.request('/demo/disable', { method: 'POST' })).json()).toMatchObject({
      ok: true,
      status: { enabled: false },
    });
  });

  it('returns structured errors when dependencies are missing', async () => {
    const response = await createDemoApiRouter().request('/demo/reset', { method: 'POST' });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, demo: true });
  });
});
