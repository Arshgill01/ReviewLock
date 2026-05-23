import { describe, expect, it } from 'vitest';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockTarget } from '../../shared/schema';
import {
  approveForReviewLock,
  ignoreReportsForReviewLock,
  unignoreReportsForReviewLock,
} from './moderation';

const target = (): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Post',
  body: 'Body',
  edited: false,
  reportCount: 2,
});

describe('moderation operations', () => {
  it('returns structured success results', async () => {
    const reddit = new FakeRedditAdapter([target()]);

    expect(await approveForReviewLock(reddit, target())).toMatchObject({ ok: true, operation: 'approve' });
    expect(await ignoreReportsForReviewLock(reddit, target())).toMatchObject({
      ok: true,
      operation: 'ignoreReports',
    });
    expect(await unignoreReportsForReviewLock(reddit, target())).toMatchObject({
      ok: true,
      operation: 'unignoreReports',
    });
  });

  it('converts adapter failures to structured errors', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    reddit.failOperation('ignoreReports', 'permission denied');

    expect(await ignoreReportsForReviewLock(reddit, target())).toMatchObject({
      ok: false,
      operation: 'ignoreReports',
      errorMessage: 'permission denied',
    });
  });
});
