import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { compareFingerprints, fingerprintTarget } from './fingerprint';

export type ReportTriggerAction =
  | 'no_lock'
  | 'suppress_unchanged'
  | 'reopen_changed'
  | 'runtime_uncertain';

export interface ReportTriggerDecision {
  action: ReportTriggerAction;
  reason: string;
}

export const decideReportTriggerAction = (
  activeLock: ReviewLockRecord | undefined,
  currentTarget: ReviewLockTarget | undefined,
): ReportTriggerDecision => {
  if (!activeLock) {
    return { action: 'no_lock', reason: 'No active lock exists for target.' };
  }

  if (!currentTarget) {
    return { action: 'runtime_uncertain', reason: 'Current target could not be loaded.' };
  }

  const current = fingerprintTarget(currentTarget);
  const previous = {
    version: activeLock.fingerprintVersion,
    targetKind: activeLock.targetKind,
    hash: activeLock.contentHash,
    input: '',
    computedAt: activeLock.lockedAt,
  };
  const comparison = compareFingerprints(previous, current);

  if (comparison === 'unchanged') {
    return { action: 'suppress_unchanged', reason: 'Current fingerprint matches locked review.' };
  }

  if (comparison === 'changed') {
    return { action: 'reopen_changed', reason: 'Current fingerprint differs from locked review.' };
  }

  return { action: 'runtime_uncertain', reason: 'Current fingerprint could not be trusted.' };
};
