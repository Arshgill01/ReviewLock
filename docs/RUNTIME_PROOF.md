# Runtime Proof

Last updated: 2026-05-24 22:41 IST.

This file distinguishes implemented behavior from verified Devvit runtime behavior. README, submission, and demo claims may cite only rows marked `verified`.

## Environment

- Local workspace: `/Users/arshdeepsingh/Developer/ReviewLock`
- Dev account: `u/BrightyBrainiac`
- Devvit app: `reviewlock`
- App id: `5201a616-7c35-48d6-a030-743e41456e69`
- Controlled subreddit: `r/reviewlock_dev`
- Default playtest subreddit id: `t5_i1a3xr`
- Devvit package family: `devvit`, `@devvit/web`, `@devvit/start` at `0.12.24`

## Commands Run

- `npx devvit whoami`
  - Result: PASS, logged in as `u/BrightyBrainiac`.
- `npx devvit view --json`
  - Result: PASS, app `reviewlock` exists, install count is `1`, owner is `BrightyBrainiac`, versions count is `38`.
- `npm run dev -- reviewlock_dev`
  - Result: PASS, playtest served `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.
  - Latest observed hot reload in the Wave 31 live WebView smoke pass: `v0.0.2.6`.
  - Latest observed hot reload in the controlled moderation method pass: `v0.0.2.39`.
- Zen browser embedded WebView smoke
  - Result: PASS, the ReviewLock dashboard rendered inside Reddit at `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.
  - Result: PASS, the header showed `r/reviewlock_dev` after the WebView context fix.
  - Result: PASS, `Verify runtime` completed and showed `redditContext verified` and `redis verified`.
- Zen browser dashboard unlock proof
  - Result: PASS, the dashboard inline `Unlock` confirmation called `/api/locks/unlock`, removed the active lock, wrote audit, and runtime status showed `unignoreReports verified`.
  - Controlled target: `t3_1tm8nak`.
- Zen browser lock form proof
  - Result: PASS, the `Lock review` form opened and showed target id, content summary, report count, edit state, permalink, and reason picker for `t3_1tm8nak`.
  - Result: PASS, submitting the form created an active lock, wrote audit, and runtime status showed `approve verified` and `ignoreReports verified`.
- `npm run type-check`
  - Result: PASS after runtime hardening patches.
- `npm run test -- --run src/integration.test.ts src/client/state/runtimeContext.test.ts src/client/state/store.test.ts src/client/render.test.ts src/server/services/runtimeHardening.test.ts`
  - Result: PASS, 5 files and 27 tests.
- `npm run test`
  - Result: PASS, 36 files and 117 tests.
- `npm run lint`
  - Result: PASS.
- `npm run build`
  - Result: PASS.
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime`
  - Result: BLOCKED while playtest was running; Devvit CLI reported `listen EADDRINUSE: address already in use :::5678`.
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps`
  - Result: BLOCKED while playtest was running; Devvit CLI reported `listen EADDRINUSE: address already in use :::5678`.
- `npx devvit logs reviewlock_dev reviewlock --connect --since 10m --show-timestamps`
  - Result: BLOCKED while playtest was running; Devvit CLI reported `listen EADDRINUSE: address already in use :::5678`.
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps`
  - Result: PASS after stopping playtest; stream connected and showed the existing ReviewLock dashboard WebView connection.
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime`
  - Result: PASS during Wave 31 after stopping playtest; stream connected for `reviewlock` on `r/reviewlock_dev`; no trigger payload logs were emitted during the sample window.

## Capability Matrix

| Capability                                   | Status     | Evidence                                                                                                                                                                         | Notes                                                                                                            |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Devvit config schema loads                   | verified   | Playtest reached `v0.0.1.19` after removing unsupported manifest fields and recursive dev script.                                                                                | Earlier failures are logged in `decisions.md` as D006 and D007.                                                  |
| Devvit Web server boot                       | verified   | Playtest served `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.                                                                                                  | Runtime server uses `createServer`, `getServerPort`, `reddit`, `redis`, and `context` from `@devvit/web/server`. |
| Subreddit dashboard menu response            | verified   | `Open ReviewLock dashboard` no longer returns the Devvit `UiResponse` unknown-key error after replacing `{ ok: true }` with valid `showForm`/`navigateTo`/`showToast` responses. | Valid response keys confirmed from installed `@devvit/build-pack` validator.                                     |
| Dashboard custom post launch                 | verified   | A ReviewLock dashboard custom post was created in `r/reviewlock_dev` and opened as a Reddit custom post WebView.                                                                 | Existing post observed at `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.                            |
| Dashboard subreddit context                  | verified   | Zen live WebView smoke rendered the dashboard header as `r/reviewlock_dev` at `reviewlock-i1a3xr-0-0-2-6-webview.devvit.net/index.html`.                                         | Client now prefers Devvit-injected WebView context and refuses mismatched weaker runtime context overwrites.     |
| Redis smoke from authorized WebView          | verified   | Zen live WebView smoke clicked `Verify runtime`; the runtime panel showed `redis verified` and `Runtime proof refreshed.`                                                        | The successful run occurred after the `r/reviewlock_dev` context fix.                                            |
| Reddit context smoke from authorized WebView | verified   | Zen live WebView smoke clicked `Verify runtime`; the runtime panel showed `redditContext verified` and `Runtime proof refreshed.`                                                | The successful run occurred after the `r/reviewlock_dev` context fix.                                            |
| Direct terminal WebView API smoke            | blocked    | Direct API calls to Devvit WebView routes are not authorized without Reddit-injected WebView headers.                                                                            | Smoke endpoints are intentionally meant to run from the embedded dashboard.                                      |
| `approve()` live behavior                    | verified   | `Lock review` on controlled post target `t3_1tm8nak` created an active lock, wrote audit, and runtime status showed `approve verified`.                                          | Verified for a controlled post target; comment target remains unverified.                                        |
| `ignoreReports()` live behavior              | verified   | `Lock review` on controlled post target `t3_1tm8nak` created an active lock and runtime status showed `ignoreReports verified`.                                                  | Verified for a controlled post target; comment target remains unverified.                                        |
| `unignoreReports()` live behavior            | verified   | Dashboard `Unlock` on controlled target `t3_1tm8nak` removed the lock, wrote audit, and runtime status showed `unignoreReports verified`.                                        | Verified through ReviewLock dashboard API and Reddit adapter path.                                               |
| Report trigger delivery                      | unverified | `devvit.json` registers `onPostReport` and `onCommentReport`; routes and services are locally tested.                                                                            | Need live or controlled trigger proof in a dedicated playtest pass.                                              |
| Update trigger delivery                      | unverified | `devvit.json` registers post/comment update, NSFW, spoiler, and flair update triggers; routes and services are locally tested.                                                   | Need live or controlled trigger proof in a dedicated playtest pass.                                              |
| Devvit logs                                  | verified   | After stopping playtest, `devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime` connected for `reviewlock` on `r/reviewlock_dev`.                   | No trigger payload logs captured yet.                                                                            |

## Runtime Failures Found And Hardened

- Devvit rejected `devvit.json` with a top-level `version` field.
  - Hardened by removing the unsupported field.
- Devvit playtest recursively launched itself through `devvit.json` `scripts.dev`.
  - Hardened by keeping package `npm run dev` as `devvit playtest` and changing manifest `scripts.dev` to a build/watch command.
- Devvit rejected menu/form responses with unknown key `ok`.
  - Hardened by returning only valid `UiResponse` keys from internal menu/form endpoints.
- Dashboard WebView initially defaulted to `r/reviewlock`.
  - Hardened by adding `/api/context`, using Devvit server `context.subredditName`, preferring Devvit-injected WebView context on the client, and falling back to URL/referrer inference only when stronger context is absent.
- Runtime smoke status could only be proven from an authorized Reddit WebView.
  - Hardened by making smoke checks dashboard-driven and storing capability results in ReviewLock runtime status.
- Devvit WebView dashboard actions cannot rely on `window.confirm()` for destructive confirmations.
  - Hardened by replacing browser confirm dialogs with inline confirmation controls for unlock and dismiss actions.
- The embedded dashboard could not call internal form endpoints for dashboard actions.
  - Hardened by adding dashboard API routes for unlock and reopen-dismiss actions.
- Client-supplied dashboard actors are not authoritative.
  - Hardened by preferring the Reddit runtime username for audit actors and using request body actors only as fallback.
- Lock creation could previously leave a partial active lock if audit or metric
  writes failed after the lock record was saved.
  - Hardened by rolling back Reddit `ignoreReports()` and removing the lock
    record plus active indexes when post-save persistence fails.
- Dashboard/form unlock could previously remove an active lock even if
  `unignoreReports()` failed.
  - Hardened by keeping the lock active, recording a runtime failure audit
    event, and returning a retryable error until Reddit returns reports to
    normal handling.
- Dashboard/form unlock confirmations could previously unlock a newer active
  lock after a stale UI confirmation.
  - Hardened by requiring the submitted `lockId` to match the current active
    lock before calling Reddit.
- Dashboard and runtime smoke routes previously trusted client-supplied
  subreddit namespaces.
  - Hardened by preferring Devvit runtime subreddit context and rejecting
    mismatched client-supplied namespaces.
- Dashboard unlock previously did not enforce the Devvit runtime subreddit
  before resolving and unlocking a target.
  - Hardened by passing the expected subreddit into the unlock service and
    rejecting cross-subreddit targets before any Reddit moderation call.
- Devvit trigger routes previously accepted only synthetic top-level target
  ids.
  - Hardened by accepting installed Devvit nested `post.id` and `comment.id`
    payload shapes for report and update callbacks.
- Devvit form submissions previously trusted editable target ID fields.
  - Hardened by storing server-side Redis form bindings and rejecting submitted
    target or lock mismatches.
- Reopen persistence previously removed active indexes before writing the reopen
  queue event.
  - Hardened by queueing the reopen event before updating lock status.
- Demo data could previously be requested from the demo namespace without
  `demo=true`.
  - Hardened by rejecting unlabeled dashboard reads of `reviewlock_demo`.
- Lock creation rollback could previously delete the local lock even when
  `unignoreReports()` rollback failed after a Redis persistence error.
  - Hardened by recording rollback runtime proof and keeping a visible `failed`
    lock with runtime warnings when rollback fails.
- Report trigger dedupe previously treated runtime-uncertain deliveries as
  permanently processed and did not expire keys.
  - Hardened by clearing dedupe markers on runtime-uncertain paths and expiring
    successful markers after seven days.
- Devvit Redis reverse sorted-set reads previously passed `{ reverse: true }`
  without the required `by` option.
  - Hardened by passing explicit rank options to `zRange()`.
- Runtime proof text was previously rendered without escaping in the dashboard.
  - Hardened by escaping Redis-backed runtime proof names, warnings, and
    verification messages.
- Lock/unlock Devvit form callbacks previously did not enforce the current
  Devvit runtime subreddit before consuming form tokens.
  - Hardened by rejecting mismatched runtime/submitted subreddit values before
    token consumption or moderation operations.
- Malformed but syntactically valid runtime proof JSON could previously flow to
  the dashboard and crash runtime status rendering.
  - Hardened by validating server-loaded runtime proof shape and client API
    runtime proof contracts, with fallback to an unverified matrix.
- Reopen transitions could previously enqueue a reopen event and then fail the
  lock status write, leaving the target suppressible through active indexes.
  - Hardened by removing active indexes as compensation when the post-queue
    status write fails.
- Reloading a dashboard URL with `demo=true` could previously request a live
  subreddit namespace under the demo flag.
  - Hardened by bootstrapping demo URLs directly into `reviewlock_demo` while
    preserving the live subreddit for exit from demo mode.
- Valid-but-malformed Redis records in lock, reopen, audit, or metric stores
  could previously pass through service lists and crash dashboard rendering.
  - Hardened by adding shared schema guards and skipping malformed ledger
    records at service boundaries.
- Repeated lock submissions for an already active target could previously create
  stale active ledger rows and double-count lock metrics.
  - Hardened by returning the existing active lock before fingerprinting or
    calling Reddit moderation methods.
- Report-trigger target resolution failure could previously leave a known
  active lock suppressible while returning `runtime_uncertain`.
  - Hardened by reopening known active locks as `runtime_uncertain` when the
    target cannot be loaded during report-trigger processing.
- Duplicate-lock idempotency could previously return an old active lock before
  checking whether the current target fingerprint had changed.
  - Hardened by fingerprinting first; changed current content reopens the stale
    lock before creating the new reviewed lock.
- Seeded demo dashboard rows previously rendered live unlock and dismiss
  controls whose API calls did not carry demo scope.
  - Hardened by rendering demo rows as read-only while keeping live mode actions
    unchanged.
- Stale-lock relock previously reopened the old lock before proving the
  replacement `ignoreReports()` call worked.
  - Hardened by calling `unignoreReports()` before reopening the stale lock and
    attempting the replacement lock.
- Older proof docs previously contradicted the controlled post-target
  moderation proof boundary.
  - Hardened by reconciling historical docs to point at this file for current
    claim status.

## Current Claim Boundary

Allowed claims:

- ReviewLock has implemented lock, unlock, report-trigger, update-trigger, dashboard, demo, audit, and runtime proof flows.
- Local type-checks and tests pass for the runtime hardening patches listed above.
- The Devvit app can be playtested in `r/reviewlock_dev`.
- The dashboard menu can open a ReviewLock custom post.
- The dashboard live WebView renders under `r/reviewlock_dev` in Zen and its runtime smoke verifies Redis plus Reddit context.
- Dashboard unlock has live-verified `unignoreReports()` on controlled target `t3_1tm8nak`.
- Dashboard lock review has live-verified `approve()` and `ignoreReports()` on controlled target `t3_1tm8nak`.

Not allowed yet:

- Do not claim live report suppression is verified.
- Do not claim live edit-trigger reopening is verified.
- Do not claim comment-target `approve()`, `ignoreReports()`, or `unignoreReports()` are verified in production-like Devvit runtime.
- Do not claim `devvit logs` has been captured for trigger payloads.
