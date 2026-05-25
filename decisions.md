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

### D059 - Accept raw and wrapped Devvit trigger payloads

Installed Devvit typings expose both raw report/update event shapes and a
`TriggerEvent` wrapper that can carry `postReport`, `commentReport`,
`postUpdate`, `commentUpdate`, `postFlairUpdate`, `nsfwPostUpdate`, or
`spoilerPostUpdate`.

Decision:

- Report trigger routes extract target id, subreddit, report count, event id,
  and timestamp from either the top-level body or wrapped report payloads.
- Update trigger routes extract target id and subreddit from either the
  top-level body or wrapped update payloads.
- Existing raw route shapes remain supported for tests and local harnesses.

Reason:

- Live trigger delivery is still unverified. Supporting both installed typed
  shapes keeps the edit-break and report-suppression paths from depending on a
  single assumed payload envelope.

### D060 - Runtime smoke routes require explicit subreddit scope

ReviewLock already removed the hidden `reviewlock_dev` fallback from dashboard
launch and runtime subreddit normalization, but the direct runtime smoke helper
still used that controlled test subreddit when neither Devvit runtime context
nor the client request provided scope.

Decision:

- Runtime smoke routes now reject missing runtime and client subreddit scope
  with a structured 400 error.
- Requests with a valid explicit client scope still work in local harnesses, and
  requests with Devvit runtime context continue to prefer the runtime subreddit.

Reason:

- Runtime proof should never invent a production write namespace. A missing
  subreddit context is an operational problem that moderators and proof docs
  should see directly.

### D061 - Review and constrain Antigravity UI output before integration

The dashboard needed a stronger operational visual pass, and Antigravity/Gemini
was delegated only the frontend-owned UI refresh scope.

Decision:

- Keep the accepted changes limited to `src/client/**` and client render tests.
- Remove Antigravity output that added external font imports, inline styles,
  dark one-note dashboard styling, non-ASCII glyphs, or exaggerated dashboard
  patterns.
- Preserve the reviewed-content loop in the first viewport with the exact
  product language: "Lock reviewed content until it changes", "Reports
  suppressed", and "Reopened after edit".
- Keep demo actions visibly read-only and avoid forbidden report-disabling
  framing.

Reason:

- Gemini is useful for widening frontend exploration, but ReviewLock's product
  thesis and proof boundary need stricter review than an autonomous UI agent can
  provide. The integrated result must remain a moderator operations tool, not a
  decorative SaaS landing page.

### D062 - Deepen seeded demo data without upgrading runtime claims

The first demo fixture met the minimum 12-record requirement but still felt too
thin for a moderator-facing operational dashboard.

Decision:

- Seed 18 demo lock records: 12 active locks, 5 reopened locks, and 1 failed
  runtime-warning example.
- Raise seeded suppressed report churn to 47 reports across posts and comments.
- Include multiple edit-break reopen reasons in demo data: content, flair, NSFW,
  and spoiler changes.
- Keep demo runtime status explicitly warning that seeded data is not runtime
  proof, with trigger capability still labeled unverified.

Reason:

- The demo should show a believable mod-team ledger and the complete
  edit-aware reopen loop without implying that seeded records prove live Reddit
  trigger delivery.

### D063 - Use controlled live scenario data, not arbitrary subreddit data

The dashboard currently shows real live data only from the installed/playtested
subreddit namespace, and the user asked whether ReviewLock should gather richer
real data from multiple subreddits or create more varied controlled content.

Decision:

- Treat arbitrary subreddit data as out of scope for proof and product behavior.
- Use `r/reviewlock_dev` as the primary live proof corpus.
- Allow additional moderated test subreddits only if ReviewLock is installed or
  playtested there.
- Keep seeded demo data in the `reviewlock_demo` namespace and never present it
  as live trigger evidence.
- Add `docs/LIVE_SCENARIO_MATRIX.md` as the checklist for controlled posts,
  comments, report events, edit events, and dashboard observations.

Reason:

- Devvit app runtime and storage are subreddit-scoped. Pulling data from
  unrelated communities would be technically unsupported, privacy-risky, and
  outside ReviewLock's no-scraping/no-external-service v1 boundary. A rich
  controlled corpus gives real proof without weakening the product claim
  boundary.

### D064 - Treat report-trigger rollback failure as runtime proof, not noise

Report-trigger suppression can call `ignoreReports()` successfully and then hit
a Redis write failure before counters and audit are durable.

Decision:

- Roll back with the same `unignoreReportsForReviewLock()` moderation helper
  used by lock/unlock flows.
- Record report-trigger moderation operation results in the runtime proof
  ledger.
- If rollback fails, write a `runtime_failure` audit event when possible and
  return the `unignoreReports` warning with the trigger result.
- Clear the report dedupe marker on this runtime-uncertain path so a Devvit
  retry can attempt the event again.

Reason:

- A rollback failure can leave Reddit still ignoring reports after ReviewLock
  failed to persist the suppression ledger. Moderators need that failure visible
  in proof surfaces, and trigger retries must not be blocked by a stale dedupe
  marker.

### D065 - Normalize bare Devvit target ids at route boundaries

Installed Devvit types expose trigger/menu target ids as strings, and Devvit
model mapping already normalizes bare `PostV2.id` and `CommentV2.id` values
after a successful refetch.

Decision:

- Keep `resolveTargetById()` strict for shared service calls that do not know a
  target kind.
- Normalize ids at endpoint boundaries where the kind is known:
  - post menu/report/update routes normalize bare ids to `t3_*`;
  - comment menu/report/update routes normalize bare ids to `t1_*`;
  - already-prefixed thing ids are preserved.
- Add regressions for bare Devvit post/comment ids before live trigger proof.

Reason:

- If a live Devvit payload supplies `post.id` or `comment.id` without a thing
  prefix, rejecting it before refetch would make report/update trigger proof fail
  for a shape the adapter is otherwise prepared to handle. The route is the
  safest place to apply kind-specific normalization.

### D066 - Log trigger payload shape without payload values

Live trigger proof needs evidence of the payload shape Devvit delivers, but
report and update payloads can carry private moderation or content context.

Decision:

- Log `reviewlock.trigger.payload_shape` from the live trigger route bootstrap.
- Include route name, target kind, and boolean/object-shape flags only.
- Exclude raw thing ids, subreddit names, author names, content text, reporter
  names, and report reason text from the logged structure.
- Keep payload values available only inside the trigger handler for target
  resolution and moderation decisions, not in proof logs.

Reason:

- The proof run must compare real runtime payload structure with local route
  fixtures, but ReviewLock's safety boundary forbids collecting reporter
  identities or unnecessary content details in logs.

### D067 - Keep stale relock retryable when stale unignore fails

Stale-lock relock can discover that the current target fingerprint differs from
the stored lock, which means the old reviewed-content lock is stale. Before
creating a replacement lock, ReviewLock must return reports to normal handling
for the stale lock.

Decision:

- Treat stale `unignoreReports()` failure as a blocking runtime failure.
- Keep the existing stale lock active and visible with runtime warnings.
- Record the failed `unignoreReports()` result in runtime proof and audit.
- Do not create a replacement lock until the stale lock can be unignored and
  reopened.

Reason:

- Removing the active lock after `unignoreReports()` fails can leave Reddit
  still ignoring reports with no ReviewLock retry surface. Keeping the active
  lock visible is the stronger moderator-useful state because later report,
  update, unlock, or relock attempts can retry the fail-open transition.

### D068 - Treat controlled PostReport proof as post-only runtime evidence

The first live report trigger proof used the already locked dashboard post
`t3_1tm8nak`, because S01 was authored by the logged-in account and could not be
reported from that same session.

Decision:

- Mark controlled unchanged post report suppression as verified for post targets.
- Keep comment report triggers and all update triggers unverified until their
  own controlled events produce logs and dashboard/audit evidence.
- Record the exact observed payload shape as sanitized shape evidence, not raw
  report details.

Reason:

- The proof shows the real post-report route, target refetch, unchanged
  fingerprint decision, report suppression, Redis metrics, and audit path. It
  does not prove comment payload shape or edit-trigger delivery.

### D069 - Show retryable runtime-warning locks in the main dashboard table

Reviewer feedback identified that active locks carrying runtime warnings could
look identical to healthy active locks after fail-open hardening.

Decision:

- Render a row-level `Needs attention` marker with escaped warning text for
  active locks with `runtimeWarnings`.
- Keep the lock active and retryable; do not add automatic destructive actions.
- Record update-trigger `unignoreReports()` results in runtime proof so the
  runtime banner and row warning can tell the same operational story.

Reason:

- If Reddit moderation operations fail during stale relock or update-trigger
  reopen, moderators need the affected item surfaced where they already scan
  active locks, not only in a global runtime warning or audit history.

### D070 - Record trigger proof as granular runtime capabilities

The runtime proof ledger originally had one broad `triggers` capability. A
single live `PostReport` proves post-report delivery only; it does not prove
comment reports or update triggers.

Decision:

- Record specific capabilities such as `postReportTrigger`,
  `commentReportTrigger`, `postUpdateTrigger`, `commentUpdateTrigger`,
  `postNsfwUpdateTrigger`, `postSpoilerUpdateTrigger`, and
  `postFlairUpdateTrigger` when those route handlers process accepted payloads.
- Keep unrelated trigger capabilities unverified until their own controlled
  events run.
- Render runtime warnings on reopened items, not only active locks, because
  reopened items are the main edit-break attention surface.

Reason:

- This avoids converting one successful report event into an inflated "all
  triggers verified" claim while still allowing the app's own runtime ledger to
  reflect exact proof as it accumulates.

### D071 - Make trigger target extraction kind-aware

Devvit comment report/update payloads can include both the parent `post` object
and the edited/reported `comment` object.

Decision:

- On post trigger routes, extract only post-oriented ids: `targetId`, `postId`,
  and `post.id`.
- On comment trigger routes, extract only comment-oriented ids: `targetId`,
  `commentId`, and `comment.id`.
- Do not let a sibling parent post id win over a comment id on comment routes.

Reason:

- The app must reopen or suppress the reviewed comment lock, not a normalized
  version of the parent post id. Kind-aware extraction is the least surprising
  route-boundary behavior and matches the Devvit payload model.

### D072 - Make menu fallback target extraction kind-aware

Devvit menu requests normally include an exact `targetId`, but context-shaped
payloads can expose both `postId` and `commentId` for comment surfaces.

Decision:

- On post menu endpoints, normalize `targetId` or `postId`.
- On comment menu endpoints, normalize `targetId` or `commentId`.
- Do not allow a sibling parent post id to satisfy a comment lock/unlock menu
  route.

Reason:

- Comment menu proof is still pending, and the safest fallback behavior is to
  keep the route boundary aligned with the requested target kind. Locking or
  unlocking the parent post when the moderator selected a comment would violate
  the reviewed-content ledger.

### D073 - Treat thrown Reddit refetch failures as structured uncertainty

Reddit target refetch can fail transiently during report and update triggers.

Decision:

- Catch refetch exceptions in the shared target resolver and return a structured
  unresolved result with the inferred target kind.
- Let existing report/update trigger fail-open paths reopen a known active lock
  as `runtime_uncertain` when subreddit scope is available.
- Keep missing subreddit scope as a runtime failure without claiming a reopen.

Reason:

- Throwing before trigger fail-open logic can leave an active lock suppressing
  reports after ReviewLock failed to verify current content. Structured
  uncertainty keeps the stronger product invariant: when content integrity
  cannot be proven, the lock should not silently continue.

### D074 - Keep failed demo exit retryable in client state

Demo mode exit is server-backed because seeded Redis state must be removed.

Decision:

- Do not mutate the client from demo mode to live mode until
  `disableDemoMode()` succeeds.
- If demo disable fails, keep `demo === true` and `subreddit ===
  reviewlock_demo` so the moderator can retry the same action.

Reason:

- A browser-only state flip would make demo mode appear exited while server
  cleanup failed. Keeping the old state visible is more honest and keeps the
  retry path available.

### D075 - Record failed Redis smoke attempts in runtime proof when scope is known

Runtime smoke checks can fail after the route has already resolved the
subreddit namespace.

Decision:

- If Redis smoke write/read/delete fails after subreddit scope is known, record
  the failed `redis` capability in runtime proof before returning the failing
  response.
- If subreddit scope is not known, return the failing response without guessing
  a namespace.
- Do not mask the HTTP failure; the dashboard should still show that the
  runtime check failed.

Reason:

- Moderators need failed runtime checks to be visible in the same operational
  proof panel as successful checks. A raw HTTP 500 without a ledger entry makes
  the failure easy to miss and weakens the runtime proof story.

### D076 - Treat live post body edit proof as post-update only

S02 verified the real Devvit post update path for a controlled body edit, but
it did not exercise comment update, flair update, NSFW update, or spoiler update
payloads.

Decision:

- Mark `postUpdateTrigger` verified after the S02 proof.
- Keep comment update, post flair, post NSFW, and post spoiler trigger
  capabilities unverified until their own controlled events run.
- Keep docs and dashboard claim language granular instead of saying all update
  triggers are verified.

Reason:

- The product can now honestly demonstrate the core edit-aware reopen loop for
  posts, while avoiding an inflated runtime claim for trigger variants that
  still need live payload evidence.

### D077 - Treat live comment body edit proof as comment-update only

S08 verified the real Devvit comment update path for a controlled body edit, but
it did not exercise comment report delivery or post flag/flair update payloads.

Decision:

- Mark `commentUpdateTrigger` verified after the S08 proof.
- Keep comment report, post flair, post NSFW, and post spoiler trigger
  capabilities unverified until their own controlled events run.
- Keep comment-target moderation method claims separate because the live
  dashboard proves lock persistence and reopen behavior but not an independent
  native-visible comment `ignoreReports()`/`unignoreReports()` state.

Reason:

- The product can now honestly demonstrate the edit-aware reopen loop for both
  posts and comments, while avoiding inflated runtime claims for report and
  flag/flair variants that still need live payload evidence.

### D078 - Record failed Reddit context smoke attempts in runtime proof when scope is known

Runtime Reddit context smoke checks can fail after the route has already
resolved the subreddit namespace.

Decision:

- If Reddit context smoke cannot return a current username after subreddit
  scope is known, record the failed `redditContext` capability in runtime proof
  before returning the failing response.
- If subreddit scope is not known or Redis is unavailable, return the failing
  response without guessing a namespace or pretending persistence succeeded.
- Keep the HTTP response failing so the dashboard action still exposes the
  immediate runtime error.

Reason:

- Moderators need failed Reddit runtime checks to be visible in the same proof
  panel as successful checks. This keeps `Verify runtime` honest during
  intermittent Devvit context failures and mirrors the Redis smoke failure
  ledger behavior.

### D079 - Use granular runtime proof capabilities for trigger variants

The dashboard proof panel needs to distinguish verified trigger paths from
unverified trigger variants.

Decision:

- Replace the broad legacy `triggers` runtime proof row with explicit rows for
  `postReportTrigger`, `commentReportTrigger`, `postUpdateTrigger`,
  `commentUpdateTrigger`, `postNsfwUpdateTrigger`, `postSpoilerUpdateTrigger`,
  and `postFlairUpdateTrigger`.
- Keep `redditContext` in the first-run default matrix so the runtime smoke
  boundary is visible before anyone clicks `Verify runtime`.
- Drop legacy broad `triggers` rows when reading older runtime proof records and
  add missing default rows as `unverified`.
- Preserve explicit stored warnings such as the demo-mode warning while adding
  the generic unverified-capabilities warning when appropriate.

Reason:

- A single broad trigger row overclaims some paths and underclaims others. The
  live evidence is now granular: controlled post report suppression and
  post/comment body-edit reopen paths are verified, while comment reports and
  post flag/flair variants still need separate proof.
- Demo/live separation is a product guardrail, so runtime normalization must not
  erase the warning that seeded demo data is not live proof.

### D080 - Serialize lock creation per target before moderation side effects

Concurrent lock submissions can otherwise race between the active-lock read and
the final lock write.

Decision:

- Acquire a short-lived Redis `setIfNotExists` creation lease at
  `target:{thingId}:lock:create` before calling `approve()` or
  `ignoreReports()`.
- Recheck the active target lock after the lease is acquired.
- If another creation is already in progress and no finished matching lock is
  visible yet, return a retryable `lock_creation_in_progress` result without
  calling Reddit moderation methods.
- Release the lease in `finally`; the TTL remains a fallback if the runtime dies
  mid-flow.

Reason:

- ReviewLock must maintain one current review state per target. A double-click,
  retry, or two moderators acting from stale menus must not leave duplicate
  active lock rows, inflated metrics, or an unreachable active lock in the
  dashboard ledger.

### D081 - Deduplicate no-id report deliveries by target and report count

Live report payload proof showed useful nested target and report-count data but
not a stable top-level event id.

Decision:

- For report triggers with no `eventId`, use `targetId + reportCount` as the
  fallback dedupe identity for the existing seven-day dedupe TTL.
- Do not include the handler clock minute in that fallback identity.
- If both `eventId` and `reportCount` are absent, use a processing-window
  fallback identity instead of a seven-day `count-unknown` key.
- Keep distinct `reportCount` increases countable, because they represent new
  report churn against the same reviewed item.

Reason:

- Devvit delivery can be at-least-once. A delayed duplicate of the same no-id
  report payload should not inflate `Reports suppressed`, target metrics, or
  audit rows simply because the retry crossed a clock-minute boundary.

### D082 - Treat report mutex contention as retryable unless the event is already deduped

The per-target trigger mutex protects lock state while a report delivery is
being processed, but distinct report events can arrive during that window.

Decision:

- Mark/check the report dedupe key before entering the per-target mutex.
- If the dedupe marker already exists, return `duplicate`.
- If a distinct event acquires its dedupe marker but the target mutex is busy,
  clear that marker and return `runtime_uncertain` with
  `concurrent_trigger_in_progress` so the delivery can be retried without being
  permanently undercounted.

Reason:

- Same-event retries should still collapse. Distinct report bursts must not be
  treated as successful duplicates simply because another report for the same
  target is currently mutating lock state.

### D083 - Fail closed instead of using `reviewlock` as a live subreddit fallback

`reviewlock` is the app name. It is not proof of the current Devvit subreddit
context.

Decision:

- Do not initialize the embedded live dashboard with `reviewlock` when no
  requested or embedded subreddit is available.
- Reject live dashboard API requests and runtime smoke writes that would use
  `reviewlock` only because runtime context is unavailable.
- Keep the isolated `reviewlock_demo` namespace for explicit demo mode only.

Reason:

- Runtime proof must be namespaced to a real subreddit. Falling back to the app
  name can make missing Devvit context look like empty live state or verified
  proof under the wrong Redis namespace.

### D084 - Preserve reopen queue visibility until dismissal audit is durable

Dismissing a reopened item is a human-confirmed moderation workflow action.

Decision:

- Fetch the reopen event, write the `reopen_dismissed` audit event, and only
  then mark the reopen event dismissed and remove it from the open queue.
- If audit write fails, leave the reopen event visible so the moderator can
  retry and traceability is not lost.

Reason:

- The audit ledger is required product behavior. Removing queue visibility
  before audit durability can make a failed dismiss non-retryable and leave no
  durable record of the moderator action.

### D085 - Write lock-created audit only after rollback-triggering persistence succeeds

Lock creation can still roll back if a later Redis write fails after the lock
record itself is saved.

Decision:

- Persist lock-created metrics before appending the `lock_created` audit event.
- If metrics persistence fails and rollback succeeds, do not leave a
  `lock_created` audit event for the removed lock.

Reason:

- The audit ledger should not claim "Reviewed content locked until it changes"
  for a lock attempt that ReviewLock rolled back and returned as not locked.

### D086 - Prefer comment-specific identifiers over generic target identifiers

Devvit comment callbacks can include both a generic target field and
comment-specific fields.

Decision:

- On comment report and comment update routes, inspect `commentId` and
  `comment.id` before generic `targetId`.
- On comment menu routes, inspect `commentId` before generic `targetId`.
- Keep generic `targetId` as a fallback only when no comment-specific id exists.

Reason:

- A generic target can refer to the parent post in mixed callback payloads.
  ReviewLock must not synthesize a comment id from a parent post id and miss the
  active comment lock.

### D087 - Demo mode runtime context updates preserve the demo namespace

Embedded dashboard runtime context can arrive after a bare `demo=true` URL has
initialized the client.

Decision:

- While demo mode is active, `updateSubredditContext()` updates only the stored
  live subreddit used for exiting demo mode.
- The active request namespace remains the isolated `reviewlock_demo`
  namespace until the moderator leaves demo mode.

Reason:

- Demo mode must be deterministic and visibly labeled. Runtime context from the
  live subreddit should not turn a demo dashboard fetch into a rejected or mixed
  live/demo request.

### D088 - Comment report counts prefer the comment object over parent post counts

Comment report payloads may include both parent post metadata and target
comment metadata.

Decision:

- On post report routes, use top-level or post report counts.
- On comment report routes, use comment-specific report counts before generic
  or parent post counts.

Reason:

- Suppressed-report metrics and audit entries must describe the locked target.
  Parent post counts can overstate or mis-dedupe comment report churn.

### D089 - Update trigger mutex contention is retryable runtime uncertainty

An update trigger can arrive while another report/update delivery is already
mutating the same target.

Decision:

- If `breakLockForChangedContent()` cannot acquire the target trigger mutex,
  return `runtime_uncertain` with `concurrent_trigger_in_progress` and
  `ok: false`.
- Do not acknowledge that delivery as a successful `no_lock` no-op.

Reason:

- The edit-aware reopen loop is the core product guarantee. If a concurrent
  report path is only suppressing unchanged content, the update delivery may be
  the signal that should break the lock and must remain retryable.

### D090 - Lock confirmation binds to the reviewed fingerprint

A moderator can open a lock form, review the content summary, and then submit
after the target changed.

Decision:

- Store the menu-time content hash and fingerprint version in lock form
  bindings.
- On lock submit, refetch and fingerprint the current target before moderation
  side effects.
- If the fingerprint differs from the reviewed binding, reject the submit and
  require the moderator to reopen the form.

Reason:

- Human confirmation applies to the content the moderator actually reviewed.
  Silently locking a newer fingerprint would recreate the edit-abuse gap that
  ReviewLock exists to close.

### D091 - Devvit Redis NX success must be explicit

Installed Devvit Redis can return an empty string for a failed `SET ... NX`.

Decision:

- Treat only `OK` or boolean `true` as successful Devvit Redis
  `setIfNotExists()` acquisition.
- Treat empty strings as a failed lease/dedupe/mutex acquisition.

Reason:

- Lock creation guards, report dedupe, and trigger mutexes depend on NX
  semantics. A false acquisition can duplicate locks or let report/update races
  enter critical sections concurrently.

### D092 - Trigger proof is verified only after successful processing

Trigger delivery alone does not prove ReviewLock processed the moderation loop.

Decision:

- Record report and update trigger runtime capabilities as `verified` only
- after the target resolves and the route exercises an active-lock path:
  unchanged active-lock comparison, report suppression, or lock reopen.
- Do not mark no-lock no-op deliveries as verified because they do not prove
  the ReviewLock lock/suppress/reopen loop.
- Do not mark unresolved fail-open deliveries as verified runtime proof.
- Runtime proof evidence now says `processed for` rather than only delivered.

Reason:

- Runtime proof must not overclaim. A payload with a subreddit and target id can
  still fail target refetch or fingerprint processing, and that must remain
  visible as unverified or runtime-uncertain.

### D093 - Manual unlock fails open after Reddit unignore succeeds

Manual unlock can succeed against Reddit and then fail while persisting the
ReviewLock status transition.

Decision:

- If `unignoreReports()` succeeds but the lock status write fails, best-effort
  clear active lock indexes and write a runtime-failure audit.
- Return a visible `redis_write_failed` result instead of throwing a generic
  route error.

Reason:

- A moderator-confirmed unlock must not be silently undone by the next report
  trigger. Clearing active indexes prevents ReviewLock from resuppressing
  reports for content the moderator explicitly unlocked.

### D094 - Accept both Devvit post flag wrapper spellings

Devvit naming around NSFW and spoiler update payload wrappers may use either
method-style or route-style names.

Decision:

- Accept both `postNsfwUpdate` and `nsfwPostUpdate`.
- Accept both `postSpoilerUpdate` and `spoilerPostUpdate`.
- Log both wrapper shapes in sanitized payload-shape evidence.

Reason:

- The remaining live flag-trigger proof should not fail because local fixtures
  used one plausible wrapper spelling while installed Devvit emits another.

### D095 - Restore lock counters when suppression ledger persistence rolls back

The unchanged-report path can write the lock-level suppression count before a
later metric or audit write fails.

Decision:

- If a later success-path write fails after `incrementLockSuppression()`,
  best-effort restore the original lock record before clearing report dedupe.

Reason:

- The flow returns `runtime_uncertain` and rolls Reddit back with
  `unignoreReports()`. The active lock should not retain an extra suppressed
  count for a report delivery that ReviewLock intentionally left retryable.

### D096 - Form moderation actions require trusted runtime subreddit context

Devvit form submissions include client-supplied subreddit fields, but the
runtime subreddit is the trusted scope boundary.

Decision:

- Lock, unlock, and reopen-dismiss form actions require
  `reddit.getCurrentSubredditName()` to return a subreddit that matches the
  submitted form namespace.
- If runtime context is missing or throws, keep the form binding unconsumed and
  do not call moderation methods.

Reason:

- Internal form callbacks can approve, ignore, unignore, or dismiss moderation
  workflow state. During Devvit context outages, ReviewLock should fail closed
  instead of trusting a client-provided subreddit string.

### D097 - Serialize dashboard metric mutations per subreddit

Daily dashboard metrics are stored as JSON records, and trigger mutexes are
target-scoped.

Decision:

- Guard metric read-modify-write operations with a short Redis mutex scoped to
  the subreddit metrics namespace.
- Keep the existing JSON schema for dashboard/API compatibility.
- Release the mutex only when the owner token still matches.

Reason:

- High-volume report churn can update different targets concurrently in the
  same subreddit. Without serialization, two writes can both read the same
  daily counter and overwrite each other, undercounting ReviewLock's suppressed
  report evidence.

### D098 - Roll back suppression metrics when success audit persistence fails

The unchanged-report path treats a final success-audit failure as
`runtime_uncertain` and clears report dedupe for retry.

Decision:

- Track whether suppression metrics were incremented before the success audit.
- If the success audit write fails, best-effort decrement the daily and target
  suppressed-report metrics along with restoring the lock record and
  unignoring reports.

Reason:

- A retryable delivery should not leave visible dashboard metrics claiming a
  durable suppression. Otherwise a retry can double-count the same report
  delivery.

### D099 - Stale relock replacement failures return structured results

Manual lock review can find an existing active lock whose content fingerprint
differs from the current target.

Decision:

- If stale-lock reopening persistence fails before replacement lock creation,
  catch the error, attempt a runtime-failure audit, and return a structured
  `LockFlowResult`.
- Do not proceed to replacement `approve()` or `ignoreReports()` after a failed
  stale-reopen durability step.

Reason:

- The old lock may already be reopened and reports may already be unignored.
  The moderator needs a clear toast/result instead of an unhandled route error,
  and ReviewLock must not half-create a replacement lock after a failed stale
  transition.

### D100 - Reopened state without success audit gets compensating runtime failure

Report and update reopen paths can commit reopened state before appending the
required `lock_reopened` audit event.

Decision:

- If the success `lock_reopened` audit fails after reopen state is already
  visible, append a `runtime_failure` audit best-effort and return
  `runtime_uncertain`.

Reason:

- Edit-break reopening is the core product loop. A reopened queue item without
  either the required success audit or a visible failure audit weakens moderator
  traceability.

### D101 - Dismiss queue mutation failures get compensating runtime failure

Dismiss actions write the moderator dismissal audit before mutating the reopen
queue.

Decision:

- Keep audit-first dismissal so an audit write failure leaves the reopen event
  visible and retryable.
- If queue/event mutation fails after audit succeeds, append a runtime-failure
  audit best-effort and return an explicit dashboard/form error.

Reason:

- Moderator intent and queue state can diverge during transient Redis failures.
  A compensating runtime-failure audit preserves traceability and avoids a
  silent "dismissed" claim when the queue mutation did not cleanly complete.

### D102 - Suppression rollback compensates partial metric writes

Suppression metric persistence can fail after a daily or target metric record
was partially written but before the helper returns successfully.

Decision:

- When report-trigger persistence fails after the lock-level suppression
  counter moves, always best-effort decrement suppressed-report metrics during
  rollback.
- Do this even when the metric increment helper threw before returning.

Reason:

- The trigger path clears dedupe and rolls Reddit back with `unignoreReports()`
  when persistence is uncertain. Dashboard "Reports suppressed" counters must
  not retain partial writes for a delivery ReviewLock deliberately left
  retryable.

### D103 - Stale relock queue writes are compensated if the old lock is still active

Manual relock can queue a stale-lock reopen event before the old lock status
and active indexes are durably updated.

Decision:

- If the stale-reopen transition fails after queueing an event, check whether
  the old lock is still the active lock for the target.
- If it is still active, remove the queued reopen event best-effort and return
  the structured relock failure.
- If the old lock is no longer active, keep the reopen event visible.

Reason:

- ReviewLock should preserve either active-with-no-queue or reopened-with-queue.
  Showing a reopen queue item while the same target is still actively locked
  makes future report-trigger behavior and moderator state hard to trust.

### D104 - Manual unlock audit failures get compensating runtime failure

Manual unlock can return reports to normal handling and clear active lock
indexes before appending the required `lock_unlocked` audit.

Decision:

- If the success `lock_unlocked` audit fails after unlock state is already
  visible, append a `runtime_failure` audit best-effort and return a structured
  failure result.

Reason:

- Human-confirmed moderation transitions need a durable ledger. If the success
  audit is missing, moderators still need an explicit runtime-failure record
  explaining that the lock was removed but audit persistence failed.

### D105 - Lock creation rollback compensates created-lock metrics

Lock creation writes the active lock, then dashboard created-lock metrics, then
the `lock_created` audit.

Decision:

- If the lock creation success block fails after the lock record was saved and
  Reddit rollback succeeds, remove the local lock and best-effort decrement
  daily and target `locksCreated` metrics.
- Apply the decrement even when the metric helper threw before returning.

Reason:

- A failed lock attempt that returns reports to normal handling should not leave
  dashboard metrics claiming a durable created lock. Metrics, active lock
  state, and audit evidence should move together or be visibly rolled back.

### D106 - Metric increment helpers restore snapshots on partial failure

Metric decrement rollback is only correct after an increment helper fully
returns. It is not safe when the helper fails before writing this attempt's
increment.

Decision:

- Snapshot existing daily and target metrics inside lock-created,
  suppressed-report, and reopened metric increment helpers.
- If a helper fails mid-write, restore the previous daily and target records
  best-effort before rethrowing.
- Only call decrement helpers from outer rollback code after the matching
  increment helper returned successfully.

Reason:

- Failed attempts must not overcount partial writes, but they also must not
  subtract valid metrics from earlier successful moderation actions.

### D107 - Reopen metric failures get compensating runtime failure audits

Reopen flows can queue the reopen event and mark the lock inactive before
writing reopen metrics.

Decision:

- Treat reopened metrics and the `lock_reopened` audit as one post-reopen proof
  boundary.
- If either post-reopen metric or audit persistence fails after the reopen
  state is visible, write a compensating `runtime_failure` audit best-effort and
  return `runtime_uncertain`.

Reason:

- Edit-break reopening is ReviewLock's core loop. A visible reopen queue item
  needs either a success audit or a failure audit explaining why the proof
  boundary is incomplete.

### D108 - Demo dashboard mutations are rejected server-side

Demo dashboard rows are seeded judge/demo fixtures and are presented as
read-only in the client.

Decision:

- Reject dashboard unlock and reopen-dismiss mutation routes when `demo=true`
  after scope validation and before Reddit calls, audit writes, or queue/lock
  mutations.
- Continue allowing demo read routes only through the isolated
  `reviewlock_demo` namespace.

Reason:

- Demo mode must stay deterministic even if a caller bypasses rendered controls.
  The read-only contract belongs at the route boundary, not only in client
  button visibility.

### D109 - Runtime report-trigger proof reconciles durable suppression audits

The runtime proof ledger and audit ledger are separate Redis records. A report
trigger can durably suppress a report and write the required
`report_suppressed` audit while the granular runtime capability row is missing
or from an older matrix shape.

Decision:

- When loading runtime proof, reconcile unverified post/comment report-trigger
  capability rows from non-demo `report_suppressed` audit events.
- Require the audit event `targetKind` to be exactly `post` or `comment`
  before deriving a report-trigger capability.
- Do not upgrade `failed` rows from audit evidence.
- Do not use seeded demo audit events as runtime proof.

Reason:

- A durable suppression audit is stronger evidence than a missing unverified
  capability row for the same live namespace. The dashboard should surface that
  proof without weakening failure visibility or confusing demo fixtures with
  live runtime behavior.

### D110 - Update-trigger proof reconciliation requires concrete reason match

Update-trigger runtime proof rows can also be missing even when the reopen audit
was written durably.

Decision:

- Store `triggerCapabilityName` in update-trigger `lock_reopened` audit data.
- Reconcile unverified update-trigger proof from non-demo reopen audits only
  when the audit contains a known update capability name and the expected
  concrete reopen reason for that capability.
- Do not reconcile `runtime_uncertain`, unknown, mismatched, or demo reopen
  audits into verified update-trigger proof.

Reason:

- A durable reopen audit can prove an update-trigger path only when it includes
  both the trigger identity and the material change class. A failed refetch
  proves fail-open behavior, not content-change trigger verification.

### D111 - Reloaded demo URLs still resolve live subreddit context

Demo mode writes `reviewlock_demo` into the URL so seeded reads remain
isolated. A reloaded embedded WebView can therefore boot with
`demo=true&subreddit=reviewlock_demo`.

Decision:

- When the dashboard boots in demo mode with the deterministic demo namespace,
  still infer or fetch the embedded runtime subreddit before the first state
  fetch.
- Preserve the runtime subreddit as the live exit target while continuing to
  read seeded demo data from `reviewlock_demo`.

Reason:

- Demo mode must be isolated, but exiting demo should return moderators to the
  current installed subreddit rather than a hardcoded fallback namespace.

### D112 - Update-trigger proof requires matching target kind

Update-trigger reopen audits are schema-valid even when `targetKind` is absent.

Decision:

- Reconcile update-trigger proof only when `targetKind` matches the trigger
  family: post capabilities require `post`, and `commentUpdateTrigger`
  requires `comment`.
- Keep missing-kind and mismatched-kind reopen audits as audit evidence only,
  not runtime proof upgrades.

Reason:

- Post-only runtime rows such as flair, NSFW, and spoiler updates must not be
  verified by partial legacy audits or comment-target reopen records.

### D113 - Dashboard failures get actionable client notices

ReviewLock's dashboard can fail from several distinct runtime states: Devvit
context mismatch, static preview without live API routes, unavailable runtime
dependencies, network failure, or malformed API responses.

Decision:

- Classify client-side dashboard errors into a small notice taxonomy before
  rendering error states.
- Preserve the raw error text while adding a concrete moderator recovery action.
- Keep these notices non-destructive: no live mutation is suggested while state
  is stale or unverified.

Reason:

- A raw error string is hard to act on during live judging or moderation. The
  dashboard should make the next safe step obvious without hiding the exact
  failure.

### D114 - Update-trigger proof includes successful report unignore

An edit-trigger can correctly reopen a lock even when the Reddit
`unignoreReports()` operation fails.

Decision:

- Continue failing open by surfacing the reopened item when `unignoreReports()`
  fails.
- Do not mark the update-trigger runtime proof row verified from that reopen.
- Reconcile update-trigger audit proof only when `unignoreReportsOk` is true.

Reason:

- ReviewLock's runtime proof for the edit-break loop should mean content was
  resolved, lock state reopened, and reports were unignored. A reopen with a
  failed unignore remains visible operationally, but it is not complete proof
  of the loop.

### D115 - Dashboard headline totals are not display-window counts

Dashboard lists are intentionally bounded, but first-viewport headline metrics
represent product impact.

Decision:

- Count all active lock records for `activeLockCount`, even when the rendered
  active-lock table is capped.
- Sum all persisted daily metrics for `reportsSuppressed` and
  `reopenedAfterEditCount`, while still keeping the daily chart/list response
  bounded.

Reason:

- Display limits should protect the UI, not understate product value for larger
  communities.

### D116 - Trigger proof means the complete ReviewLock loop

Granular trigger rows in runtime proof are read by moderators and judges as
evidence that ReviewLock completed the relevant moderation loop, not merely
that a Devvit delivery reached a route.

Decision:

- Do not mark update-trigger rows verified for unchanged active-lock deliveries.
- Keep update-trigger verification tied to a material fingerprint change,
  visible reopen state, and successful `unignoreReports()`.
- For changed-content report triggers, keep local fail-open reopening visible
  when `unignoreReports()` fails, but do not mark the report-trigger row
  verified.

Reason:

- A no-op delivery and a failed-unignore reopen are useful operational signals,
  but neither proves the end-to-end loop that returns changed reviewed content
  to normal moderator attention.

### D117 - Unlock submit trusts the server-bound lock id

The unlock form displays the lock id for moderator confirmation, but the
authoritative lock id is stored in the Redis-backed form binding created when
the menu rendered.

Decision:

- Treat submitted `lockId` as optional for unlock form callbacks.
- Require `formToken` and scoped subreddit, then consume the binding and use
  `binding.lockId` for the unlock operation.
- If a submitted `lockId` is present, reject it only when it does not match the
  bound lock id.

Reason:

- Disabled form fields can be display-only in platform submit payloads. The
  server-side binding already prevents target swapping, so requiring a disabled
  client field would make valid moderator confirmations fail unnecessarily.

### D118 - Endpoint kind rejects contradictory prefixed target ids

Devvit route payloads can include generic target fields, sibling post fields,
and comment-specific fields in the same delivery.

Decision:

- Keep preferring comment-specific fields over generic target fields on comment
  endpoints.
- Reject already-prefixed ids when their thing kind contradicts the route kind,
  instead of normalizing or refetching them.
- Apply the rule in the shared target id normalizer so menu, report trigger,
  and update trigger routes all fail closed consistently.

Reason:

- A comment endpoint must not operate on a post lock because a partial payload
  supplied only `targetId: t3_*`. Wrong-kind processing can corrupt runtime
  proof and apply moderation operations to the wrong content class.

### D119 - Form bindings are validated and expiry-safe

Lock and unlock confirmation forms depend on Redis-backed one-time form
bindings.

Decision:

- Parse form binding JSON through explicit shape validation before returning it
  to form submit handlers.
- Delete malformed binding records when a token is consumed, so corrupt tokens
  do not remain retryable.
- If creating a binding writes Redis but cannot set the 10-minute expiry,
  delete the just-written binding and fail the menu action.

Reason:

- Form tokens authorize moderator confirmation flows. A malformed binding must
  not be treated as trusted state, and a token without TTL is worse than a
  failed menu response because it can outlive the intended review context.

### D120 - Redis smoke includes sorted-set ordering

ReviewLock depends on Redis sorted sets for audit, reopen, metrics, and trigger
dedupe indexes.

Decision:

- Keep the dashboard's `Verify runtime` Redis check on the existing
  `/api/smoke/redis` route, but expand it beyond string set/get/delete.
- Verify a namespaced sorted set by writing three members, reading newest-first
  with `zRange(..., reverse=true)`, and deleting the smoke key.
- Mark the `redis` runtime capability failed if sorted-set ordering does not
  match the expected newest-first order.

Reason:

- A passing string smoke is not enough proof for ReviewLock's queue and ledger
  behavior. ModMirror's runtime proof matrix caught this as a separate concern;
  ReviewLock should prove the Redis primitive it actually relies on during live
  judging.

### D121 - Failed dismissals keep reopened items visible

Dismissing a reopened item requires both an audit trail and queue mutation.

Decision:

- Write the dismissal audit before mutating the queue.
- In `dismissReopenEvent`, remove the item from the queue before marking the
  event record dismissed.
- If queue removal fails, leave the event record open so the dashboard still
  shows the item.
- If the dismissed record write fails after queue removal, re-add the event to
  the queue before returning failure.

Reason:

- A reopened item should never disappear from moderator view unless ReviewLock
  persisted the dismissal state. Partial failures must favor visibility over a
  clean-looking queue.

### D122 - Redis guard leases fail closed

ReviewLock uses short Redis guard keys for trigger serialization, report
dedupe, metrics mutation, and lock creation.

Decision:

- After creating any guard key that is meant to be temporary, require the Redis
  TTL write to succeed before continuing.
- If TTL setup fails, delete the just-created guard when the owner token still
  matches, return a structured runtime failure, and do not perform moderation or
  metric side effects.
- Keep duplicate report dedupe retryable by clearing the dedupe marker when its
  TTL cannot be set.

Reason:

- A guard without expiry can permanently block lock creation, trigger
  processing, metrics updates, or report retries if the process exits before the
  `finally` cleanup runs. For moderator trust, a visible retryable failure is
  better than a silent stuck state.

### D123 - Persisted timestamps must be strict ISO UTC

ReviewLock sorts and displays persisted locks, reopen events, audit events,
metrics, and config records by timestamp fields.

Decision:

- Treat persisted timestamps as valid only when they are strict
  `YYYY-MM-DDTHH:mm:ss.sssZ` UTC strings that round-trip through `Date`.
- Treat daily metrics dates as valid only when they are real `YYYY-MM-DD`
  dates.
- Skip malformed persisted records during Redis reads instead of accepting
  locale dates, impossible dates, or partially-formatted timestamps.

Reason:

- Bad persisted dates can produce `NaN` scores, unstable ordering, misleading
  dashboard chronology, or malformed runtime proof context. Strict persisted
  data is safer than trying to render questionable state in a moderator-facing
  audit surface.

### D124 - Runtime proof records use the same strict validation boundary

Runtime proof rows are evidence, not decorative dashboard state.

Decision:

- Runtime proof `overall` and capability statuses must be known status values.
- Runtime proof `generatedAt` and capability `checkedAt` timestamps must be
  strict ISO UTC timestamps.
- The server rejects malformed runtime proof writes before persistence, and the
  client rejects malformed runtime proof responses before rendering.

Reason:

- A dashboard judge or moderator should not see unknown status strings or
  malformed evidence timestamps as if they were credible runtime proof. Failing
  back to explicit contract/runtime errors keeps the proof boundary honest.

### D125 - Client API arrays must validate every domain record

The dashboard client receives Redis-backed locks, reopen events, audit events,
and metric rows through JSON API endpoints.

Decision:

- Treat an API list as valid only when the field is an array and every element
  passes the shared domain validator for that record type.
- Validate dashboard overview counts as non-negative integers.
- Validate nested overview `topChurnTargets` and `latestReopenEvent` before
  rendering.
- Surface malformed records as explicit API contract errors instead of
  coercing or partially rendering them.

Reason:

- The server already skips malformed persisted records at the Redis boundary,
  but the browser should remain defensive against bad API responses, stale
  deployments, or accidental schema drift. A hard dashboard error is safer than
  showing moderators misleading locks, metrics, or audit history.

### D126 - Moderator action routes normalize body fields before side effects

Dashboard actions and Devvit form submissions are moderation-control surfaces.

Decision:

- Treat incoming JSON body fields as unknown until validated.
- Require dashboard unlock and dismiss identifiers to be strings before any
  moderation, audit, or queue mutation.
- Ignore malformed optional actor fallback values and prefer the current Reddit
  username when available.
- Ignore malformed optional lock notes, and reject malformed string expiry
  timestamps before consuming a lock form token.

Reason:

- Browser or platform-provided bodies can be malformed. Passing non-strings
  into action services can cause avoidable 500s or persist locks that fail the
  domain schema on the next read. Moderator action routes should either reject
  malformed required inputs before side effects or normalize optional inputs
  into safe absence.
