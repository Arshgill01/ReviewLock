# Wave 02 - Source Truth and Fixtures

## Goal

Create shared ReviewLock domain types, constants, fixtures, and golden demo scenario data. Later waves must import these instead of inventing their own shapes.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Wave 01 should be complete. If it is not, create only files under this wave's ownership and skip central wiring.

## Write ownership

This wave may create or edit:

- `src/shared/constants.ts`
- `src/shared/schema.ts`
- `src/shared/demoScenario.ts`
- `src/shared/schema.test.ts`
- `src/server/fixtures/demoScenario.ts`
- `src/server/fixtures/demoScenario.test.ts`

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Define literal arrays and exported union types for:
   - `TargetKind`
   - `LockStatus`
   - `ReopenReason`
   - `AuditEventKind`
   - `RuntimeCapabilityStatus`
   - `LockReasonPreset`
2. Define interfaces:
   - `ReviewLockConfig`
   - `ReviewLockTarget`
   - `ContentFingerprint`
   - `ReviewLockRecord`
   - `ReopenEvent`
   - `AuditEvent`
   - `DailyMetrics`
   - `TargetMetrics`
   - `DashboardOverview`
   - `DashboardResponse`
   - `ActiveLocksResponse`
   - `ReopenQueueResponse`
   - `AuditLogResponse`
   - `RuntimeProofStatus`
   - `DemoScenario`
3. Define validation helpers that use plain TypeScript, not a new dependency:
   - `isTargetKind(value)`
   - `isLockStatus(value)`
   - `isReopenReason(value)`
   - `isAuditEventKind(value)`
4. Define constants:
   - `APP_NAME = 'ReviewLock'`
   - `APP_SLUG = 'reviewlock'`
   - `FINGERPRINT_VERSION = 'content-v1'`
   - default lock expiry days
   - max list sizes
   - demo subreddit name
5. Demo scenario must include:
   - at least 12 locks
   - at least 5 suppressed report events
   - at least 3 reopened locks caused by changed content
   - both posts and comments
   - one runtime warning/failure example
6. Fixtures must be deterministic. No random IDs.
7. Tests must cover:
   - union validators
   - fixture counts
   - demo scenario contains the four-beat story: lock, reports suppressed, edit, reopen

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/shared/schema.test.ts src/server/fixtures/demoScenario.test.ts
npm run lint
```

## Acceptance

- Shared types compile under strict TypeScript.
- No feature wave needs to define duplicate domain unions.
- Demo data is realistic and visibly marked as demo via schema fields.
- `TODO.md` marks Wave 02 complete.
- All changes are committed.

## Commit

```txt
feat: define reviewlock domain schema
```

