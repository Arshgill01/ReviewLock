# Wave 08 - Edit-Aware Reopen Triggers

## Goal

Implement the feature that makes ReviewLock worth building: locks automatically break when reviewed content changes.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Waves 02, 03, 04, and 05 should be complete. Wave 07 is helpful but not required.

## Write ownership

This wave may create or edit:

- `src/server/services/reopenFlow.ts`
- `src/server/services/reopenFlow.test.ts`
- `src/server/services/updateTriggers.ts`
- `src/server/services/updateTriggers.test.ts`
- `src/routes/triggers.update.ts`
- `src/routes/triggers.update.test.ts`

Append-only allowed:

- `RESEARCH.md`
- `decisions.md`
- `TODO.md`
- `log.md`

Do not edit `src/routes/triggers.ts`; Wave 12 owns final central wiring.

## Implementation

1. Implement `breakLockForChangedContent(input)` service:
   - load active lock by target
   - refetch current target
   - compute current fingerprint
   - compare to stored fingerprint
   - if changed or uncertain, mark lock reopened
   - call `unignoreReports()` when possible
   - enqueue reopen event
   - increment reopened metrics
   - write audit event
2. Implement update trigger handlers for:
   - post update
   - comment update
   - post NSFW update
   - post spoiler update
   - post flair update
3. Reopen reason mapping:
   - post/comment body/title/url change: `content_changed`
   - flair: `flair_changed`
   - NSFW: `nsfw_changed`
   - spoiler: `spoiler_changed`
   - uncertain payload/refetch failure: `runtime_uncertain`
4. Reopen flow must be idempotent:
   - if lock is already reopened/unlocked/expired, do not enqueue duplicate open event.
   - duplicate update events must not create multiple active queue entries.
5. If `unignoreReports()` fails:
   - keep lock status reopened
   - include runtime warning
   - dashboard must still show the item
6. Implement standalone route module `triggers.update.ts` exporting a Hono router for update endpoints. Wave 12 will mount it.
7. Tests must cover:
   - unchanged update does not reopen
   - content edit reopens
   - flair/nsfw/spoiler changes reopen post locks
   - comment edit reopens
   - missing target fails open to runtime warning/reopen
   - unignore failure recorded but does not hide reopen
   - duplicate update idempotency

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/reopenFlow.test.ts src/server/services/updateTriggers.test.ts src/routes/triggers.update.test.ts
npm run lint
```

## Acceptance

- Edit-aware reopening works in pure tests.
- No automatic removal is introduced.
- Reopened items are visible through persisted queue data.
- `TODO.md` marks Wave 08 complete.
- All changes are committed.

## Commit

```txt
feat: reopen locks when reviewed content changes
```

