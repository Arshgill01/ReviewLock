import type { ReviewLockRecord } from '../../shared/schema';
import type { DashboardConfirmation } from '../state/store';

const text = (value: string | undefined): string =>
  (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const attr = (value: string | undefined): string =>
  text(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const reason = (value: string): string => value.replace(/_/g, ' ');

const renderUnlockAction = (
  lock: ReviewLockRecord,
  confirmation: DashboardConfirmation | null,
): string => {
  const isConfirming =
    confirmation?.action === 'unlock' &&
    confirmation.lockId === lock.id &&
    confirmation.targetId === lock.targetId;

  if (isConfirming) {
    return `
      <div class="confirm-actions" role="group" aria-label="Confirm unlock">
        <span>Confirm unlock?</span>
        <button class="button" data-action="confirm-unlock" data-lock-id="${attr(lock.id)}" data-target-id="${attr(lock.targetId)}">
          Confirm
        </button>
        <button class="button button-secondary" data-action="cancel-confirmation">
          Cancel
        </button>
      </div>
    `;
  }

  return `
    <button class="button button-secondary" data-action="unlock" data-lock-id="${attr(lock.id)}" data-target-id="${attr(lock.targetId)}">
      Unlock
    </button>
  `;
};

export const renderLockTable = (
  locks: ReviewLockRecord[],
  confirmation: DashboardConfirmation | null = null,
): string => {
  const activeLocks = locks.filter((lock) => lock.status === 'active');

  const rows = activeLocks
    .map(
      (lock) => `
        <tr>
          <td>
            <a href="${attr(lock.permalink)}" target="_blank" rel="noreferrer">
              <code>${lock.targetKind}:${text(lock.targetId.replace('t1_', '').replace('t3_', ''))}</code>
            </a>
          </td>
          <td>
            <span class="target-author">u/${text(lock.targetAuthor)}</span>
          </td>
          <td>
            <div class="content-summary">
              <strong>${text(lock.title ?? lock.targetId)}</strong>
              <span class="content-preview" title="${attr(lock.contentPreview)}">
                ${text(lock.contentPreview)}
              </span>
            </div>
          </td>
          <td>
            <span class="count-badge reason-badge">${text(reason(lock.lockReason))}</span>
          </td>
          <td class="number-cell">
            <span class="number-pill">${lock.suppressedReportCount}</span>
          </td>
          <td class="date-cell">
            ${new Date(lock.lockedAt).toLocaleDateString()}
          </td>
          <td>
            ${renderUnlockAction(lock, confirmation)}
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
