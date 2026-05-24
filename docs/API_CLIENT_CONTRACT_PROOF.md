# API Client Contract Proof

Wave 22 verified the ReviewLock dashboard client and server routes agree on
endpoint availability, success shapes, empty states, non-200 errors, malformed
JSON, missing fields, and slow responses.

Date: 2026-05-24

## Endpoint map

| Client method                              | Method/path                                    | Server route                  | Contract status                              |
| ------------------------------------------ | ---------------------------------------------- | ----------------------------- | -------------------------------------------- |
| `fetchRuntimeContext()`                    | `GET /api/context`                             | `src/routes/api.ts`           | Covered by `src/routes/api.contract.test.ts` |
| `fetchOverview(subreddit, demo)`           | `GET /api/overview?subreddit=...&demo=...`     | `src/routes/api.dashboard.ts` | Covered by route and client tests            |
| `fetchLocks(subreddit, demo)`              | `GET /api/locks?subreddit=...&demo=...`        | `src/routes/api.dashboard.ts` | Covered by route and client tests            |
| `fetchReopenQueue(subreddit, demo)`        | `GET /api/reopen-queue?subreddit=...&demo=...` | `src/routes/api.dashboard.ts` | Covered by route and client tests            |
| `fetchAuditLog(subreddit, demo)`           | `GET /api/audit?subreddit=...&demo=...`        | `src/routes/api.dashboard.ts` | Covered by route and client tests            |
| `fetchRuntimeStatus(subreddit, demo)`      | `GET /api/runtime?subreddit=...&demo=...`      | `src/routes/api.dashboard.ts` | Covered by route and client tests            |
| `runRuntimeSmoke(subreddit)`               | `POST /api/smoke/redis?subreddit=...`          | `src/routes/api.ts`           | Covered by route and client tests            |
| `runRuntimeSmoke(subreddit)`               | `POST /api/smoke/reddit?subreddit=...`         | `src/routes/api.ts`           | Covered by route and client tests            |
| `enableDemoMode()`                         | `POST /api/demo/enable`                        | `src/routes/api.demo.ts`      | Covered by route and client tests            |
| `disableDemoMode(subreddit)`               | `POST /api/demo/disable?subreddit=...`         | `src/routes/api.demo.ts`      | Covered by route and client tests            |
| `unlockTarget(targetId, lockId, actor)`    | `POST /api/locks/unlock`                       | `src/routes/api.dashboard.ts` | Covered by route and client tests            |
| `dismissReopen(eventId, actor, subreddit)` | `POST /api/reopen-queue/dismiss`               | `src/routes/api.dashboard.ts` | Covered by route and client tests            |

## Hardened client behavior

`src/client/state/api.ts` now treats the API boundary as untrusted:

- non-200 JSON errors use the server's `error` field when present;
- successful responses must parse as JSON objects;
- malformed successful JSON becomes an explicit `API contract error`;
- overview responses must include required dashboard metric fields;
- list responses must include arrays for `locks`, `events`, `dailyMetrics`, and
  `topChurnTargets`;
- runtime responses must include a runtime object;
- demo mode responses must include the required status fields;
- dashboard moderation actions require the exact lock or reopen identity that
  the moderator confirmed;
- dashboard and runtime smoke APIs reject client-supplied subreddit namespaces
  that do not match the Devvit runtime subreddit;
- dashboard reads reject the seeded `reviewlock_demo` namespace unless demo mode
  is explicitly enabled;
- Devvit form endpoints still accept UI responses such as `showToast`.

This prevents `undefined` collections or malformed payloads from reaching
dashboard render helpers.

## Failure and empty-state proof

Tests added or expanded:

- `src/client/state/api.test.ts`
  - accepts empty dashboard arrays from successful endpoints;
  - preserves server error text on non-200 responses;
  - converts malformed JSON to a contract error;
  - rejects missing overview fields;
  - rejects missing runtime/demo arrays and status fields;
  - accepts Devvit UI responses from internal form endpoints;
  - checks both runtime smoke endpoints.
- `src/routes/api.contract.test.ts`
  - verifies every endpoint used by the dashboard client is routed and returns
    JSON instead of 404/405;
  - verifies empty dashboard collections return empty arrays;
  - verifies dashboard and runtime smoke namespace mismatches return structured
    `403` JSON;
  - verifies missing API dependencies return structured non-200 JSON.
- `src/client/state/store.test.ts`
  - verifies slow API responses keep `isLoading` visible until data resolves.
- `src/client/render.test.ts`
  - verifies an initial API/contract failure renders a retryable ReviewLock
    error surface instead of a blank dashboard.

Targeted command:

```bash
npm run test -- --run src/client/state/api.test.ts src/client/state/store.test.ts src/client/render.test.ts src/routes/api.contract.test.ts src/routes/api.dashboard.test.ts src/routes/api.demo.test.ts
```

Result:

```txt
Test Files  6 passed (6)
Tests       35 passed (35)
```

## Product guardrail check

Dashboard error states continue to be operational:

- they keep the app identity visible;
- they include a retry action;
- stale data remains visible with an inline failure banner;
- they do not use forbidden framing such as permanent report disabling.

## Remaining live-proof boundary

Wave 22 proves the local client/server contract. It does not prove Reddit
WebView network timing, real browser service-worker behavior, or Devvit runtime
availability under live Reddit outages. Those remain browser/runtime regression
work for later hardening waves.
