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
