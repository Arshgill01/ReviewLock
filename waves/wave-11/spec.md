# Wave 11 - Demo Mode

## Goal

Implement deterministic demo mode so judges can see ReviewLock's core loop even without real report churn in a test subreddit.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 02, 04, and 09 should be complete.

## Write ownership

This wave may create or edit:

- `src/server/services/demoData.ts`
- `src/server/services/demoData.test.ts`
- `src/server/services/demoMode.ts`
- `src/server/services/demoMode.test.ts`
- `src/routes/api.demo.ts`
- `src/routes/api.demo.test.ts`

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

Do not edit `src/routes/api.ts`; Wave 12 owns final central wiring.

## Implementation

1. Implement deterministic demo seeding from `src/server/fixtures/demoScenario.ts`.
2. Implement demo enable/disable/reset services:
   - enable demo for subreddit/install
   - reset demo data
   - disable demo
   - get demo status
3. Demo data must write through the same persistence services as live data where possible.
4. Add API route module `api.demo.ts`:
   - `GET /demo/status`
   - `POST /demo/enable`
   - `POST /demo/reset`
   - `POST /demo/disable`
5. Demo mode must never be confused with live data:
   - every demo API response includes `demo: true`
   - dashboard data from demo includes visible labels
   - audit event `demo_reset` is written on reset
6. Tests must cover:
   - deterministic seed count
   - reset idempotency
   - demo/live separation
   - API response shapes

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/demoData.test.ts src/server/services/demoMode.test.ts src/routes/api.demo.test.ts
npm run lint
```

## Acceptance

- Demo mode can produce the full four-beat story.
- Demo state is impossible to mistake for live state.
- No random or time-dependent fixture IDs.
- `TODO.md` marks Wave 11 complete.
- All changes are committed.

## Commit

```txt
feat: add deterministic demo mode
```

