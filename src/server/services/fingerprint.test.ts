import { describe, expect, it } from 'vitest';
import type { ReviewLockTarget } from '../../shared/schema';
import {
  compareFingerprints,
  fingerprintComment,
  fingerprintPost,
  fingerprintTarget,
  hashFingerprintInput,
  normalizeText,
} from './fingerprint';

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

describe('normalizeText', () => {
  it('normalizes whitespace without lowercasing content', () => {
    expect(normalizeText('  Keep  CASE\tHere\r\nNext  line  ')).toBe('Keep CASE Here\nNext line');
  });

  it('preserves markdown line breaks while collapsing spaces and tabs', () => {
    expect(normalizeText('Line one  \n\tLine two\n\nLine   three')).toBe('Line one\n Line two\n\nLine three');
  });
});

describe('fingerprinting', () => {
  it('creates a stable SHA-256 hash for identical input', () => {
    const first = fingerprintPost(post(), '2026-05-24T00:00:00.000Z');
    const second = fingerprintPost(post(), '2026-05-24T01:00:00.000Z');

    expect(first?.hash).toBe(second?.hash);
    expect(first?.hash).toHaveLength(64);
    expect(hashFingerprintInput(first?.input ?? '')).toBe(first?.hash);
  });

  it('changes hash when a post body changes', () => {
    const previous = fingerprintPost(post({ body: 'Original body' }));
    const current = fingerprintPost(post({ body: 'Edited body' }));

    expect(compareFingerprints(previous, current)).toBe('changed');
  });

  it('does not change hash for outer whitespace-only post edits', () => {
    const previous = fingerprintPost(post({ title: 'Original title', body: 'Original body' }));
    const current = fingerprintPost(post({ title: '  Original title  ', body: '\nOriginal body\t ' }));

    expect(compareFingerprints(previous, current)).toBe('unchanged');
  });

  it('does not change hash for runs of spaces and tabs inside text', () => {
    const previous = fingerprintPost(post({ body: 'Original body with spacing' }));
    const current = fingerprintPost(post({ body: 'Original\t\tbody   with\tspacing' }));

    expect(compareFingerprints(previous, current)).toBe('unchanged');
  });

  it('changes hash when markdown line breaks change semantic structure', () => {
    const previous = fingerprintPost(post({ body: 'First line\nSecond line' }));
    const current = fingerprintPost(post({ body: 'First line Second line' }));

    expect(compareFingerprints(previous, current)).toBe('changed');
  });

  it('changes hash when post body is cleared or rewritten', () => {
    expect(compareFingerprints(fingerprintPost(post({ body: 'Original body' })), fingerprintPost(post({ body: '' })))).toBe(
      'changed',
    );
    expect(
      compareFingerprints(
        fingerprintPost(post({ body: 'Original body' })),
        fingerprintPost(post({ body: 'Completely rewritten body' })),
      ),
    ).toBe('changed');
  });

  it('changes hash for title, url, flair, nsfw, and spoiler material post fields', () => {
    const previous = fingerprintPost(post());

    for (const current of [
      post({ title: 'Changed title' }),
      post({ url: 'https://example.com/changed' }),
      post({ flairText: 'News' }),
      post({ flairTemplateId: 'flair-news' }),
      post({ isNsfw: true }),
      post({ isSpoiler: true }),
    ]) {
      expect(compareFingerprints(previous, fingerprintPost(current))).toBe('changed');
    }
  });

  it('changes hash when a comment body changes', () => {
    const previous = fingerprintComment(comment({ body: 'Original comment' }));
    const current = fingerprintComment(comment({ body: 'Edited comment' }));

    expect(compareFingerprints(previous, current)).toBe('changed');
  });

  it('does not change hash for non-material comment whitespace edits', () => {
    const previous = fingerprintComment(comment({ body: 'Original comment with spacing' }));
    const current = fingerprintComment(comment({ body: '\nOriginal\tcomment   with spacing  ' }));

    expect(compareFingerprints(previous, current)).toBe('unchanged');
  });

  it('changes hash when comment body is cleared or rewritten', () => {
    expect(
      compareFingerprints(
        fingerprintComment(comment({ body: 'Original comment' })),
        fingerprintComment(comment({ body: '' })),
      ),
    ).toBe('changed');
    expect(
      compareFingerprints(
        fingerprintComment(comment({ body: 'Original comment' })),
        fingerprintComment(comment({ body: 'Completely rewritten comment' })),
      ),
    ).toBe('changed');
  });

  it('treats missing current content as uncertain', () => {
    const previous = fingerprintComment(comment({ body: 'Original comment' }));
    const current = fingerprintTarget(comment({ body: undefined }));

    expect(compareFingerprints(previous, current)).toBe('uncertain');
  });
});
