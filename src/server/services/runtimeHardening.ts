import type { RuntimeCapabilityStatus } from '../../shared/schema';

const subredditPattern = /^[A-Za-z0-9_]{3,21}$/;

export interface RuntimeSmokeResult {
  capability: string;
  status: RuntimeCapabilityStatus;
  checkedAt: string;
  evidence: string;
  notes: string[];
}

export const normalizeRuntimeSubreddit = (value: string | null | undefined): string => {
  const subreddit = value?.trim();

  if (!subreddit) {
    throw new Error('Subreddit context is required.');
  }

  if (!subredditPattern.test(subreddit)) {
    throw new Error('Subreddit must be 3-21 characters using letters, numbers, or underscores.');
  }

  return subreddit.toLowerCase();
};

export const verifiedSmokeResult = (
  capability: string,
  evidence: string,
  notes: string[] = [],
  checkedAt = new Date().toISOString(),
): RuntimeSmokeResult => ({
  capability,
  status: 'verified',
  checkedAt,
  evidence,
  notes,
});

export const failedSmokeResult = (
  capability: string,
  evidence: string,
  error: unknown,
  checkedAt = new Date().toISOString(),
): RuntimeSmokeResult => ({
  capability,
  status: 'failed',
  checkedAt,
  evidence,
  notes: [error instanceof Error ? error.message : String(error)],
});
