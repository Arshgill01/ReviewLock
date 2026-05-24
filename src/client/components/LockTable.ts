import type { ReviewLockRecord } from '../../shared/schema';

const text = (value: string | undefined): string =>
  (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const attr = (value: string | undefined): string =>
  text(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const reason = (value: string): string => value.replace(/_/g, ' ');

export const renderLockTable = (locks: ReviewLockRecord[]): string => {
  const activeLocks = locks.filter((lock) => lock.status === 'active');

  const rows = activeLocks
    .map(
      (lock) => `
        <tr>
          <td>
            <a href="${attr(lock.permalink)}" target="_blank" rel="noreferrer">${lock.targetKind} ${text(lock.targetId)}</a>
          </td>
          <td>u/${text(lock.targetAuthor)}</td>
          <td>
            <strong>${text(lock.title ?? lock.targetId)}</strong>
            <span>${text(lock.contentPreview)}</span>
          </td>
          <td>${reason(lock.lockReason)}</td>
          <td class="number-cell">${lock.suppressedReportCount}</td>
          <td>${new Date(lock.lockedAt).toLocaleDateString()}</td>
          <td>
            <button class="button button-secondary" data-action="unlock" data-lock-id="${attr(lock.id)}" data-target-id="${attr(lock.targetId)}">
              Unlock
            </button>
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
