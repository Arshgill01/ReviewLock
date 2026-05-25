import type { TargetMetrics } from '../../shared/schema';
import { renderAuditTimeline } from '../components/AuditTimeline';
import { renderDemoBanner } from '../components/DemoBanner';
import { renderLockTable } from '../components/LockTable';
import { renderMetricStrip } from '../components/MetricStrip';
import { renderLatestReopenEvent, renderReopenQueue } from '../components/ReopenQueue';
import { renderRuntimeBanner } from '../components/RuntimeBanner';
import { classifyClientNotice } from '../state/clientNotice';
import type { ReviewLockStore } from '../state/store';
import { displayThingId, escapeText, formatLocalDate } from '../utils/format';

export const renderTopChurnTargets = (targets: TargetMetrics[]): string => {
  const rows = targets
    .filter((target) => target.reportsSuppressed > 0)
    .slice(0, 6)
    .map(
      (target) => `
        <li class="churn-row">
          <div>
            <code>${target.targetKind}:${escapeText(displayThingId(target.targetId))}</code>
            <span class="churn-date">
              Last active: ${formatLocalDate(target.lastActivityAt)}
            </span>
          </div>
          <span class="number-pill">${target.reportsSuppressed}</span>
        </li>
      `,
    )
    .join('');

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Report churn</h2>
      </div>
      ${
        rows
          ? `<ul class="churn-list">${rows}</ul>`
          : '<p class="empty-text">No reports suppressed yet.</p>'
      }
    </section>
  `;
};

export const renderDashboardPage = (store: ReviewLockStore): string => {
  if (store.isLoading && !store.overview) {
    return `
      <main class="shell shell-centered">
        <div class="panel loading-panel">
          <strong>Loading ReviewLock.</strong>
        </div>
      </main>
    `;
  }

  if (store.error && !store.overview) {
    const notice = classifyClientNotice(store.error);

    return `
      <main class="shell shell-centered">
        <section class="panel panel-error">
          <h1>ReviewLock</h1>
          <strong>${escapeText(notice.title)}</strong>
          <p>${escapeText(notice.message)}</p>
          <p class="error-action">${escapeText(notice.action)}</p>
          <div class="error-actions">
            <button class="button" data-action="retry-fetch">Retry</button>
            ${
              store.demo
                ? ''
                : '<button class="button button-secondary" data-action="toggle-mode" data-mode="demo">Demo</button>'
            }
          </div>
        </section>
      </main>
    `;
  }

  const inlineNotice = store.error ? classifyClientNotice(store.error) : undefined;

  return `
    ${renderDemoBanner(store.demo)}
    <main class="shell">
      <header class="app-header">
        <div>
          <h1>ReviewLock</h1>
          <p>Lock reviewed content until it changes.</p>
        </div>
        <div class="header-actions">
          <span>r/${escapeText(store.subreddit)}</span>
          <button class="button ${store.demo ? 'button-secondary' : ''}" data-action="toggle-mode" data-mode="live">
            Live
          </button>
          <button class="button ${store.demo ? '' : 'button-secondary'}" data-action="toggle-mode" data-mode="demo">
            Demo
          </button>
        </div>
      </header>

      ${
        inlineNotice
          ? `<section class="panel panel-error-inline" role="alert">
              <strong>${escapeText(inlineNotice.title)}</strong>
              <span>${escapeText(inlineNotice.message)}</span>
              <span class="error-action">${escapeText(inlineNotice.action)}</span>
              <button class="button button-secondary button-compact" data-action="retry-fetch">Retry</button>
            </section>`
          : ''
      }

      <section class="first-viewport" aria-label="Dashboard overview">
        ${renderMetricStrip(store.overview)}
        ${renderLatestReopenEvent(store.overview?.latestReopenEvent, store.confirmation, store.demo)}
      </section>

      <div class="content-grid">
        <div class="main-column">
          ${renderLockTable(store.locks, store.confirmation, store.demo)}
          ${renderReopenQueue(store.reopenQueue, store.confirmation, store.demo)}
        </div>
        <div class="side-column">
          ${renderTopChurnTargets(store.topChurnTargets)}
          ${renderRuntimeBanner(store.runtimeStatus, store.runtimeVerificationMessage, store.isVerifyingRuntime)}
          ${renderAuditTimeline(store.auditEvents)}
        </div>
      </div>
    </main>
  `;
};
