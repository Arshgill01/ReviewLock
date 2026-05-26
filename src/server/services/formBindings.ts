import { randomUUID } from 'node:crypto';
import type { RedisStore } from '../adapters/redis';
import type { ReviewLockTarget } from '../../shared/schema';
import { fingerprintTarget } from './fingerprint';
import { key } from './keys';
import { normalizeRuntimeSubreddit } from './runtimeHardening';

export type FormBindingAction = 'lock' | 'unlock';

export interface ReviewLockFormBinding {
  token: string;
  action: FormBindingAction;
  subreddit: string;
  targetId: string;
  lockId?: string;
  reviewedContentHash?: string;
  reviewedFingerprintVersion?: string;
  createdAt: string;
}

const formBindingKey = (subreddit: string, token: string): string =>
  key(subreddit, `form:${token}`);

const formBindingConsumeKey = (subreddit: string, token: string): string =>
  key(subreddit, `form:${token}:consume`);

const FORM_BINDING_CONSUME_LEASE_SECONDS = 30;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseBinding = (
  value: string | undefined,
  expectedSubreddit: string,
  expectedToken: string,
): ReviewLockFormBinding | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) {
      return undefined;
    }

    if (parsed.action !== 'lock' && parsed.action !== 'unlock') {
      return undefined;
    }

    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.subreddit !== 'string' ||
      typeof parsed.targetId !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return undefined;
    }

    if (parsed.lockId !== undefined && typeof parsed.lockId !== 'string') {
      return undefined;
    }

    if (
      parsed.reviewedContentHash !== undefined &&
      typeof parsed.reviewedContentHash !== 'string'
    ) {
      return undefined;
    }

    if (
      parsed.reviewedFingerprintVersion !== undefined &&
      typeof parsed.reviewedFingerprintVersion !== 'string'
    ) {
      return undefined;
    }

    if (parsed.subreddit !== expectedSubreddit || parsed.token !== expectedToken) {
      return undefined;
    }

    return {
      token: parsed.token,
      action: parsed.action,
      subreddit: parsed.subreddit,
      targetId: parsed.targetId,
      lockId: parsed.lockId,
      reviewedContentHash: parsed.reviewedContentHash,
      reviewedFingerprintVersion: parsed.reviewedFingerprintVersion,
      createdAt: parsed.createdAt,
    };
  } catch {
    return undefined;
  }
};

export const createFormBinding = async (
  redis: RedisStore,
  action: FormBindingAction,
  target: ReviewLockTarget,
  createdAt: string,
  lockId?: string,
): Promise<ReviewLockFormBinding> => {
  const canonicalTarget = {
    ...target,
    subreddit: normalizeRuntimeSubreddit(target.subreddit),
  };
  const reviewedFingerprint =
    action === 'lock' ? fingerprintTarget(canonicalTarget, createdAt) : undefined;
  const binding: ReviewLockFormBinding = {
    token: `form-${action}-${randomUUID()}`,
    action,
    subreddit: canonicalTarget.subreddit,
    targetId: canonicalTarget.id,
    lockId,
    reviewedContentHash: reviewedFingerprint?.hash,
    reviewedFingerprintVersion: reviewedFingerprint?.version,
    createdAt,
  };

  const bindingKey = formBindingKey(binding.subreddit, binding.token);
  await redis.set(bindingKey, JSON.stringify(binding));

  try {
    await redis.expire(bindingKey, 600);
  } catch (error) {
    await redis.del(bindingKey).catch(() => undefined);
    throw error;
  }

  return binding;
};

export const consumeFormBinding = async (
  redis: RedisStore,
  subreddit: string,
  token: string,
): Promise<ReviewLockFormBinding | undefined> => {
  const consumeKey = formBindingConsumeKey(subreddit, token);
  const consumeToken = `${Date.now()}:${Math.random()}`;
  let consumeAcquired: boolean;

  try {
    consumeAcquired = await redis.setIfNotExists(consumeKey, consumeToken);
  } catch {
    return undefined;
  }

  if (!consumeAcquired) {
    return undefined;
  }

  try {
    await redis.expire(consumeKey, FORM_BINDING_CONSUME_LEASE_SECONDS);
  } catch {
    if ((await redis.get(consumeKey).catch(() => undefined)) === consumeToken) {
      await redis.del(consumeKey).catch(() => undefined);
    }

    return undefined;
  }

  const bindingKey = formBindingKey(subreddit, token);

  try {
    const raw = await redis.get(bindingKey);
    const binding = parseBinding(raw, subreddit, token);

    if (raw !== undefined) {
      await redis.del(bindingKey);
    }

    return binding;
  } finally {
    if ((await redis.get(consumeKey).catch(() => undefined)) === consumeToken) {
      await redis.del(consumeKey).catch(() => undefined);
    }
  }
};
