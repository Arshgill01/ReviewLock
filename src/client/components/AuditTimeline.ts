import type { AuditEvent } from '../../shared/schema';

const text = (value: string | undefined): string =>
  (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const attr = (value: string | undefined): string =>
  text(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const renderAuditDetails = (event: AuditEvent): string => {
  const details = [
    event.targetId ? `Target ${event.targetKind ?? 'target'} ${event.targetId}` : undefined,
    event.lockId ? `Lock ${event.lockId}` : undefined,
    event.data.operation ? `Operation ${String(event.data.operation)}` : undefined,
    event.data.error ? `Error ${String(event.data.error)}` : undefined,
    event.data.reason ? `Reason ${String(event.data.reason)}` : undefined,
  ].filter((detail): detail is string => Boolean(detail));

  if (details.length === 0) {
    return '';
  }

  return `<p class="audit-details">${text(details.join(' · '))}</p>`;
};

export const renderAuditTimeline = (events: AuditEvent[]): string => {
  const rows = events
    .map((event) => {
      const createdAt = new Date(event.createdAt);

      return `
        <li class="audit-row">
          <div class="audit-row-header">
            <strong class="audit-kind">${event.kind.replace(/_/g, ' ')}</strong>
            <span class="audit-meta">
              <time datetime="${attr(event.createdAt)}">${createdAt.toLocaleString()}</time>
              <span>${text(event.actor)}</span>
            </span>
          </div>
          <p class="audit-message">${text(event.message)}</p>
          ${renderAuditDetails(event)}
        </li>
      `;
    })
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
