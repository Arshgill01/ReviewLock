# Redis Failure and Race Proof

Wave 17 verifies that ReviewLock fails honestly when Redis writes fail and remains idempotent when duplicate or concurrent trigger deliveries target the same reviewed item.

## Behaviors Proven

### Lock Creation Redis Failure

- Test: `src/server/services/lockFlow.test.ts`
- Scenario: `approve()` succeeds, `ignoreReports()` succeeds, then Redis persistence throws.
- Expected result:
  - The lock flow returns `ok: false`.
  - The result carries `redis_write_failed`.
  - ReviewLock attempts `unignoreReports()` to roll back the moderation-side lock.
  - The moderator is not told the item was locked.

### Duplicate Report Deliveries

- Test: `src/server/services/reportTriggers.test.ts`
- Test: `src/server/services/triggerMutex.test.ts`
- Scenario: two report trigger deliveries with the same event id arrive concurrently.
- Expected result:
  - One delivery suppresses unchanged reviewed content.
  - The other delivery exits as a duplicate or concurrent no-op.
  - `ignoreReports()` is called once.
  - Suppressed report metrics increment once.
  - One audit event is written.

### Redis Failure After Report Suppression

- Test: `src/server/services/reportTriggers.test.ts`
- Scenario: `ignoreReports()` succeeds, then Redis lock persistence fails while recording the suppression.
- Expected result:
  - The report trigger returns `runtime_uncertain`.
  - The result carries `redis_write_failed`.
  - ReviewLock attempts `unignoreReports()` because the durable lock/suppression ledger was not updated.
  - Suppression metrics are not silently claimed as successful.

### Report/Update Reopen Race

- Test: `src/server/services/reopenFlow.test.ts`
- Scenario: a report trigger and an update trigger both observe the same changed locked item.
- Expected result:
  - Exactly one path reopens the lock.
  - The other path exits idempotently as a duplicate/concurrent no-op or sees no active lock.
  - `unignoreReports()` is called once.
  - One reopen queue event exists.
  - Daily and target reopen metrics increment once.
  - No contradictory active/reopened state remains.

## Implementation Notes

- Trigger critical sections are protected by a per-subreddit, per-target Redis mutex key:
  `reviewlock:{subreddit}:trigger:mutex:{targetId}`.
- The mutex is acquired with Redis NX semantics through `RedisStore.setIfNotExists()`.
- The mutex key receives a short TTL through `expire()` and is also deleted by token match after the operation.
- If acquiring the mutex fails, the trigger returns an idempotent no-op result instead of retrying inside the same delivery.
- If the TTL call itself fails, the operation continues and the finally block still attempts token-checked cleanup.
- The in-memory Redis store implements `setIfNotExists()` without an await boundary so concurrent unit tests exercise Redis-like atomic NX behavior.
- Mutex behavior is covered directly by `src/server/services/triggerMutex.test.ts`.

## Verification Commands

Focused checks run during implementation:

```bash
npm run type-check
npm run test -- --run src/server/adapters/redis.test.ts src/server/services/lockFlow.test.ts src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/server/services/triggerMutex.test.ts
```

Wave completion requires the full gate:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

## Remaining Runtime Risk

The race guarantees are locally verified against the Redis adapter contract and fake Reddit adapter. Live Devvit trigger delivery timing and Reddit moderation method behavior still require controlled playtest proof before the app can claim live trigger suppression and reopening as verified.
