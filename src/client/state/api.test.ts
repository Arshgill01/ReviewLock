import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewLockApiClient } from './api';

const runtimeStatus = {
  overall: 'unverified',
  generatedAt: '2026-05-24T00:00:00.000Z',
  capabilities: [],
  warnings: [],
};

const overview = {
  activeLockCount: 0,
  reportsSuppressed: 0,
  reopenedAfterEditCount: 0,
  topChurnTargets: [],
  runtimeStatus,
};

const targetMetric = {
  subreddit: 'alpha',
  targetId: 't3_reviewed',
  targetKind: 'post',
  reportsSuppressed: 2,
  locksCreated: 1,
  locksReopened: 0,
  lastActivityAt: '2026-05-24T00:00:00.000Z',
  demo: false,
};

const reopenEvent = {
  id: 'reopen-1',
  lockId: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_reviewed',
  targetKind: 'post',
  oldContentHash: 'old',
  newContentHash: 'new',
  reason: 'content_changed',
  createdAt: '2026-05-24T00:00:00.000Z',
  summary: 'Reviewed content changed after the lock was created.',
  runtimeWarnings: [],
  demo: false,
};

const lockRecord = {
  id: 'lock-1',
  subreddit: 'alpha',
  targetId: 't3_reviewed',
  targetKind: 'post',
  targetAuthor: 'u_author',
  permalink: '/r/alpha/comments/reviewed',
  contentPreview: 'Reviewed content',
  contentHash: 'hash',
  fingerprintVersion: 'content-v1',
  lockedBy: 'mod',
  lockedAt: '2026-05-24T00:00:00.000Z',
  lockReason: 'reviewed_policy_compliant',
  status: 'active',
  lastKnownEdited: false,
  lastReportCount: 0,
  suppressedReportCount: 0,
  runtimeWarnings: [],
  demo: false,
};

const auditEvent = {
  id: 'audit-1',
  kind: 'lock_created',
  subreddit: 'alpha',
  targetId: 't3_reviewed',
  targetKind: 'post',
  lockId: 'lock-1',
  actor: 'mod',
  createdAt: '2026-05-24T00:00:00.000Z',
  message: 'Reviewed content locked until it changes.',
  data: {},
  demo: false,
};

const dailyMetric = {
  subreddit: 'alpha',
  date: '2026-05-24',
  locksCreated: 1,
  reportsSuppressed: 2,
  locksReopened: 0,
  demo: false,
};

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: { 'Content-Type': 'application/json' },
  });

const malformedJsonResponse = (): Response =>
  new Response('{', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const stubFetch = (...responses: Response[]) => {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('ReviewLockApiClient contract handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts empty dashboard arrays from successful endpoints', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ ok: true, demo: false, overview }),
      jsonResponse({ ok: true, demo: false, locks: [] }),
      jsonResponse({ ok: true, demo: false, events: [] }),
      jsonResponse({ ok: true, demo: false, events: [] }),
      jsonResponse({
        ok: true,
        demo: false,
        runtime: runtimeStatus,
        dailyMetrics: [],
        topChurnTargets: [],
      }),
    );
    const api = new ReviewLockApiClient();

    await expect(api.fetchOverview('alpha team', false)).resolves.toMatchObject({
      activeLockCount: 0,
      demo: false,
    });
    await expect(api.fetchLocks('alpha', false)).resolves.toEqual([]);
    await expect(api.fetchReopenQueue('alpha', false)).resolves.toEqual([]);
    await expect(api.fetchAuditLog('alpha', false)).resolves.toEqual([]);
    await expect(api.fetchRuntimeStatus('alpha', false)).resolves.toMatchObject({
      dailyMetrics: [],
      topChurnTargets: [],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/overview?subreddit=alpha%20team&demo=false',
      undefined,
    );
  });

  it('uses server error text for non-200 responses', async () => {
    stubFetch(
      jsonResponse(
        { ok: false, error: 'Redis adapter is not configured.', requestId: 'req-1' },
        { status: 503, statusText: 'Service Unavailable' },
      ),
    );

    await expect(new ReviewLockApiClient().fetchLocks('alpha', false)).rejects.toThrow(
      'API error: Redis adapter is not configured.',
    );
  });

  it('uses action response message text for non-200 dashboard action responses', async () => {
    stubFetch(
      jsonResponse(
        {
          ok: false,
          message: 'ReviewLock target is outside this subreddit context.',
          warnings: ['subreddit_scope_mismatch'],
        },
        { status: 403, statusText: 'Forbidden' },
      ),
    );

    await expect(
      new ReviewLockApiClient().unlockTarget('t3_reviewed', 'lock-1', 'mod', 'alpha'),
    ).rejects.toThrow('API error: ReviewLock target is outside this subreddit context.');
  });

  it('turns malformed JSON into a contract error instead of leaking parser text', async () => {
    stubFetch(malformedJsonResponse());

    await expect(new ReviewLockApiClient().fetchAuditLog('alpha', false)).rejects.toThrow(
      'API contract error at /api/audit?subreddit=alpha&demo=false: response was not valid JSON',
    );
  });

  it('rejects missing dashboard fields before rendering receives undefined data', async () => {
    stubFetch(
      jsonResponse({
        ok: true,
        demo: false,
        overview: {
          reportsSuppressed: 0,
          reopenedAfterEditCount: 0,
          topChurnTargets: [],
          runtimeStatus,
        },
      }),
    );

    await expect(new ReviewLockApiClient().fetchOverview('alpha', false)).rejects.toThrow(
      'overview object is missing required dashboard fields',
    );
  });

  it('rejects malformed dashboard overview nested records before rendering', async () => {
    stubFetch(
      jsonResponse({
        ok: true,
        demo: false,
        overview: { ...overview, activeLockCount: -1 },
      }),
      jsonResponse({
        ok: true,
        demo: false,
        overview: {
          ...overview,
          topChurnTargets: [{ ...targetMetric, reportsSuppressed: -1 }],
        },
      }),
      jsonResponse({
        ok: true,
        demo: false,
        overview: {
          ...overview,
          latestReopenEvent: { ...reopenEvent, createdAt: '2026-05-24' },
        },
      }),
    );
    const api = new ReviewLockApiClient();

    await expect(api.fetchOverview('alpha', false)).rejects.toThrow(
      'overview object is missing required dashboard fields',
    );
    await expect(api.fetchOverview('alpha', false)).rejects.toThrow(
      'overview object is missing required dashboard fields',
    );
    await expect(api.fetchOverview('alpha', false)).rejects.toThrow(
      'overview object is missing required dashboard fields',
    );
  });

  it('rejects malformed list records before dashboard rendering', async () => {
    stubFetch(
      jsonResponse({ ok: true, demo: false, locks: [{ ...lockRecord, lastReportCount: -1 }] }),
      jsonResponse({
        ok: true,
        demo: false,
        events: [{ ...reopenEvent, targetKind: 'message' }],
      }),
      jsonResponse({
        ok: true,
        demo: false,
        events: [{ ...auditEvent, createdAt: '2026-05-24T00:00:00Z' }],
      }),
      jsonResponse({
        ok: true,
        demo: false,
        runtime: runtimeStatus,
        dailyMetrics: [{ ...dailyMetric, date: '2026-02-31' }],
        topChurnTargets: [],
      }),
      jsonResponse({
        ok: true,
        demo: false,
        runtime: runtimeStatus,
        dailyMetrics: [],
        topChurnTargets: [{ ...targetMetric, lastActivityAt: '2026-05-24' }],
      }),
    );
    const api = new ReviewLockApiClient();

    await expect(api.fetchLocks('alpha', false)).rejects.toThrow(
      'locks array contains malformed records',
    );
    await expect(api.fetchReopenQueue('alpha', false)).rejects.toThrow(
      'events array contains malformed records',
    );
    await expect(api.fetchAuditLog('alpha', false)).rejects.toThrow(
      'events array contains malformed records',
    );
    await expect(api.fetchRuntimeStatus('alpha', false)).rejects.toThrow(
      'dailyMetrics array contains malformed records',
    );
    await expect(api.fetchRuntimeStatus('alpha', false)).rejects.toThrow(
      'topChurnTargets array contains malformed records',
    );
  });

  it('validates runtime status arrays and demo status shape', async () => {
    stubFetch(
      jsonResponse({ ok: true, demo: false, runtime: {}, dailyMetrics: [], topChurnTargets: [] }),
      jsonResponse({ ok: true, demo: false, runtime: runtimeStatus, dailyMetrics: [] }),
      jsonResponse({
        ok: true,
        demo: true,
        status: { subreddit: 'reviewlock_demo', enabled: true },
      }),
    );
    const api = new ReviewLockApiClient();

    await expect(api.fetchRuntimeStatus('alpha', false)).rejects.toThrow(
      'runtime object is missing required runtime proof fields',
    );
    await expect(api.fetchRuntimeStatus('alpha', false)).rejects.toThrow(
      'missing topChurnTargets array',
    );
    await expect(api.enableDemoMode()).rejects.toThrow(
      'status object is missing required demo fields',
    );
  });

  it('rejects malformed runtime proof status values before rendering', async () => {
    const api = new ReviewLockApiClient();
    stubFetch(
      jsonResponse({
        ok: true,
        demo: false,
        runtime: { ...runtimeStatus, overall: 'maybe' },
        dailyMetrics: [],
        topChurnTargets: [],
      }),
      jsonResponse({
        ok: true,
        demo: false,
        runtime: { ...runtimeStatus, generatedAt: '2026-02-31T00:00:00.000Z' },
        dailyMetrics: [],
        topChurnTargets: [],
      }),
      jsonResponse({
        ok: true,
        demo: false,
        runtime: {
          ...runtimeStatus,
          capabilities: [
            {
              name: 'redis',
              status: 'verified',
              notes: [],
              checkedAt: '2026-05-24T00:00:00Z',
            },
          ],
        },
        dailyMetrics: [],
        topChurnTargets: [],
      }),
    );

    await expect(api.fetchRuntimeStatus('alpha', false)).rejects.toThrow(
      'runtime object is missing required runtime proof fields',
    );
    await expect(api.fetchRuntimeStatus('alpha', false)).rejects.toThrow(
      'runtime object is missing required runtime proof fields',
    );
    await expect(api.fetchRuntimeStatus('alpha', false)).rejects.toThrow(
      'runtime object is missing required runtime proof fields',
    );
  });

  it('submits dashboard moderation actions through API endpoints', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ ok: true, message: 'ReviewLock unlocked this reviewed content.' }),
      jsonResponse({ ok: true, message: 'ReviewLock dismissed this reopened item.' }),
    );
    const api = new ReviewLockApiClient();

    await expect(api.unlockTarget('t3_reviewed', 'lock-1', 'mod', 'alpha')).resolves.toEqual({
      ok: true,
      message: 'ReviewLock unlocked this reviewed content.',
    });
    await expect(api.dismissReopen('reopen-1', 'mod', 'alpha')).resolves.toEqual({
      ok: true,
      message: 'ReviewLock dismissed this reopened item.',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/locks/unlock?subreddit=alpha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: 't3_reviewed', lockId: 'lock-1', actor: 'mod' }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/reopen-queue/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'reopen-1', actor: 'mod', subreddit: 'alpha' }),
    });
  });

  it('checks both runtime smoke endpoints and surfaces malformed smoke output', async () => {
    stubFetch(jsonResponse({ ok: true }), malformedJsonResponse());

    await expect(new ReviewLockApiClient().runRuntimeSmoke('alpha')).rejects.toThrow(
      'API contract error at /api/smoke/reddit?subreddit=alpha: response was not valid JSON',
    );
  });
});
