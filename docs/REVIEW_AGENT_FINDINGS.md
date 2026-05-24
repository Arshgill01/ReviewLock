## 2026-05-24 22:46 IST - Finding

- Severity: high
- Area: Lock creation rollback / Redis partial write
- Evidence: `src/server/services/lockFlow.ts:149-166` writes the active lock and indexes with `saveLock()`, then writes audit and metrics. The catch block at `src/server/services/lockFlow.ts:174-180` only calls `deps.reddit.unignoreReports(...)` and returns `redis_write_failed`; it does not delete or mark failed the lock that may already have been persisted. `src/server/services/locks.ts:20-30` shows `saveLock()` writes the lock record, sorted-set active index, active-by-target hash, and target lock key before later audit/metric writes run.
- Why it matters: If `saveLock()` succeeds but `appendAuditEvent()` or `recordLockCreatedMetric()` fails, ReviewLock can leave an active Redis lock/index after rolling Reddit reports back to normal handling. The dashboard and future triggers may treat content as locked even though reports are no longer ignored, which breaks the reviewed-content ledger and creates misleading runtime state.
- Suggested fix: Add a regression test with a Redis adapter that fails after `saveLock()` but before audit/metrics complete, then make the catch path remove active lock indexes or mark the lock `failed` in a durable, recoverable way. Consider a transaction-style helper for lock creation so the service can distinguish "lock not saved" from "lock saved but later write failed."
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/locks.ts`, `src/server/services/lockFlow.test.ts`

## 2026-05-24 22:46 IST - Finding

- Severity: high
- Area: Unlock failure handling / reports may remain ignored
- Evidence: `src/server/services/unlockFlow.ts:57-69` calls `unignoreReportsForReviewLock()` and then unconditionally updates the lock status to `unlocked`, removing active indexes through `updateLockStatus()`. The result returns `ok: unignoreResult.ok` at `src/server/services/unlockFlow.ts:91-98`, but by then the active lock has already been removed even when `unignoreReports()` failed. `src/server/services/unlockFlow.test.ts:61-79` covers only the successful unignore path.
- Why it matters: If Reddit rejects or times out on `unignoreReports()`, the target can remain ignored in Reddit while ReviewLock removes the active lock and dashboard retry surface. That is the unsafe inverse of the product promise: reports may stay suppressed without an active reviewed-content lock that can reopen on edits.
- Suggested fix: Add a failing-`unignoreReports()` regression test. On failure, keep the lock active with a runtime warning or move it to a distinct failed/attention state that stays visible and retryable; do not remove active indexes until reports are actually returned to normal handling or the failure is explicitly acknowledged.
- Files reviewed: `src/server/services/unlockFlow.ts`, `src/server/services/unlockFlow.test.ts`, `src/server/services/moderation.ts`

## 2026-05-24 22:46 IST - Finding

- Severity: high
- Area: Devvit trigger payload parsing
- Evidence: `src/routes/triggers.report.ts:14-32` and `src/routes/triggers.update.ts:14-29` extract only top-level `targetId`, `postId`, or `commentId`. Installed Devvit typings show report/update events carry nested objects instead: `node_modules/@devvit/protos/json/devvit/events/v1alpha/events.d.ts:37-48` defines `PostUpdate` and `PostReport` with `post?: PostV2`, and `events.d.ts:77-85` defines `CommentUpdate` and `CommentReport` with `comment?: CommentV2`. `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/postv2.d.ts:24-25` and `commentv2.d.ts:8` show those nested objects contain `id`. Current route tests in `src/routes/triggers.report.test.ts:69-72` and `src/routes/triggers.update.test.ts:69-72` use synthetic top-level `postId`, so they do not prove the installed Devvit payload shape.
- Why it matters: Live `PostReport`, `CommentReport`, `PostUpdate`, and `CommentUpdate` callbacks can hit the route with `body.post.id` or `body.comment.id` and receive `400 ... target id is required`, preventing report suppression and edit-aware reopen from running at all. This matches the current proof gap that trigger delivery is unverified.
- Suggested fix: Extend trigger body parsing to accept `body.post?.id` and `body.comment?.id` alongside the current synthetic fields, normalize to `t3_`/`t1_` as needed, and add route tests using the installed Devvit JSON shape for report and update events.
- Files reviewed: `src/routes/triggers.report.ts`, `src/routes/triggers.update.ts`, `src/routes/triggers.report.test.ts`, `src/routes/triggers.update.test.ts`, `node_modules/@devvit/protos/json/devvit/events/v1alpha/events.d.ts`, `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/postv2.d.ts`, `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/commentv2.d.ts`

## 2026-05-24 22:46 IST - Finding

- Severity: medium
- Area: Proof and API contract documentation drift
- Evidence: `docs/API_CLIENT_CONTRACT_PROOF.md:23-24` still says the dashboard client calls `POST /internal/form/unlock-review-submit` and `POST /internal/form/reopen-action-submit`, but the current client calls `/api/locks/unlock` and `/api/reopen-queue/dismiss` in `src/client/state/api.ts:232-260`, matching the new routes in `src/routes/api.dashboard.ts:183-274`. `docs/SAFETY_PRIVACY_AUDIT.md:92-95` says live `unignoreReports()` remains unverified, while `docs/RUNTIME_PROOF.md:70-72` and `docs/MODERATION_METHOD_PROOF.md:16-20` now mark `unignoreReports()` verified for the dashboard unlock path. `docs/CLAIM_COPY_AUDIT.md:23` also still says runtime smoke namespace proof is `implemented-not-final-verified`, while `docs/RUNTIME_PROOF.md:66-68` marks dashboard subreddit context, Redis smoke, and Reddit context smoke verified.
- Why it matters: ReviewLock is intentionally proof-bound. Stale docs can cause the final submission package or README to cite the wrong endpoint contract or under/overstate runtime proof boundaries, making the claim audit unreliable.
- Suggested fix: Update the stale proof docs after the main runtime/API changes settle. In particular, revise the dashboard action endpoint map, distinguish verified `unignoreReports()` dashboard-unlock proof from unverified lock/report/edit paths, and reconcile runtime smoke namespace status with `docs/RUNTIME_PROOF.md`.
- Files reviewed: `docs/API_CLIENT_CONTRACT_PROOF.md`, `docs/SAFETY_PRIVACY_AUDIT.md`, `docs/CLAIM_COPY_AUDIT.md`, `docs/RUNTIME_PROOF.md`, `docs/MODERATION_METHOD_PROOF.md`, `src/client/state/api.ts`, `src/routes/api.dashboard.ts`

## 2026-05-24 22:50 IST - Finding

- Severity: high
- Area: Unlock confirmation does not bind to the confirmed lock
- Evidence: `src/routes/menu.ts:94-120` renders an unlock form with both `targetId` and `lockId`, and `src/client/components/LockTable.ts:21-38` / `src/client/main.ts:51-57` carry `lockId` through the dashboard confirmation UI. The server-side submit path drops that identity: `src/routes/forms.ts:27-30` defines `UnlockSubmitBody` without `lockId`, `src/routes/forms.ts:102-111` passes only `targetId` to `unlockReviewedContent()`, `src/routes/api.dashboard.ts:24-27` and `src/routes/api.dashboard.ts:196-207` do the same for dashboard unlock, and `src/client/state/api.ts:232-238` posts only `{ targetId, actor }`. `src/server/services/unlockFlow.ts:43-55` then unlocks whichever active lock currently exists for that target.
- Why it matters: A moderator can confirm an unlock against stale UI. If the original lock reopened or was replaced by a newer lock between form/dashboard render and submit, ReviewLock will unlock the current active lock for that target instead of the lock the moderator actually confirmed. That weakens the mandatory human confirmation guardrail and can remove a newer review lock unintentionally.
- Suggested fix: Include `lockId` in both dashboard and form unlock request bodies, require it in the API/form routes, and make `unlockReviewedContent()` load and unlock only the matching active lock. If the active lock id no longer matches, return a stale-confirmation message and force the moderator to refresh/reconfirm. Add regression tests for stale unlock form/dashboard confirmation.
- Files reviewed: `src/routes/menu.ts`, `src/routes/forms.ts`, `src/routes/api.dashboard.ts`, `src/client/components/LockTable.ts`, `src/client/main.ts`, `src/client/state/api.ts`, `src/server/services/unlockFlow.ts`, `src/routes/forms.test.ts`, `src/routes/api.dashboard.test.ts`

## 2026-05-24 22:50 IST - Finding

- Severity: high
- Area: Client-controlled subreddit namespace for dashboard/runtime/reopen APIs
- Evidence: `src/routes/api.dashboard.ts:35-36` chooses the Redis namespace from `?subreddit=` or `x-subreddit` and the read routes use it directly at `src/routes/api.dashboard.ts:92-120`, `src/routes/api.dashboard.ts:134-178`. The dismiss write route accepts `body.subreddit` first at `src/routes/api.dashboard.ts:231-247`. The Devvit form dismiss path also requires and trusts `body.subreddit` at `src/routes/forms.ts:151-164`. Runtime smoke writes proof to the query-provided namespace at `src/routes/api.ts:49-70` and `src/routes/api.ts:101-120`; `src/server/services/runtimeHardening.ts:13-20` only validates subreddit syntax, not that it matches the Devvit runtime subreddit. Meanwhile `/api/context` does have access to `deps.getCurrentSubredditName` / `reddit.getCurrentSubredditName()` at `src/routes/api.ts:33-39`, but the dashboard data and mutation routes do not use that authority.
- Why it matters: A WebView client can read dashboard state, write runtime proof, or dismiss reopen events in any syntactically valid namespace by changing query/body values. That violates the namespace/isolation guardrail and can mix demo, test, or another subreddit’s moderation ledger if the Redis store is shared at the app level.
- Suggested fix: Centralize server-side subreddit resolution for dashboard API, runtime smoke, and form/dashboard dismiss actions. Prefer Devvit server context/current subreddit and reject mismatched client-supplied subreddit values, except for explicitly isolated demo endpoints. Add tests that a mismatched `?subreddit=` or `body.subreddit` is rejected and cannot read/write another namespace.
- Files reviewed: `src/routes/api.dashboard.ts`, `src/routes/forms.ts`, `src/routes/api.ts`, `src/server/services/runtimeHardening.ts`, `src/app.ts`, `src/client/state/api.ts`

## 2026-05-24 22:50 IST - Finding

- Severity: medium
- Area: Wave 32 proof status contradiction
- Evidence: `docs/RUNTIME_PROOF.md:34-36` and `docs/RUNTIME_PROOF.md:70-71` now mark controlled post-target `approve()` and `ignoreReports()` live behavior verified. `docs/MODERATION_METHOD_PROOF.md:18-19` says the same. But `TODO.md:35`, `TODO.md:44`, and `TODO.md:56-57` still leave Wave 32 and the `approve()`/`ignoreReports()` proof tasks unchecked, and `log.md:587-611` still records the Wave 32 pass as partial with the lock submit attempt inconclusive and live `approve()`/`ignoreReports()` incomplete.
- Why it matters: Runtime proof is the claim boundary for ReviewLock. Contradictory proof artifacts make it unclear whether the latest lock proof actually completed and whether Wave 32 can be considered done before Wave 33/34 or submission copy work.
- Suggested fix: Reconcile the proof artifacts in one pass: either update `TODO.md` and `log.md` with the successful controlled lock proof command/browser evidence, or downgrade `docs/RUNTIME_PROOF.md` and `docs/MODERATION_METHOD_PROOF.md` until that evidence is documented. Include the exact observed URL/version and command/session details for the successful lock submit.
- Files reviewed: `docs/RUNTIME_PROOF.md`, `docs/MODERATION_METHOD_PROOF.md`, `docs/KNOWN_LIMITATIONS.md`, `TODO.md`, `log.md`, `decisions.md`

## 2026-05-24 23:05 IST - Codex Resolution Notes

- Addressed partial lock creation writes by adding lock cleanup on post-save Redis failures and a regression test that forces metric persistence failure after `saveLock()`.
- Addressed unsafe unlock failures by keeping the lock active when `unignoreReports()` fails, recording runtime proof and a `runtime_failure` audit event, and adding regression coverage.
- Addressed nested Devvit trigger payload parsing by accepting `post.id` and `comment.id` for report and update routes with route tests for nested post/comment payloads.
- Addressed stale unlock confirmations by requiring `lockId` on dashboard/form unlock submissions and rejecting mismatches before Reddit calls.
- Addressed client-controlled namespace risk by making Devvit runtime subreddit authoritative for dashboard and runtime smoke routes, rejecting mismatched client-supplied namespaces, and adding route/contract tests.
- Reconciled proof docs, TODO, and log entries to reflect controlled post-target `approve()`, `ignoreReports()`, and `unignoreReports()` proof while keeping comment-target and trigger proof unverified.

## 2026-05-24 22:53 IST - Finding

- Severity: high
- Area: Lock/unlock form target identity is editable and trusted
- Evidence: `src/routes/menu.ts:51-92` builds the `Lock review` form with an enabled string `targetId` field whose `defaultValue` is the resolved target id, while the disabled `targetSummary` still describes the originally resolved content. `src/routes/forms.ts:73-87` then trusts `body.targetId` and locks whatever target id the submitted form contains. The unlock form has the same pattern at `src/routes/menu.ts:94-122`, and `src/routes/forms.ts:102-111` trusts the submitted `targetId`. Existing tests in `src/routes/menu.test.ts:21-43` only assert the default target id is present, and `src/routes/forms.test.ts:42-63` submits a direct `targetId`; there is no test proving the submitted target is bound to the menu target the moderator reviewed.
- Why it matters: A moderator can accidentally or intentionally change the target id after reviewing the summary, causing ReviewLock to approve/ignore/unignore a different target than the content shown in the form. That breaks the human-confirmation requirement because the confirmation is tied to displayed context, not the mutable submitted target id.
- Suggested fix: Treat target identity as server-bound form data, not an editable field. Use `showForm.data` or an immutable/hidden field if Devvit supports it, make the displayed target id disabled/read-only, and have the submit route reject mismatches between submitted target id and server-provided form data. Add tests that changing `targetId` after form construction cannot lock or unlock a different target.
- Files reviewed: `src/routes/menu.ts`, `src/routes/forms.ts`, `src/routes/menu.test.ts`, `src/routes/forms.test.ts`

## 2026-05-24 22:53 IST - Finding

- Severity: medium
- Area: Demo data can render without demo labeling
- Evidence: `src/routes/api.dashboard.ts:35-38` derives the data namespace from `?subreddit=` and the demo flag independently from `?demo=true`. The dashboard routes then load locks/reopen/audit/metrics from that namespace at `src/routes/api.dashboard.ts:92-178` and return `demo: demoFrom(context)` rather than deriving demo state from the loaded records or namespace. `src/server/services/dashboard.ts:76-79` also just propagates `options.demo`. `src/client/pages/DashboardPage.ts:69-75` renders the demo banner only from `store.demo`, and `src/client/components/DemoBanner.ts:1-9` returns no banner when `store.demo` is false. Because demo seeding writes persistent records under `reviewlock_demo` in `src/server/services/demoMode.ts:65-100`, a request such as `/api/locks?subreddit=reviewlock_demo&demo=false` can return seeded demo records while the client renders live mode with no demo banner.
- Why it matters: The product requires demo data to be visibly labeled. Showing seeded locks/reopens/metrics as live-looking data undermines runtime proof boundaries and can mislead reviewers or moderators about what has actually happened in a subreddit.
- Suggested fix: Treat `reviewlock_demo` as intrinsically demo-labeled at the server boundary, or reject dashboard reads of the demo namespace unless `demo=true`. Add tests that seeded demo records cannot be rendered without `demo: true` and that the dashboard banner appears whenever any loaded data comes from the demo namespace.
- Files reviewed: `src/routes/api.dashboard.ts`, `src/server/services/dashboard.ts`, `src/server/services/demoMode.ts`, `src/client/pages/DashboardPage.ts`, `src/client/components/DemoBanner.ts`, `src/routes/api.demo.ts`, `src/routes/api.demo.test.ts`

## 2026-05-24 22:53 IST - Finding

- Severity: medium
- Area: Current dashboard CSS/client diff lacks fresh browser regression proof
- Evidence: `git diff --stat` currently shows substantial dashboard/client churn, including `src/client/styles.css` with 769 changed lines plus changes to `LockTable`, `ReopenQueue`, `RuntimeBanner`, `DashboardPage`, and store/API code. The latest browser proof docs are older: `docs/BROWSER_REGRESSION.md:3-16` describes the Wave 28 browser pass, and `docs/BROWSER_REGRESSION.md:96-100` scopes it to that built client bundle with mocked APIs. `log.md:587-611` for the current Wave 32 work lists targeted route/service/runtime proof tests and live Zen actions, but no headless browser regression or screenshot pass after the current CSS/UI changes. `src/client/render.test.ts:96-242` checks HTML strings and copy, but it does not exercise layout, mobile overflow, clipped text, or interaction geometry in a browser.
- Why it matters: The current diff changes exactly the surface where ReviewLock has strict UI requirements: no broken mobile layout, no text overlap, no nested panels, visible demo labeling, and reliable inline confirmations. Existing Wave 28 screenshots cannot prove the changed bundle still satisfies those constraints.
- Suggested fix: Before handing off the UI changes, rerun the browser regression against the current built bundle across desktop and mobile states, update `docs/BROWSER_REGRESSION.md` or add a new proof note with screenshot paths, and include checks for the new inline confirmation controls and demo/live toggles.
- Files reviewed: `src/client/styles.css`, `src/client/render.test.ts`, `docs/BROWSER_REGRESSION.md`, `docs/UI_AUDIT.md`, `log.md`, `docs/PLAYTEST_CHECKLIST.md`

## 2026-05-24 22:57 IST - Finding

- Severity: high
- Area: Reopen persistence can drop changed content out of both active locks and the reopen queue
- Evidence: Both reopen paths mark the lock `reopened` before queueing the reopen event. `src/server/services/reopenFlow.ts:128-134` calls `updateLockStatus(...)`, which flows through `src/server/services/locks.ts:55-63` and removes active lock indexes for non-active locks, then `src/server/services/reopenFlow.ts:134` calls `enqueueReopenEvent(...)`. The report-trigger changed-content path has the same order at `src/server/services/reportTriggers.ts:221-228`. If `updateLockStatus()` succeeds but `enqueueReopenEvent()`, metrics, or audit fails, the catch returns `redis_write_failed` (`reopenFlow.ts:175-183`, `reportTriggers.ts:285-293`) after the lock is no longer active. A retry then sees no active lock because `getActiveLockByTarget()` only returns `status === 'active'` (`locks.ts:40-53`). Existing tests cover happy-path queueing and duplicate idempotency (`src/server/services/reopenFlow.test.ts:74-115`, `src/server/services/updateTriggers.test.ts:126-199`) but do not simulate Redis failure between status update and queue insert.
- Why it matters: This can silently lose the core edit-break surface. Changed content is no longer protected by the active lock, but it may never appear in the reopen queue or audit log, so moderators lose the required “reopened after edit” task and the product’s strongest loop is broken.
- Suggested fix: Make reopen state changes atomic or reorder them so the item remains recoverable if queue/audit writes fail. For example, enqueue the event before removing active indexes, or use a transaction-style helper that updates lock status, active indexes, queue, metrics, and audit as one recoverable operation. Add regression tests that fail Redis after `updateLockStatus()` and assert the item remains active/retryable or is visible in the reopen queue.
- Files reviewed: `src/server/services/reopenFlow.ts`, `src/server/services/reportTriggers.ts`, `src/server/services/locks.ts`, `src/server/services/reopenQueue.ts`, `src/server/services/reopenFlow.test.ts`, `src/server/services/updateTriggers.test.ts`

## 2026-05-24 22:57 IST - Finding

- Severity: medium
- Area: Dashboard reason labels render unescaped stored strings
- Evidence: `src/client/components/LockTable.ts:10` formats reason labels with `value.replace(/_/g, ' ')`, and `src/client/components/LockTable.ts:69` injects that return value directly into HTML. `src/client/components/ReopenQueue.ts:12`, `src/client/components/ReopenQueue.ts:82`, and `src/client/components/ReopenQueue.ts:107` do the same for reopen reasons. Other dynamic fields in these components use `text()` or `attr()`, but reason labels bypass both helpers. On the write side, `src/routes/forms.ts:63-64` accepts the submitted `lockReason` string without a runtime check against `LOCK_REASON_PRESETS`, then `src/routes/forms.ts:113-119` passes it into lock creation. The current render regression test only checks attribute escaping (`src/client/render.test.ts:139-154`) and does not cover reason text escaping.
- Why it matters: A malformed or directly posted form payload can persist a reason string that becomes executable HTML in the dashboard. Even if normal menu options only send known presets, ReviewLock should not trust stored Redis data as already safe when rendering an operational moderator dashboard.
- Suggested fix: Escape the formatted reason labels with the same `text()` helper before insertion, and add runtime validation for `lockReason` using the preset constants/schema guard before calling `lockReviewedContent()`. Add render tests with a hostile `lockReason` / `reason` value to prove the dashboard shows text, not markup.
- Files reviewed: `src/client/components/LockTable.ts`, `src/client/components/ReopenQueue.ts`, `src/routes/forms.ts`, `src/shared/constants.ts`, `src/shared/schema.ts`, `src/client/render.test.ts`

## 2026-05-24 22:58 IST - Finding

- Severity: medium
- Area: Client unlock contract tests are red after adding `lockId`
- Evidence: Targeted validation failed with `npm run test -- src/client/state/api.test.ts src/client/state/store.test.ts`. `src/client/state/api.ts:232-242` now defines `unlockTarget(targetId, lockId, actor)` and posts `{ targetId, lockId, actor }`, while `src/client/state/api.test.ts:146-158` still calls `api.unlockTarget('t3_reviewed', 'mod')` and expects the old body `{ targetId, actor }`. `src/client/state/store.ts:107-115` correctly passes `unlockTarget(targetId, lockId, 'moderator')`, but `src/client/state/store.test.ts:149-156` still expects `unlockTarget` to have been called with only `('t3_1', 'moderator')`. The failing output showed `src/client/state/api.test.ts` received `{"targetId":"t3_reviewed","lockId":"mod"}` and `src/client/state/store.test.ts` received the new three-argument call.
- Why it matters: Full handoff validation cannot pass while these tests are stale. The stale API test is also dangerous because its two-argument call treats the moderator name as the lock id, so it no longer exercises the real dashboard unlock contract.
- Suggested fix: Update the client API test to call `unlockTarget('t3_reviewed', 'lock-1', 'mod')` and expect `{ targetId, lockId: 'lock-1', actor: 'mod' }`. Update the store test expectation to include the lock id argument. Keep the dashboard route stale-confirmation tests as the server-side proof that mismatched lock ids are rejected.
- Files reviewed: `src/client/state/api.ts`, `src/client/state/api.test.ts`, `src/client/state/store.ts`, `src/client/state/store.test.ts`
- Command run: `npm run test -- src/client/state/api.test.ts src/client/state/store.test.ts` (FAIL)

## 2026-05-24 23:00 IST - Finding

- Severity: high
- Area: Devvit trigger subreddit parsing breaks fail-open update reopen when target refetch fails
- Evidence: Installed Devvit typings define trigger subreddit as a top-level `SubredditV2` object: `node_modules/@devvit/protos/json/devvit/events/v1alpha/events.d.ts:37-47` for `PostUpdate`/`PostReport`, `events.d.ts:89-100` for `CommentUpdate`/`CommentReport`, and `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/subredditv2.d.ts:66-79` exposes `name`. The route parsers instead type `subreddit?: string` and only fall back to `post?.subredditName` / `comment?.subredditName` (`src/routes/triggers.update.ts:14-27`, `src/routes/triggers.update.ts:40-41`, `src/routes/triggers.report.ts:14-34`, `src/routes/triggers.report.ts:50-51`). `PostV2` and `CommentV2` expose `subredditId`, not `subredditName` (`postv2.d.ts:44`, `commentv2.d.ts:26`). On the update path, `breakLockForChangedContent()` relies on `input.subreddit` when `resolveTargetById()` cannot refetch the target (`src/server/services/reopenFlow.ts:81-96`) and only fails open to a queued `runtime_uncertain` reopen if that subreddit is available (`src/server/services/reopenFlow.test.ts:94-102`). With a live-shaped payload like `{ post: { id: 't3_post' }, subreddit: { name: 'alpha' } }`, the route passes the object as `input.subreddit` or misses the name entirely; Redis lookups then use the wrong namespace or return `subreddit_missing` instead of loading the active lock in `alpha`. Current route tests use synthetic `subredditName` fields on nested post/comment objects (`src/routes/triggers.update.test.ts:77-90`, `src/routes/triggers.update.test.ts:114-129`, `src/routes/triggers.report.test.ts:77-94`, `src/routes/triggers.report.test.ts:114-132`), so they do not prove the installed Devvit payload shape.
- Why it matters: Update triggers are supposed to fail open: if current content cannot be refetched, ReviewLock should reopen or mark the active lock uncertain instead of leaving suppression in place. A transient Reddit refetch failure during a live update event can currently lose the subreddit namespace from the event payload and skip that fail-open path, weakening the edit-break guarantee.
- Suggested fix: Parse `body.subreddit?.name` explicitly, reject non-string subreddit values after extracting known object shapes, and add route tests using installed Devvit-shaped payloads with top-level `subreddit: { name: 'alpha' }`. Include a regression where the Reddit adapter cannot resolve the target but an active lock exists, proving the route queues a `runtime_uncertain` reopen under the correct namespace.
- Files reviewed: `src/routes/triggers.update.ts`, `src/routes/triggers.report.ts`, `src/routes/triggers.update.test.ts`, `src/routes/triggers.report.test.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/reopenFlow.test.ts`, `node_modules/@devvit/protos/json/devvit/events/v1alpha/events.d.ts`, `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/subredditv2.d.ts`, `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/postv2.d.ts`, `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/commentv2.d.ts`

## 2026-05-24 23:01 IST - Finding

- Severity: medium
- Area: Lock review form offers reason values outside the shared preset enum
- Evidence: The shared source of truth defines `LOCK_REASON_PRESETS` as `reviewed_policy_compliant`, `approved_context_known`, `repeat_report_churn`, `mod_team_consensus`, and `custom` (`src/shared/constants.ts:37-43`). The `Lock review` Devvit form instead offers `repeat_false_reports`, `context_verified`, and `moderator_consensus` (`src/routes/menu.ts:70-80`), none of which are in the shared enum. The submit route then treats the submitted value as `LockReasonPreset` without checking it against the constants (`src/routes/forms.ts:20-26`, `src/routes/forms.ts:63-64`, `src/routes/forms.ts:107-119`). Tests only submit/default `reviewed_policy_compliant` (`src/routes/forms.test.ts:65-86`, `src/routes/menu.test.ts:21-43`) and do not select any of the mismatched options.
- Why it matters: Normal moderator use of the form can persist lock records whose `lockReason` violates the app’s own schema/type contract. That undermines dashboard rendering, exports/audit consistency, and any future preset filtering or config that relies on `LOCK_REASON_PRESETS` being authoritative.
- Suggested fix: Change the menu option values to the shared constants (`repeat_report_churn`, `approved_context_known`, `mod_team_consensus`, `custom`) and add runtime validation in `forms.ts` before calling `lockReviewedContent()`. Add a form test that submits each displayed option value and proves it is accepted only when it is in `LOCK_REASON_PRESETS`; reject unknown strings with a neutral toast.
- Files reviewed: `src/shared/constants.ts`, `src/shared/schema.ts`, `src/routes/menu.ts`, `src/routes/forms.ts`, `src/routes/forms.test.ts`, `src/routes/menu.test.ts`, `src/shared/demoScenario.ts`

## 2026-05-24 23:02 IST - Finding

- Severity: medium
- Area: Missing required post/comment `Open ReviewLock` menu actions
- Evidence: The project bible requires post and comment menu actions for `Lock review`, `Unlock review`, and `Open ReviewLock`, plus a subreddit menu action `Open ReviewLock dashboard` (`AGENTS.md:53-59`). `devvit.json` registers post/comment `Lock review` and `Unlock review` items, but only one dashboard opener at `location: "subreddit"` labeled `Open ReviewLock dashboard` (`devvit.json:18-55`). `src/routes/menu.ts:177-180` wires only `/lock-post`, `/lock-comment`, `/unlock-post`, and `/unlock-comment` for post/comment locations; `/open-dashboard` is a subreddit form launcher at `src/routes/menu.ts:181-201`. `rg "Open ReviewLock"` finds no post/comment manifest entry or route test for a target-level open action.
- Why it matters: Moderators reviewing a specific post or comment need a direct path from the target context into ReviewLock. Without the required target-level `Open ReviewLock` actions, the menu surface is incomplete against must-ship scope and live proof can miss a basic navigation workflow.
- Suggested fix: Add post and comment menu items labeled `Open ReviewLock` that route to target-aware open/dashboard behavior. If the intended behavior is to open the existing dashboard custom post, make that explicit in the route response and tests; if it should deep-link/filter to the target, add that target parameter to the dashboard URL. Add manifest/integration tests that assert both post and comment `Open ReviewLock` endpoints are registered and served.
- Files reviewed: `AGENTS.md`, `devvit.json`, `src/routes/menu.ts`, `src/routes/menu.test.ts`, `src/integration.test.ts`

## 2026-05-24 23:10 IST - Codex Resolution Notes

- Addressed editable lock/unlock form target identity by adding Redis-backed form bindings. Submit routes now require a binding token and reject target/lock mismatches before moderation calls.
- Addressed demo labeling by rejecting dashboard reads of `reviewlock_demo` unless `demo=true`.
- Addressed current CSS/client proof gap with targeted render and interaction regression coverage plus a fresh Playwright browser screenshot pass documented in `docs/BROWSER_REGRESSION.md`.
- Addressed reopen persistence loss by queueing reopen events before removing active lock indexes and adding a Redis failure regression that proves the reopen event remains visible.
- Addressed reason-label rendering and invalid presets by escaping rendered reason labels, validating submitted lock reasons against `LOCK_REASON_PRESETS`, and aligning menu option values with shared constants.
- Addressed live-shaped trigger subreddit parsing by accepting top-level `subreddit.name` and adding a fail-open update route regression for refetch failure with an active lock.
- Addressed missing target-level `Open ReviewLock` actions by adding post/comment manifest entries and menu route tests.

## 2026-05-24 23:07 IST - Finding

- Severity: medium
- Area: Form route tests are stale after server-bound token hardening
- Evidence: Targeted validation failed with `npm run test -- src/routes/forms.test.ts --reporter verbose`. The current submit routes require `formToken` and `subreddit`, consume the Redis form binding, and use the bound target (`src/routes/forms.ts:118-139`, `src/routes/forms.ts:161-189`). The tests still submit direct bodies without creating or passing a binding token (`src/routes/forms.test.ts:71-78`, `src/routes/forms.test.ts:132-139`, `src/routes/forms.test.ts:161-164`), so four assertions fail with the new neutral toasts `ReviewLock form token and reason are required.` and `ReviewLock form token and lock are required.`.
- Why it matters: The token binding is the right direction for preventing stale or tampered Devvit form submissions, but the form route suite no longer proves the happy path, stale-token rejection, or target-mismatch rejection. Full handoff validation will fail until the tests exercise the actual menu-created binding contract.
- Suggested fix: Update the form tests to create bindings with `createFormBinding()` or exercise the menu route first, then submit `subreddit` and `formToken`. Add explicit regressions for missing token, expired/consumed token, wrong action token, changed submitted `targetId`, and stale unlock `lockId`.
- Files reviewed: `src/routes/forms.ts`, `src/routes/forms.test.ts`, `src/routes/menu.ts`, `src/server/services/formBindings.ts`
- Command run: `npm run test -- src/routes/forms.test.ts --reporter verbose` (FAIL)

## 2026-05-24 23:09 IST - Finding

- Severity: high
- Area: Dashboard unlock API bypasses runtime subreddit scoping
- Evidence: The dashboard read routes and reopen-dismiss action call `resolveScopedSubreddit()` before touching namespaced Redis data (`src/routes/api.dashboard.ts:153-169`, `src/routes/api.dashboard.ts:336-358`). The dashboard unlock route does not; it reads only `targetId` and `lockId` from the browser request, then calls `unlockReviewedContent()` directly (`src/routes/api.dashboard.ts:296-326`). `unlockReviewedContent()` refetches the target and loads the active lock from `resolution.target.subreddit` (`src/server/services/unlockFlow.ts:34-48`), so a request from an `alpha` dashboard can operate in any subreddit namespace that `getPostById()` / `getCommentById()` resolves. Current dashboard API tests cover same-subreddit unlock and stale lock id (`src/routes/api.dashboard.test.ts:115-178`), but there is no test for a runtime `alpha` dashboard attempting to unlock a `beta` target.
- Why it matters: The earlier client-controlled subreddit fix protects dashboard reads and reopen dismissals, but dashboard unlock is still a moderation action. It should not be possible for a browser request in one subreddit context to unignore reports and remove an active lock in another subreddit namespace, even if the caller guesses a target id and lock id.
- Suggested fix: Resolve the runtime scope in `/locks/unlock` before calling `unlockReviewedContent()`, pass the expected subreddit into the unlock flow, and reject if the resolved target subreddit differs. Add a dashboard API regression with `FakeRedditAdapter(..., 'dash_mod', 'alpha')`, a beta target/lock, and an unlock request that must return 403 and make no `unignoreReports` call.
- Files reviewed: `src/routes/api.dashboard.ts`, `src/routes/api.dashboard.test.ts`, `src/server/services/unlockFlow.ts`, `src/server/adapters/reddit.ts`

## 2026-05-24 23:09 IST - Recheck

- Area: Form route tests after server-bound token hardening
- Result: Resolved in the current worktree.
- Evidence: `npm run test -- src/routes/forms.test.ts --reporter verbose` now passes with 8 tests, including token-required, changed target identity, unknown reason, and stale unlock coverage.

## 2026-05-24 23:10 IST - Finding

- Severity: medium
- Area: Full scenario test still uses the pre-token form contract
- Evidence: Full validation failed with `npm run test`: 39 files passed, but `src/fullScenario.test.ts` failed at the first lock submit. The scenario posts directly to `/internal/form/lock-review-submit` with only `targetId`, `actor`, and `lockReason` (`src/fullScenario.test.ts:54-60`), while the hardened form route now requires `subreddit` and a consumed `formToken` from a menu-created binding. The received toast was `ReviewLock form token and reason are required.` instead of the expected lock success.
- Why it matters: The per-route form tests have been updated and pass, but the end-to-end scenario still does not exercise the actual Devvit menu-to-form flow. The project-wide `npm run test` handoff gate remains red until this scenario is updated.
- Suggested fix: Update the full scenario to request the lock form through `/internal/menu/lock-post` and submit the returned `subreddit`/`formToken`, or create a binding with `createFormBinding()` if the test is intended to stay service-adjacent. Keep the rest of the scenario assertions so the full lock, suppress, edit-reopen, dashboard loop remains covered.
- Files reviewed: `src/fullScenario.test.ts`, `src/routes/forms.ts`, `src/server/services/formBindings.ts`
- Command run: `npm run test` (FAIL)

## 2026-05-24 23:11 IST - Recheck

- Area: Full scenario test after server-bound token hardening
- Result: Resolved in the current worktree.
- Evidence: `npm run test -- src/fullScenario.test.ts --reporter verbose` passes, and the follow-up `npm run test` passes with 40 test files and 210 tests.

## 2026-05-24 23:12 IST - Recheck

- Area: Dashboard unlock API runtime subreddit scoping
- Result: Resolved in the current worktree.
- Evidence: `/api/locks/unlock` now resolves dashboard scope before calling `unlockReviewedContent()` and passes `expectedSubreddit` (`src/routes/api.dashboard.ts:336-343`). The unlock flow rejects targets outside that scope before loading the active lock or calling `unignoreReports()` (`src/server/services/unlockFlow.ts:43-49`). `src/routes/api.dashboard.test.ts` now includes `rejects dashboard unlocks outside the runtime subreddit scope`, and `npm run test -- src/routes/api.dashboard.test.ts --reporter verbose` passes with 9 tests.

## 2026-05-24 23:15 IST - Finding

- Severity: high
- Area: Lock creation Redis-failure rollback can hide reports without a visible lock
- Evidence: The project bible requires that when `ignoreReports()` succeeds but Redis write fails, ReviewLock must attempt `unignoreReports()` and, if rollback fails, log that prominently in runtime proof/dashboard (`AGENTS.md:359-361`). The current catch path after a post-`ignoreReports()` persistence failure calls `deps.reddit.unignoreReports(resolution.target).catch(() => undefined)`, removes the lock, and returns only `redis_write_failed` (`src/server/services/lockFlow.ts:174-182`). Existing rollback tests assert the `unignoreReports` call happens, but they cover only successful rollback and partial-lock cleanup (`src/server/services/lockFlow.test.ts:92-153`); there is no test where `unignoreReports()` itself fails after the Redis write failure. `FakeRedditAdapter` can simulate that failure via `failOperation('unignoreReports', ...)` (`src/server/adapters/reddit.ts:202-208`).
- Why it matters: If Reddit accepts `ignoreReports()` and then Redis/audit/metrics persistence fails, a failed rollback can leave Reddit still ignoring reports while ReviewLock deletes the local active lock and has no dashboard retry surface. That is an unsafe state: repeat reports can remain suppressed without a reviewed-content lock that can reopen on edits.
- Suggested fix: Wrap the rollback in the same moderation-result helper used elsewhere, preserve a visible failed/attention record or runtime proof entry when rollback fails, and return a warning such as `unignoreReports rollback failed`. Add a regression where metrics/audit persistence fails and `unignoreReports()` also fails, asserting the target remains visible to moderators and the rollback failure is recorded.
- Files reviewed: `AGENTS.md`, `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/server/adapters/reddit.ts`, `src/server/services/moderation.ts`

## 2026-05-24 23:17 IST - Finding

- Severity: medium
- Area: Report trigger dedupe marks failed deliveries as processed and never expires
- Evidence: `handleReportTrigger()` writes the report dedupe key before it knows whether the trigger can resolve the target, call `ignoreReports()`, write metrics, or write audit (`src/server/services/reportTriggers.ts:99-108`). Failure branches for target resolution, `ignoreReports()`, and post-`ignoreReports()` Redis writes return `runtime_uncertain` without deleting the dedupe key (`src/server/services/reportTriggers.ts:110-129`, `src/server/services/reportTriggers.ts:148-171`, `src/server/services/reportTriggers.ts:174-206`). `markDedupe()` only calls `setIfNotExists()` and does not set an expiry (`src/server/services/reportTriggers.ts:82-88`). Current tests cover duplicate success cases and failure outcomes, but do not retry the same `eventId` after a transient failure or assert a TTL on report dedupe keys (`src/server/services/reportTriggers.test.ts:340-413`).
- Why it matters: A transient Reddit or Redis failure can cause the first delivery of a report event to do no suppression/reopen work, but any retry with the same event id will be treated as `duplicate`. Over time, permanent dedupe keys can also accumulate for every reported event. That weakens retryability exactly where Devvit trigger delivery may be at-least-once and runtime failures are expected.
- Suggested fix: Either write the dedupe marker only after a successful terminal action, or delete/short-expire it when the result is `runtime_uncertain`. Add a TTL for dedupe keys even on success. Add regressions where the first delivery fails target resolution or `ignoreReports()`, then a retry with the same `eventId` succeeds and is not classified as duplicate.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/triggerMutex.ts`, `src/server/adapters/redis.ts`

## 2026-05-24 23:20 IST - Finding

- Severity: high
- Area: Devvit Redis `zRange` adapter hides a required runtime option
- Evidence: The local `DevvitRedisClient` interface types `zRange` options as only `{ reverse?: boolean }` (`src/server/adapters/redis.ts:134-139`), and the adapter passes `{ reverse }` for reverse reads (`src/server/adapters/redis.ts:180-181`). Installed Devvit typings require `ZRangeOptions` to include `by: 'score' | 'lex' | 'rank'` (`node_modules/@devvit/redis/types/redis.d.ts:1447-1454`), and `RedisClient.zRange()` uses that `ZRangeOptions` type (`node_modules/@devvit/redis/RedisClient.d.ts:75-79`). Reverse `zRange` reads are used for active locks, audit, reopen queue, and metrics (`src/server/services/locks.ts:103`, `src/server/services/audit.ts:41`, `src/server/services/reopenQueue.ts:45`, `src/server/services/metrics.ts:77`, `src/server/services/metrics.ts:102`). Local tests use `InMemoryRedisStore`, so they do not exercise the real Devvit client option shape.
- Why it matters: In the live Devvit runtime, dashboard reads that need newest-first sorted sets may pass an invalid options object to Redis. That can break active lock lists, reopen queue, audit timeline, and metrics even while local tests stay green.
- Suggested fix: Align the adapter with the installed Devvit Redis type instead of a narrowed local interface, and pass an explicit rank option, for example `{ by: 'rank', reverse: true }` for reverse range reads and `{ by: 'rank' }` where options are needed. Add an adapter-level test with a fake Devvit client that asserts reverse `zRange` receives `by: 'rank'`.
- Files reviewed: `src/server/adapters/redis.ts`, `src/server/adapters/redis.test.ts`, `src/server/services/locks.ts`, `src/server/services/audit.ts`, `src/server/services/reopenQueue.ts`, `src/server/services/metrics.ts`, `node_modules/@devvit/redis/RedisClient.d.ts`, `node_modules/@devvit/redis/types/redis.d.ts`

## 2026-05-24 23:13 IST - Codex Resolution Notes

- Addressed dashboard unlock subreddit scoping by resolving the Devvit runtime subreddit before `/api/locks/unlock`, passing the expected subreddit into `unlockReviewedContent()`, and rejecting cross-subreddit targets before any `unignoreReports()` call.
- Added service and dashboard API regressions proving cross-subreddit unlock attempts return `403`, leave the active lock intact, and make no Reddit moderation call.
