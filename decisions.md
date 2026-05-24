# decisions.md

## 2026-05-23

### D001 - Product lane

ReviewLock is a reviewed-content integrity tool, not a report filtering app.

Reason:

- Native Reddit already has ignore reports.
- Flag App is close to report filtering.
- The validated unmet need is automatic reopening when reviewed content changes.

### D002 - Default reopen behavior

When locked content changes, ReviewLock reopens the item by changing lock status, unignoring reports when supported, and adding the item to the reopen queue. It does not automatically remove content.

Reason:

- Automatic removal would be destructive and could punish harmless edits.
- The product promise is team awareness and reduced churn, not automatic enforcement.

### D003 - Fingerprint before suppression

Report suppression requires a current fingerprint match. If the current fingerprint cannot be computed with confidence, fail open by reopening or marking runtime uncertain.

Reason:

- Suppressing reports on changed content is the core failure mode the anchor thread warns about.

### D004 - No external services

ReviewLock v1 uses Devvit, Reddit API, Redis, and local app assets only.

Reason:

- Faster build.
- Lower privacy risk.
- Stronger hackathon fit.

### D005 - Demo data is mandatory

Demo mode ships even if live runtime proof is partial.

Reason:

- The judging story requires a visceral before/after loop.
- Test subreddits may not have enough report churn to show value.

### D006 - Remove unsupported Devvit manifest version field

Wave 13 playtest failed with `Error: config is not allowed to have the additional property "version"`.

Decision:

- Remove the top-level `version` property from `devvit.json`.

Reason:

- Runtime schema compatibility is higher priority than keeping a non-schema manifest field.
- Package version remains in `package.json`; Devvit app versioning is handled by upload/publish.

### D007 - Avoid recursive Devvit playtest script

Wave 13 playtest attempted to run the `devvit.json` `scripts.dev` command, which pointed to `npm run dev`. Because `npm run dev` is `devvit playtest`, this recursively invoked playtest and produced a port collision on `:::5678`.

Decision:

- Keep the package-level `dev` script as `devvit playtest`.
- Change `devvit.json` `scripts.dev` to `npm run build` so the Devvit build phase is non-recursive.

Reason:

- Playtest must not call itself.
- The app still builds server and client artifacts before runtime installation.

### D008 - Use Devvit Web server primitives in the runtime entrypoint

Wave 13 found that the in-memory integration app could pass local tests while playtest needed the real Devvit Web server primitives.

Decision:

- `src/index.ts` now creates the app with `createServer`, `getServerPort`, `reddit`, `redis`, and `context` from `@devvit/web/server`.
- Testable app wiring lives in `src/app.ts`.

Reason:

- Runtime proof must exercise the same Reddit and Redis bindings that Devvit provides in playtest.
- Keeping `createApp()` injectable preserves local integration tests without faking the production entrypoint.

### D009 - Keep runtime smoke authorization inside the embedded WebView

Direct terminal calls to WebView API routes do not include Reddit-injected authorization context.

Decision:

- Runtime smoke checks are exposed through the dashboard `Verify runtime` action.
- The checks persist capability status without returning private usernames.

Reason:

- The dashboard is the moderator-facing runtime proof surface.
- Terminal-only calls can validate local route shape but cannot prove Devvit Reddit context.

### D010 - Return only valid Devvit UiResponse keys

Playtest logged `unknown key "ok"` for a menu response.

Decision:

- Internal menu and form routes return `showForm`, `showToast`, and/or `navigateTo`, never `{ ok: true }`.

Reason:

- Installed Devvit build-pack validation accepts only those keys for menu/form UI responses.

### D011 - Source dashboard subreddit from Devvit server context

The embedded dashboard defaulted to `r/reviewlock` even when opened from `r/reviewlock_dev`.

Decision:

- `/api/context` prefers Devvit server `context.subredditName`.
- Client URL/referrer inference is only an early fallback before `/api/context` resolves.

Reason:

- Redis keys and runtime proof must be namespaced by the actual subreddit installation.
- A hardcoded or guessed subreddit risks mixing demo, local, and live proof data.

### D012 - Serialize trigger mutations per target with Redis NX

Report and update triggers can be delivered more than once or overlap on the same target.

Decision:

- Use a short-lived per-target mutex key acquired with Redis NX semantics before mutating lock state, metrics, or reopen queues.
- Treat a failed mutex acquisition as an idempotent duplicate/concurrent no-op rather than a runtime failure.

Reason:

- Duplicate trigger delivery is normal platform behavior.
- Moderators need one coherent lock state, not double-counted suppressions or two reopen events for the same edit.

### D013 - Roll back report suppression when Redis persistence fails

A report trigger can call `ignoreReports()` successfully and then fail while writing the suppression ledger.

Decision:

- Return `runtime_uncertain` with `redis_write_failed`.
- Attempt `unignoreReports()` when Redis fails after `ignoreReports()` succeeds.
- Do not increment suppression metrics or claim successful suppression without durable Redis state.

Reason:

- ReviewLock's value depends on an honest reviewed-content ledger.
- A moderation-side lock without the Redis state needed to reopen later is unsafe.

### D014 - Reopen races are single-writer and fail open

A report trigger and an update trigger can both observe the same changed locked item.

Decision:

- Allow exactly one trigger path to reopen the lock and write metrics/audit/reopen queue state.
- The losing trigger exits as a duplicate/concurrent no-op or observes that no active lock remains.
- If Redis fails during reopen, return `runtime_uncertain` instead of claiming the reopen is fully recorded.

Reason:

- Reopen is non-destructive, but duplicate reopen events erode moderator trust.
- The safe fallback is to avoid suppression and surface uncertainty rather than create contradictory active/reopened state.

### D015 - Include report event identity in audit ids

Wave 19 found that two distinct report trigger events on the same target and timestamp could collapse into one `report_suppressed` audit event.

Decision:

- Include the report trigger event id in report-trigger audit ids when it is available.
- Keep a timestamp and target fallback for payloads that do not include an event id.

Reason:

- Suppressed-report metrics and audit output must agree.
- Moderators need a trustworthy ledger of repeated report churn, especially when multiple reports arrive in the same minute or millisecond.

### D016 - Preserve the existing registered Devvit app identity

Wave 21 confirmed `npx devvit whoami` is logged in as `u/BrightyBrainiac` and `npx devvit view --json` resolves the registered `reviewlock` app owned by that account.

Decision:

- Do not run `devvit init --force` for ReviewLock.
- Harden the existing `reviewlock` registration and playtest path instead of creating a new app id.

Reason:

- Forced init would make the proof harder to review by replacing the app identity.
- The current app already uploads and playtests on `r/reviewlock_dev`.

### D017 - Carry audited dependency overrides for Devvit transitive packages

Wave 21 found `npm audit --omit=dev --audit-level=critical` reported Devvit transitive vulnerabilities through `protobufjs`, `tmp`, and `ws`.

Decision:

- Keep package overrides for `protobufjs@8.4.2`, `tmp@0.2.5`, and `ws@8.20.1`.
- Treat the overrides as part of the Devvit registration hardening path because build, type-check, and playtest all pass with them installed.

Reason:

- The same `tmp` and `ws` override pattern is already present in the known-good ModMirror workspace.
- `protobufjs@8.4.2` removes the remaining critical audit finding and survived Devvit build/playtest verification.

### D018 - Treat dashboard API responses as untrusted at the client boundary

Wave 22 found that the dashboard client trusted response bodies after `res.ok` and could pass missing arrays or malformed shapes into render helpers.

Decision:

- Keep lightweight client-side contract checks for dashboard, runtime, demo, smoke, and Devvit form responses.
- Surface malformed or missing fields as retryable operational errors instead of rendering with undefined data.

Reason:

- Devvit WebView failures, stale bundles, or server-side regressions should never produce a blank moderation dashboard.
- Moderators need an honest retryable failure state more than optimistic rendering with partial or malformed data.

### D019 - Use report count in no-id report trigger dedupe

Wave 23 found that no-id report trigger fallback dedupe used only target id and minute bucket.

Decision:

- For report triggers without an event id, include `reportCount` in the dedupe and audit identity when it is present.
- Keep the target/minute fallback when both event id and report count are missing.

Reason:

- Duplicate no-id deliveries with the same report count should not double-count suppression.
- Two real reports in the same minute commonly differ by report count and should not collapse into one audit/metric event.

### D020 - Restrict demo data writes to the demo namespace

Wave 24 found that demo write functions accepted a scenario or subreddit argument and relied on callers to pass `reviewlock_demo`.

Decision:

- `seedDemoData()` rejects any scenario that is not for `reviewlock_demo`.
- `disableDemoMode()` rejects live subreddit namespaces instead of writing demo-disable markers into live config.
- Demo status reads remain allowed for any namespace so the dashboard can show a safe disabled status.

Reason:

- Seeded demo records must never overwrite real moderator data.
- A live subreddit config should not be mutated by demo-only controls.

### D021 - Treat malformed persisted JSON as absent data

Wave 24 found that malformed JSON in Redis-backed records could throw during dashboard, trigger, or runtime-proof reads.

Decision:

- Persistence readers catch JSON parse failures and return defaults, `undefined`, or filtered lists.
- Writes still store the current typed JSON shapes; no schema migration is required for this wave.

Reason:

- A single corrupt Redis value should not blank ReviewLock or stop moderators from seeing remaining trustworthy state.
- Failing closed keeps suppression and reopen claims honest while preserving recoverability.

### D022 - Keep actor names for audit traceability only

Wave 25 reviewed whether `lockedBy`, `actor`, and `dismissedBy` create moderator surveillance risk.

Decision:

- Keep moderator actor names on state-changing audit records.
- Do not aggregate metrics by moderator, rank moderators, or calculate moderator productivity.
- Keep ReviewLock metrics scoped to content targets, daily totals, suppressed reports, and reopen events.

Reason:

- Mod teams need traceability for lock/unlock/reopen-dismiss actions.
- ReviewLock's value is reducing repeat report churn, not measuring individual moderator performance.

### D023 - Keep high-volume dashboard lists bounded

Wave 26 verified dashboard aggregation with more records than the dashboard should render at once.

Decision:

- Keep active locks, reopen events, audit events, daily metrics, and churn targets capped at their configured dashboard limits.
- Treat `overview.activeLockCount` as the currently loaded active-lock slice count until exact counters are added.
- Do not replace bounded reads with unbounded sorted-set scans for exact counts.

Reason:

- A report-churn dashboard must stay fast and scan-friendly under load.
- Exact large-total counts need explicit counters or a verified Redis cardinality primitive, not unbounded reads.

### D024 - Classify runtime claims by proof level

Wave 27 reviewed claim language across README, docs, and client copy.

Decision:

- Runtime behavior claims use one of these statuses: verified, verified locally, implemented-not-live-verified, implemented-not-final-verified, demo-only, or cut.
- Public copy may claim only verified behavior without a qualifier.
- Live report suppression, live edit reopening, and live moderation method behavior remain implemented-not-live-verified until controlled Reddit playtest proves them.

Reason:

- ReviewLock's submission strength depends on trust in the edit-aware loop.
- Inflated runtime claims would be worse than clearly labeled implemented behavior.

### D025 - Disable one-command public publish until final approval

Wave 30 found that `package.json` still exposed `npm run launch` as `npm run deploy && devvit publish`.

Decision:

- Keep `npm run deploy` as the private upload rehearsal path.
- Change `npm run launch` to fail with an explicit message requiring user approval before public publish.
- Require final manual `devvit publish` only after the live proof and claim-boundary waves pass.

Reason:

- ReviewLock still has live moderation and trigger proof gaps.
- A one-command public publish path is too risky while the app is intentionally carrying unverified runtime claims.

### D026 - Prefer Devvit WebView context for embedded subreddit identity

Wave 31 found that the live WebView could render inside `r/reviewlock_dev` while the client still initialized the dashboard store with the generic fallback `reviewlock`.

Decision:

- When no explicit `?subreddit=` query parameter exists, the client resolves subreddit identity from `globalThis.devvit.context.subredditName` first.
- URL and referrer path inference remain fallbacks.
- A later `/api/context` response cannot overwrite an embedded subreddit when it disagrees with the stronger client-side WebView context.

Reason:

- Runtime proof and Redis smoke must write under the controlled test subreddit namespace.
- A moderation dashboard showing the wrong subreddit is a trust failure even if the surrounding Reddit page is correct.

### D027 - Record moderation method proof from the service path

Wave 32 found that runtime proof remained unverified even after moderation methods were exercised unless the lock/unlock orchestration path explicitly recorded the operation result.

Decision:

- Record `approve`, `ignoreReports`, and `unignoreReports` results in the runtime proof ledger from the lock/unlock service path.
- Treat proof-ledger write failures as non-blocking for the moderation action itself.
- Record failures as `failed` when the moderation operation returns a failed result.

Reason:

- Moderators need the dashboard to distinguish implemented behavior from live-proven behavior.
- A runtime-proof Redis write problem should not turn a completed moderation action into a second operational failure.

### D028 - Use in-dashboard confirmations for WebView destructive actions

Wave 32 found that `window.confirm()` was unreliable inside the Devvit WebView during dashboard unlock testing.

Decision:

- Use inline dashboard confirmation controls for unlock and reopen-dismiss actions.
- Keep the confirmation state local to the client store and clear it after action, cancel, refresh, or failure.

Reason:

- Human confirmation remains mandatory, but it must be visible and reliable in the Devvit WebView.
- Native browser modal behavior is not a trustworthy dependency for embedded moderation actions.

### D029 - Keep dashboard actions on dashboard API routes

Wave 32 found that the embedded dashboard attempted to call `/internal/form/unlock-review-submit` and received a 404.

Decision:

- Dashboard unlock uses `/api/locks/unlock`.
- Dashboard reopen dismissal uses `/api/reopen-queue/dismiss`.
- Internal form endpoints remain for Devvit menu/form callbacks.

Reason:

- Devvit internal endpoints and WebView dashboard API endpoints have different callers and response contracts.
- The dashboard client should receive normal JSON API responses instead of Devvit `UiResponse` objects.

### D030 - Prefer Reddit runtime actor identity over client payloads

Wave 32 found that dashboard action requests included a client-supplied actor string.

Decision:

- Server-side form and dashboard action routes prefer `reddit.getCurrentUsername()` for audit actors.
- Client-supplied actor values are fallback only when runtime username lookup is unavailable.

Reason:

- The client payload is not authoritative identity.
- Audit logs are moderation traceability records and should use the Reddit runtime identity whenever Devvit exposes it.

### D031 - Roll back partially persisted locks when post-persistence writes fail

Wave 32 reviewer analysis found that lock creation could save the active lock
and indexes, then fail on audit or metric writes and only roll back Reddit
`ignoreReports()`.

Decision:

- If any post-save Redis write fails during lock creation, attempt
  `unignoreReports()` and remove the lock record plus active indexes.
- Treat cleanup failure as a runtime risk but do not leave a locally successful
  result when persistence failed.

Reason:

- A dashboard lock without matching Reddit report-ignore state is misleading.
- ReviewLock should fail visibly rather than leaving a half-created reviewed
  content lock.

### D032 - Keep locks active when manual unlock cannot unignore reports

Wave 32 reviewer analysis found that manual unlock removed active indexes even
when Reddit `unignoreReports()` failed.

Decision:

- If `unignoreReports()` fails, keep the lock active, add runtime warnings,
  write a `runtime_failure` audit event, and return a retryable failure.
- Remove active lock indexes only after `unignoreReports()` succeeds.

Reason:

- Reports must not remain ignored without an active ReviewLock record and retry
  surface.
- Keeping the lock active preserves the edit-aware reopen guardrail until
  reports are returned to normal handling.

### D033 - Bind unlock confirmation to the exact lock id

Wave 32 reviewer analysis found that stale dashboard/form unlock submissions
could unlock whichever active lock currently existed for a target.

Decision:

- Dashboard and form unlock requests must include `lockId`.
- The unlock service rejects stale confirmations when the submitted `lockId`
  does not match the current active lock.

Reason:

- Human confirmation applies to the specific lock the moderator saw.
- A newer lock should not be removed by an older confirmation surface.

### D034 - Reject mismatched client-supplied subreddit namespaces

Wave 32 reviewer analysis found that dashboard and runtime smoke routes trusted
client-supplied `subreddit` values.

Decision:

- Prefer the Devvit runtime subreddit from server context or Reddit context.
- Reject dashboard API and runtime smoke requests whose query/body subreddit
  does not match the runtime subreddit.
- Reject dashboard unlock requests when the resolved target subreddit does not
  match the runtime subreddit.
- Keep demo endpoints isolated under their explicit demo namespace.

Reason:

- Moderation ledger data must not be read from or written to another subreddit
  namespace because a WebView client changed a query string or request body.

### D035 - Bind Devvit form submissions with server-stored form tokens

Reviewer analysis found that lock and unlock form target IDs were editable and
then trusted by the submit routes.

Decision:

- Menu routes create short-lived Redis form bindings with action, subreddit,
  target ID, and lock ID where applicable.
- Form submit routes require the binding token and reject target or lock changes
  before calling moderation flows.

Reason:

- The moderator confirmation is for the target summary that ReviewLock showed,
  not for a mutable text field submitted later.

### D036 - Queue reopen events before removing active lock indexes

Reviewer analysis found that a Redis failure after setting lock status to
`reopened` could remove an item from active locks before it appeared in the
reopen queue.

Decision:

- Reopen flows enqueue the reopen event before updating lock status and removing
  active indexes.
- If later persistence fails, the reopen queue still contains a moderator-visible
  event.

Reason:

- The edit-break loop must fail recoverably and visibly.

### D037 - Treat the demo namespace as intrinsically demo-labeled

Reviewer analysis found that seeded demo records could be requested with
`demo=false`.

Decision:

- Dashboard API reads reject `reviewlock_demo` unless demo mode is enabled.
- Demo mode may still intentionally read `reviewlock_demo` even when the Devvit
  runtime subreddit is a live test subreddit.

Reason:

- Demo data must never render as live proof.

### D038 - Validate and escape reason labels at the boundary

Reviewer analysis found that reason strings could be persisted outside the
shared preset enum and rendered without escaping.

Decision:

- Devvit menu reason options now use `LOCK_REASON_PRESETS`.
- Form submit validates the selected reason against `LOCK_REASON_PRESETS`.
- Dashboard reason labels are escaped before rendering.

Reason:

- Redis data and direct form posts are not trusted UI input.

### D039 - Add target-level Open ReviewLock menu actions

Reviewer analysis found that the manifest had only the subreddit dashboard
launcher, not the required post/comment `Open ReviewLock` actions.

Decision:

- Add post and comment menu items labeled `Open ReviewLock`.
- Route both target-level open actions to the same dashboard launch form as the
  subreddit action.

Reason:

- Moderators need a direct target-context path into ReviewLock while reviewing a
  post or comment.

### D040 - Keep failed lock state visible when Reddit rollback fails

Reviewer analysis found that a Redis failure after `ignoreReports()` could hide
reports without leaving a visible ReviewLock record if `unignoreReports()`
rollback also failed.

Decision:

- Use the moderation result wrapper for rollback.
- Record runtime proof for rollback success or failure.
- If rollback fails, keep a `failed` lock record with runtime warnings and write
  a runtime failure audit event when Redis is still available.

Reason:

- A potentially still-ignored Reddit target must remain visible to moderators
  rather than disappearing from ReviewLock state.

### D041 - Make report-trigger dedupe retryable and bounded

Reviewer analysis found that report-trigger dedupe keys were written before the
trigger reached a terminal state and never expired.

Decision:

- Keep early dedupe reservation for concurrent duplicate suppression.
- Clear the dedupe key before returning `runtime_uncertain`.
- Expire successful dedupe markers after seven days.

Reason:

- Devvit trigger delivery can be at least once, and transient failures must be
  retryable without allowing permanent key growth.

### D042 - Pass explicit rank options to Devvit Redis zRange

Installed Devvit typings require `zRange` options to include `by`.

Decision:

- The Devvit Redis adapter passes `{ by: 'rank' }` for sorted-set reads and
  `{ by: 'rank', reverse: true }` for newest-first reads.

Reason:

- Dashboard sorted-set reads should match the live Devvit Redis client contract,
  not just the in-memory test double.

### D043 - Treat runtime proof text as untrusted dashboard data

Reviewer analysis found that Redis-backed runtime proof capability names,
warnings, and verification messages were rendered without escaping.

Decision:

- Escape runtime proof text and sanitize status class suffixes in the client.

Reason:

- Runtime proof is a trust surface and must not render malformed Redis text as
  HTML.

### D044 - Surface dashboard action messages on non-200 responses

Reviewer analysis found that 403 dashboard action responses with `{ message }`
were displayed as generic HTTP errors.

Decision:

- API client error extraction now falls back from `error` to a string `message`.

Reason:

- Protective moderation-scope rejections should be understandable to moderators.

### D045 - Enforce runtime subreddit scope on Devvit form submits

Reviewer analysis found that lock and unlock form callbacks consumed valid form
tokens from the submitted subreddit without comparing that subreddit to the
current Devvit runtime subreddit.

Decision:

- Lock and unlock form submit routes now run the same Devvit runtime subreddit
  scope check used by reopen-dismiss forms.
- If runtime and submitted subreddit differ, ReviewLock returns a neutral toast
  before consuming the form token or calling Reddit moderation methods.

Reason:

- A stale or replayed Devvit form must not approve, ignore, unignore, or unlock
  content outside the subreddit where the moderator is currently acting.

### D046 - Validate runtime proof records before dashboard use

Reviewer analysis found that syntactically valid but malformed Redis runtime
proof JSON could be returned to the client and crash the dashboard renderer.

Decision:

- Server runtime proof loading now validates `overall`, `generatedAt`,
  `capabilities`, and `warnings`; malformed records fall back to the default
  unverified proof matrix.
- The client API contract also validates runtime proof shape before handing data
  to render helpers.

Reason:

- Runtime proof is most important during failures, so corrupted proof state must
  degrade to an honest unverified status rather than breaking the dashboard.

### D047 - Remove active indexes if reopen status write fails after queueing

Reviewer analysis found that Redis could accept a reopen event but fail the
subsequent lock-status write, leaving the item both visible in the reopen queue
and still suppressible through the active target index.

Decision:

- Report-trigger and update-trigger reopen paths still queue the reopen event
  before the lock status update so moderator-visible reopen evidence is not lost.
- If the lock status update throws after queueing, ReviewLock removes active
  lock indexes as a compensating action before returning `runtime_uncertain`.

Reason:

- A queued reopen must never continue to behave like an active suppression lock.
  In a partial Redis failure, preserving visibility and stopping further
  suppression is safer than preserving the old active index.

### D048 - Treat demo URL bootstrap as demo namespace state

Reviewer analysis found that a reload of `?demo=true` could pair demo mode with
the live subreddit namespace and trigger the server's demo isolation guard.

Decision:

- When the dashboard starts with `initialDemo: true`, the store immediately uses
  `reviewlock_demo` for fetches while preserving the original live subreddit for
  exit from demo mode.
- Demo toggle URLs now write `subreddit=reviewlock_demo` when entering demo and
  restore the live subreddit parameter when leaving demo.

Reason:

- Demo mode is mandatory and must survive reloads or shared URLs without
  accidentally requesting live data under the demo flag.

### D049 - Validate Redis dashboard ledger records at service boundaries

Reviewer analysis found that valid JSON with missing or wrong fields could pass
through lock, reopen, audit, and metric services and later crash dashboard
render helpers.

Decision:

- Shared schema guards now validate `ReviewLockRecord`, `ReopenEvent`,
  `AuditEvent`, `DailyMetrics`, and `TargetMetrics`.
- Redis service readers return `undefined` for syntactically valid but
  malformed records, matching the existing invalid-JSON fallback behavior.

Reason:

- Redis-backed moderation state is a runtime trust boundary. A partial write or
  corrupt record should disappear from dashboard lists until repaired, not break
  the entire moderator dashboard.

### D050 - Make active lock creation idempotent per target

Reviewer analysis found that repeated lock submissions could create stale
active ledger rows for the same target and double-count lock metrics.

Decision:

- `lockReviewedContent()` checks for an existing active lock after resolving the
  target and before fingerprinting or Reddit moderation calls.
- If a lock is already active for the target, the flow returns that lock with a
  neutral already-locked message and does not call `approve()` or
  `ignoreReports()` again.

Reason:

- ReviewLock's ledger should represent one current review state per target, and
  duplicate form submits or retries should not inflate metrics or strand older
  active lock rows.

### D051 - Reopen known locks on report-trigger target resolution uncertainty

Reviewer analysis found that report triggers returned `runtime_uncertain` on
target resolution failure while leaving a known active lock suppressible.

Decision:

- When a report trigger cannot load the current target but the payload supplies a
  subreddit, ReviewLock now looks up the active target lock.
- If an active lock exists, ReviewLock queues a `runtime_uncertain` reopen event,
  marks the lock reopened, records a lock-reopened audit event, and returns
  `runtime_uncertain` without clearing the dedupe marker.
- If no subreddit or active lock is available, ReviewLock keeps the retryable
  runtime-failure behavior and clears the dedupe marker.

Reason:

- Fingerprint uncertainty must fail open. A known active lock whose current
  content cannot be loaded should return to moderator attention rather than
  remain eligible for future suppression.

### D052 - Fingerprint before duplicate-lock idempotency return

Reviewer analysis found that returning an existing active lock before comparing
the freshly refetched fingerprint could preserve a stale lock if update triggers
were missed or delayed.

Decision:

- Lock submission now computes the current fingerprint before returning an
  existing active lock as a duplicate.
- If the existing lock fingerprint matches, ReviewLock returns the active lock
  without another Reddit moderation call.
- If the fingerprint differs, ReviewLock reopens the stale lock, records a
  reopen event and metrics, then continues creating a new lock for the
  moderator-reviewed current content.

Reason:

- The lock form is also a fresh content read. It must uphold "locked until
  edited" even when automatic update delivery has not already broken the old
  lock.

### D053 - Keep seeded demo dashboard actions read-only

Reviewer analysis found that demo rows rendered live unlock and reopen-dismiss
controls even though those API calls did not carry demo scope.

Decision:

- Demo dashboard rendering now replaces unlock and dismiss controls with a
  read-only demo status marker.
- Live mode keeps the existing inline confirmation controls.

Reason:

- Seeded demo data should tell the four-beat product story without attempting
  live Reddit moderation operations or failing the demo namespace guard.

### D054 - Unignore stale locks before replacement relock attempts

Reviewer analysis found that stale-lock relock reopened the old lock before
proving the replacement `ignoreReports()` call succeeded.

Decision:

- When lock review detects that an active lock's fingerprint is stale, ReviewLock
  calls `unignoreReports()` and records runtime proof before reopening the stale
  lock and attempting the replacement lock.
- If the replacement `ignoreReports()` fails, the old lock is already fail-open
  and the replacement failed lock remains visible for retry/debugging.

Reason:

- Changed content must not remain report-suppressed without an active lock that
  can be evaluated later. The relock path must preserve fail-open behavior even
  when the replacement lock cannot be established.

### D055 - Keep proof docs aligned to current claim boundary

Reviewer analysis found older proof docs still said all live moderation methods
were unverified even after controlled post-target proof passed.

Decision:

- Historical wave docs may keep their original local-harness scope, but stale
  live-status statements now point to `docs/RUNTIME_PROOF.md`.
- Current boundary wording is: controlled post-target `approve()`,
  `ignoreReports()`, and `unignoreReports()` are verified; comment-target
  moderation methods and live report/update trigger delivery remain unverified.

Reason:

- Submission copy and final audit need one consistent proof boundary. Inconsistent
  docs invite either underclaiming verified post-target behavior or overclaiming
  unverified trigger/comment behavior.

### D056 - Do not default production writes to the controlled playtest subreddit

The dashboard-launch form previously used `reviewlock_dev` when Devvit did not
provide a current subreddit.

Decision:

- Runtime subreddit normalization now requires a concrete subreddit value.
- Dashboard custom-post launch refuses to submit if the current Devvit subreddit
  cannot be determined.
- Local test and playtest callers that need `reviewlock_dev` must pass it
  explicitly through runtime context or the CLI target.

Reason:

- `reviewlock_dev` is the controlled proof subreddit, not a production fallback.
  A missing runtime context should be visible and non-destructive instead of
  creating a dashboard post in the wrong community.

### D057 - Dashboard write actions carry explicit subreddit scope

Dashboard read routes and reopen-dismiss writes already carried the current
dashboard subreddit. Inline unlock actions depended on runtime context alone.

Decision:

- The dashboard API client now sends the current subreddit on unlock requests as
  a query parameter.
- The store passes its active live subreddit into unlock actions, matching the
  existing dismiss path's explicit scope.

Reason:

- Moderator actions should be scoped by both the Devvit runtime context and the
  dashboard state the moderator is looking at. Explicit client scope gives the
  server another mismatch check and prevents hidden fallback behavior in weaker
  or local runtime contexts.

### D058 - Preserve Devvit typed target fields in adapter mapping

Installed Devvit `PostV2` and `CommentV2` typings use field names that differ
from the higher-level Reddit client model names for some ReviewLock-critical
data.

Decision:

- Post mapping accepts `selftext` as the body fallback, `numReports` as the
  report-count fallback, and `author`/`authorId` as author fallbacks.
- Comment mapping accepts `author` as the author fallback.
- Existing Reddit-client model names remain preferred when present.

Reason:

- Fingerprints and report churn metrics must not silently lose body text,
  report counts, flair, or author context if Devvit returns a nested trigger
  model shape instead of the higher-level Reddit client shape.
