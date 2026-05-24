# Wave 20 - Hardening Pass 1

## Goal

Read every file written so far and fix obvious production-readiness issues before continuing autonomous hardening.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 19 should be complete.

## Write ownership

This wave may edit any ReviewLock-owned implementation, test, or documentation file if the change is a hardening fix and is recorded in `docs/HARDENING_PASS_01.md`.

Do not rewrite planner files except `TODO.md`, `log.md`, and append-only `decisions.md` unless fixing a discovered planning inconsistency.

## Implementation

1. Read all files under:
   - `src/`
   - `docs/`
   - root config files
   - `README.md`
2. Search for:
   - `TODO`
   - placeholder/stub language
   - dead branches.
   - unsafe copy.
   - missing error handling.
   - brittle tests.
3. Fix anything that would look unfinished in a judge review.
4. Record the audit and changes in `docs/HARDENING_PASS_01.md`.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
rg -n "TODO|placeholder|stub|coming soon|not implemented" src docs README.md || true
```

Review any hits manually.

## Acceptance

- No unfinished code remains in owned implementation files.
- Any remaining hit is documented as historical/audit context.
- `TODO.md` marks Wave 20 complete.
- All changes are committed.

## Commit

```txt
chore: harden reviewlock implementation pass 1
```
