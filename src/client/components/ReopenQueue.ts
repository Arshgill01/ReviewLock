import type { ReopenEvent } from '../../shared/schema';
import type { DashboardConfirmation } from '../state/store';
import {
  displayThingId,
  escapeAttr,
  escapeText,
  formatLocalDateTime,
  labelFromToken,
} from '../utils/format';

const shortHash = (value: string): string => escapeText(value.slice(0, 8));

const renderHashTransition = (event: ReopenEvent): string => `
  <div class="hash-transition">
    <span class="field-label">Content change fingerprint</span>
    <code>${shortHash(event.oldContentHash)}</code>
    <span class="hash-arrow">to</span>
    <code class="hash-new">${shortHash(event.newContentHash)}</code>
  </div>
`;

const renderRuntimeWarnings = (warnings: string[]): string => {
  if (warnings.length === 0) {
    return '';
  }

  return `
    <div class="runtime-item-warning" role="status">
      <span class="status status-failed">Needs attention</span>
      <span>${escapeText(warnings.join('; '))}</span>
    </div>
  `;
};

const renderDismissAction = (
  event: ReopenEvent,
  confirmation: DashboardConfirmation | null,
  label: string,
  readOnly = false,
): string => {
  if (readOnly) {
    return '<span class="status status-unverified">Demo read-only</span>';
  }

  const isConfirming =
    confirmation?.action === 'dismiss-reopen' && confirmation.eventId === event.id;

  if (isConfirming) {
    return `
      <div class="confirm-actions" role="group" aria-label="Confirm dismiss reopen">
        <span>Confirm dismiss?</span>
        <button class="button" data-action="confirm-dismiss-reopen" data-event-id="${escapeAttr(event.id)}">
          Confirm
        </button>
        <button class="button button-secondary" data-action="cancel-confirmation">
          Cancel
        </button>
      </div>
    `;
  }

  return `
    <button class="button button-secondary" data-action="dismiss-reopen" data-event-id="${escapeAttr(event.id)}">
      ${label}
    </button>
  `;
};

export const renderLatestReopenEvent = (
  event: ReopenEvent | undefined,
  confirmation: DashboardConfirmation | null = null,
  readOnly = false,
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
          <strong><code>${event.targetKind}:${escapeText(displayThingId(event.targetId))}</code></strong>
        </div>
        <div>
          <span class="field-label">Reason</span>
          <strong class="status status-reopened latest-reason">${escapeText(labelFromToken(event.reason))}</strong>
        </div>
        <div>
          <span class="field-label">Created</span>
          <strong>${formatLocalDateTime(event.createdAt)}</strong>
        </div>
      </div>
      <p>${escapeText(event.summary)}</p>
      ${renderRuntimeWarnings(event.runtimeWarnings)}
      <div class="hash-transition-wrap">
        ${renderHashTransition(event)}
      </div>
      <div class="latest-action">
        ${renderDismissAction(event, confirmation, 'Dismiss Reopen', readOnly)}
      </div>
    </section>
  `;
};

export const renderReopenQueue = (
  events: ReopenEvent[],
  confirmation: DashboardConfirmation | null = null,
  readOnly = false,
): string => {
  const rows = events
    .map(
      (event) => `
        <li class="queue-row">
          <div class="queue-row-body">
            <div class="queue-row-heading">
              <code>${event.targetKind}:${escapeText(displayThingId(event.targetId))}</code>
              <span class="status status-reopened">${escapeText(labelFromToken(event.reason))}</span>
              <span class="date-cell">${formatLocalDateTime(event.createdAt)}</span>
            </div>
            <p>${escapeText(event.summary)}</p>
            ${renderRuntimeWarnings(event.runtimeWarnings)}
            ${renderHashTransition(event)}
          </div>
          <div class="queue-row-action">
            ${renderDismissAction(event, confirmation, 'Dismiss', readOnly)}
          </div>
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
