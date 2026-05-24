import type { RedisStore } from '../adapters/redis';
import type {
  RuntimeCapabilityStatus,
  RuntimeProofCapability,
  RuntimeProofStatus,
} from '../../shared/schema';
import { RUNTIME_CAPABILITY_STATUSES } from '../../shared/constants';
import type { ModerationOperationResult } from './moderation';
import { keys } from './keys';

const defaultCapabilityNames = ['approve', 'ignoreReports', 'unignoreReports', 'redis', 'triggers'];

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

export const loadRuntimeProofStatus = async (
  redis: RedisStore,
  subreddit: string,
  now = new Date().toISOString(),
): Promise<RuntimeProofStatus> => {
  const parsed = parseJson<unknown>(await redis.get(keys.runtime(subreddit)));

  return isRuntimeProofStatus(parsed) ? parsed : defaultRuntimeStatus(now);
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
    warnings: capabilities.some((entry) => entry.status !== 'verified')
      ? ['Some runtime capabilities are not verified.']
      : [],
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
