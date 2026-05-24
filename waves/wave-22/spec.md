# Wave 22 - API Contract and Client Integration Hardening

## Goal

Prove the dashboard API and client agree under success, empty, failure, malformed, and slow-response conditions.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 21 should be complete.

## Write ownership

This wave may create or edit:

- `docs/API_CLIENT_CONTRACT_PROOF.md`
- `src/routes/api*.test.ts`
- `src/client/**`
- narrow fixes in dashboard API modules

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Verify every client endpoint has a server route.
2. Test malformed JSON, non-200 responses, missing fields, and empty arrays.
3. Ensure UI errors are operational and retryable.
4. Fix mismatches or brittle assumptions.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

## Acceptance

- Contract proof documents every endpoint.
- Client never renders a blank dashboard from API failure.
- `TODO.md` marks Wave 22 complete.
- All changes are committed.

## Commit

```txt
test: harden dashboard api contract
```
