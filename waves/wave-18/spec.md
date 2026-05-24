# Wave 18 - UI and Dashboard Audit

## Goal

Audit every dashboard state so the app is never blank, misleading, overflowing, or product-drifting.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use browser tooling for rendered verification.

## Dependencies

Waves 01 through 17 should be complete.

## Write ownership

This wave may create or edit:

- `docs/UI_AUDIT.md`
- `src/client/**`
- client-only tests

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Test dashboard states:
   - empty live.
   - demo seeded.
   - locked active state.
   - reopened after edit.
   - runtime failed/unverified.
   - high-volume active locks.
   - high-volume report churn.
2. Use browser screenshots or DOM inspection for desktop and mobile widths.
3. Fix any blank state, overflow, broken interaction, forbidden copy, nested card, or decorative gradient/orb styling.
4. Record screenshot paths or browser evidence in `docs/UI_AUDIT.md`.

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/client/state/store.test.ts src/client/render.test.ts
npm run lint
npm run build
```

Also run a browser verification against the local built or dev-served client.

## Acceptance

- Every listed UI state is inspected and documented.
- First viewport makes active locks, reports suppressed, reopened after edit, and latest reopen obvious.
- No forbidden product copy appears in production UI.
- `TODO.md` marks Wave 18 complete.
- All changes are committed.

## Commit

```txt
test: audit reviewlock dashboard states
```
