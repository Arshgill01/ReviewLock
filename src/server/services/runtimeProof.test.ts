import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import {
  loadRuntimeProofStatus,
  recordCapabilityStatus,
  recordModerationOperationStatus,
} from './runtimeProof';
import { keys } from './keys';
import { appendAuditEvent } from './audit';

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
      {
        overall: 'verified',
        generatedAt: '2026-02-31T00:00:00.000Z',
        capabilities: [{ name: 'redis', status: 'verified', notes: [] }],
        warnings: [],
      },
      {
        overall: 'verified',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [
          {
            name: 'redis',
            status: 'verified',
            notes: [],
            checkedAt: '2026-05-24T00:00:00Z',
          },
        ],
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

  it('reconciles unverified report trigger proof from durable suppression audit evidence', async () => {
    const redis = new InMemoryRedisStore();
    await appendAuditEvent(redis, {
      id: 'audit-report-suppressed-1',
      kind: 'report_suppressed',
      subreddit: 'alpha',
      targetId: 't3_post',
      targetKind: 'post',
      lockId: 'lock-1',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:00:00.000Z',
      message: 'Repeat report suppressed because reviewed content was unchanged.',
      data: { reportCount: 1 },
      demo: false,
    });

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T02:00:00.000Z');

    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'approve', status: 'unverified' }),
        expect.objectContaining({ name: 'commentReportTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'commentUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'ignoreReports', status: 'unverified' }),
        expect.objectContaining({
          name: 'postReportTrigger',
          status: 'verified',
          checkedAt: '2026-05-24T01:00:00.000Z',
          evidence: 'report_suppressed audit audit-report-suppressed-1',
        }),
        expect.objectContaining({ name: 'postUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postFlairUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postNsfwUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postSpoilerUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'redditContext', status: 'unverified' }),
        expect.objectContaining({ name: 'redis', status: 'unverified' }),
        expect.objectContaining({ name: 'unignoreReports', status: 'unverified' }),
      ]),
    );
    expect(status.warnings).toContain('Some runtime capabilities are not verified.');
  });

  it('does not upgrade failed or demo report trigger proof from audit evidence', async () => {
    const redis = new InMemoryRedisStore();
    await recordCapabilityStatus(
      redis,
      'alpha',
      {
        name: 'postReportTrigger',
        status: 'failed',
        evidence: 'latest report proof failed',
        notes: ['latest report proof failed'],
      },
      '2026-05-24T01:00:00.000Z',
    );
    await appendAuditEvent(redis, {
      id: 'audit-report-suppressed-demo',
      kind: 'report_suppressed',
      subreddit: 'alpha',
      targetId: 't3_demo',
      targetKind: 'post',
      lockId: 'lock-demo',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:30:00.000Z',
      message: 'Repeat report suppressed because reviewed content was unchanged.',
      data: { reportCount: 1 },
      demo: true,
    });

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T02:00:00.000Z');

    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'postReportTrigger',
          status: 'failed',
          evidence: 'latest report proof failed',
        }),
        expect.objectContaining({ name: 'commentReportTrigger', status: 'unverified' }),
      ]),
    );
  });

  it('rejects malformed runtime proof writes before persistence', async () => {
    const redis = new InMemoryRedisStore();

    await expect(
      recordCapabilityStatus(
        redis,
        'alpha',
        {
          name: 'redis',
          status: 'verified',
          checkedAt: '2026-05-24T00:00:00Z',
        },
        '2026-05-24T01:00:00.000Z',
      ),
    ).rejects.toThrow('Runtime proof status is malformed.');
    await expect(redis.get(keys.runtime('alpha'))).resolves.toBeUndefined();
  });

  it('does not reconcile report trigger proof from suppression audits with missing target kind', async () => {
    const redis = new InMemoryRedisStore();
    await appendAuditEvent(redis, {
      id: 'audit-report-suppressed-missing-kind',
      kind: 'report_suppressed',
      subreddit: 'alpha',
      targetId: 't3_legacy',
      lockId: 'lock-legacy',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:00:00.000Z',
      message: 'Repeat report suppressed because reviewed content was unchanged.',
      data: { reportCount: 1 },
      demo: false,
    });

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T02:00:00.000Z');

    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'postReportTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'commentReportTrigger', status: 'unverified' }),
      ]),
    );
  });

  it('reconciles unverified update trigger proof from durable reopen audit evidence', async () => {
    const redis = new InMemoryRedisStore();
    await appendAuditEvent(redis, {
      id: 'audit-update-reopened-1',
      kind: 'lock_reopened',
      subreddit: 'alpha',
      targetId: 't3_post',
      targetKind: 'post',
      lockId: 'lock-1',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:00:00.000Z',
      message: 'Lock reopened after reviewed content changed or became uncertain.',
      data: {
        reason: 'flair_changed',
        triggerCapabilityName: 'postFlairUpdateTrigger',
        unignoreReportsOk: true,
      },
      demo: false,
    });

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T02:00:00.000Z');

    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'postFlairUpdateTrigger',
          status: 'verified',
          checkedAt: '2026-05-24T01:00:00.000Z',
          evidence: 'lock_reopened audit audit-update-reopened-1',
        }),
        expect.objectContaining({ name: 'postNsfwUpdateTrigger', status: 'unverified' }),
      ]),
    );
  });

  it('does not reconcile update trigger proof from unknown or demo reopen audits', async () => {
    const redis = new InMemoryRedisStore();
    await appendAuditEvent(redis, {
      id: 'audit-update-reopened-unknown',
      kind: 'lock_reopened',
      subreddit: 'alpha',
      targetId: 't3_post',
      targetKind: 'post',
      lockId: 'lock-1',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:00:00.000Z',
      message: 'Lock reopened after reviewed content changed or became uncertain.',
      data: { triggerCapabilityName: 'unknownTrigger' },
      demo: false,
    });
    await appendAuditEvent(redis, {
      id: 'audit-update-reopened-demo',
      kind: 'lock_reopened',
      subreddit: 'alpha',
      targetId: 't3_demo',
      targetKind: 'post',
      lockId: 'lock-demo',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:01:00.000Z',
      message: 'Lock reopened after reviewed content changed or became uncertain.',
      data: { triggerCapabilityName: 'postSpoilerUpdateTrigger' },
      demo: true,
    });
    await appendAuditEvent(redis, {
      id: 'audit-update-reopened-mismatched-reason',
      kind: 'lock_reopened',
      subreddit: 'alpha',
      targetId: 't3_mismatch',
      targetKind: 'post',
      lockId: 'lock-mismatch',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:02:00.000Z',
      message: 'Lock reopened after reviewed content changed or became uncertain.',
      data: {
        reason: 'content_changed',
        triggerCapabilityName: 'postNsfwUpdateTrigger',
      },
      demo: false,
    });
    await appendAuditEvent(redis, {
      id: 'audit-update-reopened-missing-kind',
      kind: 'lock_reopened',
      subreddit: 'alpha',
      targetId: 't3_missing_kind',
      lockId: 'lock-missing-kind',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:03:00.000Z',
      message: 'Lock reopened after reviewed content changed or became uncertain.',
      data: {
        reason: 'flair_changed',
        triggerCapabilityName: 'postFlairUpdateTrigger',
      },
      demo: false,
    });
    await appendAuditEvent(redis, {
      id: 'audit-update-reopened-mismatched-kind',
      kind: 'lock_reopened',
      subreddit: 'alpha',
      targetId: 't1_comment',
      targetKind: 'comment',
      lockId: 'lock-mismatched-kind',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:04:00.000Z',
      message: 'Lock reopened after reviewed content changed or became uncertain.',
      data: {
        reason: 'flair_changed',
        triggerCapabilityName: 'postFlairUpdateTrigger',
        unignoreReportsOk: true,
      },
      demo: false,
    });

    await appendAuditEvent(redis, {
      id: 'audit-update-reopened-unignore-failed',
      kind: 'lock_reopened',
      subreddit: 'alpha',
      targetId: 't3_unignore_failed',
      targetKind: 'post',
      lockId: 'lock-unignore-failed',
      actor: 'reviewlock',
      createdAt: '2026-05-24T01:05:00.000Z',
      message: 'Lock reopened after reviewed content changed or became uncertain.',
      data: {
        reason: 'flair_changed',
        triggerCapabilityName: 'postFlairUpdateTrigger',
        unignoreReportsOk: false,
      },
      demo: false,
    });

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T02:00:00.000Z');

    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'postFlairUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postNsfwUpdateTrigger', status: 'unverified' }),
        expect.objectContaining({ name: 'postSpoilerUpdateTrigger', status: 'unverified' }),
      ]),
    );
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

  it('drops unknown persisted capability rows before summarizing runtime proof', async () => {
    const redis = new InMemoryRedisStore();
    await redis.set(
      keys.runtime('alpha'),
      JSON.stringify({
        overall: 'failed',
        generatedAt: '2026-05-24T00:00:00.000Z',
        capabilities: [
          { name: 'redis', status: 'verified', notes: [] },
          {
            name: 'surpriseCapability',
            status: 'failed',
            notes: ['malformed persisted proof row'],
          },
        ],
        warnings: ['Some runtime capabilities are not verified.'],
      }),
    );

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T01:00:00.000Z');

    expect(status.capabilities.map((capability) => capability.name)).not.toContain(
      'surpriseCapability',
    );
    expect(status.overall).toBe('unverified');
    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'redis', status: 'verified' }),
        expect.objectContaining({ name: 'postReportTrigger', status: 'unverified' }),
      ]),
    );
  });

  it('rejects attempts to record unknown runtime proof capabilities', async () => {
    const redis = new InMemoryRedisStore();

    await expect(
      recordCapabilityStatus(
        redis,
        'alpha',
        {
          name: 'surpriseCapability',
          status: 'verified',
          evidence: 'unexpected proof row',
        },
        '2026-05-24T01:00:00.000Z',
      ),
    ).rejects.toThrow('Unknown runtime proof capability: surpriseCapability');

    const status = await loadRuntimeProofStatus(redis, 'alpha', '2026-05-24T02:00:00.000Z');
    expect(status.capabilities.map((capability) => capability.name)).not.toContain(
      'surpriseCapability',
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
