import { describe, expect, it } from 'vitest';
import { fixedClock } from '../server/adapters/clock';
import { FakeRedditAdapter } from '../server/adapters/reddit';
import { InMemoryRedisStore } from '../server/adapters/redis';
import type { ReopenEvent, ReviewLockRecord, ReviewLockTarget } from '../shared/schema';
import { listAuditEvents } from '../server/services/audit';
import { getActiveLockByTarget, saveLock } from '../server/services/locks';
import { loadRuntimeProofStatus } from '../server/services/runtimeProof';
import { enqueueReopenEvent, listOpenReopenEvents } from '../server/services/reopenQueue';
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

const target = (): ReviewLockTarget => ({
  id: 't3_alpha',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/alpha',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: 4,
});

const reopenEvent = (): ReopenEvent => ({
  id: 'reopen-1',
  lockId: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_alpha',
  targetKind: 'post',
  oldContentHash: 'old',
  newContentHash: 'new',
  reason: 'content_changed',
  createdAt: '2026-05-24T00:30:00.000Z',
  summary: 'Content changed after review.',
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

    const response = await router.request('/overview?subreddit=alpha&demo=false');

    expect(await response.json()).toMatchObject({
      ok: true,
      demo: false,
      generatedAt: '2026-05-24T01:00:00.000Z',
      overview: { activeLockCount: 1 },
    });
  });

  it('returns list JSON shapes', async () => {
    const redis = new InMemoryRedisStore();
    const router = createDashboardApiRouter({
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

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
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'Redis adapter is not configured.',
    });
  });

  it('unlocks reviewed content from the dashboard API', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target()], 'dash_mod');
    await saveLock(redis, lock());
    const router = createDashboardApiRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/locks/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: 't3_alpha',
        lockId: 'lock-1',
        actor: 'client_supplied_actor',
      }),
    });

    expect(await response.json()).toMatchObject({
      ok: true,
      message: 'ReviewLock lock removed and reports returned to normal handling.',
    });
    expect(reddit.calls).toContain('unignoreReports:t3_alpha');
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_alpha')).toBeUndefined();
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'lock_unlocked',
        actor: 'dash_mod',
      }),
    ]);
    expect(await loadRuntimeProofStatus(redis, 'alpha')).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'unignoreReports', status: 'verified' }),
      ]),
    });
  });

  it('rejects stale dashboard unlock confirmations', async () => {
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([target()], 'dash_mod');
    await saveLock(redis, lock());
    const router = createDashboardApiRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/locks/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: 't3_alpha', lockId: 'old-lock' }),
    });

    expect(await response.json()).toMatchObject({
      ok: false,
      message:
        'ReviewLock lock changed before unlock could be confirmed. Refresh and confirm again.',
      warnings: ['stale_unlock_confirmation'],
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'alpha', 't3_alpha')).toMatchObject({ id: 'lock-1' });
  });

  it('rejects dashboard unlocks outside the runtime subreddit scope', async () => {
    const betaTarget: ReviewLockTarget = {
      ...target(),
      id: 't3_beta',
      subreddit: 'beta',
      permalink: '/r/beta/comments/beta',
    };
    const betaLock: ReviewLockRecord = {
      ...lock(),
      id: 'lock-beta',
      subreddit: 'beta',
      targetId: 't3_beta',
      permalink: '/r/beta/comments/beta',
    };
    const redis = new InMemoryRedisStore();
    const reddit = new FakeRedditAdapter([betaTarget], 'dash_mod', 'alpha');
    await saveLock(redis, betaLock);
    const router = createDashboardApiRouter({
      reddit,
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/locks/unlock?subreddit=alpha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: 't3_beta', lockId: 'lock-beta' }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      message: 'ReviewLock target is outside the current subreddit context.',
      warnings: ['subreddit_scope_mismatch'],
    });
    expect(reddit.calls).toEqual([]);
    expect(await getActiveLockByTarget(redis, 'beta', 't3_beta')).toMatchObject({
      id: 'lock-beta',
    });
  });

  it('dismisses reopened items from the dashboard API', async () => {
    const redis = new InMemoryRedisStore();
    await enqueueReopenEvent(redis, reopenEvent());
    const router = createDashboardApiRouter({
      reddit: new FakeRedditAdapter([target()], 'dash_mod'),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/reopen-queue/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'reopen-1',
        actor: 'client_supplied_actor',
        subreddit: 'alpha',
      }),
    });

    expect(await response.json()).toMatchObject({
      ok: true,
      message: 'ReviewLock dismissed this reopened item.',
    });
    expect(await listOpenReopenEvents(redis, 'alpha')).toEqual([]);
    expect(await listAuditEvents(redis, 'alpha')).toEqual([
      expect.objectContaining({
        kind: 'reopen_dismissed',
        actor: 'dash_mod',
      }),
    ]);
  });

  it('rejects client-supplied subreddit namespaces that do not match runtime context', async () => {
    const redis = new InMemoryRedisStore();
    await saveLock(redis, lock());
    const router = createDashboardApiRouter({
      reddit: new FakeRedditAdapter([target()], 'dash_mod', 'alpha'),
      redis,
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/overview?subreddit=beta');

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'Dashboard subreddit scope does not match the Devvit runtime subreddit.',
    });
  });

  it('rejects demo namespace reads unless demo mode is enabled', async () => {
    const router = createDashboardApiRouter({
      redis: new InMemoryRedisStore(),
      clock: fixedClock('2026-05-24T01:00:00.000Z'),
    });

    const response = await router.request('/locks?subreddit=reviewlock_demo&demo=false');

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'ReviewLock demo data must be requested with demo mode enabled.',
    });
  });
});
