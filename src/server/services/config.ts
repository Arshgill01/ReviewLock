import { DEFAULT_LOCK_EXPIRY_DAYS, LOCK_REASON_PRESETS } from '../../shared/constants';
import { isReviewLockConfig, type ReviewLockConfig } from '../../shared/schema';
import type { RedisStore } from '../adapters/redis';
import { keys } from './keys';

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

export const defaultConfig = (
  subreddit: string,
  now = new Date().toISOString(),
): ReviewLockConfig => ({
  subreddit,
  lockExpiryDays: DEFAULT_LOCK_EXPIRY_DAYS,
  demoModeEnabled: false,
  reasonPresets: [...LOCK_REASON_PRESETS],
  updatedAt: now,
});

export const loadConfig = async (redis: RedisStore, subreddit: string): Promise<ReviewLockConfig> => {
  const parsed = parseJson<unknown>(await redis.get(keys.config(subreddit)));

  return isReviewLockConfig(parsed) && parsed.subreddit === subreddit
    ? parsed
    : defaultConfig(subreddit);
};

export const saveConfig = async (
  redis: RedisStore,
  config: ReviewLockConfig,
): Promise<ReviewLockConfig> => {
  if (!isReviewLockConfig(config)) {
    throw new Error('Invalid ReviewLock config.');
  }

  await redis.set(keys.config(config.subreddit), JSON.stringify(config));
  return config;
};

export const updateConfig = async (
  redis: RedisStore,
  subreddit: string,
  updates: Partial<Omit<ReviewLockConfig, 'subreddit'>>,
  now = new Date().toISOString(),
): Promise<ReviewLockConfig> => {
  const current = await loadConfig(redis, subreddit);
  return saveConfig(redis, { ...current, ...updates, subreddit, updatedAt: now });
};
