# Wave 26 - Performance and High-Volume Hardening

## Goal

Stress dashboard aggregation and trigger services with high-volume data that resembles report churn.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 25 should be complete.

## Write ownership

This wave may create or edit:

- `docs/PERFORMANCE_HARDENING.md`
- high-volume service/client tests.
- narrow performance fixes.

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Generate high-volume lock, audit, metrics, and reopen data in tests.
2. Verify dashboard limits and ordering.
3. Verify trigger handling stays bounded and deterministic.
4. Fix inefficient or unstable paths.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

## Acceptance

- High-volume tests exist and pass.
- Dashboard remains scan-friendly and bounded.
- `TODO.md` marks Wave 26 complete.
- All changes are committed.

## Commit

```txt
test: harden reviewlock high-volume behavior
```
