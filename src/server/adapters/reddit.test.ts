import { describe, expect, it } from 'vitest';
import type { ReviewLockTarget } from '../../shared/schema';
import { FakeRedditAdapter, mapCommentModel, mapPostModel } from './reddit';

const target = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Post',
  body: 'Body',
  edited: false,
  reportCount: 2,
  ...overrides,
});

describe('reddit adapter mapping', () => {
  it('maps post and comment models into ReviewLock targets', () => {
    expect(
      mapPostModel({
        id: 'abc',
        title: 'Title',
        body: 'Body',
        subredditName: 'alpha',
        authorName: 'u_author',
        permalink: '/p',
        numberOfReports: 3,
        edited: true,
        approve: async () => undefined,
        ignoreReports: async () => undefined,
        unignoreReports: async () => undefined,
      }),
    ).toMatchObject({
      id: 't3_abc',
      kind: 'post',
      reportCount: 3,
      edited: true,
    });
    expect(
      mapCommentModel({
        id: 'def',
        body: 'Comment',
        subredditName: 'alpha',
        authorName: 'u_commenter',
        permalink: '/c',
        numReports: 2,
        approve: async () => undefined,
        ignoreReports: async () => undefined,
        unignoreReports: async () => undefined,
      }),
    ).toMatchObject({
      id: 't1_def',
      kind: 'comment',
      reportCount: 2,
    });
  });

  it('records fake moderation calls and structured failures can be triggered', async () => {
    const reddit = new FakeRedditAdapter([target()]);
    await reddit.approveTarget(target());

    expect(reddit.calls).toEqual(['approve:t3_post']);
    reddit.failOperation('ignoreReports', 'not allowed');
    await expect(reddit.ignoreReports(target())).rejects.toThrow('not allowed');
  });
});
