# Wave 07 - Report Trigger Suppression

## Goal

Implement report-trigger handling for unchanged locked content: suppress repeat report churn, increment metrics, and fail open if content integrity is uncertain.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Waves 02, 03, 04, and 05 should be complete. Wave 06 is not required.

## Write ownership

This wave may create or edit:

- `src/server/services/reportTriggers.ts`
- `src/server/services/reportTriggers.test.ts`
- `src/server/services/triggerDecisions.ts`
- `src/server/services/triggerDecisions.test.ts`
- `src/routes/triggers.report.ts`
- `src/routes/triggers.report.test.ts`

Append-only allowed:

- `RESEARCH.md`
- `decisions.md`
- `TODO.md`
- `log.md`

Do not edit `src/routes/triggers.ts`; Wave 12 owns final central wiring.

## Implementation

1. Implement report trigger input normalizers for post and comment reports.
2. Implement `decideReportTriggerAction(input, activeLock, currentTarget)`:
   - `no_lock`
   - `suppress_unchanged`
   - `reopen_changed`
   - `runtime_uncertain`
3. Suppression path must:
   - call `ignoreReports()`
   - increment target and daily suppressed metrics
   - update lock `suppressedReportCount`, `lastSuppressedAt`, `lastReportCount`
   - write `report_suppressed` audit event
4. Changed path must delegate to a reopen service function if Wave 08 exists, or export a local `buildReopenFromReportDecision` helper for Wave 08/12 integration.
5. Runtime uncertain path must not suppress reports. It must write a runtime warning audit event.
6. Idempotency:
   - duplicate report events should not corrupt counters.
   - if exact event id is available, dedupe by event id.
   - if no event id is available, use a short target/reason/time bucket dedupe key.
7. Tests must cover:
   - no lock does nothing
   - unchanged content suppresses
   - changed content reopens/fails open
   - missing target fails open
   - duplicate event does not double count when dedupe id exists
   - adapter ignore failure records runtime failure

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/reportTriggers.test.ts src/server/services/triggerDecisions.test.ts src/routes/triggers.report.test.ts
npm run lint
```

## Acceptance

- Suppression is impossible without a fingerprint match.
- Metrics/audit prove suppressed report value.
- Central trigger router remains untouched.
- `TODO.md` marks Wave 07 complete.
- All changes are committed.

## Commit

```txt
feat: suppress repeat reports on unchanged locks
```

