import { describe, expect, it } from 'vitest';
import type { ReviewLockRecord, ReviewLockTarget } from '../../shared/schema';
import { fingerprintTarget } from './fingerprint';
import { decideReportTriggerAction } from './triggerDecisions';

const target = (body = 'Reviewed body'): ReviewLockTarget => ({
  id: 't3_post',
  kind: 'post',
  subreddit: 'alpha',
  authorName: 'u_author',
  permalink: '/r/alpha/comments/post',
  title: 'Reviewed post',
  body,
  edited: false,
  reportCount: 4,
});

const lock = (): ReviewLockRecord => {
  const fingerprint = fingerprintTarget(target(), '2026-05-24T00:00:00.000Z');

  return {
    id: 'lock-1',
    subreddit: 'alpha',
    targetId: 't3_post',
    targetKind: 'post',
    targetAuthor: 'u_author',
    permalink: '/r/alpha/comments/post',
    title: 'Reviewed post',
    contentPreview: 'Reviewed body',
    contentHash: fingerprint?.hash ?? '',
    fingerprintVersion: fingerprint?.version ?? 'content-v1',
    lockedBy: 'mod',
    lockedAt: '2026-05-24T00:00:00.000Z',
    lockReason: 'reviewed_policy_compliant',
    status: 'active',
    lastKnownEdited: false,
    lastReportCount: 4,
    suppressedReportCount: 0,
    runtimeWarnings: [],
    demo: false,
  };
};

describe('report trigger decisions', () => {
  it('does nothing with no lock', () => {
    expect(decideReportTriggerAction(undefined, target()).action).toBe('no_lock');
  });

  it('suppresses unchanged content only on fingerprint match', () => {
    expect(decideReportTriggerAction(lock(), target()).action).toBe('suppress_unchanged');
    expect(decideReportTriggerAction(lock(), target('Edited body')).action).toBe('reopen_changed');
  });

  it('fails open when current target is missing', () => {
    expect(decideReportTriggerAction(lock(), undefined).action).toBe('runtime_uncertain');
  });
});
