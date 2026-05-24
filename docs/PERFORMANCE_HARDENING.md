# Performance Hardening

Wave 26 stress-tested ReviewLock with high-volume data shaped like report churn.

## What Was Stressed

Dashboard aggregation:

- 70 active locks.
- 65 reopen events.
- 115 audit events.
- 35 daily metric records.
- 15 churn targets with increasing suppressed-report counts.

Report triggers:

- 50 distinct unchanged report events on one locked target.
- 50 concurrent duplicate deliveries for the same event id.

## Dashboard Boundaries

ReviewLock keeps dashboard responses bounded:

- Active locks: `MAX_ACTIVE_LOCKS` = 50.
- Reopen queue: `MAX_REOPEN_EVENTS` = 50.
- Audit timeline: `MAX_AUDIT_EVENTS` = 100.
- Daily metrics: `MAX_DAILY_METRICS` = 30.
- Top churn targets: 10.

The high-volume dashboard test verifies:

- each list is capped at the configured limit;
- active locks are newest-first by lock time;
- reopen queue is newest-first by reopen event time;
- audit timeline is newest-first by audit time;
- daily metrics are newest-first by date;
- top churn targets are sorted by suppressed-report count;
- the latest reopen event in the overview matches the newest queued reopen event.

## Trigger Boundaries

The high-volume trigger tests verify:

- a burst of 50 distinct report events produces 50 suppressions, 50 audit events, and consistent lock/daily/target metrics;
- a concurrent duplicate storm of 50 deliveries for the same event id produces one durable suppression and 49 duplicate no-ops;
- duplicate storms call `ignoreReports()` once, preventing report churn from double-counting because of delivery retries.

## Fixes Needed

No production code changes were required in Wave 26. Existing list limits, sorted-set ordering, report dedupe, and trigger mutex behavior held under the added high-volume tests.

## Known Boundary

`overview.activeLockCount` is derived from the bounded active-lock slice. Devvit's Redis surface currently used by ReviewLock exposes `zRange` but not a cheap sorted-set cardinality primitive in the project adapter. If public dashboard copy later needs exact counts beyond the bounded first page, add explicit persisted counters or a verified Redis count operation instead of unbounded list reads.

## Verification

Commands run:

- `npm run test -- --run src/server/services/dashboard.test.ts src/server/services/reportTriggers.test.ts`
- `npm run type-check`
- `npm run test`
- `npm run lint`
- `npm run build`
