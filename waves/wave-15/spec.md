# Wave 15 - End-to-End Trigger Proof

## Goal

Prove every trigger path from payload to lock decision, Redis mutation, metric update, audit event, and moderation operation.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 13 should be complete.

## Write ownership

This wave may create or edit:

- `docs/TRIGGER_PROOF.md`
- `src/server/services/reportTriggers*.test.ts`
- `src/server/services/updateTriggers*.test.ts`
- `src/routes/triggers*.test.ts`
- narrow fixes in `src/server/services/reportTriggers.ts`, `src/server/services/updateTriggers.ts`, `src/routes/triggers.ts`, or trigger helper modules

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Manually trace each path and document it:
   - `PostReport` unchanged locked target suppresses reports.
   - `CommentReport` unchanged locked target suppresses reports.
   - `PostReport` changed locked target reopens.
   - `CommentReport` changed locked target reopens.
   - `PostUpdate` changed locked target reopens.
   - `CommentUpdate` changed locked target reopens.
   - `PostNsfwUpdate`, `PostSpoilerUpdate`, and `PostFlairUpdate` reopen when material fingerprint changes.
2. Add tests that assert Redis-visible outcomes:
   - active lock state changes or remains active as expected.
   - target metrics and daily metrics update.
   - audit event kind and message are written.
   - reopen queue receives correct reason.
   - moderation adapter receives `ignoreReports()` or `unignoreReports()` exactly when expected.
3. If live Devvit payloads are available, compare them to route test payloads and record the comparison in `docs/TRIGGER_PROOF.md`.
4. Fix any path that relies on weak assumptions or produces incomplete audit/metrics evidence.

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/reportTriggers.test.ts src/server/services/updateTriggers.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts
npm run lint
npm run build
```

## Acceptance

- Every trigger path has a documented trace.
- Tests prove Redis, metrics, audit, reopen queue, and moderation effects.
- No trigger path suppresses when fingerprint is uncertain.
- `TODO.md` marks Wave 15 complete.
- All changes are committed.

## Commit

```txt
test: prove reviewlock trigger paths
```
