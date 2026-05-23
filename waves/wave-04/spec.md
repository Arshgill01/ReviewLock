# Wave 04 - Redis Store and Indexes

## Goal

Implement ReviewLock persistence with namespaced Redis keys, lock indexes, reopen queue, audit log, metrics, and config storage.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Wave 02 should be complete. Wave 03 is not required.

## Write ownership

This wave may create or edit:

- `src/server/adapters/redis.ts`
- `src/server/adapters/redis.test.ts`
- `src/server/services/keys.ts`
- `src/server/services/keys.test.ts`
- `src/server/services/locks.ts`
- `src/server/services/locks.test.ts`
- `src/server/services/reopenQueue.ts`
- `src/server/services/reopenQueue.test.ts`
- `src/server/services/audit.ts`
- `src/server/services/audit.test.ts`
- `src/server/services/metrics.ts`
- `src/server/services/metrics.test.ts`
- `src/server/services/config.ts`
- `src/server/services/config.test.ts`

Append-only allowed:

- `RESEARCH.md`
- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Create a small Redis adapter interface so services can be tested with an in-memory fake.
2. Implement `key(subreddit, suffix)` exactly as `reviewlock:${subreddit}:${suffix}`.
3. Implement active lock persistence:
   - save lock
   - get by lock id
   - get active lock by target id
   - update lock status
   - list active locks newest first
4. Implement indexes:
   - `locks:active` sorted by locked time
   - `locks:activeByTarget` or target pointer keys
   - target pointer `target:{thingId}:lock`
5. Implement reopen queue:
   - enqueue event
   - get event
   - list open events newest first
   - dismiss event
6. Implement audit:
   - append event
   - get event
   - list recent events
7. Implement metrics:
   - increment suppressed report count
   - increment reopened count
   - aggregate daily metrics
   - aggregate per-target metrics
8. Implement config:
   - load defaults
   - save subreddit config
   - merge partial updates
9. Tests must use in-memory fake adapter and cover:
   - all key names
   - namespace isolation across subreddits
   - idempotent save/update where possible
   - missing keys
   - list ordering
   - metrics increments

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/adapters/redis.test.ts src/server/services/keys.test.ts src/server/services/locks.test.ts src/server/services/reopenQueue.test.ts src/server/services/audit.test.ts src/server/services/metrics.test.ts src/server/services/config.test.ts
npm run lint
```

## Acceptance

- No hardcoded subreddit names except demo fixtures.
- No unnamespaced Redis keys.
- Services are testable without Devvit runtime.
- `TODO.md` marks Wave 04 complete.
- All changes are committed.

## Commit

```txt
feat: add reviewlock redis persistence
```

