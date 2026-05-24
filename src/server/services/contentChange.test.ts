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

  it('returns unchanged for non-material post whitespace edits', () => {
    expect(
      classifyContentChange(
        post({ title: 'Original title', body: 'Original body with spacing' }),
        post({ title: '  Original title ', body: '\nOriginal\tbody   with spacing  ' }),
      ),
    ).toEqual({
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

  it('classifies post body cleared and rewritten as content changes', () => {
    expect(classifyContentChange(post({ body: 'Original body' }), post({ body: '' }))).toMatchObject({
      status: 'changed',
      changedFields: ['body'],
      reopenReason: 'content_changed',
    });
    expect(
      classifyContentChange(post({ body: 'Original body' }), post({ body: 'Completely rewritten body' })),
    ).toMatchObject({
      status: 'changed',
      changedFields: ['body'],
      reopenReason: 'content_changed',
    });
  });

  it('classifies markdown line break changes as content changes', () => {
    expect(classifyContentChange(post({ body: 'First line\nSecond line' }), post({ body: 'First line Second line' }))).toMatchObject({
      status: 'changed',
      changedFields: ['body'],
      reopenReason: 'content_changed',
    });
  });

  it('classifies title and url changes as content changes', () => {
    expect(classifyContentChange(post(), post({ title: 'Changed title' }))).toMatchObject({
      status: 'changed',
      changedFields: ['title'],
      reopenReason: 'content_changed',
    });
    expect(classifyContentChange(post(), post({ url: 'https://example.com/changed' }))).toMatchObject({
      status: 'changed',
      changedFields: ['url'],
      reopenReason: 'content_changed',
    });
  });

  it('classifies flair changes separately', () => {
    expect(classifyContentChange(post(), post({ flairText: 'News' }))).toMatchObject({
      status: 'changed',
      changedFields: ['flairText'],
      reopenReason: 'flair_changed',
    });
    expect(classifyContentChange(post(), post({ flairTemplateId: 'flair-news' }))).toMatchObject({
      status: 'changed',
      changedFields: ['flairTemplateId'],
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

  it('returns unchanged for non-material comment whitespace edits', () => {
    expect(
      classifyContentChange(
        comment({ body: 'Original comment with spacing' }),
        comment({ body: '\nOriginal\tcomment   with spacing  ' }),
      ),
    ).toEqual({
      status: 'unchanged',
      changedFields: [],
    });
  });

  it('classifies comment body cleared and rewritten as content changes', () => {
    expect(classifyContentChange(comment({ body: 'Original comment' }), comment({ body: '' }))).toMatchObject({
      status: 'changed',
      changedFields: ['body'],
      reopenReason: 'content_changed',
    });
    expect(
      classifyContentChange(
        comment({ body: 'Original comment' }),
        comment({ body: 'Completely rewritten comment' }),
      ),
    ).toMatchObject({
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
