import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReviewLockStore } from './store';
import { ReviewLockApiClient } from './api';
import type { DashboardOverview, RuntimeProofStatus } from '../../shared/schema';

describe('ReviewLockStore', () => {
  let store: ReviewLockStore;
  let apiClient: ReviewLockApiClient;

  const mockOverview = (): DashboardOverview => ({
    activeLockCount: 2,
    reportsSuppressed: 10,
    reopenedAfterEditCount: 1,
    topChurnTargets: [],
    runtimeStatus: {
      overall: 'verified',
      generatedAt: '2026-05-24T00:00:00.000Z',
      capabilities: [],
      warnings: [],
    },
  });

  const mockRuntimeStatus = (): RuntimeProofStatus => ({
    overall: 'verified',
    generatedAt: '2026-05-24T00:00:00.000Z',
    capabilities: [],
    warnings: [],
  });

  beforeEach(() => {
    apiClient = new ReviewLockApiClient();
    store = new ReviewLockStore(apiClient, 'test_subreddit', false);

    // Mock API Client methods
    apiClient.fetchOverview = vi.fn().mockResolvedValue({
      ...mockOverview(),
      demo: false,
    });
    apiClient.fetchLocks = vi
      .fn()
      .mockResolvedValue([
        { id: 'lock-1', targetId: 't3_1', status: 'active', suppressedReportCount: 5, demo: false },
      ]);
    apiClient.fetchReopenQueue = vi
      .fn()
      .mockResolvedValue([
        { id: 'reopen-1', lockId: 'lock-2', reason: 'content_changed', demo: false },
      ]);
    apiClient.fetchAuditLog = vi
      .fn()
      .mockResolvedValue([
        { id: 'audit-1', kind: 'lock_created', actor: 'mod', message: 'Locked', demo: false },
      ]);
    apiClient.fetchRuntimeStatus = vi.fn().mockResolvedValue({
      runtime: mockRuntimeStatus(),
      dailyMetrics: [],
      topChurnTargets: [],
    });
    apiClient.runRuntimeSmoke = vi.fn().mockResolvedValue(undefined);
    apiClient.enableDemoMode = vi.fn().mockResolvedValue({
      subreddit: 'reviewlock_demo',
      enabled: true,
      demo: true,
      lockCount: 8,
      reopenEventCount: 3,
    });
    apiClient.disableDemoMode = vi.fn().mockResolvedValue({
      subreddit: 'reviewlock_demo',
      enabled: false,
      demo: true,
      lockCount: 0,
      reopenEventCount: 0,
    });

    apiClient.unlockTarget = vi.fn().mockResolvedValue({ ok: true });
    apiClient.dismissReopen = vi.fn().mockResolvedValue({ ok: true });
  });

  it('initializes with default options', () => {
    expect(store.subreddit).toBe('test_subreddit');
    expect(store.demo).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.confirmation).toBeNull();
  });

  it('tracks dashboard confirmation state explicitly', () => {
    const callback = vi.fn();
    store.subscribe(callback);

    store.requestConfirmation({ action: 'unlock', lockId: 'lock-1', targetId: 't3_1' });
    expect(store.confirmation).toEqual({
      action: 'unlock',
      lockId: 'lock-1',
      targetId: 't3_1',
    });

    store.clearConfirmation();
    expect(store.confirmation).toBeNull();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('fetches full state and notifies subscribers', async () => {
    const callback = vi.fn();
    store.subscribe(callback);

    await store.fetchState();

    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.locks.length).toBe(1);
    expect(store.reopenQueue.length).toBe(1);
    expect(store.auditEvents.length).toBe(1);
    expect(store.overview?.activeLockCount).toBe(2);
    expect(callback).toHaveBeenCalled();
  });

  it('handles API errors during fetch gracefully', async () => {
    apiClient.fetchOverview = vi.fn().mockRejectedValue(new Error('API failed'));

    await store.fetchState();

    expect(store.isLoading).toBe(false);
    expect(store.error).toBe('API failed');
    expect(store.overview).toBeNull();
  });

  it('keeps loading state visible while a slow API response is pending', async () => {
    let resolveOverview: (value: DashboardOverview & { demo: boolean }) => void = () => undefined;
    apiClient.fetchOverview = vi.fn(
      () =>
        new Promise<DashboardOverview & { demo: boolean }>((resolve) => {
          resolveOverview = resolve;
        }),
    );

    const pendingFetch = store.fetchState();

    expect(store.isLoading).toBe(true);
    expect(store.error).toBeNull();

    resolveOverview({ ...mockOverview(), demo: false });
    await pendingFetch;

    expect(store.isLoading).toBe(false);
    expect(store.overview?.activeLockCount).toBe(2);
  });

  it('performs unlock and re-fetches state', async () => {
    await store.fetchState();
    expect(store.locks.length).toBe(1);

    await store.unlock('lock-1', 't3_1');

    expect(apiClient.unlockTarget).toHaveBeenCalledWith('t3_1', 'lock-1', 'moderator');
    expect(apiClient.fetchOverview).toHaveBeenCalledTimes(2); // Initial + after unlock
    expect(store.confirmation).toBeNull();
  });

  it('dismisses reopen event and re-fetches state', async () => {
    await store.fetchState();
    expect(store.reopenQueue.length).toBe(1);

    await store.dismissReopen('reopen-1');

    expect(apiClient.dismissReopen).toHaveBeenCalledWith('reopen-1', 'moderator', 'test_subreddit');
    expect(apiClient.fetchOverview).toHaveBeenCalledTimes(2);
    expect(store.confirmation).toBeNull();
  });

  it('runs runtime verification in live mode and refreshes proof status', async () => {
    await store.verifyRuntime();

    expect(apiClient.runRuntimeSmoke).toHaveBeenCalledWith('test_subreddit');
    expect(apiClient.fetchRuntimeStatus).toHaveBeenCalledWith('test_subreddit', false);
    expect(store.runtimeVerificationMessage).toBe('Runtime proof refreshed.');
    expect(store.isVerifyingRuntime).toBe(false);
  });

  it('does not run runtime verification in demo mode', async () => {
    await store.setDemo(true);
    vi.mocked(apiClient.runRuntimeSmoke).mockClear();

    await store.verifyRuntime();

    expect(apiClient.runRuntimeSmoke).not.toHaveBeenCalled();
    expect(store.error).toBe('Runtime verification runs in live mode only.');
  });

  it('seeds demo data and switches to the deterministic demo namespace', async () => {
    await store.setDemo(true);

    expect(apiClient.enableDemoMode).toHaveBeenCalled();
    expect(store.demo).toBe(true);
    expect(store.subreddit).toBe('reviewlock_demo');
    expect(apiClient.fetchOverview).toHaveBeenLastCalledWith('reviewlock_demo', true);
  });

  it('returns to the live subreddit when demo mode is disabled', async () => {
    store.updateSubredditContext('reviewlock_dev');
    await store.setDemo(true);
    await store.setDemo(false);

    expect(apiClient.disableDemoMode).toHaveBeenCalledWith('reviewlock_demo');
    expect(store.demo).toBe(false);
    expect(store.subreddit).toBe('reviewlock_dev');
    expect(apiClient.fetchOverview).toHaveBeenLastCalledWith('reviewlock_dev', false);
  });
});
