import type { AuditEvent } from '../../shared/schema';
import { escapeAttr, escapeText, formatLocalDateTime, labelFromToken } from '../utils/format';

type AuditDetail = {
  label: string;
  value: string;
};

const auditDetails = (event: AuditEvent): AuditDetail[] =>
  [
    event.targetId
      ? { label: 'Target', value: `${event.targetKind ?? 'target'} ${event.targetId}` }
      : undefined,
    event.lockId ? { label: 'Lock', value: event.lockId } : undefined,
    event.data.operation ? { label: 'Operation', value: String(event.data.operation) } : undefined,
    event.data.error ? { label: 'Error', value: String(event.data.error) } : undefined,
    event.data.reason ? { label: 'Reason', value: String(event.data.reason) } : undefined,
  ].filter((detail): detail is AuditDetail => Boolean(detail));

const formatAuditTimestamp = (value: string): { date: string; time: string } => {
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date),
  };
};

const renderAuditDetails = (event: AuditEvent): string => {
  const details = auditDetails(event);

  if (details.length === 0) {
    return '';
  }

  return `
    <dl class="audit-details">
      ${details
        .map(
          (detail) => `
            <div class="audit-detail">
              <dt>${escapeText(detail.label)}</dt>
              <dd>${escapeText(detail.value)}</dd>
            </div>
          `,
        )
        .join('')}
    </dl>
  `;
};

export const renderAuditTimeline = (events: AuditEvent[]): string => {
  const rows = events
    .map((event) => {
      const createdAt = formatLocalDateTime(event.createdAt);
      const timestamp = formatAuditTimestamp(event.createdAt);
      const details = auditDetails(event);
      const summary = [
        labelFromToken(event.kind),
        createdAt,
        event.actor,
        event.message,
        ...details.map((detail) => `${detail.label} ${detail.value}`),
      ].join(' · ');

      return `
        <li class="audit-row" aria-label="${escapeAttr(summary)}">
          <time class="audit-time" datetime="${escapeAttr(event.createdAt)}" title="${escapeAttr(createdAt)}">
            <span class="audit-date">${escapeText(timestamp.date)}</span>
            <span class="audit-clock">${escapeText(timestamp.time)}</span>
          </time>
          <div class="audit-row-body">
            <div class="audit-row-header">
              <strong class="audit-kind">${labelFromToken(event.kind)}</strong>
              <span class="audit-actor">${escapeText(event.actor)}</span>
            </div>
            <p class="audit-message">${escapeText(event.message)}</p>
            ${renderAuditDetails(event)}
          </div>
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
