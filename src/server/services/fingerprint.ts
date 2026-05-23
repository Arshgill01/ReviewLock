import { createHash } from 'node:crypto';
import { FINGERPRINT_VERSION } from '../../shared/constants';
import type { ContentFingerprint, ReviewLockTarget } from '../../shared/schema';

export type FingerprintComparison = 'changed' | 'unchanged' | 'uncertain';

export const normalizeText = (input: string | undefined): string => {
  if (input === undefined) {
    return '';
  }

  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .trim();
};

const normalizeBoolean = (value: boolean | undefined): string => (value === true ? 'true' : 'false');

export const buildPostFingerprintInput = (target: ReviewLockTarget): string => {
  const fields = [
    ['kind', 'post'],
    ['title', normalizeText(target.title)],
    ['body', normalizeText(target.body)],
    ['url', normalizeText(target.url)],
    ['flairText', normalizeText(target.flairText)],
    ['flairTemplateId', normalizeText(target.flairTemplateId)],
    ['nsfw', normalizeBoolean(target.isNsfw)],
    ['spoiler', normalizeBoolean(target.isSpoiler)],
  ];

  return JSON.stringify(fields);
};

export const buildCommentFingerprintInput = (target: ReviewLockTarget): string =>
  JSON.stringify([
    ['kind', 'comment'],
    ['body', normalizeText(target.body)],
  ]);

export const hashFingerprintInput = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

const hasRequiredContent = (target: ReviewLockTarget): boolean => {
  if (target.kind === 'post') {
    return target.title !== undefined || target.body !== undefined || target.url !== undefined;
  }

  if (target.kind === 'comment') {
    return target.body !== undefined;
  }

  return false;
};

const fingerprintFromInput = (
  target: ReviewLockTarget,
  input: string,
  computedAt = new Date().toISOString(),
): ContentFingerprint => ({
  version: FINGERPRINT_VERSION,
  targetKind: target.kind,
  hash: hashFingerprintInput(input),
  input,
  computedAt,
});

export const fingerprintPost = (
  target: ReviewLockTarget,
  computedAt?: string,
): ContentFingerprint | undefined => {
  if (target.kind !== 'post' || !hasRequiredContent(target)) {
    return undefined;
  }

  return fingerprintFromInput(target, buildPostFingerprintInput(target), computedAt);
};

export const fingerprintComment = (
  target: ReviewLockTarget,
  computedAt?: string,
): ContentFingerprint | undefined => {
  if (target.kind !== 'comment' || !hasRequiredContent(target)) {
    return undefined;
  }

  return fingerprintFromInput(target, buildCommentFingerprintInput(target), computedAt);
};

export const fingerprintTarget = (
  target: ReviewLockTarget | undefined,
  computedAt?: string,
): ContentFingerprint | undefined => {
  if (!target) {
    return undefined;
  }

  if (target.kind === 'post') {
    return fingerprintPost(target, computedAt);
  }

  if (target.kind === 'comment') {
    return fingerprintComment(target, computedAt);
  }

  return undefined;
};

export const compareFingerprints = (
  previous: ContentFingerprint | undefined,
  current: ContentFingerprint | undefined,
): FingerprintComparison => {
  if (!previous || !current) {
    return 'uncertain';
  }

  if (previous.version !== current.version || previous.targetKind !== current.targetKind) {
    return 'uncertain';
  }

  return previous.hash === current.hash ? 'unchanged' : 'changed';
};
