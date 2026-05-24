import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import { loadRuntimeProofStatus, recordCapabilityStatus } from './runtimeProof';
import { keys } from './keys';

describe('runtime proof status', () => {
  it('loads an unverified default matrix', async () => {
    const redis = new InMemoryRedisStore();

    expect(await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T00:00:00.000Z')).toMatchObject({
      overall: 'unverified',
      capabilities: expect.arrayContaining([expect.objectContaining({ name: 'ignoreReports' })]),
    });
  });

  it('records capability transitions and keeps failed status visible', async () => {
    const redis = new InMemoryRedisStore();

    await recordCapabilityStatus(
      redis,
      'alpha',
      {
        name: 'ignoreReports',
        status: 'verified',
        evidence: 'playtest command',
      },
      '2026-05-24T01:00:00.000Z',
    );
    const failed = await recordCapabilityStatus(
      redis,
      'alpha',
      {
        name: 'unignoreReports',
        status: 'failed',
        evidence: 'playtest command',
        notes: ['returned API error'],
      },
      '2026-05-24T02:00:00.000Z',
    );

    expect(failed.overall).toBe('failed');
    expect(failed.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'unignoreReports', status: 'failed' }),
      ]),
    );
  });

  it('loads the unverified default matrix for malformed runtime proof records', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(keys.runtime('alpha'), '{');

    expect(await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T00:00:00.000Z')).toMatchObject({
      overall: 'unverified',
      capabilities: expect.arrayContaining([expect.objectContaining({ name: 'redis' })]),
    });
  });
});
