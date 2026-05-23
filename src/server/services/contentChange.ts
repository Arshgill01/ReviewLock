import type { ReopenReason, ReviewLockTarget } from '../../shared/schema';
import { compareFingerprints, fingerprintTarget, normalizeText } from './fingerprint';

export interface ContentChangeClassification {
  status: 'changed' | 'unchanged' | 'uncertain';
  changedFields: string[];
  reopenReason?: ReopenReason;
}

const firstChangedPostReason = (changedFields: string[]): ReopenReason => {
  if (changedFields.includes('flairText') || changedFields.includes('flairTemplateId')) {
    return 'flair_changed';
  }

  if (changedFields.includes('isNsfw')) {
    return 'nsfw_changed';
  }

  if (changedFields.includes('isSpoiler')) {
    return 'spoiler_changed';
  }

  return 'content_changed';
};

const changedWhen = <T>(name: string, previous: T, current: T): string[] =>
  previous === current ? [] : [name];

export const classifyContentChange = (
  previousTarget: ReviewLockTarget | undefined,
  currentTarget: ReviewLockTarget | undefined,
): ContentChangeClassification => {
  if (!previousTarget || !currentTarget || previousTarget.kind !== currentTarget.kind) {
    return {
      status: 'uncertain',
      changedFields: [],
      reopenReason: 'runtime_uncertain',
    };
  }

  const comparison = compareFingerprints(fingerprintTarget(previousTarget), fingerprintTarget(currentTarget));

  if (comparison === 'uncertain') {
    return {
      status: 'uncertain',
      changedFields: [],
      reopenReason: 'runtime_uncertain',
    };
  }

  if (comparison === 'unchanged') {
    return {
      status: 'unchanged',
      changedFields: [],
    };
  }

  if (currentTarget.kind === 'comment') {
    return {
      status: 'changed',
      changedFields: ['body'],
      reopenReason: 'content_changed',
    };
  }

  const changedFields = [
    ...changedWhen('title', normalizeText(previousTarget.title), normalizeText(currentTarget.title)),
    ...changedWhen('body', normalizeText(previousTarget.body), normalizeText(currentTarget.body)),
    ...changedWhen('url', normalizeText(previousTarget.url), normalizeText(currentTarget.url)),
    ...changedWhen('flairText', normalizeText(previousTarget.flairText), normalizeText(currentTarget.flairText)),
    ...changedWhen(
      'flairTemplateId',
      normalizeText(previousTarget.flairTemplateId),
      normalizeText(currentTarget.flairTemplateId),
    ),
    ...changedWhen('isNsfw', previousTarget.isNsfw === true, currentTarget.isNsfw === true),
    ...changedWhen('isSpoiler', previousTarget.isSpoiler === true, currentTarget.isSpoiler === true),
  ];

  return {
    status: 'changed',
    changedFields,
    reopenReason: firstChangedPostReason(changedFields),
  };
};
