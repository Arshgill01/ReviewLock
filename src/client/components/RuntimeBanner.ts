import type { RuntimeCapabilityStatus, RuntimeProofStatus } from '../../shared/schema';

const statusLabel = (status: RuntimeCapabilityStatus): string => status.replace(/_/g, ' ');
const text = (value: string | number | undefined | null): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
const statusClass = (status: RuntimeCapabilityStatus): string =>
  status.replace(/[^a-zA-Z0-9_-]/g, '');

export const renderRuntimeBanner = (
  status: RuntimeProofStatus | null,
  verificationMessage: string | null = null,
  isVerifying: boolean = false,
): string => {
  const verifyLabel = isVerifying ? 'Verifying...' : 'Verify runtime';

  if (!status) {
    return `
      <section class="panel panel-tight">
        <div class="panel-heading">
          <h2>Runtime proof/status</h2>
          <button class="button button-secondary" data-action="verify-runtime" ${isVerifying ? 'disabled' : ''}>${verifyLabel}</button>
        </div>
        <p class="empty-text">Runtime status has not loaded.</p>
      </section>
    `;
  }

  const capabilities = status.capabilities
    .map(
      (capability) => `
        <li class="capability-row">
          <span>${text(capability.name)}</span>
          <span class="status status-${statusClass(capability.status)}">${text(statusLabel(capability.status))}</span>
        </li>
      `,
    )
    .join('');

  const warnings = status.warnings.map((warning) => `<li>${text(warning)}</li>`).join('');

  return `
    <section class="panel panel-tight">
      <div class="panel-heading">
        <h2>Runtime proof/status</h2>
        <div class="panel-actions">
          <span class="status status-${statusClass(status.overall)}">${text(statusLabel(status.overall))}</span>
          <button class="button button-secondary" data-action="verify-runtime" ${isVerifying ? 'disabled' : ''}>${verifyLabel}</button>
        </div>
      </div>
      ${
        verificationMessage
          ? `<p class="runtime-note runtime-note-success">${text(verificationMessage)}</p>`
          : ''
      }
      <ul class="capability-list">${capabilities}</ul>
      ${
        status.warnings.length
          ? `<ul class="runtime-warnings" aria-label="Runtime warnings">${warnings}</ul>`
          : ''
      }
    </section>
  `;
};
