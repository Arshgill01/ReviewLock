import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import { defaultConfig, loadConfig, saveConfig, updateConfig } from './config';
import { keys } from './keys';

describe('config persistence', () => {
  it('loads defaults for missing config', async () => {
    const redis = new InMemoryRedisStore();

    expect(await loadConfig(redis, 'alpha')).toMatchObject({
      subreddit: 'alpha',
      demoModeEnabled: false,
    });
  });

  it('saves and merges config updates', async () => {
    const redis = new InMemoryRedisStore();
    await saveConfig(redis, defaultConfig('alpha', '2026-05-24T00:00:00.000Z'));
    await updateConfig(redis, 'alpha', { demoModeEnabled: true }, '2026-05-24T01:00:00.000Z');

    expect(await loadConfig(redis, 'alpha')).toMatchObject({
      demoModeEnabled: true,
      updatedAt: '2026-05-24T01:00:00.000Z',
    });
  });

  it('loads defaults for malformed config records', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(keys.config('alpha'), '{');

    expect(await loadConfig(redis, 'alpha')).toMatchObject({
      subreddit: 'alpha',
      demoModeEnabled: false,
    });
  });

  it('loads defaults for valid JSON with malformed config shape', async () => {
    const redis = new InMemoryRedisStore();

    for (const malformed of [
      {},
      {
        subreddit: 'alpha',
        lockExpiryDays: 'forever',
        demoModeEnabled: false,
        reasonPresets: ['reviewed_policy_compliant'],
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
      {
        subreddit: 'alpha',
        lockExpiryDays: 0,
        demoModeEnabled: false,
        reasonPresets: ['reviewed_policy_compliant'],
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
      {
        subreddit: 'alpha',
        lockExpiryDays: 30,
        demoModeEnabled: false,
        reasonPresets: ['unexpected_reason'],
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
    ]) {
      await redis.set(keys.config('alpha'), JSON.stringify(malformed));

      await expect(loadConfig(redis, 'alpha')).resolves.toMatchObject({
        subreddit: 'alpha',
        lockExpiryDays: 30,
        demoModeEnabled: false,
      });
    }
  });

  it('loads defaults when config belongs to another subreddit', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(
      keys.config('alpha'),
      JSON.stringify({
        ...defaultConfig('beta', '2026-05-24T00:00:00.000Z'),
        demoModeEnabled: true,
      }),
    );

    await expect(loadConfig(redis, 'alpha')).resolves.toMatchObject({
      subreddit: 'alpha',
      demoModeEnabled: false,
    });
  });

  it('rejects invalid config writes', async () => {
    const redis = new InMemoryRedisStore();

    await expect(
      saveConfig(redis, {
        ...defaultConfig('alpha', '2026-05-24T00:00:00.000Z'),
        lockExpiryDays: 0,
      }),
    ).rejects.toThrow('Invalid ReviewLock config.');
    await expect(redis.get(keys.config('alpha'))).resolves.toBeUndefined();
  });
});
