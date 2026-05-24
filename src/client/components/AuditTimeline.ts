import type { AuditEvent } from '../../shared/schema';

const text = (value: string | undefined): string =>
  (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export const renderAuditTimeline = (events: AuditEvent[]): string => {
  const rows = events
    .map(
      (event) => `
        <li class="audit-row">
          <div>
            <strong class="audit-kind">${event.kind.replace(/_/g, ' ')}</strong>
            <span>${new Date(event.createdAt).toLocaleString()} · <strong>${text(event.actor)}</strong></span>
          </div>
          <p>${text(event.message)}</p>
        </li>
      `,
    )
    .join('');

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Audit timeline</h2>
        <span class="count-badge">${events.length}</span>
      </div>
      ${
        events.length
          ? `<ul class="audit-list">${rows}</ul>`
          : '<p class="empty-text">No audit events recorded.</p>'
      }
    </section>
  `;
};
