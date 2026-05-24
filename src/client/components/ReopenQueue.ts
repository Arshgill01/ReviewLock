import type { ReopenEvent } from '../../shared/schema';
import type { DashboardConfirmation } from '../state/store';

const text = (value: string | undefined): string =>
  (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const attr = (value: string | undefined): string =>
  text(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const date = (value: string): string => new Date(value).toLocaleString();

const reason = (value: string): string => value.replace(/_/g, ' ');

const shortHash = (value: string): string => text(value.slice(0, 8));

const renderHashTransition = (event: ReopenEvent): string => `
  <div class="hash-transition">
    <span class="field-label">Hash transition</span>
    <code>${shortHash(event.oldContentHash)}</code>
    <span class="hash-arrow">to</span>
    <code class="hash-new">${shortHash(event.newContentHash)}</code>
  </div>
`;

const renderDismissAction = (
  event: ReopenEvent,
  confirmation: DashboardConfirmation | null,
  label: string,
): string => {
  const isConfirming =
    confirmation?.action === 'dismiss-reopen' && confirmation.eventId === event.id;

  if (isConfirming) {
    return `
      <div class="confirm-actions" role="group" aria-label="Confirm dismiss reopen">
        <span>Confirm dismiss?</span>
        <button class="button" data-action="confirm-dismiss-reopen" data-event-id="${attr(event.id)}">
          Confirm
        </button>
        <button class="button button-secondary" data-action="cancel-confirmation">
          Cancel
        </button>
      </div>
    `;
  }

  return `
    <button class="button button-secondary" data-action="dismiss-reopen" data-event-id="${attr(event.id)}">
      ${label}
    </button>
  `;
};

export const renderLatestReopenEvent = (
  event: ReopenEvent | undefined,
  confirmation: DashboardConfirmation | null = null,
): string => {
  if (!event) {
    return `
      <section class="panel latest-panel">
        <div class="panel-heading">
          <h2>Latest edit-break event</h2>
        </div>
        <p class="empty-text">No reopened item is waiting.</p>
      </section>
    `;
  }

  return `
    <section class="panel latest-panel">
      <div class="panel-heading">
        <h2>Latest edit-break event</h2>
        <span class="status status-reopened">Reopened after edit</span>
      </div>
      <div class="latest-grid">
        <div>
          <span class="field-label">Target</span>
          <strong>${event.targetKind} ${text(event.targetId)}</strong>
        </div>
        <div>
          <span class="field-label">Reason</span>
          <strong>${text(reason(event.reason))}</strong>
        </div>
        <div>
          <span class="field-label">Created</span>
          <strong>${date(event.createdAt)}</strong>
        </div>
      </div>
      <p>${text(event.summary)}</p>
      ${renderHashTransition(event)}
      ${renderDismissAction(event, confirmation, 'Dismiss reopen')}
    </section>
  `;
};

export const renderReopenQueue = (
  events: ReopenEvent[],
  confirmation: DashboardConfirmation | null = null,
): string => {
  const rows = events
    .map(
      (event) => `
        <li class="queue-row">
          <div>
            <div class="queue-row-heading">
              <strong>${event.targetKind} ${text(event.targetId)}</strong>
              <span class="status status-reopened">${text(reason(event.reason))}</span>
              <span>${date(event.createdAt)}</span>
            </div>
            <p>${text(event.summary)}</p>
            ${renderHashTransition(event)}
          </div>
          ${renderDismissAction(event, confirmation, 'Dismiss')}
        </li>
      `,
    )
    .join('');

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Reopened after edit</h2>
        <span class="count-badge">${events.length}</span>
      </div>
      ${
        events.length
          ? `<ul class="queue-list">${rows}</ul>`
          : '<p class="empty-text">No reopened items are waiting.</p>'
      }
    </section>
  `;
};
