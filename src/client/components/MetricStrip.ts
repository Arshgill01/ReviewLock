import type { DashboardOverview } from '../../shared/schema';

export const renderMetricStrip = (overview: DashboardOverview | null): string => {
  const activeLocks = overview?.activeLockCount ?? 0;
  const reportsSuppressed = overview?.reportsSuppressed ?? 0;
  const reopenedAfterEdit = overview?.reopenedAfterEditCount ?? 0;

  return `
    <section class="metric-strip" aria-label="ReviewLock metrics">
      <div class="metric-cell">
        <span class="metric-value">${activeLocks}</span>
        <span class="metric-label">Active locks</span>
      </div>
      <div class="metric-cell">
        <span class="metric-value">${reportsSuppressed}</span>
        <span class="metric-label">Reports suppressed</span>
      </div>
      <div class="metric-cell">
        <span class="metric-value">${reopenedAfterEdit}</span>
        <span class="metric-label">Reopened after edit</span>
      </div>
    </section>
  `;
};
