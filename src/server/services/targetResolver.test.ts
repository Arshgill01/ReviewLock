import { describe, expect, it } from 'vitest';
import { FakeRedditAdapter } from '../adapters/reddit';
import type { ReviewLockTarget } from '../../shared/schema';
import { inferTargetKind, normalizeTargetId, resolveTargetById } from './targetResolver';

const target = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't1_comment',
  kind: 'comment',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post/-/comment',
  body: 'Comment',
  edited: false,
  reportCount: 0,
  ...overrides,
});

describe('target resolver', () => {
  it('infers post and comment thing ids', () => {
    expect(inferTargetKind('t3_post')).toBe('post');
    expect(inferTargetKind('t1_comment')).toBe('comment');
    expect(inferTargetKind('abc')).toBeUndefined();
  });

  it('normalizes bare Reddit ids when the route target kind is known', () => {
    expect(normalizeTargetId('post', 'abc123')).toBe('t3_abc123');
    expect(normalizeTargetId('comment', 'def456')).toBe('t1_def456');
    expect(normalizeTargetId('post', 't3_post')).toBe('t3_post');
    expect(normalizeTargetId('comment', undefined)).toBeUndefined();
  });

  it('rejects non-string and blank ids before normalization', () => {
    expect(normalizeTargetId('post', 42)).toBeUndefined();
    expect(normalizeTargetId('comment', { id: 'comment' })).toBeUndefined();
    expect(normalizeTargetId('post', '   ')).toBeUndefined();
    expect(normalizeTargetId('post', ' post ')).toBe('t3_post');
  });

  it('rejects already-prefixed ids that contradict the route target kind', () => {
    expect(normalizeTargetId('post', 't1_comment')).toBeUndefined();
    expect(normalizeTargetId('comment', 't3_post')).toBeUndefined();
  });

  it('refetches comments through the adapter', async () => {
    const reddit = new FakeRedditAdapter([target()]);

    expect(await resolveTargetById(reddit, 't1_comment')).toMatchObject({
      ok: true,
      target: { id: 't1_comment' },
    });
  });

  it('returns structured errors for unknown targets', async () => {
    const reddit = new FakeRedditAdapter();

    expect(await resolveTargetById(reddit, 'missing')).toMatchObject({
      ok: false,
      error: 'Unsupported target id: missing',
    });
    expect(await resolveTargetById(reddit, 't3_missing')).toMatchObject({
      ok: false,
      targetKind: 'post',
    });
  });
});
