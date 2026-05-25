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
      capabilities: expect.arrayContaining([
        expect.objectContaining({ name: 'ignoreReports' }),
        expect.objectContaining({ name: 'redditContext', status: 'unverified' }),
        expect.objectContaining({ name: 'postReportTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'commentReportTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'commentUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postNsfwUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postSpoilerUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postFlairUpdateTrigger', status: 'unverified' }),
      ]),
    });
    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T00:00:00.000Z');
    expect(status.capabilities.map((capability) => capability.name)).not.toContain('triggers');
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
        capabilities: expect.arrayContaining([
          expect.objectContaining({ name: 'postReportTrigger', status: 'unverified' }),
          expect.objectContaining({ name: 'commentReportTrigger', status: 'unverified' }),
          expect.objectContaining({ name: 'postUpdateTrigger', status: 'unverified' }),
          expect.objectContaining({ name: 'commentUpdateTrigger', status: 'unverified' }),
          expect.objectContaining({ name: 'redditContext', status: 'unverified' }),
        ]),
        warnings: ['Runtime capabilities have not been playtested yet.'],
      });
    }
  });

  it('can verify all granular trigger capabilities without a stale broad trigger row', async () => {
    const redis = new InMemoryRedisStore();
    const triggerCapabilities = [
      'postReportTrigger',
      'commentReportTrigger',
      'postUpdateTrigger',
      'commentUpdateTrigger',
      'postNsfwUpdateTrigger',
      'postSpoilerUpdateTrigger',
      'postFlairUpdateTrigger',
    ];
    let minute = 10;

    for (const name of [
      'approve',
      'ignoreReports',
      'unignoreReports',
      'redditContext',
      'redis',
      ...triggerCapabilities,
    ]) {
      await recordCapabilityStatus(
        redis,
        'alpha',
        {
          name,
          status: 'verified',
          evidence: `${name} proof`,
        },
        `2026-05-24T00:${String(minute++).padStart(2, '0')}:00.000Z`,
      );
    }

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T01:00:00.000Z');

    expect(status.overall).toBe('verified');
    expect(status.warnings).toEqual([]);
    expect(status.capabilities.map((capability) => capability.name)).not.toContain('triggers');
    expect(status.capabilities).toEqual(
      expect.arrayContaining(
        triggerCapabilities.map((name) => expect.objectContaining({ name, status: 'verified' })),
      ),
    );
  });

  it('migrates legacy broad trigger rows into granular default rows on read', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(
      keys.runtime('alpha'),
      JSON.stringify({
        overall: 'unverified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [
          { name: 'redis', status: 'verified', notes: [] },
          { name: 'triggers', status: 'unverified', notes: ['legacy broad trigger row'] },
        ],
        warnings: ['Some runtime capabilities are not verified.'],
      }),
    );

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T01:00:00.000Z');

    expect(status.overall).toBe('unverified');
    expect(status.capabilities.map((capability) => capability.name)).not.toContain('triggers');
    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'redis', status: 'verified' }),
        expect.objectContaining({ name: 'postReportTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'commentReportTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'commentUpdateTrigger', status: 'unverified' }),
      ]),
    );
  });

  it('preserves explicit demo warnings while normalizing missing capability rows', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(
      keys.runtime('reviewlock_demo'),
      JSON.stringify({
        overall: 'unverified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [
          {
            name: 'approve',
            status: 'unverified',
            notes: ['Seeded demo data is illustrative.'],
          },
        ],
        warnings: ['Demo data only. Seeded records are not runtime proof.'],
      }),
    );

    const status = await loadRuntimeProofStatus(
      redis,
      'reviewlock_demo',
      '2026-05-24T01:00:00.000Z',
    );

    expect(status.warnings).toEqual([
      'Demo data only. Seeded records are not runtime proof.',
      'Some runtime capabilities are not verified.',
    ]);
    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'redditContext', status: 'unverified' }),
        expect.objectContaining({ name: 'postFlairUpdateTrigger', status: 'unverified' }),
      ]),
    );
  });

  it('preserves explicit warnings when recording later capability transitions', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(
      keys.runtime('reviewlock_demo'),
      JSON.stringify({
        overall: 'unverified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [
          {
            name: 'approve',
            status: 'unverified',
            notes: ['Seeded demo data is illustrative.'],
          },
        ],
        warnings: ['Demo data only. Seeded records are not runtime proof.'],
      }),
    );

    const status = await recordCapabilityStatus(
      redis,
      'reviewlock_demo',
      {
        name: 'redis',
        status: 'verified',
        evidence: 'runtime smoke',
      },
      '2026-05-24T02:00:00.000Z',
    );

    expect(status.warnings).toEqual([
      'Demo data only. Seeded records are not runtime proof.',
      'Some runtime capabilities are not verified.',
    ]);
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
