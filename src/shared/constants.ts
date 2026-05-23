export const APP_NAME = 'ReviewLock';
export const APP_SLUG = 'reviewlock';
export const FINGERPRINT_VERSION = 'content-v1';
export const DEFAULT_LOCK_EXPIRY_DAYS = 30;
export const MAX_ACTIVE_LOCKS = 50;
export const MAX_REOPEN_EVENTS = 50;
export const MAX_AUDIT_EVENTS = 100;
export const MAX_DAILY_METRICS = 30;
export const DEMO_SUBREDDIT = 'reviewlock_demo';

export const TARGET_KINDS = ['post', 'comment'] as const;
export const LOCK_STATUSES = ['active', 'reopened', 'unlocked', 'expired', 'failed'] as const;
export const REOPEN_REASONS = [
  'content_changed',
  'flair_changed',
  'nsfw_changed',
  'spoiler_changed',
  'manual_unlock',
  'expiry',
  'runtime_uncertain',
] as const;
export const AUDIT_EVENT_KINDS = [
  'lock_created',
  'lock_unlocked',
  'report_suppressed',
  'lock_reopened',
  'reopen_dismissed',
  'runtime_failure',
  'demo_reset',
] as const;
export const RUNTIME_CAPABILITY_STATUSES = [
  'unverified',
  'verified',
  'failed',
  'not_supported',
] as const;
export const LOCK_REASON_PRESETS = [
  'reviewed_policy_compliant',
  'approved_context_known',
  'repeat_report_churn',
  'mod_team_consensus',
  'custom',
] as const;
