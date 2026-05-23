import { describe, expect, it } from 'vitest';
import type { ReviewLockTarget } from '../../shared/schema';
import { classifyContentChange } from './contentChange';

const post = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'reviewlock',
  authorName: 'u_author',
  permalink: '/r/reviewlock/comments/post',
  title: 'Original title',
  body: 'Original body',
  url: '',
  flairText: 'Discussion',
  flairTemplateId: 'flair-discussion',
  isNsfw: false,
  isSpoiler: false,
  edited: false,
  reportCount: 0,
  ...overrides,
});

const comment = (overrides: Partial<ReviewLockTarget> = {}): ReviewLockTarget => ({
  id: 't1_comment',
  kind: 'comment',
  subreddit: 'reviewlock',
  authorName: 'u_commenter',
  permalink: '/r/reviewlock/comments/post/-/comment',
  body: 'Original comment',
  edited: false,
  reportCount: 0,
  ...overrides,
});

describe('classifyContentChange', () => {
  it('returns unchanged for identical post content', () => {
    expect(classifyContentChange(post(), post())).toEqual({
      status: 'unchanged',
      changedFields: [],
    });
  });

  it('classifies post body edits as content changes', () => {
    expect(classifyContentChange(post(), post({ body: 'Edited body' }))).toMatchObject({
      status: 'changed',
      changedFields: ['body'],
      reopenReason: 'content_changed',
    });
  });

  it('classifies flair changes separately', () => {
    expect(classifyContentChange(post(), post({ flairText: 'News' }))).toMatchObject({
      status: 'changed',
      changedFields: ['flairText'],
      reopenReason: 'flair_changed',
    });
  });

  it('classifies nsfw and spoiler changes separately', () => {
    expect(classifyContentChange(post(), post({ isNsfw: true })).reopenReason).toBe('nsfw_changed');
    expect(classifyContentChange(post(), post({ isSpoiler: true })).reopenReason).toBe(
      'spoiler_changed',
    );
  });

  it('classifies comment body edits as content changes', () => {
    expect(classifyContentChange(comment(), comment({ body: 'Edited comment' }))).toMatchObject({
      status: 'changed',
      changedFields: ['body'],
      reopenReason: 'content_changed',
    });
  });

  it('fails open when current content is missing', () => {
    expect(classifyContentChange(comment(), comment({ body: undefined }))).toMatchObject({
      status: 'uncertain',
      changedFields: [],
      reopenReason: 'runtime_uncertain',
    });
  });
});
