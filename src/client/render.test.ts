import { describe, expect, it } from 'vitest';
import { renderAuditTimeline } from './components/AuditTimeline';
import { renderDemoBanner } from './components/DemoBanner';
import { renderLockTable } from './components/LockTable';
import { renderMetricStrip } from './components/MetricStrip';
import { renderLatestReopenEvent, renderReopenQueue } from './components/ReopenQueue';
import { renderRuntimeBanner } from './components/RuntimeBanner';
import { renderDashboardPage } from './pages/DashboardPage';
import { ReviewLockApiClient } from './state/api';
import { ReviewLockStore } from './state/store';
import type {
  AuditEvent,
  ReopenEvent,
  ReviewLockRecord,
  RuntimeProofStatus,
} from '../shared/schema';

const forbiddenCopy = [
  'not reportable',
  'disable reports',
  'blocked reports',
  'ai decides',
  'automatic removal',
  'permanent',
  'forever',
];

const expectSafeCopy = (html: string): void => {
  const normalized = html.toLowerCase();

  for (const phrase of forbiddenCopy) {
    expect(normalized).not.toContain(phrase);
  }
};

const lock = (overrides: Partial<ReviewLockRecord> = {}): ReviewLockRecord => ({
  id: 'lock-1',
  subreddit: 'reviewlock',
  targetId: 't3_reviewed',
  targetKind: 'post',
  targetAuthor: 'reviewed_author',
  permalink: '/r/reviewlock/comments/reviewed',
  title: 'Reviewed post',
  contentPreview: 'Reviewed content preview',
  contentHash: 'hash',
  fingerprintVersion: 'content-v1',
  lockedBy: 'mod',
  lockedAt: '2026-05-24T00:00:00.000Z',
  lockReason: 'reviewed_policy_compliant',
  status: 'active',
  lastKnownEdited: false,
  lastReportCount: 3,
  suppressedReportCount: 7,
  runtimeWarnings: [],
  demo: false,
  ...overrides,
});

const reopen = (overrides: Partial<ReopenEvent> = {}): ReopenEvent => ({
  id: 'reopen-1',
  lockId: 'lock-1',
  subreddit: 'reviewlock',
  targetId: 't3_reviewed',
  targetKind: 'post',
  oldContentHash: 'old',
  newContentHash: 'new',
  reason: 'content_changed',
  createdAt: '2026-05-24T01:00:00.000Z',
  summary: 'Post body changed after review.',
  runtimeWarnings: [],
  demo: false,
  ...overrides,
});

const runtime = (): RuntimeProofStatus => ({
  overall: 'unverified',
  generatedAt: '2026-05-24T00:00:00.000Z',
  capabilities: [{ name: 'ignoreReports', status: 'unverified', notes: [] }],
  warnings: ['Runtime behavior needs playtest proof.'],
});

const audit = (): AuditEvent => ({
  id: 'audit-1',
  kind: 'report_suppressed',
  subreddit: 'reviewlock',
  targetId: 't3_reviewed',
  targetKind: 'post',
  lockId: 'lock-1',
  actor: 'reviewlock',
  createdAt: '2026-05-24T01:10:00.000Z',
  message: 'Repeat report suppressed because reviewed content was unchanged.',
  data: {},
  demo: false,
});

describe('client render helpers', () => {
  it('renders required metrics and copy', () => {
    const html = renderMetricStrip({
      activeLockCount: 2,
      reportsSuppressed: 11,
      reopenedAfterEditCount: 1,
      topChurnTargets: [],
      runtimeStatus: runtime(),
    });

    expect(html).toContain('Active locks');
    expect(html).toContain('Reports suppressed');
    expect(html).toContain('Reopened after edit');
    expect(html).toContain('1. Reviewed and locked');
    expect(html).toContain('2. Reports suppressed');
    expectSafeCopy(html);
  });

  it('renders active locks and empty lock state', () => {
    const html = renderLockTable([lock()]);
    expect(html).toContain('Reviewed post');
    expect(html).toContain('Reports suppressed');
    expect(html).toContain('Unlock');
    expect(renderLockTable([])).toContain('No active locks.');
    expectSafeCopy(html);
  });

  it('renders item-level runtime warnings on active locks', () => {
    const html = renderLockTable([
      lock({ runtimeWarnings: ['unignoreReports failed for t3_reviewed'] }),
    ]);

    expect(html).toContain('Needs attention');
    expect(html).toContain('unignoreReports failed for t3_reviewed');
    expectSafeCopy(html);
  });

  it('renders in-dashboard confirmations for destructive dashboard actions', () => {
    const lockHtml = renderLockTable([lock()], {
      action: 'unlock',
      lockId: 'lock-1',
      targetId: 't3_reviewed',
    });
    const reopenHtml = renderReopenQueue([reopen()], {
      action: 'dismiss-reopen',
      eventId: 'reopen-1',
    });

    expect(lockHtml).toContain('Confirm unlock?');
    expect(lockHtml).toContain('data-action="confirm-unlock"');
    expect(reopenHtml).toContain('Confirm dismiss?');
    expect(reopenHtml).toContain('data-action="confirm-dismiss-reopen"');
    expectSafeCopy(lockHtml + reopenHtml);
  });

  it('escapes dynamic values used inside HTML attributes', () => {
    const html = [
      renderLockTable([
        lock({
          id: 'lock-1" data-leak="x',
          permalink: 'https://reddit.example/item" onclick="alert(1)',
        }),
      ]),
      renderReopenQueue([reopen({ id: 'reopen-1" data-leak="x' })]),
    ].join('');

    expect(html).toContain('&quot;');
    expect(html).not.toContain('data-lock-id="lock-1" data-leak="x');
    expect(html).not.toContain('data-event-id="reopen-1" data-leak="x');
    expect(html).not.toContain('onclick="alert');
  });

  it('escapes dynamic reason labels before rendering', () => {
    const html = [
      renderLockTable([
        lock({
          lockReason: 'custom_<img src=x onerror=alert(1)>' as ReviewLockRecord['lockReason'],
        }),
      ]),
      renderReopenQueue([
        reopen({
          reason: 'content_changed_<script>alert(1)</script>' as ReopenEvent['reason'],
        }),
      ]),
    ].join('');

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
  });

  it('renders reopened queue and latest reopen states', () => {
    expect(renderReopenQueue([reopen()])).toContain('Reopened after edit');
    expect(renderReopenQueue([])).toContain('No reopened items are waiting.');
    expect(renderLatestReopenEvent(reopen())).toContain('Latest edit-break event');
    expect(renderLatestReopenEvent(undefined)).toContain('No reopened item is waiting.');
  });

  it('renders item-level runtime warnings on reopened items', () => {
    const event = reopen({ runtimeWarnings: ['unignoreReports failed for t3_reviewed'] });
    const html = renderReopenQueue([event]) + renderLatestReopenEvent(event);

    expect(html).toContain('Needs attention');
    expect(html).toContain('unignoreReports failed for t3_reviewed');
    expectSafeCopy(html);
  });

  it('renders demo and runtime status plainly', () => {
    expect(renderDemoBanner(false)).toBe('');
    expect(renderDemoBanner(true)).toContain('Demo mode');
    expect(renderRuntimeBanner(runtime())).toContain('Runtime proof/status');
    expect(renderRuntimeBanner(runtime())).toContain('ignoreReports');
    expect(renderRuntimeBanner(runtime(), 'Runtime proof refreshed.')).toContain('Verify runtime');
    expect(renderRuntimeBanner(runtime(), 'Runtime proof refreshed.')).toContain(
      'Runtime proof refreshed.',
    );
  });

  it('escapes Redis-backed runtime proof text before rendering', () => {
    const html = renderRuntimeBanner(
      {
        overall: 'failed',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [
          {
            name: 'ignoreReports<script>alert(1)</script>',
            status: 'failed',
            notes: [],
          },
        ],
        warnings: ['<img src=x onerror=alert(1)>'],
      },
      'Runtime <script>alert(1)</script> refreshed.',
    );

    expect(html).toContain('ignoreReports&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Runtime &lt;script&gt;alert(1)&lt;/script&gt; refreshed.');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
  });

  it('renders audit timeline', () => {
    const html = renderAuditTimeline([audit()]);
    expect(html).toContain('Audit timeline');
    expect(html).toContain('Repeat report suppressed');
    expect(html).toContain('Target post t3_reviewed');
    expect(html).toContain('Lock lock-1');
    expectSafeCopy(html);
  });

  it('renders runtime failure audit details for the seeded warning example', () => {
    const html = renderAuditTimeline([
      {
        ...audit(),
        kind: 'runtime_failure',
        targetId: 't3_warning',
        lockId: 'lock-warning',
        message: 'Demo runtime warning recorded for capability transparency.',
        data: { operation: 'ignoreReports', ok: false, error: 'permission denied' },
      },
    ]);

    expect(html).toContain('t3_warning');
    expect(html).toContain('lock-warning');
    expect(html).toContain('Operation ignoreReports');
    expect(html).toContain('Error permission denied');
    expectSafeCopy(html);
  });

  it('renders dashboard for demo and reopen states', () => {
    const store = new ReviewLockStore(new ReviewLockApiClient(), 'reviewlock_demo', true);
    store.overview = {
      activeLockCount: 1,
      reportsSuppressed: 7,
      reopenedAfterEditCount: 1,
      latestReopenEvent: reopen(),
      topChurnTargets: [],
      runtimeStatus: runtime(),
    };
    store.locks = [lock()];
    store.reopenQueue = [reopen()];
    store.auditEvents = [audit()];
    store.runtimeStatus = runtime();

    const html = renderDashboardPage(store);

    expect(html).toContain('Lock reviewed content until it changes.');
    expect(html).toContain('Reports suppressed');
    expect(html).toContain('Reopened after edit');
    expect(html).toContain('Demo mode');
    expect(html).toContain('Demo read-only');
    expect(html).not.toContain('data-action="unlock"');
    expect(html).not.toContain('data-action="confirm-unlock"');
    expect(html).not.toContain('data-action="dismiss-reopen"');
    expect(html).not.toContain('data-action="confirm-dismiss-reopen"');
    expectSafeCopy(html);
  });

  it('keeps stale dashboard data honest when refresh fails', () => {
    const store = new ReviewLockStore(new ReviewLockApiClient(), 'reviewlock', false);
    store.overview = {
      activeLockCount: 1,
      reportsSuppressed: 7,
      reopenedAfterEditCount: 1,
      latestReopenEvent: reopen(),
      topChurnTargets: [],
      runtimeStatus: runtime(),
    };
    store.locks = [lock()];
    store.reopenQueue = [reopen()];
    store.auditEvents = [audit()];
    store.runtimeStatus = runtime();
    store.error = 'API error: Service unavailable';

    const html = renderDashboardPage(store);

    expect(html).toContain('Dashboard refresh failed.');
    expect(html).toContain('API error: Service unavailable');
    expect(html).toContain('Retry');
    expect(html).toContain('Active locks');
    expectSafeCopy(html);
  });

  it('renders a retryable error instead of a blank dashboard when initial load fails', () => {
    const store = new ReviewLockStore(new ReviewLockApiClient(), 'reviewlock', false);
    store.error = 'API contract error at /api/locks: missing locks array';

    const html = renderDashboardPage(store);

    expect(html).toContain('ReviewLock');
    expect(html).toContain('API contract error at /api/locks: missing locks array');
    expect(html).toContain('Retry');
    expect(html.trim()).not.toBe('');
    expectSafeCopy(html);
  });
});
