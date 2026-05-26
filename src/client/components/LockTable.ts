import type { ReviewLockRecord } from '../../shared/schema';
import type { DashboardConfirmation } from '../state/store';
import {
  displayThingId,
  escapeAttr,
  escapeText,
  formatLocalDate,
  labelFromToken,
  safeRedditPermalinkHref,
} from '../utils/format';

const renderRuntimeWarnings = (warnings: string[]): string => {
  if (warnings.length === 0) {
    return '';
  }

  return `
    <div class="lock-warning" role="status">
      <span class="status status-failed">Needs attention</span>
      <span>${escapeText(warnings.join('; '))}</span>
    </div>
  `;
};

const renderUnlockAction = (
  lock: ReviewLockRecord,
  confirmation: DashboardConfirmation | null,
  readOnly = false,
): string => {
  if (readOnly) {
    return '<span class="status status-unverified">Demo read-only</span>';
  }

  const isConfirming =
    confirmation?.action === 'unlock' &&
    confirmation.lockId === lock.id &&
    confirmation.targetId === lock.targetId;

  if (isConfirming) {
    return `
      <div class="confirm-actions" role="group" aria-label="Confirm unlock">
        <span>Confirm unlock?</span>
        <button class="button" data-action="confirm-unlock" data-lock-id="${escapeAttr(lock.id)}" data-target-id="${escapeAttr(lock.targetId)}">
          Confirm
        </button>
        <button class="button button-secondary" data-action="cancel-confirmation">
          Cancel
        </button>
      </div>
    `;
  }

  return `
    <button class="button button-secondary" data-action="unlock" data-lock-id="${escapeAttr(lock.id)}" data-target-id="${escapeAttr(lock.targetId)}">
      Unlock
    </button>
  `;
};

const renderTargetLink = (lock: ReviewLockRecord): string => {
  const label = `<code>${lock.targetKind}:${escapeText(displayThingId(lock.targetId))}</code>`;
  const href = safeRedditPermalinkHref(lock.permalink);

  if (!href) {
    return label;
  }

  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
};

export const renderLockTable = (
  locks: ReviewLockRecord[],
  confirmation: DashboardConfirmation | null = null,
  readOnly = false,
): string => {
  const activeLocks = locks.filter((lock) => lock.status === 'active');

  const rows = activeLocks
    .map(
      (lock) => `
        <li class="lock-row">
          <div class="lock-target">
            ${renderTargetLink(lock)}
            <span class="target-author">u/${escapeText(lock.targetAuthor)}</span>
          </div>
          <div class="content-summary">
            <strong>${escapeText(lock.title ?? lock.targetId)}</strong>
            <span class="content-preview" title="${escapeAttr(lock.contentPreview)}">
              ${escapeText(lock.contentPreview)}
            </span>
            ${renderRuntimeWarnings(lock.runtimeWarnings)}
          </div>
          <dl class="lock-meta">
            <div>
              <dt>Reason</dt>
              <dd><span class="count-badge reason-badge">${escapeText(labelFromToken(lock.lockReason))}</span></dd>
            </div>
            <div>
              <dt>Reports suppressed</dt>
              <dd><span class="number-pill">${lock.suppressedReportCount}</span></dd>
            </div>
            <div>
              <dt>Locked</dt>
              <dd class="date-cell">${formatLocalDate(lock.lockedAt)}</dd>
            </div>
          </dl>
          <div class="lock-action">
            ${renderUnlockAction(lock, confirmation, readOnly)}
          </div>
        </li>
      `,
    )
    .join('');

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Active locks</h2>
        <span class="count-badge">${activeLocks.length}</span>
      </div>
      ${
        activeLocks.length
          ? `
            <ul class="lock-list">${rows}</ul>
          `
          : '<p class="empty-text">No active locks.</p>'
      }
    </section>
  `;
};
