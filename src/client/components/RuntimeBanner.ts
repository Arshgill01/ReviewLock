import type { RuntimeCapabilityStatus, RuntimeProofStatus } from '../../shared/schema';

const statusLabel = (status: RuntimeCapabilityStatus): string =>
  status.replace(/_/g, ' ');

export const renderRuntimeBanner = (status: RuntimeProofStatus | null): string => {
  if (!status) {
    return `
      <section class="panel panel-tight">
        <div class="panel-heading">
          <h2>Runtime proof/status</h2>
        </div>
        <p class="empty-text">Runtime status has not loaded.</p>
      </section>
    `;
  }

  const capabilities = status.capabilities
    .map(
      (capability) => `
        <li class="capability-row">
          <span>${capability.name}</span>
          <span class="status status-${capability.status}">${statusLabel(capability.status)}</span>
        </li>
      `,
    )
    .join('');

  const warnings = status.warnings
    .map((warning) => `<li>${warning}</li>`)
    .join('');

  return `
    <section class="panel panel-tight">
      <div class="panel-heading">
        <h2>Runtime proof/status</h2>
        <span class="status status-${status.overall}">${statusLabel(status.overall)}</span>
      </div>
      <ul class="capability-list">${capabilities}</ul>
      ${
        status.warnings.length
          ? `<ul class="runtime-warnings" aria-label="Runtime warnings">${warnings}</ul>`
          : ''
      }
    </section>
  `;
};
