# Wave 23 - Trigger Idempotency Hardening

## Goal

Strengthen duplicate and out-of-order trigger handling beyond the first proof pass.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Waves 01 through 22 should be complete.

## Write ownership

This wave may create or edit:

- `docs/TRIGGER_IDEMPOTENCY_PROOF.md`
- trigger service tests.
- narrow trigger service fixes.

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Test duplicate report event IDs.
2. Test missing event IDs.
3. Test report-then-update and update-then-report on the same changed content.
4. Test two reopen-capable updates for one lock.
5. Fix double counting, contradictory statuses, and weak dedupe keys.

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/reportTriggers.test.ts src/server/services/updateTriggers.test.ts
npm run lint
npm run build
```

## Acceptance

- Duplicate/out-of-order proof is documented.
- Reopen and suppression counters remain correct.
- `TODO.md` marks Wave 23 complete.
- All changes are committed.

## Commit

```txt
fix: harden trigger idempotency
```
