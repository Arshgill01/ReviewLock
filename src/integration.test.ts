import { describe, expect, it } from 'vitest';
import devvitConfig from '../devvit.json';
import { fixedClock } from './server/adapters/clock';
import { InMemoryRedisStore } from './server/adapters/redis';
import { FakeRedditAdapter } from './server/adapters/reddit';
import type { ReviewLockTarget } from './shared/schema';
import { createApp } from './index';

interface DevvitMenuItem {
  endpoint: string;
}

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body: 'Reviewed body',
  edited: false,
  reportCount: 3,
});

const commentTarget = (): ReviewLockTarget => ({
  id: 't1_comment',
  kind: 'comment',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post/-/comment',
  body: 'Reviewed comment',
  edited: false,
  reportCount: 1,
});

const makeApp = () =>
  createApp({
    redis: new InMemoryRedisStore(),
    reddit: new FakeRedditAdapter([target(), commentTarget()]),
    clock: fixedClock('2026-05-24T00:00:00.000Z'),
  });

const endpointPayload = (path: string): string => {
  if (path.includes('comment')) {
    return JSON.stringify({ targetId: 't1_comment', actor: 'mod', lockReason: 'reviewed_policy_compliant' });
  }

  if (path.includes('lock-review-submit')) {
    return JSON.stringify({ targetId: 't3_post', actor: 'mod', lockReason: 'reviewed_policy_compliant' });
  }

  if (path.includes('unlock-review-submit')) {
    return JSON.stringify({ targetId: 't3_post', actor: 'mod' });
  }

  if (path.includes('post') || path.includes('report') || path.includes('update')) {
    return JSON.stringify({ targetId: 't3_post', eventId: 'evt-1', subreddit: 'alpha' });
  }

  return JSON.stringify({});
};

const devvitEndpoints = (): string[] => [
  ...(devvitConfig.menu.items as DevvitMenuItem[]).map((item) => item.endpoint),
  ...Object.values(devvitConfig.forms),
  ...Object.values(devvitConfig.triggers),
];

describe('integrated ReviewLock app', () => {
  it('has no duplicate devvit endpoint paths', () => {
    const endpoints = devvitEndpoints();
    expect(new Set(endpoints).size).toBe(endpoints.length);
  });

  it('serves every devvit.json endpoint path', async () => {
    for (const path of devvitEndpoints()) {
      const response = await makeApp().request(path, {
        method: 'POST',
        body: endpointPayload(path),
      });

      expect(response.status, path).not.toBe(404);
    }
  });

  it('returns dashboard overview with empty state', async () => {
    const response = await makeApp().request('/api/overview?subreddit=alpha');

    expect(await response.json()).toMatchObject({
      ok: true,
      overview: {
        activeLockCount: 0,
        reportsSuppressed: 0,
      },
    });
  });

  it('demo enable then overview returns demo data', async () => {
    const app = makeApp();
    await app.request('/api/demo/enable', { method: 'POST' });
    const response = await app.request('/api/overview?subreddit=reviewlock_demo&demo=true');

    expect(await response.json()).toMatchObject({
      ok: true,
      demo: true,
      overview: {
        activeLockCount: 8,
        reopenedAfterEditCount: 3,
      },
    });
  });

  it('trigger endpoint accepts representative payload without throwing', async () => {
    const response = await makeApp().request('/internal/triggers/on-post-report', {
      method: 'POST',
      body: JSON.stringify({ targetId: 't3_post', eventId: 'evt-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });
});
