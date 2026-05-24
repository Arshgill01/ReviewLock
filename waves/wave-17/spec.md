# Wave 17 - Redis Failure and Race Conditions

## Goal

Harden ReviewLock when Redis operations fail or duplicate/concurrent trigger deliveries target the same lock.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 16 should be complete.

## Write ownership

This wave may create or edit:

- `docs/REDIS_RACE_PROOF.md`
- `src/server/adapters/redis*.test.ts`
- `src/server/services/locks*.test.ts`
- `src/server/services/reportTriggers*.test.ts`
- `src/server/services/reopenFlow*.test.ts`
- `src/server/services/updateTriggers*.test.ts`
- narrow fixes in Redis adapter or orchestration services

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Add a failing Redis test double or failure hooks if needed.
2. Prove lock creation rollback behavior when Redis write fails after moderation calls.
3. Prove report suppression does not double-count duplicate events.
4. Prove simultaneous reports on the same target cannot create contradictory active/reopened states.
5. Prove reopen is idempotent when update and report triggers both notice the same edit.
6. Add runtime warnings/audit events for partially failed operations.
7. Log every race/failure behavior decision in `decisions.md`.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

## Acceptance

- Redis failures produce honest failed/runtime-uncertain state rather than silent success.
- Duplicate and concurrent triggers are idempotent.
- Decisions are logged.
- `TODO.md` marks Wave 17 complete.
- All changes are committed.

## Commit

```txt
fix: harden redis failure and race paths
```
