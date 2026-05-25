import type { AuditEvent } from '../../shared/schema';
import { escapeAttr, escapeText, formatLocalDateTime, labelFromToken } from '../utils/format';

const auditDetails = (event: AuditEvent): string[] =>
  [
    event.targetId ? `Target ${event.targetKind ?? 'target'} ${event.targetId}` : undefined,
    event.lockId ? `Lock ${event.lockId}` : undefined,
    event.data.operation ? `Operation ${String(event.data.operation)}` : undefined,
    event.data.error ? `Error ${String(event.data.error)}` : undefined,
    event.data.reason ? `Reason ${String(event.data.reason)}` : undefined,
  ].filter((detail): detail is string => Boolean(detail));

const renderAuditDetails = (event: AuditEvent): string => {
  const details = auditDetails(event);

  if (details.length === 0) {
    return '';
  }

  return `<p class="audit-details">${escapeText(details.join(' · '))}</p>`;
};

export const renderAuditTimeline = (events: AuditEvent[]): string => {
  const rows = events
    .map((event) => {
      const createdAt = formatLocalDateTime(event.createdAt);
      const details = auditDetails(event);
      const summary = [
        labelFromToken(event.kind),
        createdAt,
        event.actor,
        event.message,
        ...details,
      ].join(' · ');

      return `
        <li class="audit-row" aria-label="${escapeAttr(summary)}">
          <div class="audit-row-header">
            <strong class="audit-kind">${labelFromToken(event.kind)}</strong>
            <span class="audit-meta">
              <time datetime="${escapeAttr(event.createdAt)}">${createdAt}</time>
              <span>${escapeText(event.actor)}</span>
            </span>
          </div>
          <p class="audit-message">${escapeText(event.message)}</p>
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
