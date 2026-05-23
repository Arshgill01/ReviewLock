export interface SortedSetEntry {
  member: string;
  score: number;
}

export interface RedisStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, values: Record<string, string>): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hincrby(key: string, field: string, value: number): Promise<number>;
  zAdd(key: string, entry: SortedSetEntry): Promise<void>;
  zRange(key: string, start: number, stop: number, reverse?: boolean): Promise<SortedSetEntry[]>;
  zRem(key: string, member: string): Promise<void>;
  zIncrBy(key: string, increment: number, member: string): Promise<number>;
}

export class InMemoryRedisStore implements RedisStore {
  private readonly strings = new Map<string, string>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly sortedSets = new Map<string, Map<string, number>>();

  async get(key: string): Promise<string | undefined> {
    return this.strings.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.strings.delete(key);
    this.hashes.delete(key);
    this.sortedSets.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.strings.has(key) || this.hashes.has(key) || this.sortedSets.has(key);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key)?.entries() ?? []);
  }

  async hset(key: string, values: Record<string, string>): Promise<void> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();

    for (const [field, value] of Object.entries(values)) {
      hash.set(field, value);
    }

    this.hashes.set(key, hash);
  }

  async hdel(key: string, field: string): Promise<void> {
    this.hashes.get(key)?.delete(field);
  }

  async hincrby(key: string, field: string, value: number): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    const next = Number.parseInt(hash.get(field) ?? '0', 10) + value;
    hash.set(field, String(next));
    this.hashes.set(key, hash);
    return next;
  }

  async zAdd(key: string, entry: SortedSetEntry): Promise<void> {
    const sortedSet = this.sortedSets.get(key) ?? new Map<string, number>();
    sortedSet.set(entry.member, entry.score);
    this.sortedSets.set(key, sortedSet);
  }

  async zRange(
    key: string,
    start: number,
    stop: number,
    reverse = false,
  ): Promise<SortedSetEntry[]> {
    const sorted = [...(this.sortedSets.get(key)?.entries() ?? [])]
      .map(([member, score]) => ({ member, score }))
      .sort((left, right) => left.score - right.score);
    const ordered = reverse ? sorted.reverse() : sorted;
    const end = stop < 0 ? undefined : stop + 1;

    return ordered.slice(start, end);
  }

  async zRem(key: string, member: string): Promise<void> {
    this.sortedSets.get(key)?.delete(member);
  }

  async zIncrBy(key: string, increment: number, member: string): Promise<number> {
    const sortedSet = this.sortedSets.get(key) ?? new Map<string, number>();
    const next = (sortedSet.get(member) ?? 0) + increment;
    sortedSet.set(member, next);
    this.sortedSets.set(key, sortedSet);
    return next;
  }
}

interface DevvitRedisClient {
  get(key: string): Promise<string | undefined | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  exists(key: string): Promise<number | boolean>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, values: Record<string, string>): Promise<unknown>;
  hdel(key: string, field: string): Promise<unknown>;
  hincrby(key: string, field: string, value: number): Promise<number>;
  zAdd(key: string, entry: SortedSetEntry): Promise<unknown>;
  zRange(
    key: string,
    start: number,
    stop: number,
    options?: { reverse?: boolean },
  ): Promise<SortedSetEntry[]>;
  zRem(key: string, member: string): Promise<unknown>;
  zIncrBy(key: string, member: string, increment: number): Promise<number>;
}

export const createDevvitRedisStore = (client: DevvitRedisClient): RedisStore => ({
  async get(key) {
    return (await client.get(key)) ?? undefined;
  },
  async set(key, value) {
    await client.set(key, value);
  },
  async del(key) {
    await client.del(key);
  },
  async exists(key) {
    const result = await client.exists(key);
    return typeof result === 'boolean' ? result : result > 0;
  },
  async hgetall(key) {
    return client.hgetall(key);
  },
  async hset(key, values) {
    await client.hset(key, values);
  },
  async hdel(key, field) {
    await client.hdel(key, field);
  },
  async hincrby(key, field, value) {
    return client.hincrby(key, field, value);
  },
  async zAdd(key, entry) {
    await client.zAdd(key, entry);
  },
  async zRange(key, start, stop, reverse) {
    return client.zRange(key, start, stop, reverse ? { reverse } : undefined);
  },
  async zRem(key, member) {
    await client.zRem(key, member);
  },
  async zIncrBy(key, increment, member) {
    return client.zIncrBy(key, member, increment);
  },
});
