import type { RedisStore } from '../adapters/redis';
import { isReopenEvent, type ReopenEvent } from '../../shared/schema';
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

const parseReopenEvent = (
  value: string | undefined,
  expectedSubreddit: string,
  expectedEventId: string,
): ReopenEvent | undefined => {
  const parsed = parseJson(value);
  if (!isReopenEvent(parsed)) {
    return undefined;
  }

  return parsed.subreddit === expectedSubreddit && parsed.id === expectedEventId ? parsed : undefined;
};

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
): Promise<ReopenEvent | undefined> =>
  parseReopenEvent(await redis.get(keys.reopenEvent(subreddit, eventId)), subreddit, eventId);

export const listOpenReopenEvents = async (
  redis: RedisStore,
  subreddit: string,
  limit = 50,
): Promise<ReopenEvent[]> => {
  const entries = await redis.zRange(keys.reopenQueue(subreddit), 0, Math.max(0, limit - 1), true);
  const events = await Promise.all(
    entries.map((entry) => getReopenEvent(redis, subreddit, entry.member)),
  );

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
  await redis.zRem(keys.reopenQueue(subreddit), eventId);

  try {
    await redis.set(keys.reopenEvent(subreddit, eventId), JSON.stringify(dismissed));
  } catch (error) {
    await redis.zAdd(keys.reopenQueue(subreddit), {
      member: event.id,
      score: Date.parse(event.createdAt),
    }).catch(() => undefined);
    throw error;
  }

  return dismissed;
};
