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

export interface DemoModeStatus {
  subreddit: string;
  enabled: boolean;
  demo: boolean;
  seededAt?: string;
  lockCount: number;
  reopenEventCount: number;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasBoolean = (data: JsonObject, key: string): boolean => typeof data[key] === 'boolean';

const hasArray = (data: JsonObject, key: string): boolean => Array.isArray(data[key]);

const hasObject = (data: JsonObject, key: string): boolean => isObject(data[key]);

const errorText = (data: unknown): string | undefined =>
  isObject(data) && typeof data.error === 'string'
    ? data.error
    : isObject(data) && typeof data.message === 'string'
      ? data.message
      : undefined;

const contractError = (endpoint: string, message: string): Error =>
  new Error(`API contract error at ${endpoint}: ${message}`);

export class ReviewLockApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private getQueryString(subreddit: string, demo: boolean): string {
    return `?subreddit=${encodeURIComponent(subreddit)}&demo=${demo ? 'true' : 'false'}`;
  }

  private async requestJson(endpoint: string, init?: RequestInit): Promise<JsonObject> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, init);
    let data: unknown;

    try {
      data = await res.json();
    } catch {
      if (!res.ok) {
        throw new Error(`API error: ${res.statusText || res.status}`);
      }
      throw contractError(endpoint, 'response was not valid JSON');
    }

    if (!res.ok) {
      throw new Error(`API error: ${errorText(data) ?? (res.statusText || String(res.status))}`);
    }

    if (!isObject(data)) {
      throw contractError(endpoint, 'response JSON was not an object');
    }

    return data;
  }

  private expectOk(data: JsonObject, endpoint: string): void {
    if (data.ok !== true) {
      throw new Error(errorText(data) ?? `Failed request to ${endpoint}`);
    }
  }

  private expectDashboardOverview(data: JsonObject, endpoint: string): DashboardOverview {
    if (!hasObject(data, 'overview')) {
      throw contractError(endpoint, 'missing overview object');
    }

    const overview = data.overview as JsonObject;
    if (
      typeof overview.activeLockCount !== 'number' ||
      typeof overview.reportsSuppressed !== 'number' ||
      typeof overview.reopenedAfterEditCount !== 'number' ||
      !Array.isArray(overview.topChurnTargets) ||
      !isObject(overview.runtimeStatus)
    ) {
      throw contractError(endpoint, 'overview object is missing required dashboard fields');
    }

    return overview as unknown as DashboardOverview;
  }

  private expectArray<T>(data: JsonObject, endpoint: string, key: string): T[] {
    if (!hasArray(data, key)) {
      throw contractError(endpoint, `missing ${key} array`);
    }

    return data[key] as T[];
  }

  private expectDemoStatus(data: JsonObject, endpoint: string): DemoModeStatus {
    if (!hasObject(data, 'status')) {
      throw contractError(endpoint, 'missing status object');
    }

    const status = data.status as JsonObject;
    if (
      typeof status.subreddit !== 'string' ||
      typeof status.enabled !== 'boolean' ||
      typeof status.demo !== 'boolean' ||
      typeof status.lockCount !== 'number' ||
      typeof status.reopenEventCount !== 'number'
    ) {
      throw contractError(endpoint, 'status object is missing required demo fields');
    }

    return status as unknown as DemoModeStatus;
  }

  async fetchRuntimeContext(): Promise<{ subreddit?: string }> {
    const endpoint = '/api/context';
    const data = await this.requestJson(endpoint);
    this.expectOk(data, endpoint);
    if (
      data.subreddit !== null &&
      data.subreddit !== undefined &&
      typeof data.subreddit !== 'string'
    ) {
      throw contractError(endpoint, 'subreddit must be a string, null, or omitted');
    }
    return { subreddit: data.subreddit ?? undefined };
  }

  async fetchOverview(
    subreddit: string,
    demo: boolean,
  ): Promise<DashboardOverview & { demo: boolean }> {
    const endpoint = `/api/overview${this.getQueryString(subreddit, demo)}`;
    const data = await this.requestJson(endpoint);
    this.expectOk(data, endpoint);
    if (!hasBoolean(data, 'demo')) {
      throw contractError(endpoint, 'missing demo boolean');
    }
    return { ...this.expectDashboardOverview(data, endpoint), demo: data.demo as boolean };
  }

  async fetchLocks(subreddit: string, demo: boolean): Promise<ReviewLockRecord[]> {
    const endpoint = `/api/locks${this.getQueryString(subreddit, demo)}`;
    const data = await this.requestJson(endpoint);
    this.expectOk(data, endpoint);
    return this.expectArray<ReviewLockRecord>(data, endpoint, 'locks');
  }

  async fetchReopenQueue(subreddit: string, demo: boolean): Promise<ReopenEvent[]> {
    const endpoint = `/api/reopen-queue${this.getQueryString(subreddit, demo)}`;
    const data = await this.requestJson(endpoint);
    this.expectOk(data, endpoint);
    return this.expectArray<ReopenEvent>(data, endpoint, 'events');
  }

  async fetchAuditLog(subreddit: string, demo: boolean): Promise<AuditEvent[]> {
    const endpoint = `/api/audit${this.getQueryString(subreddit, demo)}`;
    const data = await this.requestJson(endpoint);
    this.expectOk(data, endpoint);
    return this.expectArray<AuditEvent>(data, endpoint, 'events');
  }

  async fetchRuntimeStatus(
    subreddit: string,
    demo: boolean,
  ): Promise<{
    runtime: RuntimeProofStatus;
    dailyMetrics: DailyMetrics[];
    topChurnTargets: TargetMetrics[];
  }> {
    const endpoint = `/api/runtime${this.getQueryString(subreddit, demo)}`;
    const data = await this.requestJson(endpoint);
    this.expectOk(data, endpoint);
    if (!hasObject(data, 'runtime')) {
      throw contractError(endpoint, 'missing runtime object');
    }
    return {
      runtime: data.runtime as unknown as RuntimeProofStatus,
      dailyMetrics: this.expectArray<DailyMetrics>(data, endpoint, 'dailyMetrics'),
      topChurnTargets: this.expectArray<TargetMetrics>(data, endpoint, 'topChurnTargets'),
    };
  }

  async runRuntimeSmoke(subreddit: string): Promise<void> {
    const query = `?subreddit=${encodeURIComponent(subreddit)}`;
    const checks = await Promise.all([
      this.requestJson(`/api/smoke/redis${query}`, { method: 'POST' }),
      this.requestJson(`/api/smoke/reddit${query}`, { method: 'POST' }),
    ]);

    for (const data of checks) {
      if (data.ok !== true) {
        throw new Error(errorText(data) ?? 'Runtime verification failed');
      }
    }
  }

  async enableDemoMode(): Promise<DemoModeStatus> {
    const endpoint = '/api/demo/enable';
    const data = await this.requestJson(endpoint, { method: 'POST' });
    this.expectOk(data, endpoint);
    return this.expectDemoStatus(data, endpoint);
  }

  async disableDemoMode(subreddit: string): Promise<DemoModeStatus> {
    const query = `?subreddit=${encodeURIComponent(subreddit)}`;
    const endpoint = `/api/demo/disable${query}`;
    const data = await this.requestJson(endpoint, { method: 'POST' });
    this.expectOk(data, endpoint);
    return this.expectDemoStatus(data, endpoint);
  }

  async unlockTarget(
    targetId: string,
    lockId: string,
    actor: string,
  ): Promise<{ ok: boolean; message?: string }> {
    const endpoint = '/api/locks/unlock';
    const data = await this.requestJson(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, lockId, actor }),
    });
    return {
      ok: Boolean(data.ok ?? data.showToast ?? data.navigateTo),
      message:
        typeof data.message === 'string'
          ? data.message
          : isObject(data.showToast) && typeof data.showToast.text === 'string'
            ? data.showToast.text
            : undefined,
    };
  }

  async dismissReopen(
    eventId: string,
    actor: string,
    subreddit: string,
  ): Promise<{ ok: boolean; message?: string }> {
    const endpoint = '/api/reopen-queue/dismiss';
    const data = await this.requestJson(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, actor, subreddit }),
    });
    return {
      ok: Boolean(data.ok ?? data.showToast ?? data.navigateTo),
      message:
        typeof data.message === 'string'
          ? data.message
          : isObject(data.showToast) && typeof data.showToast.text === 'string'
            ? data.showToast.text
            : undefined,
    };
  }
}
