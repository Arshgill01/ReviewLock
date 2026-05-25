import type { ReviewLockRecord } from '../../shared/schema';
import type { DashboardConfirmation } from '../state/store';
import {
  displayThingId,
  escapeAttr,
  escapeText,
  formatLocalDate,
  labelFromToken,
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

export const renderLockTable = (
  locks: ReviewLockRecord[],
  confirmation: DashboardConfirmation | null = null,
  readOnly = false,
): string => {
  const activeLocks = locks.filter((lock) => lock.status === 'active');

  const rows = activeLocks
    .map(
      (lock) => `
        <tr>
          <td>
            <a href="${escapeAttr(lock.permalink)}" target="_blank" rel="noopener noreferrer">
              <code>${lock.targetKind}:${escapeText(displayThingId(lock.targetId))}</code>
            </a>
          </td>
          <td>
            <span class="target-author">u/${escapeText(lock.targetAuthor)}</span>
          </td>
          <td>
            <div class="content-summary">
              <strong>${escapeText(lock.title ?? lock.targetId)}</strong>
              <span class="content-preview" title="${escapeAttr(lock.contentPreview)}">
                ${escapeText(lock.contentPreview)}
              </span>
              ${renderRuntimeWarnings(lock.runtimeWarnings)}
            </div>
          </td>
          <td>
            <span class="count-badge reason-badge">${escapeText(labelFromToken(lock.lockReason))}</span>
          </td>
          <td class="number-cell">
            <span class="number-pill">${lock.suppressedReportCount}</span>
          </td>
          <td class="date-cell">
            ${formatLocalDate(lock.lockedAt)}
          </td>
          <td>
            ${renderUnlockAction(lock, confirmation, readOnly)}
          </td>
        </tr>
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
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Author</th>
                    <th>Content</th>
                    <th>Reason</th>
                    <th>Reports suppressed</th>
                    <th>Locked</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `
          : '<p class="empty-text">No active locks.</p>'
      }
    </section>
  `;
};
