# Wave 24 - Data Namespace and Migration Hardening

## Goal

Ensure Redis keys, demo data, live data, and future schema evolution are safe and reviewable.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 23 should be complete.

## Write ownership

This wave may create or edit:

- `docs/DATA_NAMESPACE_AUDIT.md`
- Redis/key/config tests.
- narrow fixes in persistence services.

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Prove every Redis key starts with `reviewlock:{subreddit}:`.
2. Prove demo data cannot overwrite live data for a real subreddit.
3. Prove missing or malformed records degrade safely.
4. Add a schema-version/migration note if needed.

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/keys.test.ts src/server/adapters/redis.test.ts src/server/services/demoMode.test.ts src/server/services/locks.test.ts
npm run lint
npm run build
```

## Acceptance

- Namespace audit is evidence-backed.
- Demo/live separation is enforced.
- `TODO.md` marks Wave 24 complete.
- All changes are committed.

## Commit

```txt
test: harden reviewlock data namespaces
```
