import {
  AUDIT_EVENT_KINDS,
  LOCK_STATUSES,
  REOPEN_REASONS,
  TARGET_KINDS,
} from './constants';
import type { LOCK_REASON_PRESETS, RUNTIME_CAPABILITY_STATUSES } from './constants';

export type TargetKind = (typeof TARGET_KINDS)[number];
export type LockStatus = (typeof LOCK_STATUSES)[number];
export type ReopenReason = (typeof REOPEN_REASONS)[number];
export type AuditEventKind = (typeof AUDIT_EVENT_KINDS)[number];
export type RuntimeCapabilityStatus = (typeof RUNTIME_CAPABILITY_STATUSES)[number];
export type LockReasonPreset = (typeof LOCK_REASON_PRESETS)[number];

export interface ReviewLockConfig {
  subreddit: string;
  lockExpiryDays: number;
  demoModeEnabled: boolean;
  reasonPresets: LockReasonPreset[];
  updatedAt: string;
}

export interface ReviewLockTarget {
  id: string;
  kind: TargetKind;
  subreddit: string;
  authorName: string;
  permalink: string;
  title?: string;
  body?: string;
  url?: string;
  flairText?: string;
  flairTemplateId?: string;
  isNsfw?: boolean;
  isSpoiler?: boolean;
  edited: boolean;
  reportCount: number;
}

export interface ContentFingerprint {
  version: string;
  targetKind: TargetKind;
  hash: string;
  input: string;
  computedAt: string;
}

export interface ReviewLockRecord {
  id: string;
  subreddit: string;
  targetId: string;
  targetKind: TargetKind;
  targetAuthor: string;
  permalink: string;
  title?: string;
  contentPreview: string;
  contentHash: string;
  fingerprintVersion: string;
  lockedBy: string;
  lockedAt: string;
  lockReason: LockReasonPreset;
  customNote?: string;
  expiresAt?: string;
  status: LockStatus;
  lastKnownEdited: boolean;
  lastReportCount: number;
  suppressedReportCount: number;
  lastSuppressedAt?: string;
  reopenedAt?: string;
  reopenReason?: ReopenReason;
  reopenEventId?: string;
  runtimeWarnings: string[];
  demo: boolean;
}

export interface ReopenEvent {
  id: string;
  lockId: string;
  subreddit: string;
  targetId: string;
  targetKind: TargetKind;
  oldContentHash: string;
  newContentHash: string;
  reason: ReopenReason;
  createdAt: string;
  dismissedAt?: string;
  dismissedBy?: string;
  summary: string;
  runtimeWarnings: string[];
  demo: boolean;
}

export interface AuditEvent {
  id: string;
  kind: AuditEventKind;
  subreddit: string;
  targetId?: string;
  targetKind?: TargetKind;
  lockId?: string;
  actor: string;
  createdAt: string;
  message: string;
  data: Record<string, string | number | boolean | null | undefined>;
  demo: boolean;
}

export interface DailyMetrics {
  subreddit: string;
  date: string;
  locksCreated: number;
  reportsSuppressed: number;
  locksReopened: number;
  demo: boolean;
}

export interface TargetMetrics {
  subreddit: string;
  targetId: string;
  targetKind: TargetKind;
  reportsSuppressed: number;
  locksCreated: number;
  locksReopened: number;
  lastActivityAt: string;
  demo: boolean;
}

export interface DashboardOverview {
  activeLockCount: number;
  reportsSuppressed: number;
  reopenedAfterEditCount: number;
  latestReopenEvent?: ReopenEvent;
  topChurnTargets: TargetMetrics[];
  runtimeStatus: RuntimeProofStatus;
}

export interface DashboardResponse {
  ok: true;
  demo: boolean;
  generatedAt: string;
  overview: DashboardOverview;
  activeLocks: ReviewLockRecord[];
  reopenQueue: ReopenEvent[];
  auditEvents: AuditEvent[];
  dailyMetrics: DailyMetrics[];
}

export interface ActiveLocksResponse {
  ok: true;
  demo: boolean;
  generatedAt: string;
  locks: ReviewLockRecord[];
}

export interface ReopenQueueResponse {
  ok: true;
  demo: boolean;
  generatedAt: string;
  events: ReopenEvent[];
}

export interface AuditLogResponse {
  ok: true;
  demo: boolean;
  generatedAt: string;
  events: AuditEvent[];
}

export interface RuntimeProofCapability {
  name: string;
  status: RuntimeCapabilityStatus;
  checkedAt?: string;
  evidence?: string;
  notes: string[];
}

export interface RuntimeProofStatus {
  overall: RuntimeCapabilityStatus;
  generatedAt: string;
  capabilities: RuntimeProofCapability[];
  warnings: string[];
}

export interface DemoScenario {
  subreddit: string;
  generatedAt: string;
  label: string;
  locks: ReviewLockRecord[];
  reopenEvents: ReopenEvent[];
  auditEvents: AuditEvent[];
  dailyMetrics: DailyMetrics[];
  targetMetrics: TargetMetrics[];
  runtimeStatus: RuntimeProofStatus;
}

const includesValue = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === 'string' && values.includes(value);

export const isTargetKind = (value: unknown): value is TargetKind =>
  includesValue(TARGET_KINDS, value);

export const isLockStatus = (value: unknown): value is LockStatus =>
  includesValue(LOCK_STATUSES, value);

export const isReopenReason = (value: unknown): value is ReopenReason =>
  includesValue(REOPEN_REASONS, value);

export const isAuditEventKind = (value: unknown): value is AuditEventKind =>
  includesValue(AUDIT_EVENT_KINDS, value);
