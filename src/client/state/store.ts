import type { ReviewLockApiClient } from './api';
import type {
  DashboardOverview,
  ReviewLockRecord,
  ReopenEvent,
  AuditEvent,
  DailyMetrics,
  TargetMetrics,
  RuntimeProofStatus,
} from '../../shared/schema';

export type DashboardConfirmation =
  | {
      action: 'unlock';
      lockId: string;
      targetId: string;
    }
  | {
      action: 'dismiss-reopen';
      eventId: string;
    };

export class ReviewLockStore {
  private api: ReviewLockApiClient;
  private listeners: Set<() => void> = new Set();
  private liveSubreddit: string = 'reviewlock';

  public subreddit: string = 'reviewlock';
  public demo: boolean = false;
  public isLoading: boolean = false;
  public error: string | null = null;

  public overview: DashboardOverview | null = null;
  public locks: ReviewLockRecord[] = [];
  public reopenQueue: ReopenEvent[] = [];
  public auditEvents: AuditEvent[] = [];
  public dailyMetrics: DailyMetrics[] = [];
  public topChurnTargets: TargetMetrics[] = [];
  public runtimeStatus: RuntimeProofStatus | null = null;
  public isVerifyingRuntime: boolean = false;
  public runtimeVerificationMessage: string | null = null;
  public confirmation: DashboardConfirmation | null = null;

  constructor(
    api: ReviewLockApiClient,
    initialSubreddit: string = 'reviewlock',
    initialDemo: boolean = false,
  ) {
    this.api = api;
    this.subreddit = initialDemo ? 'reviewlock_demo' : initialSubreddit;
    this.liveSubreddit = initialSubreddit === 'reviewlock_demo' ? 'reviewlock' : initialSubreddit;
    this.demo = initialDemo;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  getLiveSubreddit(): string {
    return this.liveSubreddit;
  }

  requestConfirmation(confirmation: DashboardConfirmation) {
    this.confirmation = confirmation;
    this.notify();
  }

  clearConfirmation() {
    this.confirmation = null;
    this.notify();
  }

  async fetchState() {
    this.isLoading = true;
    this.error = null;
    this.notify();

    try {
      const [overviewData, locks, reopenQueue, auditEvents, runtimeData] = await Promise.all([
        this.api.fetchOverview(this.subreddit, this.demo),
        this.api.fetchLocks(this.subreddit, this.demo),
        this.api.fetchReopenQueue(this.subreddit, this.demo),
        this.api.fetchAuditLog(this.subreddit, this.demo),
        this.api.fetchRuntimeStatus(this.subreddit, this.demo),
      ]);

      this.overview = overviewData;
      this.locks = locks;
      this.reopenQueue = reopenQueue;
      this.auditEvents = auditEvents;
      this.runtimeStatus = runtimeData.runtime;
      this.dailyMetrics = runtimeData.dailyMetrics;
      this.topChurnTargets = runtimeData.topChurnTargets;
      this.error = null;
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : 'An error occurred fetching dashboard state';
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  async unlock(lockId: string, targetId: string) {
    this.isLoading = true;
    this.error = null;
    this.confirmation = null;
    this.notify();

    try {
      const res = await this.api.unlockTarget(targetId, lockId, 'moderator', this.subreddit);
      if (!res.ok) {
        throw new Error(res.message || 'Failed to unlock content');
      }

      this.locks = this.locks.filter((l) => l.id !== lockId);
      if (this.overview) {
        this.overview.activeLockCount = Math.max(0, this.overview.activeLockCount - 1);
      }
      await this.fetchState();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while unlocking';
      this.isLoading = false;
      this.notify();
    }
  }

  async dismissReopen(eventId: string) {
    this.isLoading = true;
    this.error = null;
    this.confirmation = null;
    this.notify();

    try {
      const res = await this.api.dismissReopen(eventId, 'moderator', this.subreddit);
      if (!res.ok) {
        throw new Error(res.message || 'Failed to dismiss reopen event');
      }

      this.reopenQueue = this.reopenQueue.filter((e) => e.id !== eventId);
      if (this.overview) {
        this.overview.reopenedAfterEditCount = Math.max(
          0,
          this.overview.reopenedAfterEditCount - 1,
        );
        if (this.overview.latestReopenEvent?.id === eventId) {
          this.overview.latestReopenEvent = this.reopenQueue[0];
        }
      }
      await this.fetchState();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while dismissing';
      this.isLoading = false;
      this.notify();
    }
  }

  async verifyRuntime() {
    if (this.demo) {
      this.runtimeVerificationMessage = null;
      this.error = 'Runtime verification runs in live mode only.';
      this.notify();
      return;
    }

    this.isVerifyingRuntime = true;
    this.runtimeVerificationMessage = null;
    this.error = null;
    this.notify();

    try {
      await this.api.runRuntimeSmoke(this.subreddit);
      const runtimeData = await this.api.fetchRuntimeStatus(this.subreddit, false);
      this.runtimeStatus = runtimeData.runtime;
      this.dailyMetrics = runtimeData.dailyMetrics;
      this.topChurnTargets = runtimeData.topChurnTargets;
      this.runtimeVerificationMessage = 'Runtime proof refreshed.';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Runtime verification failed';
    } finally {
      this.isVerifyingRuntime = false;
      this.notify();
    }
  }

  async setSubreddit(subreddit: string) {
    this.subreddit = subreddit;
    if (!this.demo) {
      this.liveSubreddit = subreddit;
    }
    await this.fetchState();
  }

  updateSubredditContext(subreddit: string) {
    this.subreddit = subreddit;
    if (!this.demo) {
      this.liveSubreddit = subreddit;
    }
    this.notify();
  }

  async setDemo(demo: boolean) {
    if (demo === this.demo) {
      await this.fetchState();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.notify();

    try {
      if (demo) {
        const status = await this.api.enableDemoMode();
        this.demo = true;
        this.subreddit = status.subreddit;
      } else {
        const demoSubreddit = this.subreddit;
        await this.api.disableDemoMode(demoSubreddit);
        this.demo = false;
        this.subreddit = this.liveSubreddit;
      }

      await this.fetchState();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred toggling demo mode';
      this.isLoading = false;
      this.notify();
    }
  }
}
