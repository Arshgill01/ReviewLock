import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import {
  loadRuntimeProofStatus,
  recordCapabilityStatus,
  recordModerationOperationStatus,
} from './runtimeProof';
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

  it('loads the unverified default matrix for valid JSON with malformed runtime proof shape', async () => {
    const redis = new InMemoryRedisStore();

    for (const malformed of [
      {},
      {
        overall: 'verified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: null,
        warnings: [],
      },
      {
        overall: 'verified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [{ name: 'redis', status: 'verified' }],
        warnings: [],
      },
      {
        overall: 'verified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [{ name: 'redis', status: 'surprising', notes: [] }],
        warnings: [],
      },
    ]) {
      await redis.set(keys.runtime('alpha'), JSON.stringify(malformed));

      await expect(
        loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T00:00:00.000Z'),
      ).resolves.toMatchObject({
        overall: 'unverified',
        capabilities: expect.arrayContaining([expect.objectContaining({ name: 'triggers' })]),
        warnings: ['Runtime capabilities have not been playtested yet.'],
      });
    }
  });

  it('records moderation operation proof with target-level evidence', async () => {
    const redis = new InMemoryRedisStore();

    const status = await recordModerationOperationStatus(
      redis,
      'alpha',
      {
        ok: true,
        operation: 'ignoreReports',
        targetId: 't3_post',
        warnings: [],
      },
      '2026-05-24T03:00:00.000Z',
    );

    expect(status).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          name: 'ignoreReports',
          status: 'verified',
          evidence: 'ignoreReports on t3_post',
        }),
      ]),
    });
  });
});
