import { describe, expect, it } from 'vitest';
import { InMemoryRedisStore } from '../adapters/redis';
import type { AuditEvent } from '../../shared/schema';
import { appendAuditEvent, getAuditEvent, listAuditEvents } from './audit';

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

    expect((await listAuditEvents(redis, 'alpha')).map((entry) => entry.id)).toEqual(['new', 'old']);
    expect(await getAuditEvent(redis, 'alpha', 'new')).toMatchObject({ message: 'Locked.' });
  });
});
