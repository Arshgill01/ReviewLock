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

const formBindingContextSuffix = (
  action: FormBindingAction,
  targetId: string,
  createdAt: string,
): string => `form-context:${action}:${targetId}:${createdAt}`;

const formBindingContextKey = (
  subreddit: string,
  action: FormBindingAction,
  targetId: string,
  createdAt: string,
): string => key(subreddit, formBindingContextSuffix(action, targetId, createdAt));

const formBindingContextConsumeKey = (
  subreddit: string,
  action: FormBindingAction,
  targetId: string,
  createdAt: string,
): string => `${formBindingContextKey(subreddit, action, targetId, createdAt)}:consume`;

const FORM_BINDING_CONSUME_LEASE_SECONDS = 30;
const FORM_BINDING_TTL_SECONDS = 600;
const FORM_BINDING_CONTEXT_ATTEMPTS = 10;

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

const shiftedIsoTimestamp = (value: string, offsetMilliseconds: number): string => {
  if (offsetMilliseconds === 0) {
    return value;
  }

  const milliseconds = Date.parse(value);

  if (Number.isNaN(milliseconds)) {
    return value;
  }

  return new Date(milliseconds + offsetMilliseconds).toISOString();
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

  for (let attempt = 0; attempt < FORM_BINDING_CONTEXT_ATTEMPTS; attempt += 1) {
    const bindingCreatedAt = shiftedIsoTimestamp(createdAt, attempt);
    const reviewedFingerprint =
      action === 'lock' ? fingerprintTarget(canonicalTarget, bindingCreatedAt) : undefined;
    const binding: ReviewLockFormBinding = {
      token: `form-${action}-${randomUUID()}`,
      action,
      subreddit: canonicalTarget.subreddit,
      targetId: canonicalTarget.id,
      lockId,
      reviewedContentHash: reviewedFingerprint?.hash,
      reviewedFingerprintVersion: reviewedFingerprint?.version,
      createdAt: bindingCreatedAt,
    };

    const bindingKey = formBindingKey(binding.subreddit, binding.token);
    const contextKey = formBindingContextKey(
      binding.subreddit,
      binding.action,
      binding.targetId,
      binding.createdAt,
    );
    let bindingWritten = false;
    let contextReserved = false;

    try {
      await redis.set(bindingKey, JSON.stringify(binding));
      bindingWritten = true;

      contextReserved = await redis.setIfNotExists(contextKey, binding.token);

      if (!contextReserved) {
        await redis.del(bindingKey).catch(() => undefined);
        continue;
      }

      await redis.expire(bindingKey, FORM_BINDING_TTL_SECONDS);
      await redis.expire(contextKey, FORM_BINDING_TTL_SECONDS);

      return binding;
    } catch (error) {
      if (bindingWritten) {
        await redis.del(bindingKey).catch(() => undefined);
      }

      if (contextReserved) {
        const storedToken = await redis.get(contextKey).catch(() => undefined);

        if (storedToken === binding.token) {
          await redis.del(contextKey).catch(() => undefined);
        }
      }

      throw error;
    }
  }

  throw new Error('ReviewLock could not reserve a unique form confirmation context.');
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

export const consumeFormBindingByContext = async (
  redis: RedisStore,
  subreddit: string,
  action: FormBindingAction,
  targetId: string,
  createdAt: string,
  lockId?: string,
): Promise<ReviewLockFormBinding | undefined> => {
  const contextKey = formBindingContextKey(subreddit, action, targetId, createdAt);
  const consumeKey = formBindingContextConsumeKey(subreddit, action, targetId, createdAt);
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

  try {
    const token = await redis.get(contextKey);

    if (!token) {
      return undefined;
    }

    const bindingKey = formBindingKey(subreddit, token);
    const raw = await redis.get(bindingKey);
    const binding = parseBinding(raw, subreddit, token);

    if (
      !binding ||
      binding.action !== action ||
      binding.targetId !== targetId ||
      binding.createdAt !== createdAt ||
      (lockId !== undefined && binding.lockId === undefined)
    ) {
      if (raw !== undefined) {
        await redis.del(bindingKey);
      }

      await redis.del(contextKey);
      return undefined;
    }

    if (lockId !== undefined && binding.lockId !== lockId) {
      return undefined;
    }

    if (raw !== undefined) {
      await redis.del(bindingKey);
    }

    await redis.del(contextKey);

    return binding;
  } finally {
    if ((await redis.get(consumeKey).catch(() => undefined)) === consumeToken) {
      await redis.del(consumeKey).catch(() => undefined);
    }
  }
};
