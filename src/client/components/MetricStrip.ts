import type { DashboardOverview } from '../../shared/schema';

export const renderMetricStrip = (overview: DashboardOverview | null): string => {
  const activeLocks = overview?.activeLockCount ?? 0;
  const reportsSuppressed = overview?.reportsSuppressed ?? 0;
  const reopenedAfterEdit = overview?.reopenedAfterEditCount ?? 0;

  return `
    <section class="metric-strip" aria-label="ReviewLock metrics">
      <div class="metric-cell" title="Reviewed content is locked with a content fingerprint">
        <span class="field-label">1. Reviewed and locked</span>
        <span class="metric-value">${activeLocks}</span>
        <span class="metric-label">Active locks</span>
      </div>
      <div class="metric-cell" title="Incoming reports on unchanged reviewed content are suppressed">
        <span class="field-label">2. Reports suppressed</span>
        <span class="metric-value">${reportsSuppressed}</span>
        <span class="metric-label">Reports suppressed</span>
      </div>
      <div class="metric-cell" title="Any material edit breaks the lock and alerts moderators">
        <span class="field-label">3. Reopened after edit</span>
        <span class="metric-value">${reopenedAfterEdit}</span>
        <span class="metric-label">Reopened after edit</span>
      </div>
    </section>
  `;
};
