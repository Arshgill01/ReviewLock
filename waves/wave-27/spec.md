# Wave 27 - Claim and Copy Hardening

## Goal

Align every claim and product phrase with runtime proof and ReviewLock's thesis.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use `$reviewlock-devvit-proof` for claim safety.

## Dependencies

Waves 01 through 26 should be complete.

## Write ownership

This wave may create or edit:

- `docs/CLAIM_COPY_AUDIT.md`
- README/docs/client copy/tests needed for claim safety.

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Search all app and docs copy for forbidden framing.
2. Mark every runtime claim as verified, implemented-not-live-verified, demo-only, or cut.
3. Fix inflated claims.
4. Preserve core phrases:
   - "Lock reviewed content until it changes."
   - "Reports suppressed"
   - "Reopened after edit"

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
rg -n "not reportable|disable reports|blocked reports|AI decides|automatic removal|permanent|forever" README.md docs src || true
```

Review hits manually.

## Acceptance

- Claim audit is evidence-backed.
- Forbidden production-facing copy is absent.
- `TODO.md` marks Wave 27 complete.
- All changes are committed.

## Commit

```txt
docs: harden reviewlock claim language
```
