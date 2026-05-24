# Trigger Idempotency Proof

Wave 23 strengthened duplicate and out-of-order trigger handling for
ReviewLock's report and update paths.

Date: 2026-05-24

## Trigger paths covered

| Case                                                | Expected result                                               | Proof                                        |
| --------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| Duplicate report event id on unchanged content      | One suppression, one metric increment, one audit event        | `src/server/services/reportTriggers.test.ts` |
| Concurrent duplicate report event id                | One suppression, duplicate/concurrent no-op                   | `src/server/services/reportTriggers.test.ts` |
| Duplicate report event id on changed content        | One reopen, one metric increment, one audit event             | `src/server/services/reportTriggers.test.ts` |
| Missing report event id with same report count      | Duplicate no-op                                               | `src/server/services/reportTriggers.test.ts` |
| Missing report event id with increased report count | Counts as a distinct report suppression                       | `src/server/services/reportTriggers.test.ts` |
| Report then update on already changed content       | Report reopens; update sees no active lock                    | `src/server/services/reportTriggers.test.ts` |
| Update then report on already changed content       | Update reopens; report sees no active lock                    | `src/server/services/reportTriggers.test.ts` |
| Sequential reopen-capable updates                   | First update reopens; second sees no active lock              | `src/server/services/updateTriggers.test.ts` |
| Concurrent reopen-capable updates                   | One update reopens; the other is a no-op/concurrent duplicate | `src/server/services/updateTriggers.test.ts` |

## Fix made

Before Wave 23, report triggers without an event id used this fallback identity:

```txt
targetId + minute bucket
```

That avoided double processing duplicate no-id deliveries, but it could also
undercount two real reports against the same target in the same minute.

Wave 23 changed no-id report dedupe to:

```txt
missing-event:{targetId}:count-{reportCount-or-unknown}:{minute bucket}
```

Audit ids for no-id reports now include the same report-count component. This
keeps suppressed-report metrics and audit entries aligned when Devvit delivers a
report trigger without a stable event id but with an increased report count.

## Counter proof

The targeted test command:

```bash
npm run test -- --run src/server/services/reportTriggers.test.ts src/server/services/updateTriggers.test.ts
```

Result:

```txt
Test Files  2 passed (2)
Tests       20 passed (20)
```

Verified invariants:

- duplicate unchanged report event ids do not increment suppression counters;
- missing-id same-count duplicate report deliveries do not increment suppression
  counters;
- missing-id increased-count report deliveries increment suppression counters
  exactly once per new count;
- changed-content report duplicates do not create multiple reopen events;
- report/update ordering cannot leave both active and reopened lock state;
- update/update races produce one reopen queue event and one reopen metric;
- Reddit moderation calls remain single-call for one reopened lock.

## Remaining live-proof boundary

The proof uses local service tests and the Redis adapter contract. Live Devvit
delivery may still vary in which fields appear on report payloads. If live
payloads omit both `eventId` and `reportCount`, ReviewLock falls back to the
target/minute bucket and may conservatively undercount duplicate-looking
deliveries rather than overcounting churn.
