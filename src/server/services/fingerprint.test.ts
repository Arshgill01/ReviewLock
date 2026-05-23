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

  it('changes hash when a comment body changes', () => {
    const previous = fingerprintComment(comment({ body: 'Original comment' }));
    const current = fingerprintComment(comment({ body: 'Edited comment' }));

    expect(compareFingerprints(previous, current)).toBe('changed');
  });

  it('treats missing current content as uncertain', () => {
    const previous = fingerprintComment(comment({ body: 'Original comment' }));
    const current = fingerprintTarget(comment({ body: undefined }));

    expect(compareFingerprints(previous, current)).toBe('uncertain');
  });
});
