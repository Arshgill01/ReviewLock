import type {
  DashboardOverview,
  ReviewLockRecord,
  ReopenEvent,
  AuditEvent,
  DailyMetrics,
  TargetMetrics,
  RuntimeProofStatus,
} from '../../shared/schema';

export interface DashboardFullData {
  overview: DashboardOverview;
  locks: ReviewLockRecord[];
  reopenQueue: ReopenEvent[];
  auditEvents: AuditEvent[];
  runtime: RuntimeProofStatus;
  dailyMetrics: DailyMetrics[];
  topChurnTargets: TargetMetrics[];
}

export class ReviewLockApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private getQueryString(subreddit: string, demo: boolean): string {
    return `?subreddit=${encodeURIComponent(subreddit)}&demo=${demo ? 'true' : 'false'}`;
  }

  async fetchRuntimeContext(): Promise<{ subreddit?: string }> {
    const res = await fetch(`${this.baseUrl}/api/context`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch runtime context');
    return { subreddit: data.subreddit ?? undefined };
  }

  async fetchOverview(subreddit: string, demo: boolean): Promise<DashboardOverview & { demo: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/overview${this.getQueryString(subreddit, demo)}`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch overview');
    return { ...data.overview, demo: data.demo };
  }

  async fetchLocks(subreddit: string, demo: boolean): Promise<ReviewLockRecord[]> {
    const res = await fetch(`${this.baseUrl}/api/locks${this.getQueryString(subreddit, demo)}`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch locks');
    return data.locks;
  }

  async fetchReopenQueue(subreddit: string, demo: boolean): Promise<ReopenEvent[]> {
    const res = await fetch(`${this.baseUrl}/api/reopen-queue${this.getQueryString(subreddit, demo)}`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch reopen queue');
    return data.events;
  }

  async fetchAuditLog(subreddit: string, demo: boolean): Promise<AuditEvent[]> {
    const res = await fetch(`${this.baseUrl}/api/audit${this.getQueryString(subreddit, demo)}`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch audit log');
    return data.events;
  }

  async fetchRuntimeStatus(subreddit: string, demo: boolean): Promise<{
    runtime: RuntimeProofStatus;
    dailyMetrics: DailyMetrics[];
    topChurnTargets: TargetMetrics[];
  }> {
    const res = await fetch(`${this.baseUrl}/api/runtime${this.getQueryString(subreddit, demo)}`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch runtime status');
    return {
      runtime: data.runtime,
      dailyMetrics: data.dailyMetrics,
      topChurnTargets: data.topChurnTargets,
    };
  }

  async runRuntimeSmoke(subreddit: string): Promise<void> {
    const query = `?subreddit=${encodeURIComponent(subreddit)}`;
    const checks = await Promise.all([
      fetch(`${this.baseUrl}/api/smoke/redis${query}`, { method: 'POST' }),
      fetch(`${this.baseUrl}/api/smoke/reddit${query}`, { method: 'POST' }),
    ]);

    for (const res of checks) {
      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Runtime verification failed');
    }
  }

  async unlockTarget(targetId: string, actor: string): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(`${this.baseUrl}/internal/form/unlock-review-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, actor }),
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    return { ok: Boolean(data.ok ?? data.showToast ?? data.navigateTo), message: data.message ?? data.showToast?.text };
  }

  async dismissReopen(eventId: string, actor: string): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(`${this.baseUrl}/internal/form/reopen-action-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action: 'dismiss', actor }),
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    return { ok: Boolean(data.ok ?? data.showToast ?? data.navigateTo), message: data.message ?? data.showToast?.text };
  }
}
