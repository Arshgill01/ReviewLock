import type { RedisStore } from '../adapters/redis';
import { isAuditEvent, type AuditEvent } from '../../shared/schema';
import { keys } from './keys';

const parseJson = (value: string | undefined): unknown => {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const parseAuditEvent = (value: string | undefined): AuditEvent | undefined => {
  const parsed = parseJson(value);
  return isAuditEvent(parsed) ? parsed : undefined;
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
  parseAuditEvent(await redis.get(keys.auditEvent(subreddit, eventId)));

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
