import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { InMemoryRedisStore } from '../server/adapters/redis';
import type { ReviewLockRecord } from '../shared/schema';
import { saveLock } from '../server/services/locks';
import { createDashboardApiRouter } from './api.dashboard';

const lock = (): ReviewLockRecord => ({
  id: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_alpha',
  targetKind: 'post',
  targetAuthor: 'u_author',
  permalink: '/r/alpha/comments/alpha',
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

describe('dashboard API routes', () => {
  it('returns overview JSON shape', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const router = createDashboardApiRouter({
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/overview?subreddit=alpha&demo=true');

    expect(await response.json()).toMatchObject({
      ok: true,
      demo: true,
      generatedAt: '2026-05-24T01:00:00.000Z',
      overview: { activeLockCount: 1 },
    });
  });

  it('returns list JSON shapes', async () => {
    const redis = new InMemoryRedisStore();
    const router = createDashboardApiRouter({ redis, clock: fixedClock('2026-05-24T01:00:00.000Z') });

    expect(await (await router.request('/locks?subreddit=alpha')).json()).toMatchObject({
      ok: true,
      locks: [],
    });
    expect(await (await router.request('/reopen-queue?subreddit=alpha')).json()).toMatchObject({
      ok: true,
      events: [],
    });
    expect(await (await router.request('/audit?subreddit=alpha')).json()).toMatchObject({
      ok: true,
      events: [],
    });
    expect(await (await router.request('/runtime?subreddit=alpha')).json()).toMatchObject({
      ok: true,
      runtime: { overall: 'unverified' },
    });
  });

  it('returns structured errors when dependencies are missing', async () => {
    const response = await createDashboardApiRouter().request('/overview?subreddit=alpha');

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, error: 'Redis adapter is not configured.' });
  });
});
