# Wave 25 - Safety and Privacy Hardening

## Goal

Audit ReviewLock for privacy, moderator safety, and product-scope drift.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 24 should be complete.

## Write ownership

This wave may create or edit:

- `docs/SAFETY_PRIVACY_AUDIT.md`
- schema/tests/docs/UI copy needed to remove unsafe data or claims.

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Verify no reporter usernames are stored.
2. Verify moderator productivity surveillance is absent.
3. Verify no AI judging or external services were introduced.
4. Verify reopen remains non-destructive.
5. Fix unsafe copy or data handling.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
rg -n "reporter|AI decides|automatic removal|productivity|surveillance|external service" src docs README.md || true
```

Review hits manually.

## Acceptance

- Safety/privacy audit gives concrete evidence.
- Unsafe product drift is fixed or documented as absent.
- `TODO.md` marks Wave 25 complete.
- All changes are committed.

## Commit

```txt
docs: harden reviewlock safety posture
```
