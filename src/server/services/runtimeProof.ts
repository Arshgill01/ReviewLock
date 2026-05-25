import type { RedisStore } from '../adapters/redis';
import type {
  AuditEvent,
  RuntimeCapabilityStatus,
  RuntimeProofCapability,
  RuntimeProofStatus,
} from '../../shared/schema';
import { RUNTIME_CAPABILITY_STATUSES } from '../../shared/constants';
import type { ModerationOperationResult } from './moderation';
import { keys } from './keys';
import { listAuditEvents } from './audit';

const defaultCapabilityNames = [
  'approve',
  'ignoreReports',
  'unignoreReports',
  'redditContext',
  'redis',
  'postReportTrigger',
  'commentReportTrigger',
  'postUpdateTrigger',
  'commentUpdateTrigger',
  'postNsfwUpdateTrigger',
  'postSpoilerUpdateTrigger',
  'postFlairUpdateTrigger',
];

const parseJson = <T>(value: string | undefined): T | undefined => {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRuntimeCapabilityStatus = (value: unknown): value is RuntimeCapabilityStatus =>
  typeof value === 'string' &&
  RUNTIME_CAPABILITY_STATUSES.includes(value as RuntimeCapabilityStatus);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isRuntimeProofCapability = (value: unknown): value is RuntimeProofCapability => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === 'string' &&
    isRuntimeCapabilityStatus(value.status) &&
    isStringArray(value.notes) &&
    (value.checkedAt === undefined || typeof value.checkedAt === 'string') &&
    (value.evidence === undefined || typeof value.evidence === 'string')
  );
};

const isRuntimeProofStatus = (value: unknown): value is RuntimeProofStatus => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRuntimeCapabilityStatus(value.overall) &&
    typeof value.generatedAt === 'string' &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every(isRuntimeProofCapability) &&
    isStringArray(value.warnings)
  );
};

const defaultRuntimeStatus = (now: string): RuntimeProofStatus => ({
  overall: 'unverified',
  generatedAt: now,
  capabilities: defaultCapabilityNames.map((name) => ({
    name,
    status: 'unverified',
    notes: [],
  })),
  warnings: ['Runtime capabilities have not been playtested yet.'],
});

const rank: Record<RuntimeCapabilityStatus, number> = {
  verified: 0,
  not_supported: 1,
  unverified: 2,
  failed: 3,
};

const summarizeOverall = (capabilities: RuntimeProofCapability[]): RuntimeCapabilityStatus => {
  const worst = capabilities.reduce<RuntimeCapabilityStatus>(
    (current, capability) =>
      rank[capability.status] > rank[current] ? capability.status : current,
    'verified',
  );

  return worst;
};

const warningsForCapabilities = (
  existingWarnings: string[],
  capabilities: RuntimeProofCapability[],
): string[] => {
  const genericWarning =
    capabilities.some((entry) => entry.status !== 'verified')
      ? 'Some runtime capabilities are not verified.'
      : undefined;
  const preservedWarnings = existingWarnings.filter(
    (warning) =>
      warning !== 'Some runtime capabilities are not verified.' &&
      warning !== 'Runtime capabilities have not been playtested yet.',
  );

  return genericWarning && !preservedWarnings.includes(genericWarning)
    ? [...preservedWarnings, genericWarning]
    : preservedWarnings;
};

const normalizeRuntimeProofStatus = (status: RuntimeProofStatus): RuntimeProofStatus => {
  const withoutLegacy = status.capabilities.filter((entry) => entry.name !== 'triggers');
  const existingNames = new Set(withoutLegacy.map((entry) => entry.name));
  const missingDefaults: RuntimeProofCapability[] = defaultCapabilityNames
    .filter((name) => !existingNames.has(name))
    .map((name) => ({
      name,
      status: 'unverified',
      notes: [],
    }));
  const capabilities = [...withoutLegacy, ...missingDefaults].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  return {
    ...status,
    capabilities,
    overall: summarizeOverall(capabilities),
    warnings: warningsForCapabilities(status.warnings, capabilities),
  };
};

const capabilityFromReportAudit = (event: AuditEvent): RuntimeProofCapability | undefined => {
  if (event.kind !== 'report_suppressed' || event.demo) {
    return undefined;
  }

  if (event.targetKind !== 'post' && event.targetKind !== 'comment') {
    return undefined;
  }

  return {
    name: event.targetKind === 'post' ? 'postReportTrigger' : 'commentReportTrigger',
    status: 'verified',
    checkedAt: event.createdAt,
    evidence: `report_suppressed audit ${event.id}`,
    notes: [
      `${event.targetKind} report trigger verified by durable suppression audit for ${event.targetId}.`,
    ],
  };
};

const reconcileAuditEvidence = async (
  redis: RedisStore,
  subreddit: string,
  status: RuntimeProofStatus,
): Promise<RuntimeProofStatus> => {
  let events: AuditEvent[];

  try {
    events = await listAuditEvents(redis, subreddit);
  } catch {
    return status;
  }

  const derived = new Map<string, RuntimeProofCapability>();

  for (const event of events) {
    const capability = capabilityFromReportAudit(event);

    if (capability && !derived.has(capability.name)) {
      derived.set(capability.name, capability);
    }
  }

  if (derived.size === 0) {
    return status;
  }

  const capabilities = status.capabilities
    .map((capability) => {
      const auditCapability = derived.get(capability.name);

      return auditCapability && capability.status === 'unverified'
        ? auditCapability
        : capability;
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    ...status,
    capabilities,
    overall: summarizeOverall(capabilities),
    warnings: warningsForCapabilities(status.warnings, capabilities),
  };
};

export const loadRuntimeProofStatus = async (
  redis: RedisStore,
  subreddit: string,
  now = new Date().toISOString(),
): Promise<RuntimeProofStatus> => {
  const parsed = parseJson<unknown>(await redis.get(keys.runtime(subreddit)));
  const status = isRuntimeProofStatus(parsed)
    ? normalizeRuntimeProofStatus(parsed)
    : defaultRuntimeStatus(now);

  return reconcileAuditEvidence(redis, subreddit, status);
};

export const saveRuntimeProofStatus = async (
  redis: RedisStore,
  subreddit: string,
  status: RuntimeProofStatus,
): Promise<RuntimeProofStatus> => {
  await redis.set(keys.runtime(subreddit), JSON.stringify(status));
  return status;
};

export const recordCapabilityStatus = async (
  redis: RedisStore,
  subreddit: string,
  capability: Omit<RuntimeProofCapability, 'notes'> & { notes?: string[] },
  now = new Date().toISOString(),
): Promise<RuntimeProofStatus> => {
  const current = await loadRuntimeProofStatus(redis, subreddit, now);
  const nextCapability: RuntimeProofCapability = {
    notes: [],
    ...capability,
    checkedAt: capability.checkedAt ?? now,
  };
  const withoutCapability = current.capabilities.filter((entry) => entry.name !== capability.name);
  const capabilities = [...withoutCapability, nextCapability].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const next: RuntimeProofStatus = {
    ...current,
    generatedAt: now,
    capabilities,
    overall: summarizeOverall(capabilities),
    warnings: warningsForCapabilities(current.warnings, capabilities),
  };

  return saveRuntimeProofStatus(redis, subreddit, next);
};

export const recordModerationOperationStatus = (
  redis: RedisStore,
  subreddit: string,
  result: ModerationOperationResult,
  now = new Date().toISOString(),
): Promise<RuntimeProofStatus> =>
  recordCapabilityStatus(
    redis,
    subreddit,
    {
      name: result.operation,
      status: result.ok ? 'verified' : 'failed',
      checkedAt: now,
      evidence: `${result.operation} on ${result.targetId}`,
      notes: result.ok
        ? [`${result.operation} succeeded for ${result.targetId}.`]
        : [
            `${result.operation} failed for ${result.targetId}: ${result.errorMessage ?? 'unknown error'}.`,
          ],
    },
    now,
  );
