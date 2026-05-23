import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import { defaultConfig, loadConfig, saveConfig, updateConfig } from './config';

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
});
