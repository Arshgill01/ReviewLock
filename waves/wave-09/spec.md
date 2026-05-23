# Wave 09 - Dashboard API and Aggregation

## Goal

Implement server-side dashboard data so the UI can make ReviewLock's value obvious: active locks, reports suppressed, reopened edits, and runtime health.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 02 and 04 should be complete. Waves 07 and 08 improve data sources but are not required for this wave's API shape.

## Write ownership

This wave may create or edit:

- `src/server/services/dashboard.ts`
- `src/server/services/dashboard.test.ts`
- `src/routes/api.dashboard.ts`
- `src/routes/api.dashboard.test.ts`

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

Do not edit `src/routes/api.ts`; Wave 12 owns final central wiring.

## Implementation

1. Implement dashboard aggregation:
   - active lock count
   - total suppressed reports
   - reopened lock count
   - last reopened event
   - top report-churn targets
   - runtime status summary
2. Implement list functions:
   - active locks with pagination limit
   - reopen queue with pagination limit
   - recent audit events
   - daily metrics
3. Implement API route module `api.dashboard.ts` with endpoints:
   - `GET /overview`
   - `GET /locks`
   - `GET /reopen-queue`
   - `GET /audit`
   - `GET /runtime`
4. API response rules:
   - include `ok: true` on success
   - include `demo: boolean`
   - include `generatedAt`
   - never expose reporter usernames
   - return structured errors with `ok: false`, `error`, and `requestId` when possible
5. Tests must cover:
   - overview aggregation
   - empty subreddit state
   - demo flag propagation
   - top churn ordering
   - API JSON shapes

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/dashboard.test.ts src/routes/api.dashboard.test.ts
npm run lint
```

## Acceptance

- Dashboard API can drive the first viewport without client-side guessing.
- Empty state is useful and honest.
- API does not claim reports are impossible.
- `TODO.md` marks Wave 09 complete.
- All changes are committed.

## Commit

```txt
feat: add dashboard data api
```

