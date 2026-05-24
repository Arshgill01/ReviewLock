# Wave 28 - Browser Regression Hardening

## Goal

Exercise the dashboard in a real browser and fix visual or interaction regressions.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use Browser or Playwright tooling.

## Dependencies

Waves 01 through 27 should be complete.

## Write ownership

This wave may create or edit:

- `docs/BROWSER_REGRESSION.md`
- `src/client/**`
- browser-oriented client tests if needed.

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Serve the dashboard locally.
2. Inspect desktop and mobile viewport states.
3. Click/demo-test visible controls.
4. Check screenshots for blank regions, overlaps, overflow, and unreadable text.
5. Fix regressions.

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/client/state/store.test.ts src/client/render.test.ts
npm run lint
npm run build
```

Record browser commands and screenshot paths.

## Acceptance

- Browser evidence is documented.
- Dashboard is usable on mobile and desktop.
- `TODO.md` marks Wave 28 complete.
- All changes are committed.

## Commit

```txt
test: harden dashboard browser behavior
```
