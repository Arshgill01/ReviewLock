import type { RuntimeCapabilityStatus, RuntimeProofStatus } from '../../shared/schema';
import { escapeText, labelFromToken } from '../utils/format';

const statusLabel = (status: RuntimeCapabilityStatus): string => labelFromToken(status);
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
          <span>${escapeText(capability.name)}</span>
          <span class="status status-${statusClass(capability.status)}">${escapeText(statusLabel(capability.status))}</span>
        </li>
      `,
    )
    .join('');

  const warnings = status.warnings.map((warning) => `<li>${escapeText(warning)}</li>`).join('');

  return `
    <section class="panel panel-tight">
      <div class="panel-heading">
        <h2>Runtime proof/status</h2>
        <div class="panel-actions">
          <span class="status status-${statusClass(status.overall)}">${escapeText(statusLabel(status.overall))}</span>
          <button class="button button-secondary" data-action="verify-runtime" ${isVerifying ? 'disabled' : ''}>${verifyLabel}</button>
        </div>
      </div>
      ${
        verificationMessage
          ? `<p class="runtime-note runtime-note-success">${escapeText(verificationMessage)}</p>`
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
