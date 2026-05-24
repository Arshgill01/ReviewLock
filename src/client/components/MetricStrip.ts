import type { DashboardOverview } from '../../shared/schema';

export const renderMetricStrip = (overview: DashboardOverview | null): string => {
  const activeLocks = overview?.activeLockCount ?? 0;
  const reportsSuppressed = overview?.reportsSuppressed ?? 0;
  const reopenedAfterEdit = overview?.reopenedAfterEditCount ?? 0;

  return `
    <section class="metric-strip" aria-label="ReviewLock metrics">
      <div class="metric-cell">
        <span class="field-label">1. Lock Review</span>
        <span class="metric-value">${activeLocks}</span>
        <span class="metric-label">Active locks</span>
      </div>
      <div class="metric-cell">
        <span class="field-label">2. Avoid Churn</span>
        <span class="metric-value">${reportsSuppressed}</span>
        <span class="metric-label">Reports suppressed</span>
      </div>
      <div class="metric-cell">
        <span class="field-label">3. Break on Edit</span>
        <span class="metric-value">${reopenedAfterEdit}</span>
        <span class="metric-label">Reopened after edit</span>
      </div>
    </section>
  `;
};
