import type { RedisStore } from '../adapters/redis';
import type { AuditEvent } from '../../shared/schema';
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

export const appendAuditEvent = async (
  redis: RedisStore,
  event: AuditEvent,
): Promise<AuditEvent> => {
  await redis.set(keys.auditEvent(event.subreddit, event.id), JSON.stringify(event));
  await redis.zAdd(keys.audit(event.subreddit), {
    member: event.id,
    score: Date.parse(event.createdAt),
  });
  return event;
};

export const getAuditEvent = async (
  redis: RedisStore,
  subreddit: string,
  eventId: string,
): Promise<AuditEvent | undefined> =>
  parseJson(await redis.get(keys.auditEvent(subreddit, eventId)));

export const listAuditEvents = async (
  redis: RedisStore,
  subreddit: string,
  limit = 100,
): Promise<AuditEvent[]> => {
  const entries = await redis.zRange(keys.audit(subreddit), 0, Math.max(0, limit - 1), true);
  const events = await Promise.all(
    entries.map((entry) => getAuditEvent(redis, subreddit, entry.member)),
  );

  return events.filter((event): event is AuditEvent => event !== undefined);
};
