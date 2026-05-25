import { randomUUID } from 'node:crypto';
import type { RedisStore } from '../adapters/redis';
import type { ReviewLockTarget } from '../../shared/schema';
import { fingerprintTarget } from './fingerprint';
import { key } from './keys';

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

const parseBinding = (value: string | undefined): ReviewLockFormBinding | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as ReviewLockFormBinding;
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
  const reviewedFingerprint =
    action === 'lock' ? fingerprintTarget(target, createdAt) : undefined;
  const binding: ReviewLockFormBinding = {
    token: `form-${action}-${randomUUID()}`,
    action,
    subreddit: target.subreddit,
    targetId: target.id,
    lockId,
    reviewedContentHash: reviewedFingerprint?.hash,
    reviewedFingerprintVersion: reviewedFingerprint?.version,
    createdAt,
  };

  await redis.set(formBindingKey(binding.subreddit, binding.token), JSON.stringify(binding));
  await redis.expire(formBindingKey(binding.subreddit, binding.token), 600);

  return binding;
};

export const consumeFormBinding = async (
  redis: RedisStore,
  subreddit: string,
  token: string,
): Promise<ReviewLockFormBinding | undefined> => {
  const binding = parseBinding(await redis.get(formBindingKey(subreddit, token)));

  if (binding) {
    await redis.del(formBindingKey(subreddit, token));
  }

  return binding;
};
