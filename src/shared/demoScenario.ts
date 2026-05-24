import { DEMO_SUBREDDIT } from './constants';
import type {
  AuditEvent,
  AuditEventKind,
  DailyMetrics,
  DemoScenario,
  LockReasonPreset,
  ReopenEvent,
  ReopenReason,
  ReviewLockRecord,
  RuntimeProofStatus,
  TargetKind,
  TargetMetrics,
} from './schema';

const generatedAt = '2026-05-24T00:00:00.000Z';
const fingerprintVersion = 'content-v1';

interface DemoLockInput {
  id: number;
  kind: TargetKind;
  author: string;
  permalink: string;
  title?: string;
  preview: string;
  lockedBy: string;
  lockedAt: string;
  reason: LockReasonPreset;
  lastReportCount: number;
  suppressed: number;
  lastSuppressedAt?: string;
  customNote?: string;
  runtimeWarnings?: string[];
}

interface DemoReopenedInput extends DemoLockInput {
  reopenId: number;
  reopenedAt: string;
  reopenReason: ReopenReason;
  summary: string;
  lastKnownEdited?: boolean;
}

const targetId = (kind: TargetKind, id: number): string =>
  `${kind === 'post' ? 't3' : 't1'}_demo${String(id).padStart(3, '0')}`;

const lockId = (id: number): string => `demo-lock-${String(id).padStart(3, '0')}`;

const reopenId = (id: number): string => `demo-reopen-${String(id).padStart(3, '0')}`;

const activeLock = (input: DemoLockInput): ReviewLockRecord => ({
  id: lockId(input.id),
  subreddit: DEMO_SUBREDDIT,
  targetId: targetId(input.kind, input.id),
  targetKind: input.kind,
  targetAuthor: input.author,
  permalink: input.permalink,
  title: input.title,
  contentPreview: input.preview,
  contentHash: `hash-demo-${String(input.id).padStart(3, '0')}`,
  fingerprintVersion,
  lockedBy: input.lockedBy,
  lockedAt: input.lockedAt,
  lockReason: input.reason,
  customNote: input.customNote,
  status: 'active',
  lastKnownEdited: false,
  lastReportCount: input.lastReportCount,
  suppressedReportCount: input.suppressed,
  lastSuppressedAt: input.lastSuppressedAt,
  runtimeWarnings: input.runtimeWarnings ?? [],
  demo: true,
});

const reopenedLock = (input: DemoReopenedInput): ReviewLockRecord => ({
  ...activeLock(input),
  contentHash: `hash-demo-${String(input.id).padStart(3, '0')}-old`,
  status: 'reopened',
  lastKnownEdited: input.lastKnownEdited ?? true,
  reopenedAt: input.reopenedAt,
  reopenReason: input.reopenReason,
  reopenEventId: reopenId(input.reopenId),
});

const failedLock = (input: DemoLockInput): ReviewLockRecord => ({
  ...activeLock(input),
  status: 'failed',
  runtimeWarnings: input.runtimeWarnings ?? ['ignoreReports capability failed in seeded demo data'],
});

const reopenEvent = (input: DemoReopenedInput): ReopenEvent => ({
  id: reopenId(input.reopenId),
  lockId: lockId(input.id),
  subreddit: DEMO_SUBREDDIT,
  targetId: targetId(input.kind, input.id),
  targetKind: input.kind,
  oldContentHash: `hash-demo-${String(input.id).padStart(3, '0')}-old`,
  newContentHash: `hash-demo-${String(input.id).padStart(3, '0')}-new`,
  reason: input.reopenReason,
  createdAt: input.reopenedAt,
  summary: input.summary,
  runtimeWarnings: [],
  demo: true,
});

const audit = (
  id: number,
  kind: AuditEventKind,
  createdAt: string,
  actor: string,
  message: string,
  data: AuditEvent['data'],
  lock?: ReviewLockRecord,
): AuditEvent => ({
  id: `demo-audit-${String(id).padStart(3, '0')}`,
  kind,
  subreddit: DEMO_SUBREDDIT,
  targetId: lock?.targetId,
  targetKind: lock?.targetKind,
  lockId: lock?.id,
  actor,
  createdAt,
  message,
  data,
  demo: true,
});

const activeInputs: DemoLockInput[] = [
  {
    id: 1,
    kind: 'post',
    author: 'u_launch_author',
    permalink: '/r/reviewlock_demo/comments/demo001/policy_context_thread/',
    title: 'Policy context thread',
    preview: 'Policy context reviewed by the team while repeat reports kept arriving.',
    lockedBy: 'mod_alpha',
    lockedAt: '2026-05-20T09:00:00.000Z',
    reason: 'reviewed_policy_compliant',
    lastReportCount: 14,
    suppressed: 8,
    lastSuppressedAt: '2026-05-20T21:30:00.000Z',
  },
  {
    id: 2,
    kind: 'comment',
    author: 'u_context_helper',
    permalink: '/r/reviewlock_demo/comments/demo001/-/demo002/',
    preview: 'Sourced clarification that stayed unchanged through repeated stale reports.',
    lockedBy: 'mod_beta',
    lockedAt: '2026-05-20T10:30:00.000Z',
    reason: 'approved_context_known',
    lastReportCount: 5,
    suppressed: 3,
    lastSuppressedAt: '2026-05-20T20:15:00.000Z',
  },
  {
    id: 3,
    kind: 'post',
    author: 'u_event_host',
    permalink: '/r/reviewlock_demo/comments/demo003/event_logistics/',
    title: 'Event logistics',
    preview: 'Recurring announcement reviewed once, then protected from duplicate churn.',
    lockedBy: 'mod_alpha',
    lockedAt: '2026-05-20T11:00:00.000Z',
    reason: 'repeat_report_churn',
    lastReportCount: 9,
    suppressed: 5,
    lastSuppressedAt: '2026-05-21T01:20:00.000Z',
  },
  {
    id: 4,
    kind: 'comment',
    author: 'u_regular',
    permalink: '/r/reviewlock_demo/comments/demo003/-/demo004/',
    preview: 'Reviewed comment repeatedly reported after the mod team reached consensus.',
    lockedBy: 'mod_gamma',
    lockedAt: '2026-05-20T11:45:00.000Z',
    reason: 'mod_team_consensus',
    lastReportCount: 6,
    suppressed: 4,
    lastSuppressedAt: '2026-05-21T02:45:00.000Z',
  },
  {
    id: 5,
    kind: 'post',
    author: 'u_reviewer',
    permalink: '/r/reviewlock_demo/comments/demo005/resource_index/',
    title: 'Resource index',
    preview: 'Resource list reviewed after context was confirmed.',
    lockedBy: 'mod_beta',
    lockedAt: '2026-05-20T12:05:00.000Z',
    reason: 'approved_context_known',
    lastReportCount: 2,
    suppressed: 1,
    lastSuppressedAt: '2026-05-20T18:10:00.000Z',
  },
  {
    id: 6,
    kind: 'comment',
    author: 'u_cited_reply',
    permalink: '/r/reviewlock_demo/comments/demo005/-/demo006/',
    preview: 'Reviewed citation reply that drew duplicate disagreement reports.',
    lockedBy: 'mod_alpha',
    lockedAt: '2026-05-20T13:15:00.000Z',
    reason: 'reviewed_policy_compliant',
    lastReportCount: 3,
    suppressed: 2,
    lastSuppressedAt: '2026-05-20T19:40:00.000Z',
  },
  {
    id: 11,
    kind: 'comment',
    author: 'u_report_target',
    permalink: '/r/reviewlock_demo/comments/demo010/-/demo011/',
    preview: 'Low-volume reviewed comment kept in the ledger for team memory.',
    lockedBy: 'mod_alpha',
    lockedAt: '2026-05-21T08:40:00.000Z',
    reason: 'reviewed_policy_compliant',
    lastReportCount: 0,
    suppressed: 0,
  },
  {
    id: 12,
    kind: 'post',
    author: 'u_question_author',
    permalink: '/r/reviewlock_demo/comments/demo012/question_megathread/',
    title: 'Question megathread',
    preview: 'Recurring megathread reviewed once instead of re-reviewed after every report.',
    lockedBy: 'mod_beta',
    lockedAt: '2026-05-21T09:10:00.000Z',
    reason: 'repeat_report_churn',
    lastReportCount: 5,
    suppressed: 3,
    lastSuppressedAt: '2026-05-21T16:50:00.000Z',
  },
  {
    id: 13,
    kind: 'post',
    author: 'u_rules_explainer',
    permalink: '/r/reviewlock_demo/comments/demo013/rules_explainer/',
    title: 'Rules explainer',
    preview: 'High-churn rules explainer reviewed and locked after coordinated reports.',
    lockedBy: 'mod_delta',
    lockedAt: '2026-05-21T10:25:00.000Z',
    reason: 'repeat_report_churn',
    lastReportCount: 11,
    suppressed: 6,
    lastSuppressedAt: '2026-05-22T00:30:00.000Z',
  },
  {
    id: 14,
    kind: 'comment',
    author: 'u_exception_context',
    permalink: '/r/reviewlock_demo/comments/demo013/-/demo014/',
    preview: 'Context comment explaining a moderator-approved exception.',
    lockedBy: 'mod_beta',
    lockedAt: '2026-05-21T11:05:00.000Z',
    reason: 'approved_context_known',
    lastReportCount: 4,
    suppressed: 2,
    lastSuppressedAt: '2026-05-21T17:55:00.000Z',
  },
  {
    id: 15,
    kind: 'post',
    author: 'u_title_editor',
    permalink: '/r/reviewlock_demo/comments/demo015/spoiler_safe_title/',
    title: 'Spoiler-safe title',
    preview: 'Title and body were reviewed; one later stale report was suppressed.',
    lockedBy: 'mod_gamma',
    lockedAt: '2026-05-21T12:30:00.000Z',
    reason: 'reviewed_policy_compliant',
    lastReportCount: 2,
    suppressed: 1,
    lastSuppressedAt: '2026-05-21T15:15:00.000Z',
  },
  {
    id: 16,
    kind: 'comment',
    author: 'u_wiki_helper',
    permalink: '/r/reviewlock_demo/comments/demo015/-/demo016/',
    preview: 'Community wiki clarification reviewed with no repeat reports yet.',
    lockedBy: 'mod_alpha',
    lockedAt: '2026-05-21T13:00:00.000Z',
    reason: 'mod_team_consensus',
    lastReportCount: 0,
    suppressed: 0,
  },
];

const reopenedInputs: DemoReopenedInput[] = [
  {
    id: 7,
    reopenId: 1,
    kind: 'post',
    author: 'u_changed_post',
    permalink: '/r/reviewlock_demo/comments/demo007/edited_after_review/',
    title: 'Edited after review',
    preview: 'Original body was reviewed, then the author rewrote material details.',
    lockedBy: 'mod_delta',
    lockedAt: '2026-05-20T14:00:00.000Z',
    reason: 'reviewed_policy_compliant',
    lastReportCount: 8,
    suppressed: 3,
    lastSuppressedAt: '2026-05-20T16:00:00.000Z',
    reopenedAt: '2026-05-20T17:20:00.000Z',
    reopenReason: 'content_changed',
    summary: 'Post body changed after moderator review, so ReviewLock reopened it.',
  },
  {
    id: 8,
    reopenId: 2,
    kind: 'comment',
    author: 'u_comment_editor',
    permalink: '/r/reviewlock_demo/comments/demo007/-/demo008/',
    preview: 'Comment changed after lock and returned to moderator attention.',
    lockedBy: 'mod_beta',
    lockedAt: '2026-05-20T14:30:00.000Z',
    reason: 'mod_team_consensus',
    lastReportCount: 5,
    suppressed: 2,
    lastSuppressedAt: '2026-05-20T14:50:00.000Z',
    reopenedAt: '2026-05-20T18:00:00.000Z',
    reopenReason: 'content_changed',
    summary: 'Comment body changed after moderator review.',
  },
  {
    id: 9,
    reopenId: 3,
    kind: 'post',
    author: 'u_flair_editor',
    permalink: '/r/reviewlock_demo/comments/demo009/flair_changed_after_review/',
    title: 'Flair changed after review',
    preview: 'Post flair changed after approval, so the lock reopened.',
    lockedBy: 'mod_gamma',
    lockedAt: '2026-05-20T15:00:00.000Z',
    reason: 'approved_context_known',
    lastReportCount: 7,
    suppressed: 4,
    lastSuppressedAt: '2026-05-20T15:45:00.000Z',
    reopenedAt: '2026-05-20T18:10:00.000Z',
    reopenReason: 'flair_changed',
    summary: 'Post flair changed from context to announcement after review.',
    lastKnownEdited: false,
  },
  {
    id: 17,
    reopenId: 4,
    kind: 'post',
    author: 'u_flag_changed',
    permalink: '/r/reviewlock_demo/comments/demo017/nsfw_toggle_after_review/',
    title: 'NSFW toggle after review',
    preview: 'Safety flag changed after the item had already been reviewed.',
    lockedBy: 'mod_delta',
    lockedAt: '2026-05-21T14:00:00.000Z',
    reason: 'reviewed_policy_compliant',
    lastReportCount: 4,
    suppressed: 2,
    lastSuppressedAt: '2026-05-21T15:20:00.000Z',
    reopenedAt: '2026-05-21T18:40:00.000Z',
    reopenReason: 'nsfw_changed',
    summary: 'NSFW status changed after review, so the lock broke.',
    lastKnownEdited: false,
  },
  {
    id: 18,
    reopenId: 5,
    kind: 'post',
    author: 'u_spoiler_toggle',
    permalink: '/r/reviewlock_demo/comments/demo018/spoiler_toggle_after_review/',
    title: 'Spoiler toggle after review',
    preview: 'Spoiler state changed after the reviewed snapshot.',
    lockedBy: 'mod_alpha',
    lockedAt: '2026-05-21T14:45:00.000Z',
    reason: 'approved_context_known',
    lastReportCount: 3,
    suppressed: 1,
    lastSuppressedAt: '2026-05-21T16:10:00.000Z',
    reopenedAt: '2026-05-21T19:15:00.000Z',
    reopenReason: 'spoiler_changed',
    summary: 'Spoiler state changed after review and returned the post to the queue.',
    lastKnownEdited: false,
  },
];

const warningInput: DemoLockInput = {
  id: 10,
  kind: 'post',
  author: 'u_warning_case',
  permalink: '/r/reviewlock_demo/comments/demo010/runtime_warning_example/',
  title: 'Runtime warning example',
  preview: 'A lock attempt with a simulated runtime warning for honest dashboard status.',
  lockedBy: 'mod_delta',
  lockedAt: '2026-05-20T15:30:00.000Z',
  reason: 'custom',
  customNote: 'Demo warning case.',
  lastReportCount: 1,
  suppressed: 0,
  runtimeWarnings: ['ignoreReports capability failed in seeded runtime example'],
};

export const demoLocks: ReviewLockRecord[] = [
  ...activeInputs.map(activeLock),
  ...reopenedInputs.map(reopenedLock),
  failedLock(warningInput),
].sort((left, right) => left.lockedAt.localeCompare(right.lockedAt));

export const demoReopenEvents: ReopenEvent[] = reopenedInputs.map(reopenEvent);

const lockById = new Map(demoLocks.map((lock) => [lock.id, lock]));

const requiredLock = (id: number): ReviewLockRecord => {
  const lock = lockById.get(lockId(id));

  if (!lock) {
    throw new Error(`Missing demo lock ${id}`);
  }

  return lock;
};

export const demoAuditEvents: AuditEvent[] = [
  audit(
    1,
    'lock_created',
    '2026-05-20T09:00:00.000Z',
    'mod_alpha',
    'Reviewed policy context locked until content changes.',
    { beat: 'lock', queueBefore: 14 },
    requiredLock(1),
  ),
  audit(
    2,
    'report_suppressed',
    '2026-05-20T21:30:00.000Z',
    'reviewlock',
    'Eight repeat reports were suppressed after the fingerprint matched.',
    { beat: 'reports_suppressed', count: 8 },
    requiredLock(1),
  ),
  audit(
    3,
    'report_suppressed',
    '2026-05-21T01:20:00.000Z',
    'reviewlock',
    'Recurring announcement stayed locked while duplicate reports arrived.',
    { beat: 'reports_suppressed', count: 5 },
    requiredLock(3),
  ),
  audit(
    4,
    'lock_reopened',
    '2026-05-20T17:20:00.000Z',
    'reviewlock',
    'Post edit changed the fingerprint and reopened the lock.',
    { beat: 'edit', reason: 'content_changed' },
    requiredLock(7),
  ),
  audit(
    5,
    'lock_reopened',
    '2026-05-20T18:00:00.000Z',
    'reviewlock',
    'Comment edit changed the fingerprint and reopened the lock.',
    { beat: 'reopen', reason: 'content_changed' },
    requiredLock(8),
  ),
  audit(
    6,
    'lock_reopened',
    '2026-05-20T18:10:00.000Z',
    'reviewlock',
    'Post flair changed after review and returned to moderator attention.',
    { beat: 'reopen', reason: 'flair_changed' },
    requiredLock(9),
  ),
  audit(
    7,
    'runtime_failure',
    '2026-05-20T15:31:00.000Z',
    'reviewlock',
    'Demo runtime warning recorded for capability transparency.',
    { operation: 'ignoreReports', ok: false },
    requiredLock(10),
  ),
  audit(
    8,
    'lock_created',
    '2026-05-21T10:25:00.000Z',
    'mod_delta',
    'High-churn rules explainer locked after moderator review.',
    { beat: 'lock', queueBefore: 11 },
    requiredLock(13),
  ),
  audit(
    9,
    'report_suppressed',
    '2026-05-22T00:30:00.000Z',
    'reviewlock',
    'Six duplicate reports were suppressed on unchanged reviewed content.',
    { beat: 'reports_suppressed', count: 6 },
    requiredLock(13),
  ),
  audit(
    10,
    'lock_reopened',
    '2026-05-21T18:40:00.000Z',
    'reviewlock',
    'NSFW status changed after review and broke the lock.',
    { beat: 'reopen', reason: 'nsfw_changed' },
    requiredLock(17),
  ),
  audit(
    11,
    'lock_reopened',
    '2026-05-21T19:15:00.000Z',
    'reviewlock',
    'Spoiler state changed after review and broke the lock.',
    { beat: 'reopen', reason: 'spoiler_changed' },
    requiredLock(18),
  ),
  audit(
    12,
    'report_suppressed',
    '2026-05-21T16:50:00.000Z',
    'reviewlock',
    'Question megathread reports were counted without re-opening unchanged content.',
    { beat: 'reports_suppressed', count: 3 },
    requiredLock(12),
  ),
];

export const demoDailyMetrics: DailyMetrics[] = [
  {
    subreddit: DEMO_SUBREDDIT,
    date: '2026-05-20',
    locksCreated: 10,
    reportsSuppressed: 23,
    locksReopened: 3,
    demo: true,
  },
  {
    subreddit: DEMO_SUBREDDIT,
    date: '2026-05-21',
    locksCreated: 8,
    reportsSuppressed: 18,
    locksReopened: 2,
    demo: true,
  },
  {
    subreddit: DEMO_SUBREDDIT,
    date: '2026-05-22',
    locksCreated: 0,
    reportsSuppressed: 6,
    locksReopened: 0,
    demo: true,
  },
];

export const demoTargetMetrics: TargetMetrics[] = demoLocks.map((lock) => ({
  subreddit: lock.subreddit,
  targetId: lock.targetId,
  targetKind: lock.targetKind,
  reportsSuppressed: lock.suppressedReportCount,
  locksCreated: 1,
  locksReopened: lock.status === 'reopened' ? 1 : 0,
  lastActivityAt: lock.reopenedAt ?? lock.lastSuppressedAt ?? lock.lockedAt,
  demo: true,
}));

export const demoRuntimeStatus: RuntimeProofStatus = {
  overall: 'unverified',
  generatedAt,
  capabilities: [
    {
      name: 'approve',
      status: 'unverified',
      notes: ['Seeded demo data is illustrative and does not prove live moderation calls.'],
    },
    {
      name: 'ignoreReports',
      status: 'unverified',
      notes: ['Suppressed counts are deterministic demo metrics, not live report delivery proof.'],
    },
    {
      name: 'unignoreReports',
      status: 'unverified',
      notes: [
        'Reopen rows show the expected flow; live trigger-driven unignore remains separate proof.',
      ],
    },
    {
      name: 'triggers',
      status: 'unverified',
      notes: [
        'Demo events model report and edit triggers without claiming Devvit trigger delivery.',
      ],
    },
  ],
  warnings: ['Demo data only. Seeded records are not runtime proof.'],
};

export const DEMO_SCENARIO: DemoScenario = {
  subreddit: DEMO_SUBREDDIT,
  generatedAt,
  label: 'Demo data: lock, repeat reports, edit, reopen',
  locks: demoLocks,
  reopenEvents: demoReopenEvents,
  auditEvents: demoAuditEvents,
  dailyMetrics: demoDailyMetrics,
  targetMetrics: demoTargetMetrics,
  runtimeStatus: demoRuntimeStatus,
};
