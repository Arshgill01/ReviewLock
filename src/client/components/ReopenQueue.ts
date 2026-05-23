import type { ReopenEvent } from '../../shared/schema';

const text = (value: string | undefined): string =>
  (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const date = (value: string): string => new Date(value).toLocaleString();

const reason = (value: string): string => value.replace(/_/g, ' ');

export const renderLatestReopenEvent = (event: ReopenEvent | undefined): string => {
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
          <strong>${reason(event.reason)}</strong>
        </div>
        <div>
          <span class="field-label">Created</span>
          <strong>${date(event.createdAt)}</strong>
        </div>
      </div>
      <p>${text(event.summary)}</p>
      <button class="button button-secondary" data-action="dismiss-reopen" data-event-id="${text(event.id)}">
        Dismiss reopen
      </button>
    </section>
  `;
};

export const renderReopenQueue = (events: ReopenEvent[]): string => {
  const rows = events
    .map(
      (event) => `
        <li class="queue-row">
          <div>
            <strong>${event.targetKind} ${text(event.targetId)}</strong>
            <span>${reason(event.reason)} · ${date(event.createdAt)}</span>
            <p>${text(event.summary)}</p>
          </div>
          <button class="button button-secondary" data-action="dismiss-reopen" data-event-id="${text(event.id)}">
            Dismiss
          </button>
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
