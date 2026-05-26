import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { AuditEvent } from '../../shared/schema';
import { appendAuditEvent, getAuditEvent, listAuditEvents } from './audit';
import { keys } from './keys';

const event = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'audit-1',
  kind: 'lock_created',
  subreddit: 'alpha',
  targetId: 't3_alpha',
  targetKind: 'post',
  lockId: 'lock-1',
  actor: 'mod',
  createdAt: '2026-05-24T00:00:00.000Z',
  message: 'Locked.',
  data: {},
  demo: false,
  ...overrides,
});

describe('audit log', () => {
  it('appends and lists recent events newest first', async () => {
    const redis = new InMemoryRedisStore();
    await appendAuditEvent(redis, event({ id: 'old', createdAt: '2026-05-23T00:00:00.000Z' }));
    await appendAuditEvent(redis, event({ id: 'new', createdAt: '2026-05-24T00:00:00.000Z' }));

    expect((await listAuditEvents(redis, 'alpha')).map((entry) => entry.id)).toEqual([
      'new',
      'old',
    ]);
    expect(await getAuditEvent(redis, 'alpha', 'new')).toMatchObject({ message: 'Locked.' });
  });

  it('skips valid-shaped audit records stored under the wrong namespace key', async () => {
    const redis = new InMemoryRedisStore();
    await appendAuditEvent(redis, event({ id: 'good' }));
    await redis.set(
      keys.auditEvent('alpha', 'cross-namespace'),
      JSON.stringify(event({ id: 'cross-namespace', subreddit: 'beta', targetId: 't3_beta' })),
    );
    await redis.set(
      keys.auditEvent('alpha', 'wrong-id'),
      JSON.stringify(event({ id: 'other-id', targetId: 't3_wrong_id' })),
    );
    await redis.zAdd(keys.audit('alpha'), {
      member: 'cross-namespace',
      score: Date.parse('2026-05-24T01:00:00.000Z'),
    });
    await redis.zAdd(keys.audit('alpha'), {
      member: 'wrong-id',
      score: Date.parse('2026-05-24T02:00:00.000Z'),
    });

    expect(await getAuditEvent(redis, 'alpha', 'cross-namespace')).toBeUndefined();
    expect(await getAuditEvent(redis, 'alpha', 'wrong-id')).toBeUndefined();
    expect((await listAuditEvents(redis, 'alpha')).map((entry) => entry.id)).toEqual(['good']);
  });

  it('skips malformed audit event records', async () => {
    const redis = new InMemoryRedisStore();
    await appendAuditEvent(redis, event({ id: 'good' }));
    await redis.set(keys.auditEvent('alpha', 'bad'), '{');
    await redis.set(
      keys.auditEvent('alpha', 'wrong-shape'),
      JSON.stringify({ kind: 'lock_created' }),
    );
    await redis.set(
      keys.auditEvent('alpha', 'bad-date'),
      JSON.stringify(event({ id: 'bad-date', createdAt: '2026-05-24T00:00:00Z' })),
    );
    await redis.zAdd(keys.audit('alpha'), {
      member: 'bad',
      score: Date.parse('2026-05-24T01:00:00.000Z'),
    });
    await redis.zAdd(keys.audit('alpha'), {
      member: 'wrong-shape',
      score: Date.parse('2026-05-24T02:00:00.000Z'),
    });
    await redis.zAdd(keys.audit('alpha'), {
      member: 'bad-date',
      score: Date.parse('2026-05-24T03:00:00.000Z'),
    });

    expect(await getAuditEvent(redis, 'alpha', 'bad')).toBeUndefined();
    expect(await getAuditEvent(redis, 'alpha', 'wrong-shape')).toBeUndefined();
    expect(await getAuditEvent(redis, 'alpha', 'bad-date')).toBeUndefined();
    expect((await listAuditEvents(redis, 'alpha')).map((entry) => entry.id)).toEqual(['good']);
  });
});
