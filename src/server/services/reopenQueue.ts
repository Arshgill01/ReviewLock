import type { RedisStore } from '../adapters/redis';
import type { ReopenEvent } from '../../shared/schema';
import { keys } from './keys';

const parseJson = <T>(value: string | undefined): T | undefined =>
  value === undefined ? undefined : (JSON.parse(value) as T);

export const enqueueReopenEvent = async (
  redis: RedisStore,
  event: ReopenEvent,
): Promise<ReopenEvent> => {
  await redis.set(keys.reopenEvent(event.subreddit, event.id), JSON.stringify(event));

  if (!event.dismissedAt) {
    await redis.zAdd(keys.reopenQueue(event.subreddit), {
      member: event.id,
      score: Date.parse(event.createdAt),
    });
  }

  return event;
};

export const getReopenEvent = async (
  redis: RedisStore,
  subreddit: string,
  eventId: string,
): Promise<ReopenEvent | undefined> => parseJson(await redis.get(keys.reopenEvent(subreddit, eventId)));

export const listOpenReopenEvents = async (
  redis: RedisStore,
  subreddit: string,
  limit = 50,
): Promise<ReopenEvent[]> => {
  const entries = await redis.zRange(keys.reopenQueue(subreddit), 0, Math.max(0, limit - 1), true);
  const events = await Promise.all(entries.map((entry) => getReopenEvent(redis, subreddit, entry.member)));

  return events.filter((event): event is ReopenEvent => event !== undefined && !event.dismissedAt);
};

export const dismissReopenEvent = async (
  redis: RedisStore,
  subreddit: string,
  eventId: string,
  dismissedAt: string,
  dismissedBy: string,
): Promise<ReopenEvent | undefined> => {
  const event = await getReopenEvent(redis, subreddit, eventId);

  if (!event) {
    return undefined;
  }

  const dismissed = { ...event, dismissedAt, dismissedBy };
  await redis.set(keys.reopenEvent(subreddit, eventId), JSON.stringify(dismissed));
  await redis.zRem(keys.reopenQueue(subreddit), eventId);

  return dismissed;
};
