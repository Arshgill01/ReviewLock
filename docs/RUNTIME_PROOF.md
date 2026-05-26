# Runtime Proof

Last updated: 2026-05-26 20:20 IST.

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
  - Result: PASS, app `reviewlock` exists, owner is `BrightyBrainiac`, install
    count is `1`, and default playtest subreddit is `t5_i1a3xr`.
  - Latest upload completed through `npm run deploy` on 2026-05-26 19:47 IST.
  - Latest listing check after upload showed current uploaded version `0.0.10`,
    uploaded `2026-05-26T14:17:37.752Z`, built
    `2026-05-26T14:17:40.373Z`, with `version.about` populated from the
    self-contained README/App Directory summary.
  - The current CLI JSON shape exposes `majorVersion`, `minorVersion`, and
    `patchVersion`, but not the older total versions-count field.
  - Remaining listing blocker: `app.description`, `marketingInfo`,
    `privacyPolicy`, and `termsAndConditions` are still empty. If the Developer
    Portal exposes those fields separately from `devvit upload`, fill them from
    `docs/APP_LISTING.md` before Devpost submission.
- `npm run dev -- reviewlock_dev`
  - Result: PASS, playtest served `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.
  - Latest observed hot reload in the Wave 31 live WebView smoke pass: `v0.0.2.6`.
  - Latest observed hot reload in the controlled moderation method pass: `v0.0.2.39`.
  - Latest observed hot reload in the post-hardening live WebView smoke pass: `v0.0.2.62`.
  - Latest observed hot reload in the trigger-wrapper hardening recheck: `v0.0.2.64`.
  - Latest observed hot reload in the controlled `PostReport` proof pass:
    `v0.0.2.87`.
  - Observed hot reload after update-trigger runtime-proof hardening:
    `v0.0.2.89`; subsequent doc-only validation reloads continued after that.
  - Latest observed hot reload in the controlled post body edit proof pass:
    `v0.0.2.107`.
  - Latest observed hot reload in the runtime proof reconciliation hardening
    recheck: `v0.0.2.185`.
  - Latest observed hot reload in the post-upload target-link hardening
    recheck: `v0.0.3.3`.
  - Latest observed hot reload in the no-visible-token form and live dashboard
    audit-layout recheck: `v0.0.10.2`.
  - The same playtest watcher later rebuilt to `v0.0.10.4` while docs and
    screenshots were being updated, then was stopped cleanly.
- Zen browser embedded WebView smoke
  - Result: PASS, the ReviewLock dashboard rendered inside Reddit at `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.
  - Result: PASS, the header showed `r/reviewlock_dev` after the WebView context fix.
  - Result: PASS, `Verify runtime` completed and showed `redditContext verified` and `redis verified`.
  - Result: PASS, repeated after the runtime fallback and scoped-unlock hardening; Zen showed `Runtime proof refreshed.` under `r/reviewlock_dev`.
  - Result: PASS, repeated after Reddit adapter mapping and trigger-wrapper
    hardening; Zen showed `Runtime proof refreshed.` under `r/reviewlock_dev`
    and demo mode showed visibly labeled seeded data under `reviewlock_demo`.
  - Result: PASS, repeated after runtime proof audit reconciliation hardening;
    Zen showed `postReportTrigger verified`, kept
    `commentReportTrigger unverified`, and `Verify runtime` completed with
    `Runtime proof refreshed.` under `r/reviewlock_dev`.
  - Result: PASS, repeated after submission upload and dashboard target-link
    canonicalization; Zen rendered playtest `v0.0.3.3`, the first viewport
    showed `2` active locks, `1` report suppressed, `2` reopened after edit,
    latest event `comment:ontlx1k`, and `Verify runtime` completed with
    `Runtime proof refreshed.` Target links resolved to `reddit.com/r/...`
    URLs instead of the Devvit WebView host.
  - Result: PASS, repeated after the no-visible-token form hardening and
    `0.0.10` upload; Zen rendered playtest `v0.0.10.2`, showed `3` active
    locks, `1` report suppressed, `2` reopened after edit, latest event
    `comment:ontlx1k`, active lock `post:1tnfgqf`, and an audit timeline with
    compact date/time columns plus non-overlapping target/lock detail columns.
- Zen browser dashboard unlock proof
  - Result: PASS, the dashboard inline `Unlock` confirmation called `/api/locks/unlock`, removed the active lock, wrote audit, and runtime status showed `unignoreReports verified`.
  - Controlled target: `t3_1tm8nak`.
- Zen browser lock form proof
  - Result: PASS, the `Lock review` form opened and showed target id, content summary, report count, edit state, permalink, and reason picker for `t3_1tm8nak`.
  - Result: PASS, submitting the form created an active lock, wrote audit, and runtime status showed `approve verified` and `ignoreReports verified`.
- Zen browser no-visible-token lock form proof
  - Result: PASS, the `Lock review` form opened on playtest `v0.0.10.2` for
    controlled post `t3_1tnfgqf` without rendering a raw `Review token` or
    `formToken` field.
  - Result: PASS, submitting the form created a new active lock for
    `t3_1tnfgqf`, wrote audit event `Lock Created 5/26/2026, 6:35 PM`, and
    the live dashboard showed the target in active locks.
  - Screenshot: `output/submission/01-live-lock-form-zen.png`.
- Zen browser audit timeline layout proof
  - Result: PASS, the live dashboard audit timeline on playtest `v0.0.10.2`
    rendered without the timestamp/detail overlap visible in the earlier
    screenshots.
  - Screenshot: `output/submission/02-live-dashboard-runtime-proof.png`.
- Zen browser controlled post report proof
  - Result: PASS, submitted one controlled Reddit report against unchanged locked post `t3_1tm8nak`.
  - Result: PASS, Devvit emitted sanitized `reviewlock.trigger.payload_shape` for `on-post-report`.
  - Result: PASS, Reddit showed native `Reports ignored 1`; ReviewLock dashboard showed `Reports suppressed = 1`, active row `post:1tm8nak` suppressed count `1`, report churn `post:1tm8nak` count `1`, and audit `Report Suppressed 5/25/2026, 3:29:43 PM`.
- Zen browser controlled post body edit proof
  - Result: PASS, posted S02 as `t3_1tnfgqf`, locked it through `Lock review`, edited the body, and observed ReviewLock reopen the lock.
  - Result: PASS, Devvit emitted sanitized `reviewlock.trigger.payload_shape` for `on-post-update`.
  - Result: PASS, dashboard showed active locks decrease from `3` to `2`, `Reopened after edit = 1`, latest reopen `post:1tnfgqf` with reason `content changed`, reopen queue fingerprint delta `c322d267` to `fc05f41b`, audit `Lock Reopened 5/25/2026, 10:53:00 PM`, and runtime proof `postUpdateTrigger verified`.
- Zen browser controlled comment body edit proof
  - Result: PASS, created S08 comment `t1_ontlx1k` under S02, locked it through the comment `Lock review` menu, edited the comment body, and observed ReviewLock reopen the lock.
  - Result: PASS, Devvit emitted sanitized `reviewlock.trigger.payload_shape` for `on-comment-update`.
  - Result: PASS, dashboard showed active locks decrease from `3` to `2`, `Reopened after edit` increase from `1` to `2`, latest reopen `comment:ontlx1k` with reason `content changed`, reopen queue fingerprint delta `9da841c1` to `20abf990`, audit `Lock Reopened 5/25/2026, 11:05:07 PM`, and runtime proof `commentUpdateTrigger verified`.
- `npm run type-check`
  - Result: PASS after submission documentation and dashboard permalink
    hardening patches.
- `npm run test -- --run src/integration.test.ts src/client/state/runtimeContext.test.ts src/client/state/store.test.ts src/client/render.test.ts src/server/services/runtimeHardening.test.ts`
  - Result: PASS, 5 files and 27 tests.
- `npm run test`
  - Result: PASS on earlier local gate, 43 files and 419 tests.
- `npm run lint`
  - Result: PASS.
- `npm run build`
  - Result: PASS.
- `npm run deploy`
  - Result: PASS after form-binding identity and listing-copy hardening.
  - The script ran `npm run type-check`, `npm run lint`, `npm run test`,
    `vite build`, and `devvit upload`.
  - Latest deploy gate: type-check, lint, 43 test files and 444 tests, build,
    and Devvit upload.
  - Devvit upload auto-bumped the uploaded app version to `0.0.10`.
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
- `npx devvit logs reviewlock_dev reviewlock --since 5m --show-timestamps --log-runtime`
  - Result: PARTIAL during the `v0.0.2.62` playtest; CLI reported `listen EADDRINUSE: address already in use :::5678` and then connected to the log stream. No trigger payload logs were emitted during the sample window.
- `npx devvit logs reviewlock_dev reviewlock --since 5m --show-timestamps --log-runtime`
  - Result: PARTIAL during the `v0.0.2.64` playtest; CLI reported `listen EADDRINUSE: address already in use :::5678` and then connected to the log stream. No trigger payload logs were emitted during the sample window.

## Capability Matrix

| Capability                                   | Status     | Evidence                                                                                                                                                                         | Notes                                                                                                            |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Devvit config schema loads                   | verified   | Playtest reached `v0.0.1.19` after removing unsupported manifest fields and recursive dev script.                                                                                | Earlier failures are logged in `decisions.md` as D006 and D007.                                                  |
| Devvit Web server boot                       | verified   | Playtest served `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.                                                                                                  | Runtime server uses `createServer`, `getServerPort`, `reddit`, `redis`, and `context` from `@devvit/web/server`. |
| Subreddit dashboard menu response            | verified   | `Open ReviewLock dashboard` no longer returns the Devvit `UiResponse` unknown-key error after replacing `{ ok: true }` with valid `showForm`/`navigateTo`/`showToast` responses. | Valid response keys confirmed from installed `@devvit/build-pack` validator.                                     |
| Dashboard custom post launch                 | verified   | A ReviewLock dashboard custom post was created in `r/reviewlock_dev` and opened as a Reddit custom post WebView.                                                                 | Existing post observed at `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.                            |
| Dashboard custom post reuse                  | unverified | Implemented and locally tested with cached permalink reuse, unsafe cached permalink rejection, and duplicate creation lease coverage.                                            | Needs controlled playtest proof that a repeated subreddit launch opens the existing dashboard post without creating another post. |
| Dashboard subreddit context                  | verified   | Zen live WebView smoke rendered the dashboard header as `r/reviewlock_dev`; latest recheck used playtest `v0.0.10.2`.                                                           | Client now prefers Devvit-injected WebView context and refuses mismatched weaker runtime context overwrites.     |
| Redis smoke from authorized WebView          | verified   | Zen live WebView smoke clicked `Verify runtime`; the runtime panel showed `redis verified` and `Runtime proof refreshed.`                                                        | Rechecked on playtest `v0.0.10.2` after no-visible-token form and audit timeline hardening.                      |
| Reddit context smoke from authorized WebView | verified   | Zen live WebView smoke clicked `Verify runtime`; the runtime panel showed `redditContext verified` and `Runtime proof refreshed.`                                                | Rechecked on playtest `v0.0.10.2` after no-visible-token form and audit timeline hardening.                      |
| Direct terminal WebView API smoke            | blocked    | Direct API calls to Devvit WebView routes are not authorized without Reddit-injected WebView headers.                                                                            | Smoke endpoints are intentionally meant to run from the embedded dashboard.                                      |
| `approve()` live behavior                    | verified   | `Lock review` on controlled post target `t3_1tm8nak` created an active lock, wrote audit, and runtime status showed `approve verified`.                                          | Verified for a controlled post target; comment target remains unverified.                                        |
| `ignoreReports()` live behavior              | verified   | `Lock review` on controlled post target `t3_1tm8nak` created an active lock and runtime status showed `ignoreReports verified`.                                                  | Verified for a controlled post target; comment target remains unverified.                                        |
| `unignoreReports()` live behavior            | verified   | Dashboard `Unlock` on controlled target `t3_1tm8nak` removed the lock, wrote audit, and runtime status showed `unignoreReports verified`.                                        | Verified through ReviewLock dashboard API and Reddit adapter path.                                               |
| Post report trigger delivery                 | verified   | Controlled report against unchanged locked post `t3_1tm8nak` emitted sanitized `on-post-report` payload-shape logs, kept the lock active, incremented suppressed metrics, and wrote `report_suppressed` audit. Runtime proof reconciliation rechecked this durable audit on playtest `v0.0.2.185`. | Verified for a controlled post target. Comment report trigger remains unverified.                                |
| Comment report trigger delivery              | unverified | `devvit.json` registers `onCommentReport`; routes and services are locally tested.                                                                                               | Need live or controlled comment report proof.                                                                    |
| Post update trigger delivery                 | verified   | Controlled S02 body edit against locked post `t3_1tnfgqf` emitted sanitized `on-post-update` payload-shape logs, changed the fingerprint, reopened the lock, enqueued reopen, and wrote `lock_reopened` audit. | Verified for a controlled post body edit target.                                                                 |
| Comment update trigger delivery              | verified   | Controlled S08 body edit against locked comment `t1_ontlx1k` emitted sanitized `on-comment-update` payload-shape logs, changed the fingerprint, reopened the lock, enqueued reopen, and wrote `lock_reopened` audit. | Verified for a controlled comment body edit target. Comment report trigger remains unverified.                    |
| Post NSFW/spoiler/flair update triggers      | unverified | `devvit.json` registers `onPostNsfwUpdate`, `onPostSpoilerUpdate`, and `onPostFlairUpdate`; routes and services are locally tested.                                             | Need live or controlled flag/flair update proof.                                                                 |
| Devvit logs                                  | verified   | `devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime` captured sanitized `on-post-report`, `on-post-update`, and `on-comment-update` payload-shape evidence during controlled proof. | Comment report, NSFW, spoiler, and flair variants still need payload logs.                                        |

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
- Devvit trigger routes could have received `TriggerEvent` wrapper envelopes
  instead of raw report/update event bodies.
  - Hardened by extracting target ids, subreddit scope, report counts, event ids,
    and timestamps from both raw and wrapped Devvit trigger payloads.
- Devvit form submissions previously trusted editable target ID fields.
  - Hardened by storing server-side Redis form bindings and rejecting submitted
    target or lock mismatches.
- Reopen persistence previously removed active indexes before writing the reopen
  queue event.
  - Hardened by queueing the reopen event before updating lock status.
- Demo data could previously be requested from the demo namespace without
  `demo=true`.
  - Hardened by rejecting unlabeled dashboard reads of `reviewlock_demo`.
- Dashboard target links previously canonicalized safe Reddit permalinks to
  relative paths, which resolved inside the Devvit WebView host instead of
  reddit.com.
  - Hardened by canonicalizing safe relative and full Reddit permalinks to
    absolute `https://www.reddit.com/r/...` links and rendering unsafe
    permalinks as plain text.
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
  - Hardened by keeping known active locks retryable with a
    `target_resolution_failed` warning, clearing report dedupe for retry, and
    writing `runtime_failure` audit data with `active_lock_retry_required`.
    ReviewLock no longer queues a `runtime_uncertain` reopen until it can load
    current content and attempt report restoration.
- Report/update trigger retries after transient target-refetch failure could
  previously leave stale `target_resolution_failed` warnings on active locks
  after later successfully proving unchanged content.
  - Hardened by clearing resolved `target_resolution_failed` warnings on
    successful unchanged retry while preserving non-transient runtime warnings.
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
- Stale-lock relock could still remove the old active lock if stale
  `unignoreReports()` failed before a replacement lock attempt.
  - Hardened by treating stale `unignoreReports()` failure as a blocking
    runtime failure: ReviewLock keeps the stale lock active with warnings,
    records runtime proof/audit, and does not attempt replacement lock writes
    until reports can be returned to normal handling.
- Older proof docs previously contradicted the controlled post-target
  moderation proof boundary.
  - Hardened by reconciling historical docs to point at this file for current
    claim status.
- Runtime subreddit normalization and dashboard launch previously defaulted to
  the controlled playtest subreddit when context was missing.
  - Hardened by requiring concrete subreddit context before normalization or
    custom dashboard post creation.
- Dashboard inline unlock actions previously depended on runtime context alone
  for subreddit scope.
  - Hardened by sending the current dashboard subreddit with unlock requests so
    the server can reject mismatches explicitly.
- Update-trigger reopen flows previously did not record their
  `unignoreReports()` moderation operation result in the runtime proof ledger.
  - Hardened by recording update-trigger `unignoreReports()` success/failure in
    the same runtime proof surface used by lock, unlock, and report-trigger
    paths.
- Active locks with runtime warnings previously looked like ordinary active
  locks in the dashboard.
  - Hardened by rendering a row-level `Needs attention` marker and escaped
    warning text next to the affected active lock.
- Reopen queue and latest reopen cards previously hid runtime warnings attached
  to reopened items.
  - Hardened by rendering a row-level `Needs attention` marker and escaped
    warning text on reopened items.
- Trigger delivery proof previously existed only in docs/logs, while the
  runtime proof ledger kept the broad `triggers` capability unverified.
  - Hardened by recording granular capabilities such as `postReportTrigger`,
    `commentReportTrigger`, and individual update-trigger capabilities when
    those specific routes process accepted payloads.
- Runtime proof defaults previously kept a stale broad `triggers` capability
  after granular trigger proof was added.
  - Hardened by seeding explicit granular trigger capability rows, removing
    legacy broad `triggers` rows on read, and adding regression coverage that a
    fully granular matrix can reach `verified` without stale broad rows.
- Comment report/update route target extraction could previously choose a
  sibling parent post id before the edited/reported comment id.
  - Hardened by making trigger route target extraction kind-aware and adding
    regressions for payloads that contain both `post.id` and `comment.id`.
- Redis smoke failures after subreddit scope was resolved previously returned a
  plain failing response without updating the runtime proof ledger.
  - Hardened by recording failed Redis smoke capability status when the
    subreddit namespace is known, so moderators can see the failure in the same
    runtime proof surface as successful checks.
- Reddit context smoke failures after subreddit scope was resolved previously
  returned a plain failing response without updating the runtime proof ledger.
  - Hardened by recording failed `redditContext` capability status when the
    subreddit namespace is known, matching the Redis smoke behavior.
- Unchanged active-lock update deliveries could previously verify granular
  update-trigger rows even though no edit-break loop completed.
  - Hardened by reserving update-trigger verification for material changes that
    reopen a lock and successfully unignore reports.
- Changed-content report-trigger reopens could previously verify the
  post/comment report-trigger row even when `unignoreReports()` failed.
  - Hardened by keeping the row unverified unless the changed-report path
    returns reports to normal handling.
- Unlock form submissions previously required a disabled display-only `lockId`
  field even though the server had already bound the confirmed lock id to the
  form token.
  - Hardened by treating submitted `lockId` as optional and using the
    Redis-backed binding as the source of truth, while still rejecting present
    mismatches.
- Comment endpoints could previously accept a generic already-prefixed post id
  when no comment-specific id was present.
  - Hardened by rejecting prefixed target ids that contradict the route target
    kind before any target refetch, moderation operation, or runtime proof
    write.
- Redis-backed form bindings previously trusted parsed JSON shape and could be
  left without an expiry if the `expire` write failed after `set`.
  - Hardened by validating binding shape on consume, deleting malformed token
    records, and rolling back the binding write when expiry cannot be set.
- Redis runtime smoke previously proved only string write/read/delete behavior.
  - Hardened by also writing a namespaced sorted set, reading newest-first
    order, and deleting the smoke key before marking the `redis` capability
    verified.
- Reopen dismissal previously could mark an event dismissed before queue
  removal completed.
  - Hardened by mutating queue visibility before the dismissed record write and
    restoring queue visibility if the record write fails, so failed dismissals
    keep reopened items visible.

## Current Claim Boundary

Allowed claims:

- ReviewLock has implemented lock, unlock, report-trigger, update-trigger, dashboard, demo, audit, and runtime proof flows.
- Local type-checks and tests pass for the runtime hardening patches listed above.
- The Devvit app can be playtested in `r/reviewlock_dev`.
- The dashboard menu can open a ReviewLock custom post.
- The dashboard live WebView renders under `r/reviewlock_dev` in Zen and its runtime smoke verifies Redis plus Reddit context.
- Dashboard unlock has live-verified `unignoreReports()` on controlled target `t3_1tm8nak`.
- Dashboard lock review has live-verified `approve()` and `ignoreReports()` on controlled target `t3_1tm8nak`.
- Controlled post report suppression is live-verified for unchanged locked
  target `t3_1tm8nak`, including sanitized trigger payload-shape log, native
  Reddit `Reports ignored 1`, dashboard suppressed count, report churn, and
  audit evidence.
- Controlled post edit reopening is live-verified for locked target
  `t3_1tnfgqf`, including sanitized `on-post-update` payload-shape log,
  fingerprint delta, reopen queue, runtime proof `postUpdateTrigger verified`,
  and audit evidence.
- Controlled comment edit reopening is live-verified for locked target
  `t1_ontlx1k`, including sanitized `on-comment-update` payload-shape log,
  fingerprint delta, reopen queue, runtime proof `commentUpdateTrigger verified`,
  and audit evidence.
- Future trigger deliveries now write granular runtime proof capabilities
  without marking unrelated comment or update trigger paths verified.
- A controlled live scenario matrix exists for the remaining edit/comment
  trigger proof pass in `docs/LIVE_SCENARIO_MATRIX.md`.

Not allowed yet:

- Do not claim live comment report suppression is verified.
- Do not claim live post NSFW/spoiler/flair reopening or comment report trigger
  delivery is verified.
- Do not claim comment-target `approve()`, `ignoreReports()`, or `unignoreReports()` are verified in production-like Devvit runtime.
