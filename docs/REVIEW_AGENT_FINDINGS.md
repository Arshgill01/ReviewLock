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

## 2026-05-24 23:23 IST - Finding

- Severity: medium
- Area: Runtime proof banner renders Redis-backed text without escaping
- Evidence: `renderRuntimeBanner()` injects `capability.name`, warning strings, and `verificationMessage` directly into HTML (`src/client/components/RuntimeBanner.ts:24-35`, `src/client/components/RuntimeBanner.ts:46-50`). Runtime proof records are loaded from Redis (`src/server/services/runtimeProof.ts:45-48`) and can include operation names, evidence, notes, and warning text derived from runtime errors (`src/server/services/runtimeProof.ts:82-103`). Other dashboard components already escape dynamic text through local `text()` helpers, but the runtime banner has no equivalent escaping. Current render tests check attribute escaping and reason label escaping, but the runtime banner test only checks ordinary copy (`src/client/render.test.ts:182-191`).
- Why it matters: A malformed runtime proof record or runtime error string stored in Redis can render markup inside the moderator dashboard. This is especially risky because runtime proof is a trust/status surface that moderators are expected to inspect after failures.
- Suggested fix: Add `text()`/`attr()` escaping to `RuntimeBanner.ts` for capability names, warning text, verification messages, and status-derived class names. Add a render regression with hostile runtime capability/warning values proving the dashboard shows escaped text and no raw `<script>`/event-handler markup.
- Files reviewed: `src/client/components/RuntimeBanner.ts`, `src/client/pages/DashboardPage.ts`, `src/client/render.test.ts`, `src/server/services/runtimeProof.ts`

## 2026-05-24 23:13 IST - Codex Resolution Notes

- Addressed dashboard unlock subreddit scoping by resolving the Devvit runtime subreddit before `/api/locks/unlock`, passing the expected subreddit into `unlockReviewedContent()`, and rejecting cross-subreddit targets before any `unignoreReports()` call.
- Added service and dashboard API regressions proving cross-subreddit unlock attempts return `403`, leave the active lock intact, and make no Reddit moderation call.

## 2026-05-24 23:19 IST - Finding

- Severity: low
- Area: Dashboard action errors discard message-only non-200 responses
- Evidence: The client error extractor only reads `data.error` (`src/client/state/api.ts:41-42`), and `requestJson()` throws on non-2xx before action helpers can read `data.message` (`src/client/state/api.ts:58-72`). The dashboard unlock endpoint returns scope failures as HTTP 403 with `{ ok, message, warnings }`, not an `error` field (`src/routes/api.dashboard.ts:352-359`). `ReviewLockStore.unlock()` displays the thrown error text directly (`src/client/state/store.ts:113-126`), so a cross-subreddit/stale-context unlock rejection becomes the generic `API error: 403` instead of the moderator-actionable unlock message. Current API client tests cover non-200 bodies with `error`, but not non-200 action bodies with `message` (`src/client/state/api.test.ts:80-90`, `src/client/state/api.test.ts:139-164`).
- Why it matters: This does not reintroduce the moderation-scope bug, but it makes the protective 403 path hard for moderators to understand and diagnose. The server already computed a specific explanation; the dashboard loses it at the transport layer.
- Suggested fix: Have `errorText()` fall back to a string `message`, or make action routes consistently return `error` on non-2xx responses. Add an API client regression where `unlockTarget()` receives HTTP 403 with `{ ok: false, message: 'ReviewLock target is outside this subreddit context.' }` and surfaces that text.
- Files reviewed: `src/client/state/api.ts`, `src/routes/api.dashboard.ts`, `src/client/state/store.ts`, `src/client/state/api.test.ts`

## 2026-05-24 23:22 IST - Recheck

- Area: Lock creation Redis-failure rollback visibility
- Result: Resolved in the current worktree.
- Evidence: The Redis persistence catch path now calls `unignoreReportsForReviewLock()`, records runtime proof for the rollback operation, keeps a failed visible lock when rollback fails, and writes a `runtime_failure` audit event (`src/server/services/lockFlow.ts:178-216`). `src/server/services/lockFlow.test.ts` now includes `keeps a visible failed lock when Redis persistence fails and unignore rollback also fails`. `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose` passes with 6 tests.

## 2026-05-24 23:22 IST - Recheck

- Area: Report trigger dedupe retryability and expiry
- Result: Resolved in the current worktree.
- Evidence: Report dedupe markers now receive a 7-day TTL on creation (`src/server/services/reportTriggers.ts:82-95`), and runtime-uncertain paths clear the marker before returning (`src/server/services/reportTriggers.ts:125-145`, `src/server/services/reportTriggers.ts:164-188`, `src/server/services/reportTriggers.ts:212-216`). `src/server/services/reportTriggers.test.ts` now covers TTL plus retry after target-resolution and `ignoreReports()` failures. `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose` passes with 18 tests.

## 2026-05-24 23:22 IST - Recheck

- Area: Devvit Redis `zRange` adapter options
- Result: Resolved in the current worktree.
- Evidence: The Devvit Redis client interface now requires `options?: { by: 'score' | 'lex' | 'rank'; reverse?: boolean }`, and the adapter passes `{ by: 'rank', reverse: true }` for reverse reads and `{ by: 'rank' }` otherwise (`src/server/adapters/redis.ts:134-181`). `src/server/adapters/redis.test.ts` now includes `passes explicit rank options for Devvit reverse sorted-set reads`. `npm run test -- src/server/adapters/redis.test.ts --reporter verbose` passes with 4 tests.

## 2026-05-24 23:22 IST - Recheck

- Area: Runtime proof banner escaping
- Result: Resolved in the current worktree.
- Evidence: `renderRuntimeBanner()` now escapes capability names, status labels, warning text, and verification messages, and sanitizes status class suffixes (`src/client/components/RuntimeBanner.ts:3-12`, `src/client/components/RuntimeBanner.ts:33-64`). `src/client/render.test.ts` now includes `escapes Redis-backed runtime proof text before rendering`. `npm run test -- src/client/render.test.ts --reporter verbose` passes with 12 tests.

## 2026-05-24 23:23 IST - Codex Resolution Notes

- Addressed message-only non-200 dashboard action errors by letting the API client fall back from `error` to a string `message`.
- Added `src/client/state/api.test.ts` coverage proving a 403 unlock response with `ReviewLock target is outside this subreddit context.` surfaces that exact text instead of `API error: 403`.
- Reran focused tests for the reviewer findings, then full `npm run type-check`, `npm run lint`, `npm run test`, and `npm run build`; all passed.

## 2026-05-24 23:24 IST - Validation

- Area: Current dirty implementation fixes
- Result: Full local validation passed.
- Evidence: `npm run type-check` passed. `npm run test` passed with 40 test files and 219 tests. The low-severity client error-message finding remains open because the suite does not currently cover non-2xx action responses that use `message` instead of `error`.

## 2026-05-24 23:24 IST - Recheck

- Area: Dashboard action message-only non-200 errors
- Result: Resolved in the current worktree.
- Evidence: `errorText()` now falls back from `data.error` to a string `data.message` (`src/client/state/api.ts:41-46`). `src/client/state/api.test.ts` now includes `uses action response message text for non-200 dashboard action responses`, covering the 403 unlock message path. `npm run test -- src/client/state/api.test.ts --reporter verbose` passes with 8 tests.

## 2026-05-24 23:25 IST - Validation

- Area: Current dirty implementation fixes
- Result: Full local validation gates passed.
- Evidence: `npm run type-check`, `npm run lint`, `npm run test`, and `npm run build` all passed in the current review pass.

## 2026-05-24 23:26 IST - Finding

- Severity: medium
- Area: Lock/unlock Devvit form submissions do not enforce current subreddit scope
- Evidence: `scopedFormSubreddit()` validates a submitted subreddit against `reddit.getCurrentSubredditName()` (`src/routes/forms.ts:83-103`), and the reopen-dismiss form uses it before touching Redis (`src/routes/forms.ts:232-238`). The lock and unlock form submit routes do not call that helper; they consume a Redis binding using `body.subreddit` directly (`src/routes/forms.ts:118-127`, `src/routes/forms.ts:163-168`) and then call `lockReviewedContent()` / `unlockReviewedContent()` (`src/routes/forms.ts:140-146`, `src/routes/forms.ts:181-186`). The form binding itself is keyed by the stored target subreddit (`src/server/services/formBindings.ts:17-18`, `src/server/services/formBindings.ts:48-49`), but nothing in the lock/unlock submit path rejects a still-valid binding whose subreddit differs from the current Devvit runtime subreddit. Existing form route tests cover token presence, changed target identity, unknown reason, and stale lock id, but they do not create a router with `FakeRedditAdapter(..., 'mod', 'beta')` and an `alpha` binding to prove lock/unlock submissions are rejected in a mismatched runtime context (`src/routes/forms.test.ts:65-249`).
- Why it matters: Recent dashboard actions were hardened to make the Devvit runtime subreddit authoritative before moderation operations. Internal Devvit form callbacks are also moderation actions. If a stale or replayed form submission can carry a valid token for another subreddit namespace, ReviewLock can approve/ignore/unignore a target outside the current runtime context rather than forcing the moderator to reopen the menu in that subreddit.
- Suggested fix: Apply the same scope check to `lock-review-submit` and `unlock-review-submit` before consuming the binding or before calling the flow. Normalize and compare the submitted/bound subreddit to `reddit.getCurrentSubredditName()`, reject mismatches with a neutral toast, and add regressions for lock and unlock forms where runtime subreddit is `beta` but the binding/body are `alpha`; assert no Reddit moderation call and the active lock remains unchanged.
- Files reviewed: `src/routes/forms.ts`, `src/routes/forms.test.ts`, `src/server/services/formBindings.ts`, `src/server/services/keys.ts`, `src/server/adapters/reddit.ts`

## 2026-05-24 23:28 IST - Recheck

- Area: Lock/unlock Devvit form runtime subreddit scoping
- Result: Resolved in the current worktree.
- Evidence: `lock-review-submit` and `unlock-review-submit` now call `scopedFormSubreddit()` before consuming form bindings, returning `ReviewLock form subreddit does not match the current Devvit context.` on mismatch (`src/routes/forms.ts`). `src/routes/forms.test.ts` now covers both lock and unlock form mismatches with runtime subreddit `beta` and binding/body subreddit `alpha`, proving no Reddit moderation call, no token consumption, and no active-lock mutation. `npm run test -- src/routes/forms.test.ts --reporter verbose` passes with 10 tests.

## 2026-05-24 23:27 IST - Finding

- Severity: medium
- Area: Malformed runtime proof records can crash dashboard rendering
- Evidence: `loadRuntimeProofStatus()` only falls back for missing or syntactically invalid JSON; any JSON object is cast to `RuntimeProofStatus` without validating `overall`, `capabilities`, or `warnings` (`src/server/services/runtimeProof.ts:12-22`, `src/server/services/runtimeProof.ts:52-58`). The runtime API returns that value directly from Redis (`src/routes/api.dashboard.ts:302-307`), and the client only checks that `runtime` is an object before casting it (`src/client/state/api.ts:186-204`). `renderRuntimeBanner()` then assumes `status.capabilities` and `status.warnings` are arrays and that statuses are strings with `.replace()` (`src/client/components/RuntimeBanner.ts:3-12`, `src/client/components/RuntimeBanner.ts:33-44`, `src/client/components/RuntimeBanner.ts:51-63`). Current tests cover the string `{` case, but not valid JSON with the wrong shape such as `{}` or `{"capabilities":null}` (`src/server/services/runtimeProof.test.ts:53-61`).
- Why it matters: Runtime proof is written to Redis and is intentionally surfaced during failure/debug flows. A corrupted or partially-written runtime proof record can make `/api/runtime` return a contract-passing object that crashes the dashboard render instead of degrading to the unverified runtime matrix. That turns a proof/status problem into a blank or broken mod dashboard.
- Suggested fix: Validate parsed runtime proof shape at the server boundary and return `defaultRuntimeStatus()` for malformed objects; also make the client contract check require `overall` string, `capabilities` array, and `warnings` array before rendering. Add regressions for valid-but-malformed runtime JSON in `runtimeProof.test.ts` and/or `api.test.ts` plus a render regression proving `renderRuntimeBanner()` handles only validated status data.
- Files reviewed: `src/server/services/runtimeProof.ts`, `src/server/services/runtimeProof.test.ts`, `src/routes/api.dashboard.ts`, `src/client/state/api.ts`, `src/client/components/RuntimeBanner.ts`

## 2026-05-24 23:31 IST - Recheck

- Area: Malformed runtime proof records
- Result: Resolved in the current worktree.
- Evidence: `loadRuntimeProofStatus()` now validates parsed Redis records before returning them and falls back to the default unverified matrix for malformed objects (`src/server/services/runtimeProof.ts`). The client API contract now requires runtime proof `overall`, `generatedAt`, `capabilities`, and `warnings` shape before render use (`src/client/state/api.ts`). `src/server/services/runtimeProof.test.ts` covers `{}`, `capabilities: null`, missing notes, and unknown status values; `src/client/state/api.test.ts` covers malformed `/api/runtime` output. `npm run test -- src/server/services/runtimeProof.test.ts src/client/state/api.test.ts src/routes/forms.test.ts --reporter verbose` passes with 23 tests.

## 2026-05-24 23:28 IST - Recheck

- Area: Lock/unlock Devvit form subreddit scoping
- Result: Resolved in the current worktree.
- Evidence: Lock and unlock form submit routes now call `scopedFormSubreddit()` before consuming the Redis form binding and return `ReviewLock form subreddit does not match the current Devvit context.` on mismatch (`src/routes/forms.ts:126-134`, `src/routes/forms.ts:175-183`). `src/routes/forms.test.ts` now includes lock and unlock regressions with runtime subreddit `beta` and binding/body subreddit `alpha`, asserting no Reddit moderation call and preserving the binding/active lock. `npm run test -- src/routes/forms.test.ts --reporter verbose` passes with 10 tests.

## 2026-05-24 23:30 IST - Finding

- Severity: medium
- Area: Reopen transition can leave contradictory active-lock and reopen-queue state if the lock status write fails
- Evidence: Both changed-content paths enqueue the reopen event before persisting the lock as `reopened`: report triggers call `enqueueReopenEvent()` and then `updateLockStatus()` (`src/server/services/reportTriggers.ts:235-246`), and update triggers do the same through `breakLockForChangedContent()` (`src/server/services/reopenFlow.ts:120-138`). `updateLockStatus()` first saves the new lock record and only then removes active indexes (`src/server/services/locks.ts:55-63`, `src/server/services/locks.ts:82-95`), while `getActiveLockByTarget()` continues to use the target-lock pointer and only filters on the stored lock status (`src/server/services/locks.ts:40-52`). Existing reopen tests cover failure while removing active indexes after the status save has succeeded (`src/server/services/reopenFlow.test.ts:126-151`), but they do not cover Redis `set()` failure for `reviewlock:{subreddit}:lock:{lockId}` after the reopen event has already been enqueued. The report-trigger Redis failure regression is currently for unchanged-content suppression rollback, not changed-content reopen rollback (`src/server/services/reportTriggers.test.ts:472-504`).
- Why it matters: If Redis accepts the reopen event write but rejects the subsequent lock-record status write, the mod dashboard can show an item in the reopen queue while `getActiveLockByTarget()` still returns the old active lock. A later report on unchanged current content can then run the suppression path for content that ReviewLock has already surfaced as reopened, undercutting the "lock breaks automatically and returns to moderator attention" loop.
- Suggested fix: Make the reopen transition atomic or explicitly compensating. Options include saving the lock status before enqueueing the visible reopen event, wrapping the lock/event/index writes in a Redis transaction where Devvit supports it, or deleting/marking the queued reopen event as runtime-uncertain if `updateLockStatus()` fails. Add regressions for report and update reopen paths where `redis.set(keys.lock(...))` fails after `enqueueReopenEvent()`: assert the final state does not contain both an open reopen event and an active lock capable of suppressing reports.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/locks.ts`, `src/server/services/reopenFlow.test.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/reopenQueue.ts`

## 2026-05-24 23:31 IST - Recheck

- Area: Malformed runtime proof records
- Result: Resolved in the current worktree.
- Evidence: `loadRuntimeProofStatus()` now validates parsed Redis JSON before returning it and falls back to the default unverified runtime matrix for malformed shapes (`src/server/services/runtimeProof.ts:25-99`). The client API contract now validates `RuntimeProofStatus` before returning dashboard/runtime data (`src/client/state/api.ts:48-70`, `src/client/state/api.ts:216-224`). `src/server/services/runtimeProof.test.ts` includes malformed-but-valid JSON cases such as `{}`, `capabilities: null`, missing `notes`, and an invalid status string, and `src/client/state/api.test.ts` rejects `{ runtime: {} }`. `npm run test -- src/server/services/runtimeProof.test.ts src/client/state/api.test.ts --reporter verbose` passes with 13 tests.

## 2026-05-24 23:33 IST - Finding

- Severity: medium
- Area: Demo-mode URL/reload path can request the live subreddit with `demo=true` and fail the isolated demo guard
- Evidence: The dashboard click handler for `data-action="toggle-mode"` only writes the `demo` query parameter to the URL; it does not write the deterministic demo subreddit (`src/client/main.ts:80-85`). `setDemo(true)` correctly switches the in-memory store to the `reviewlock_demo` namespace after `/api/demo/enable` returns (`src/client/state/store.ts:215-220`), and API requests always include the current store subreddit plus demo flag (`src/client/state/api.ts:80-82`). On a reload or shared URL with `?demo=true`, however, the store constructor keeps the requested or embedded live subreddit as `this.subreddit` and only sets `this.demo = true`; it also seeds `liveSubreddit` as plain `reviewlock` instead of the original live subreddit (`src/client/main.ts:10-22`, `src/client/state/store.ts:44-52`). The server intentionally rejects demo dashboard reads when `demo=true` is paired with any client subreddit other than `reviewlock_demo` (`src/routes/api.dashboard.ts:110-121`). Current store tests cover entering demo through `setDemo(true)` and returning to live mode, but not initial construction/bootstrap with `initialDemo: true` or a reload after the URL was changed to `demo=true` (`src/client/state/store.test.ts:190-208`).
- Why it matters: Demo mode is mandatory and must be visibly labeled. A moderator or judge who clicks Demo and then reloads the embedded dashboard can land on a retryable 403 instead of the seeded four-beat demo, because the URL says demo mode while the bootstrapped store asks for the live subreddit namespace. That makes the required demo story brittle at exactly the moment reviewers are likely to refresh or share the playtest URL.
- Suggested fix: Make initial demo bootstrap use `reviewlock_demo` immediately and preserve the live subreddit separately. When toggling demo in `main.ts`, either also set `subreddit=reviewlock_demo` in the URL or make `ReviewLockStore` ignore any non-demo initial subreddit while `initialDemo` is true. Add a store or main bootstrap regression that simulates `initialSubreddit: 'reviewlock_dev', initialDemo: true` and asserts the first fetch uses `reviewlock_demo` with `demo=true`, then disabling demo returns to `reviewlock_dev`.
- Files reviewed: `src/client/main.ts`, `src/client/state/store.ts`, `src/client/state/api.ts`, `src/client/state/store.test.ts`, `src/routes/api.dashboard.ts`, `src/routes/api.dashboard.test.ts`

## 2026-05-24 23:36 IST - Recheck

- Area: Reopen transition partial Redis failure
- Result: Resolved in the current worktree.
- Evidence: Report-trigger and update-trigger reopen paths now compensate for a post-queue status-write failure by removing active lock indexes before returning `runtime_uncertain`. `src/server/services/reopenFlow.test.ts` and `src/server/services/reportTriggers.test.ts` cover `redis.set(keys.lock(...))` failure after `enqueueReopenEvent()`, asserting the reopen event remains visible and `getActiveLockByTarget()` returns `undefined`. `npm run test -- src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts src/client/state/store.test.ts --reporter verbose` passes.

## 2026-05-24 23:36 IST - Recheck

- Area: Demo-mode URL/reload namespace handling
- Result: Resolved in the current worktree.
- Evidence: `ReviewLockStore` now boots `initialDemo: true` into `reviewlock_demo` while preserving the original live subreddit for exit, and `src/client/main.ts` writes `subreddit=reviewlock_demo` when entering demo mode. `src/client/state/store.test.ts` covers `initialSubreddit: 'reviewlock_dev', initialDemo: true`, first fetch to `reviewlock_demo` with demo mode enabled, and return to `reviewlock_dev` after disabling demo. Targeted validation passes.

## 2026-05-24 23:36 IST - Finding

- Severity: medium
- Area: Valid-but-malformed Redis dashboard records can still crash rendering
- Evidence: Runtime proof now validates valid JSON shape, but the other Redis-backed dashboard services still parse and cast any syntactically valid JSON. Locks use `parseJson<ReviewLockRecord>()` directly (`src/server/services/locks.ts:5-15`, `src/server/services/locks.ts:33-38`), reopen events do the same (`src/server/services/reopenQueue.ts:5-15`, `src/server/services/reopenQueue.ts:33-50`), audit events do the same (`src/server/services/audit.ts:5-15`, `src/server/services/audit.ts:29-46`), and metrics do the same (`src/server/services/metrics.ts:5-15`, `src/server/services/metrics.ts:65-112`). Current malformed-record tests only write invalid JSON like `{`, so they prove syntax failures are skipped but not valid wrong-shape JSON (`src/server/services/locks.test.ts:78-91`, `src/server/services/reopenQueue.test.ts:49-60`, `src/server/services/audit.test.ts:35-46`, `src/server/services/metrics.test.ts:76-93`). The dashboard render path then calls string/number methods on those fields: active locks call `lock.targetId.replace(...)` and `reason(lock.lockReason)` (`src/client/components/LockTable.ts:53-75`), reopen events call `reason(event.reason)`, `date(event.createdAt)`, and `event.oldContentHash.slice(...)` (`src/client/components/ReopenQueue.ts:10-22`, `src/client/components/ReopenQueue.ts:69-111`), audit events call `event.kind.replace(...)` (`src/client/components/AuditTimeline.ts:6-16`), and churn targets call `target.targetId.replace(...)` (`src/client/pages/DashboardPage.ts:13-29`).
- Why it matters: Redis records are written across several multi-step flows that already handle partial runtime failures. A valid JSON object with missing fields, for example `{"status":"active"}` in a lock slot or `{}` in a reopen event slot, can pass the server list filters and API array contract, then throw in the dashboard renderer. That reintroduces the same class of blank-dashboard failure just fixed for runtime proof, but through the active locks, reopen queue, audit timeline, or report churn lists.
- Suggested fix: Add schema guards at the service boundary for `ReviewLockRecord`, `ReopenEvent`, `AuditEvent`, `DailyMetrics`, and `TargetMetrics`, and skip or quarantine valid-but-malformed records the same way invalid JSON is skipped. Add regression cases using valid JSON with missing fields for each list service and an API/client regression proving malformed list items do not reach render helpers.
- Files reviewed: `src/server/services/locks.ts`, `src/server/services/reopenQueue.ts`, `src/server/services/audit.ts`, `src/server/services/metrics.ts`, `src/server/services/locks.test.ts`, `src/server/services/reopenQueue.test.ts`, `src/server/services/audit.test.ts`, `src/server/services/metrics.test.ts`, `src/client/components/LockTable.ts`, `src/client/components/ReopenQueue.ts`, `src/client/components/AuditTimeline.ts`, `src/client/pages/DashboardPage.ts`

## 2026-05-24 23:37 IST - Finding

- Severity: medium
- Area: Re-locking an already active target can create stale active locks in the dashboard ledger
- Evidence: The lock menu always creates a new lock form binding after resolving the target; it does not check `getActiveLockByTarget()` before showing the lock form (`src/routes/menu.ts:187-218`). The lock flow also resolves, fingerprints, approves, ignores reports, and creates a new `ReviewLockRecord` without checking for an existing active lock on the target (`src/server/services/lockFlow.ts:80-178`). `saveLock()` writes the new lock record, adds it to `locks:active`, and overwrites `locks:activeByTarget` / `target:{thingId}:lock` with the new lock id, but it never marks or removes any previous active lock for the same target (`src/server/services/locks.ts:20-30`). `listActiveLocks()` returns every zset member whose stored lock still has `status === 'active'` (`src/server/services/locks.ts:98-107`), so the prior lock remains visible even though target lookups now point only to the newest lock. Existing lock-flow tests cover success and failure rollback but do not call `lockReviewedContent()` twice for the same target or assert one active lock per target (`src/server/services/lockFlow.test.ts:29-203`).
- Why it matters: A moderator can open `Lock review` twice, double-submit a form, or retry after a slow response. That can leave multiple active ledger rows for one piece of content, inflate active-lock and lock-created metrics, and strand older active locks that cannot be reached by target-based unlock/report/update flows because `target:{thingId}:lock` points at the newest lock. ReviewLock’s core ledger should represent one current review state per target.
- Suggested fix: Make lock creation idempotent per active target. Before calling Reddit moderation methods, load the current active lock by target and either return that lock with a neutral "already locked" response or update the existing lock in place. Add regressions for duplicate lock submissions proving only one active lock row remains, metrics are not double-counted, and the second call does not make unnecessary `approve()` / `ignoreReports()` calls.
- Files reviewed: `src/routes/menu.ts`, `src/server/services/lockFlow.ts`, `src/server/services/locks.ts`, `src/server/services/lockFlow.test.ts`, `src/server/services/locks.test.ts`

## 2026-05-24 23:40 IST - Recheck

- Area: Valid-but-malformed Redis dashboard records
- Result: Resolved in the current worktree.
- Evidence: `src/shared/schema.ts` now exports guards for lock records, reopen events, audit events, daily metrics, and target metrics. The Redis-backed service readers in `locks.ts`, `reopenQueue.ts`, `audit.ts`, and `metrics.ts` use those guards before returning records. Tests now cover syntactically valid but wrong-shape JSON for every affected list/get path. `npm run test -- src/server/services/locks.test.ts src/server/services/reopenQueue.test.ts src/server/services/audit.test.ts src/server/services/metrics.test.ts src/server/services/lockFlow.test.ts --reporter verbose` passes.

## 2026-05-24 23:40 IST - Recheck

- Area: Duplicate active lock creation
- Result: Resolved in the current worktree.
- Evidence: `lockReviewedContent()` now checks `getActiveLockByTarget()` after resolving the target and returns the existing active lock before fingerprinting or calling Reddit moderation methods. `src/server/services/lockFlow.test.ts` covers two lock attempts across different timestamps, proving one active lock row, one `locksCreated` metric increment, and no second `approve()` / `ignoreReports()` call. Targeted validation passes.

## 2026-05-24 23:39 IST - Finding

- Severity: medium
- Area: Report-trigger target resolution failure leaves an active suppressible lock instead of reopening as runtime uncertain
- Evidence: `handleReportTrigger()` resolves the current target before looking up the active lock. If `resolveTargetById()` fails, it writes a `runtime_failure` audit event, clears the dedupe marker, and returns `runtime_uncertain` without checking the provided subreddit for an existing active lock (`src/server/services/reportTriggers.ts:123-163`). The regression for this exact path asserts that the active lock remains active after the target cannot be loaded (`src/server/services/reportTriggers.test.ts:408-428`). By contrast, update-trigger handling uses the supplied subreddit to find the active lock even when target resolution fails, builds a `runtime_uncertain` reopen event, and marks the lock reopened with `target_resolution_failed` warnings (`src/server/services/reopenFlow.ts:120-176`).
- Why it matters: The product rule is that fingerprint uncertainty must fail open: reopen or mark runtime uncertain rather than suppress. After this report-trigger path returns, `target:{thingId}:lock` still points at an active lock. A later retry that successfully refetches unchanged current content can suppress reports for a lock whose integrity was previously unknown, instead of keeping the item in moderator attention.
- Suggested fix: When target resolution fails but `input.subreddit` is available, load `getActiveLockByTarget(redis, input.subreddit, input.targetId)` and transition that lock to a visible `runtime_uncertain` reopen queue entry before returning. Since there is no target object to call `unignoreReports()` on, include `target_resolution_failed` in `runtimeWarnings` and audit `unignoreReportsOk: false`. Keep the current plain runtime failure only when the handler truly cannot determine a subreddit/lock. Update `fails open when the target cannot be loaded` to assert `getActiveLockByTarget()` returns `undefined` and the reopen queue contains a `runtime_uncertain` event.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/reopenFlow.ts`

## 2026-05-24 23:42 IST - Recheck

- Area: Report-trigger target resolution failure on known active locks
- Result: Resolved in the current worktree.
- Evidence: `handleReportTrigger()` now looks up the active lock when target resolution fails but `input.subreddit` is available. Known active locks are reopened with a `runtime_uncertain` reopen event, active indexes are removed through the same post-queue status transition path, and the audit log records a `lock_reopened` event with `unignoreReportsOk: false`. `src/server/services/reportTriggers.test.ts` now asserts target-resolution failure with a known lock leaves `getActiveLockByTarget()` undefined, persists a `runtime_uncertain` reopen event, and marks the lock reopened. The no-subreddit path remains retryable and clears the `unknown` dedupe marker. `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose` passes.

## 2026-05-24 23:41 IST - Finding

- Severity: medium
- Area: Existing-lock idempotency skips fingerprint comparison, so a changed target can remain actively locked
- Evidence: `lockReviewedContent()` refetches the current target, then checks `getActiveLockByTarget()` and returns the existing active lock before computing the current fingerprint (`src/server/services/lockFlow.ts:84-110`). That means a still-active lock with an old `contentHash` is treated as "already locked" even if the newly fetched target body/title/flair/flags now fingerprint differently. The new duplicate-submit regression only calls `lockReviewedContent()` twice against the same unchanged `target()` and asserts no second moderation call (`src/server/services/lockFlow.test.ts:107-123`); there is no case where an active lock was created from the original content and the second lock submission refetches edited content.
- Why it matters: ReviewLock's core promise is "locked until edited." Update/report triggers are the normal automatic break path, but the lock form is also a moderator-facing refetch of the current content. If an update trigger was missed or delayed, a moderator opening/submitting Lock review on the edited target should not be told the old review is still valid. The current early return can leave stale active-lock state in place until a later report or update event happens to correct it.
- Suggested fix: Compute the current fingerprint before the idempotency return. If an existing active lock matches the current fingerprint, return the existing lock as the duplicate-submit path. If it differs or is uncertain, transition the old lock to a `content_changed` or `runtime_uncertain` reopen state before either returning a clear "content changed; review reopened" response or creating a new lock from the moderator's confirmed submission. Add a regression where the first lock stores `Reviewed body`, the second call refetches `Edited body`, and the old lock is no longer returned as active.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/server/services/fingerprint.ts`, `src/server/services/reopenFlow.ts`

## 2026-05-24 23:44 IST - Recheck

- Area: Existing-lock idempotency with changed current content
- Result: Resolved in the current worktree.
- Evidence: `lockReviewedContent()` now computes the current fingerprint before returning an existing active lock. Matching fingerprints still use the idempotent return path. Changed fingerprints reopen the stale lock, enqueue a `content_changed` reopen event, increment reopen metrics, and continue creating a new active lock for the current moderator-reviewed content. `src/server/services/lockFlow.test.ts` covers the edited-body second submission, proving the first lock is `reopened`, the second lock becomes the active target lock, the reopen queue contains the old lock event, and metrics show two locks created plus one reopen. `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose` passes.

## 2026-05-24 23:43 IST - Finding

- Severity: medium
- Area: Demo dashboard renders action buttons whose API calls do not carry demo scope
- Evidence: The demo dashboard renders the same active-lock and reopen-queue action controls as live mode: `renderLockTable()` always emits `data-action="unlock"` / `confirm-unlock` buttons (`src/client/components/LockTable.ts:12-39`, `src/client/components/LockTable.ts:77-79`), and `renderReopenQueue()` / `renderLatestReopenEvent()` always emit dismiss buttons (`src/client/components/ReopenQueue.ts:25-51`, `src/client/components/ReopenQueue.ts:91-113`). `renderDashboardPage()` calls those renderers while `store.demo` is true and the demo render test asserts only that the demo banner is present, not that actions are safe or disabled (`src/client/render.test.ts:225-246`). The action API calls omit demo context: `unlockTarget()` posts to `/api/locks/unlock` with only `targetId`, `lockId`, and `actor`, and `dismissReopen()` posts to `/api/reopen-queue/dismiss` with a body subreddit but no `demo=true` query (`src/client/state/api.ts:258-290`). Server scope rejects `reviewlock_demo` when `demoFrom(context)` is false (`src/routes/api.dashboard.ts:124-138`), so demo dismiss calls against `reviewlock_demo` return 403. Demo unlock calls do not include the demo subreddit at all, so they resolve against the live runtime/default subreddit and then try to refetch a seeded demo target through Reddit (`src/routes/api.dashboard.ts:313-350`).
- Why it matters: Demo mode is mandatory and must be visibly labeled. A judge/moderator can click visible demo buttons after the seeded four-beat story appears, but those controls either fail the demo namespace guard or attempt a live Reddit-backed unlock for seeded IDs. That makes the demo experience look broken and risks confusing seeded demo state with real moderation actions.
- Suggested fix: Either make demo mode read-only by hiding/disabling unlock and dismiss controls with clear in-dashboard state, or plumb action scope through the client (`subreddit=reviewlock_demo&demo=true`) and handle demo mutations without Reddit moderation calls. Add store/API/router regressions for demo unlock/dismiss clicks proving they do not touch live Reddit and either succeed safely in the demo namespace or are not rendered as actionable controls.
- Files reviewed: `src/client/components/LockTable.ts`, `src/client/components/ReopenQueue.ts`, `src/client/pages/DashboardPage.ts`, `src/client/state/api.ts`, `src/client/state/store.ts`, `src/routes/api.dashboard.ts`, `src/client/render.test.ts`

## 2026-05-24 23:45 IST - Recheck

- Area: Demo dashboard action safety
- Result: Resolved in the current worktree.
- Evidence: `renderDashboardPage()` now passes demo read-only state into lock and reopen renderers. In demo mode, active lock and reopen rows render `Demo read-only` instead of `unlock`, `confirm-unlock`, `dismiss-reopen`, or `confirm-dismiss-reopen` action controls. Live mode still renders the existing confirmation controls. `src/client/render.test.ts` asserts the demo dashboard contains the read-only marker and none of the live action data attributes. `npm run test -- src/client/render.test.ts --reporter verbose` passes.

## 2026-05-24 23:45 IST - Finding

- Severity: high
- Area: Stale-lock relock can reopen the old lock before proving the replacement lock actually ignored reports
- Evidence: When `lockReviewedContent()` finds an existing active lock whose fingerprint differs from the refetched target, it immediately enqueues a reopen event and marks the existing lock `reopened` (`src/server/services/lockFlow.ts:145-185`). Only after that does it call `approveForReviewLock()` and `ignoreReportsForReviewLock()` for the replacement lock (`src/server/services/lockFlow.ts:187-189`). If the replacement `ignoreReports()` fails, the function persists a separate `failed` lock and returns `Reports were not locked because ignoreReports failed.` without calling `unignoreReports()` or restoring the previous active lock (`src/server/services/lockFlow.ts:191-223`). The stale-relock regression covers only the successful replacement path (`src/server/services/lockFlow.test.ts:127-180`); the existing ignore failure test is for a first-time lock with no prior active lock (`src/server/services/lockFlow.test.ts:70-90`).
- Why it matters: The previous active lock likely corresponds to Reddit reports already being ignored. If content changed and the replacement lock cannot call `ignoreReports()`, ReviewLock can end with no active lock, a reopened old lock, and Reddit reports still ignored from the old lock state. That violates the fail-open rule: changed or uncertain reviewed content should return to moderator attention, not remain suppressed without an active lock that can reopen later.
- Suggested fix: Treat stale-lock relock as a two-phase transition. Either call `unignoreReports()` when reopening the stale lock before attempting the replacement, or defer marking the old lock reopened until the replacement lock has successfully ignored reports and persisted. On replacement failure, leave a visible retryable state that guarantees reports are not ignored without an active lock. Add a regression where the second lock attempt sees edited content and `ignoreReports()` fails; assert `unignoreReports()` is called or the previous active lock remains retryable, and `getActiveLockByTarget()` is not silently empty while reports may still be ignored.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/server/services/locks.ts`, `src/server/adapters/reddit.ts`

## 2026-05-24 23:47 IST - Recheck

- Area: Stale-lock relock fail-open ordering
- Result: Resolved in the current worktree.
- Evidence: Stale-lock relock now calls `unignoreReportsForReviewLock()` and records runtime proof before reopening the stale lock and attempting the replacement `approve()` / `ignoreReports()` calls. `src/server/services/lockFlow.test.ts` covers edited-content relock with replacement `ignoreReports()` failure, proving `unignoreReports:t3_post` is called, the old lock is `reopened`, the replacement lock is `failed`, and no active target lock remains. `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose` passes.

## 2026-05-24 23:46 IST - Finding

- Severity: medium
- Area: Current proof-boundary docs still contradict controlled moderation method proof
- Evidence: `docs/RUNTIME_PROOF.md` and `docs/MODERATION_METHOD_PROOF.md` now mark controlled post-target `approve()`, `ignoreReports()`, and `unignoreReports()` verified, while keeping comment-target and trigger proof unverified (`docs/RUNTIME_PROOF.md:70-72`, `docs/MODERATION_METHOD_PROOF.md:16-20`). Several current proof docs still state the older broader boundary: `docs/FULL_SCENARIO_WALKTHROUGH.md:25` says real `approve()`, `ignoreReports()`, and `unignoreReports()` behavior remains unverified and still requires controlled playtest; `docs/PRODUCTION_TRUST_AUDIT.md:9` and `docs/PRODUCTION_TRUST_AUDIT.md:38` say live `approve()`, `ignoreReports()`, and `unignoreReports()` remain unverified and list them as next actions; `docs/REDIS_RACE_PROOF.md:82` says live Reddit moderation method behavior still requires controlled playtest proof. Earlier review notes claimed the proof docs were reconciled after Wave 32, but these files remain stale.
- Why it matters: ReviewLock's final submission and README are supposed to use the proof docs as the claim boundary. Leaving some docs saying "all moderation methods unverified" while the runtime proof says "post-target methods verified" makes the final audit ambiguous and can cause either underclaiming in submission copy or accidental cherry-picking from inconsistent evidence.
- Suggested fix: Reconcile these docs to the current boundary: controlled post-target `approve()` / `ignoreReports()` / `unignoreReports()` verified; comment-target moderation methods, report trigger delivery, update trigger delivery, and trigger-driven `unignoreReports()` unverified. If any file is intentionally historical for its wave, label the statement as historical and add a pointer to `docs/RUNTIME_PROOF.md` for current status.
- Files reviewed: `docs/RUNTIME_PROOF.md`, `docs/MODERATION_METHOD_PROOF.md`, `docs/FULL_SCENARIO_WALKTHROUGH.md`, `docs/PRODUCTION_TRUST_AUDIT.md`, `docs/REDIS_RACE_PROOF.md`, `docs/REVIEW_AGENT_FINDINGS.md`

## 2026-05-24 23:48 IST - Recheck

- Area: Proof-boundary documentation consistency
- Result: Resolved in the current worktree.
- Evidence: `docs/FULL_SCENARIO_WALKTHROUGH.md`, `docs/PRODUCTION_TRUST_AUDIT.md`, and `docs/REDIS_RACE_PROOF.md` now distinguish historical/local wave status from the current claim boundary and point to `docs/RUNTIME_PROOF.md`. The boundary is consistent: controlled post-target `approve()`, `ignoreReports()`, and `unignoreReports()` are verified; comment-target moderation methods and live report/update trigger delivery remain unverified.

## 2026-05-25 15:22 IST - Finding

- Severity: high
- Area: Stale-lock relock when stale `unignoreReports()` fails
- Evidence: The stale-lock relock path detects changed current content, calls `unignoreReportsForReviewLock()` on the old active lock, records runtime proof, but then continues regardless of `staleUnignoreResult.ok` (`src/server/services/lockFlow.ts:164-196`). It reopens the old lock and removes active indexes via `markLockReopenedAfterQueue()`, then attempts replacement `approve()` / `ignoreReports()` (`src/server/services/lockFlow.ts:198-199`). If replacement `ignoreReports()` fails, it writes a separate `failed` lock and returns without restoring the previous active lock or otherwise ensuring Reddit reports are no longer ignored (`src/server/services/lockFlow.ts:202-234`). The regression `unignores reports before stale relock replacement failure can leave reports suppressed` only covers replacement `ignoreReports()` failure after successful stale `unignoreReports()` (`src/server/services/lockFlow.test.ts:183-225`); there is no case where stale `unignoreReports()` and replacement `ignoreReports()` both fail.
- Why it matters: This can leave changed content with no active ReviewLock lock while Reddit may still be ignoring reports from the old lock. That is the unsafe state the relock hardening was meant to prevent: reports can stay suppressed without an active reviewed-content lock that can reopen later.
- Suggested fix: Treat stale `unignoreReports()` failure as a blocking fail-open condition before removing the old active lock, or keep a visible retryable active/failed state until Reddit confirms reports are back to normal handling. Add a regression where the second lock attempt sees edited content, `unignoreReports()` fails, and replacement `ignoreReports()` also fails; assert ReviewLock does not end with `getActiveLockByTarget()` empty while the moderation rollback may have failed.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/server/services/locks.ts`, `src/server/adapters/reddit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`

## 2026-05-25 15:23 IST - Finding

- Severity: medium
- Area: Live trigger proof runbook contradicts the available report target
- Evidence: `docs/LIVE_TRIGGER_PROOF_RUNBOOK.md:28-32` says S01 is authored by the logged-in dev account and Reddit does not expose a `Report` action for S01, so the first unchanged-report proof candidate is the already locked dashboard post `t3_1tm8nak`. The same runbook still labels the next section "S01 Proof Sequence" and instructs the operator to open S01, verify `t3_1tmmeo6`, and "Submit one controlled report against S01" (`docs/LIVE_TRIGGER_PROOF_RUNBOOK.md:60-80`). `docs/LIVE_SCENARIO_CONTENT.md:52-55` also lists the S01 proof action as submitting a controlled repeat report against S01 despite the current-account reporting blocker.
- Why it matters: Wave 33's next open gate is live report trigger generation. Following the current runbook can send the operator back to an unreportable-from-this-session post, delaying the proof pass or causing inconsistent evidence between S01 and the dashboard-post fallback target.
- Suggested fix: Split the runbook into "S01 active lock baseline" and a separate "Dashboard post unchanged-report candidate" sequence, or update S01 steps to require a second account/session before attempting the report. Make the expected proof target id explicit for whichever path is actually executable.
- Files reviewed: `docs/LIVE_TRIGGER_PROOF_RUNBOOK.md`, `docs/LIVE_SCENARIO_CONTENT.md`, `TODO.md`, `docs/PLAYTEST_CHECKLIST.md`

## 2026-05-25 15:25 IST - Recheck

- Area: Stale-lock relock when stale `unignoreReports()` fails
- Result: Resolved in the current worktree.
- Evidence: `lockReviewedContent()` now treats stale `unignoreReports()` failure as a blocking runtime failure before reopening the stale lock or attempting replacement moderation writes. The existing lock remains `active`, receives the `unignoreReports failed for t3_post` runtime warning, records runtime proof and a `runtime_failure` audit event, and the replacement `approve()` / `ignoreReports()` calls are not attempted. `src/server/services/lockFlow.test.ts` includes `keeps the stale lock active when stale unignore fails before replacement`, covering simultaneous stale-unignore and replacement-ignore failure setup. `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose` passes.

## 2026-05-25 15:25 IST - Recheck

- Area: Live trigger proof runbook target split
- Result: Resolved in the current worktree.
- Evidence: `docs/LIVE_TRIGGER_PROOF_RUNBOOK.md` now separates the S01 active-lock baseline from the executable dashboard-post report candidate `t3_1tm8nak`. `docs/LIVE_SCENARIO_CONTENT.md` marks S01 same-account report proof as blocked, adds the dashboard post candidate details, and removes the stale manual preflight text that said S01 had not been posted.

## 2026-05-25 15:27 IST - Finding

- Severity: low
- Area: Live scenario content duplicates the dashboard-post report candidate
- Evidence: `docs/LIVE_SCENARIO_CONTENT.md` now contains two `## Live Report Candidate - Dashboard Post` sections for the same target `t3_1tm8nak`: the first at `docs/LIVE_SCENARIO_CONTENT.md:63-86` includes the expected report-suppression proof steps, and the second at `docs/LIVE_SCENARIO_CONTENT.md:118-129` repeats the same permalink and thing id in shorter form after S02.
- Why it matters: The live proof pass depends on following exact scenario instructions and recording evidence against the right target. Duplicating the same candidate in two places is easy to read as two separate proof items or as a stale copy of the current candidate, which can muddy the evidence log for the next report-trigger run.
- Suggested fix: Keep one dashboard-post candidate section near the S01 blocker note and remove or merge the later duplicate so the scenario sequence has a single source of truth for `t3_1tm8nak`.
- Files reviewed: `docs/LIVE_SCENARIO_CONTENT.md`, `docs/LIVE_TRIGGER_PROOF_RUNBOOK.md`, `docs/REVIEW_AGENT_FINDINGS.md`

## 2026-05-25 15:28 IST - Finding

- Severity: medium
- Area: Stale active locks with runtime warnings are not surfaced in the dashboard lock table
- Evidence: The current stale-relock hardening keeps the existing lock active when `unignoreReports()` fails, updates `lastKnownEdited`, `lastReportCount`, and appends `staleUnignoreResult.warnings` to `runtimeWarnings` (`src/server/services/lockFlow.ts:167-199`). Dashboard data returns those active locks unchanged (`src/server/services/dashboard.ts:66-87`), but `renderLockTable()` filters to `status === 'active'` and renders target, author, content, reason, suppressed count, locked date, and unlock action only (`src/client/components/LockTable.ts:47-120`). It never renders `lock.runtimeWarnings`, `lastKnownEdited`, or any failed/needs-retry marker. The audit timeline renders the failure message but not the target id (`src/client/components/AuditTimeline.ts:6-33`), and the runtime banner is global rather than item-specific.
- Why it matters: After a stale `unignoreReports()` failure, ReviewLock intentionally leaves the old lock active as a retry surface. In the main moderator dashboard that retry surface looks like an ordinary active reviewed-content lock, even though current content changed and reports may still be ignored. That can hide the exact item needing attention and weakens the fail-open story for the edit-break loop.
- Suggested fix: Render item-level runtime warnings or a distinct needs-attention state in the active locks table when `lock.runtimeWarnings.length > 0` or when `lastKnownEdited` changed during a failed stale relock. Add a client render regression covering an active lock with `runtimeWarnings: ['unignoreReports failed for t3_post']` so the warning is visible next to that target.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/dashboard.ts`, `src/client/components/LockTable.ts`, `src/client/components/AuditTimeline.ts`, `src/client/components/RuntimeBanner.ts`, `src/server/services/lockFlow.test.ts`

## 2026-05-25 15:30 IST - Finding

- Severity: medium
- Area: Update-trigger `unignoreReports()` results are not recorded in runtime proof
- Evidence: `breakLockForChangedContent()` calls `unignoreReportsForReviewLock()` for changed update-trigger targets and carries its warnings into the reopen event and audit data (`src/server/services/reopenFlow.ts:133-165`), but `reopenFlow.ts` does not import or call `recordModerationOperationStatus()`. By contrast, lock/relock/unlock and report-trigger moderation paths record moderation operation results into runtime proof (`src/server/services/lockFlow.ts`, `src/server/services/unlockFlow.ts`, `src/server/services/reportTriggers.ts:144-151`, `src/server/services/reportTriggers.ts:349-350`). Existing update-trigger tests assert the Reddit call, reopen state, metrics, and audit, but do not assert runtime proof changes (`src/server/services/updateTriggers.test.ts:126-162`, `src/server/services/reopenFlow.test.ts:75-93`).
- Why it matters: Wave 33 is specifically trying to prove live edit/update-trigger behavior. If an update trigger successfully or unsuccessfully calls `unignoreReports()`, the moderator-facing runtime proof ledger can remain stale, showing only earlier dashboard unlock proof or no trigger-time failure. That weakens the claim boundary and makes it harder to distinguish "edit trigger reopened locally" from "edit trigger performed and recorded the live moderation operation."
- Suggested fix: Record update-trigger `unignoreReports()` results through the same runtime proof helper used by report and lock flows, swallowing proof-write failures if needed. Add a regression where a changed update trigger records `unignoreReports verified`, and a failing `unignoreReports()` records `failed` while preserving the reopen warning.
- Files reviewed: `src/server/services/reopenFlow.ts`, `src/server/services/updateTriggers.ts`, `src/server/services/updateTriggers.test.ts`, `src/server/services/reopenFlow.test.ts`, `src/server/services/runtimeProof.ts`, `src/server/services/reportTriggers.ts`, `src/server/services/lockFlow.ts`, `src/server/services/unlockFlow.ts`

## 2026-05-25 15:35 IST - Recheck

- Area: Live scenario duplicate dashboard-post candidate
- Result: Resolved in the current worktree.
- Evidence: `docs/LIVE_SCENARIO_CONTENT.md` now has a single
  `Live Report Candidate - Dashboard Post` section, with observed live proof
  recorded under that section.

## 2026-05-25 15:35 IST - Recheck

- Area: Stale active locks with runtime warnings surfaced in dashboard
- Result: Resolved in the current worktree.
- Evidence: `renderLockTable()` now renders a row-level `Needs attention`
  marker and escaped runtime warning text for active locks with
  `runtimeWarnings`; `src/client/render.test.ts` covers the visible warning.

## 2026-05-25 15:35 IST - Recheck

- Area: Update-trigger `unignoreReports()` runtime proof recording
- Result: Resolved in the current worktree.
- Evidence: `breakLockForChangedContent()` now records the
  `unignoreReports()` operation result through `recordModerationOperationStatus`
  and swallows proof-write failures; `src/server/services/reopenFlow.test.ts`
  covers both verified and failed runtime proof statuses.

## 2026-05-25 15:31 IST - Finding

- Severity: medium
- Area: Reopen queue hides runtime warnings attached to reopened items
- Evidence: Reopen events include `runtimeWarnings` in the shared schema and trigger services populate them for risky paths such as changed-content `unignoreReports()` warnings and target-resolution uncertainty (`src/server/services/reopenFlow.ts:51-75`, `src/server/services/reportTriggers.ts:88-106`, `src/server/services/reportTriggers.ts:348-359`). The client renderers for the latest reopen event and reopen queue render target, reason, created date, summary, fingerprint transition, and dismiss action, but never render `event.runtimeWarnings` (`src/client/components/ReopenQueue.ts:59-103`, `src/client/components/ReopenQueue.ts:106-145`). The existing reopen-flow test explicitly accepts an `unignoreReports failed for t3_post` warning while still queueing a reopened item (`src/server/services/reopenFlow.test.ts:85-93`), so this hidden-warning state is reachable by design.
- Why it matters: Reopen is the main moderator attention surface for edited or uncertain content. If ReviewLock reopened an item but failed to unignore reports, or reopened because target integrity was uncertain, moderators can dismiss the reopen item without seeing the operational warning that reports may still be ignored or proof is incomplete. That weakens the fail-open/recovery story during the exact edit-break loop the product must demonstrate.
- Suggested fix: Render `event.runtimeWarnings` in both latest reopen and queue rows with a distinct needs-attention treatment, and consider disabling or adding stronger confirmation for dismissing reopen events with unresolved runtime warnings. Add a render regression with a reopen event containing `runtimeWarnings: ['unignoreReports failed for t3_post']`.
- Files reviewed: `src/client/components/ReopenQueue.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.test.ts`, `src/shared/schema.ts`

## 2026-05-25 15:36 IST - Finding

- Severity: medium
- Area: Live trigger delivery is not written to the runtime proof ledger
- Evidence: The default runtime proof matrix includes a `triggers` capability (`src/server/services/runtimeProof.ts:11`, `src/server/services/runtimeProof.test.ts:63-96`), but the only direct `recordCapabilityStatus()` call sites are the Redis and Reddit smoke endpoints (`src/routes/api.ts:143`, `src/routes/api.ts:206`). Report and update trigger routes log sanitized payload shape and call the trigger services (`src/routes/triggers.report.ts:107-131`, `src/routes/triggers.update.ts:93-106`), while the services record moderation operations such as `ignoreReports` and `unignoreReports` but never record that `onPostReport`, `onCommentReport`, or update-trigger delivery itself was observed (`src/server/services/reportTriggers.ts:144-151`, `src/server/services/reopenFlow.ts:136-141`). Existing trigger/runtime tests assert moderation-operation proof, not trigger-capability proof (`src/server/services/reportTriggers.test.ts:595-600`, `src/server/services/reopenFlow.test.ts:84-103`). Current docs now mark controlled post report delivery verified in `docs/RUNTIME_PROOF.md:91` and `docs/LIVE_TRIGGER_PROOF_RUNBOOK.md:114-127`, while older proof surfaces still say trigger delivery remains unverified (`docs/KNOWN_LIMITATIONS.md:9-11`, `docs/CLAIM_COPY_AUDIT.md:21`, `docs/LIVE_SCENARIO_MATRIX.md:98-99`).
- Why it matters: Wave 33's core evidence is live trigger delivery. After a real `PostReport` is observed, the moderator-facing runtime panel can still show the `triggers` capability as unverified because no trigger path updates that ledger. That creates a split-brain proof boundary: docs may claim controlled post report delivery is verified, while the app's own runtime status remains stale or only proves the downstream `ignoreReports()` call.
- Suggested fix: Record trigger delivery through `recordCapabilityStatus()` when a trigger route accepts and processes a live payload, ideally with more specific capability names such as `postReportTrigger`, `commentReportTrigger`, and `updateTriggers` rather than one ambiguous `triggers` bucket. Add route/service regressions proving a successful `on-post-report` updates runtime proof without marking comment/update triggers verified, then reconcile the stale claim-boundary docs to the same post-only status.
- Files reviewed: `src/server/services/runtimeProof.ts`, `src/routes/api.ts`, `src/routes/triggers.report.ts`, `src/routes/triggers.update.ts`, `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/reopenFlow.test.ts`, `docs/RUNTIME_PROOF.md`, `docs/LIVE_TRIGGER_PROOF_RUNBOOK.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/CLAIM_COPY_AUDIT.md`, `docs/LIVE_SCENARIO_MATRIX.md`

## 2026-05-25 15:41 IST - Recheck

- Area: Reopen queue hides runtime warnings attached to reopened items
- Result: Resolved in the current worktree.
- Evidence: `renderLatestReopenEvent()` and `renderReopenQueue()` now render
  `event.runtimeWarnings` with a `Needs attention` marker; `src/client/render.test.ts`
  covers reopened items with `unignoreReports failed for t3_reviewed`.

## 2026-05-25 15:41 IST - Recheck

- Area: Live trigger delivery runtime proof ledger
- Result: Resolved in the current worktree for future trigger deliveries.
- Evidence: `handleReportTrigger()` records `postReportTrigger` or
  `commentReportTrigger` through `recordCapabilityStatus()`, and
  `handleUpdateTrigger()` passes specific update-trigger capability names into
  `breakLockForChangedContent()`. Route tests prove `postReportTrigger` is
  recorded without marking `commentReportTrigger` verified, and update route
  tests prove `postUpdateTrigger` is recorded.

## 2026-05-25 15:39 IST - Finding

- Severity: high
- Area: Comment update trigger target extraction can choose the parent post id
- Evidence: Installed Devvit typings define `CommentUpdate` with both `comment?: CommentV2` and `post?: PostV2` (`node_modules/@devvit/protos/json/devvit/events/v1alpha/events.d.ts:89-94`). `CommentV2` carries the edited comment id at `comment.id` and the parent post id separately at `comment.postId` (`node_modules/@devvit/protos/json/devvit/reddit/v2alpha/commentv2.d.ts:7-26`). The update trigger route uses one target extractor for both post and comment routes and searches `payload.targetId`, `payload.postId`, `payload.commentId`, `payload.post?.id`, then `payload.comment?.id` before applying kind-specific normalization (`src/routes/triggers.update.ts:58-70`). On `/on-comment-update`, a live-shaped payload containing both `post` and `comment` will therefore pick `post.id`, normalize it as a comment id, and call `breakLockForChangedContent()` with the wrong `t1_*` target. Existing comment-update route tests cover `{ comment: { id: 't1_comment' } }` and wrapped `{ commentUpdate: { comment: { id: 't1_comment' } } }`, but they do not include the installed `post` sibling (`src/routes/triggers.update.test.ts:243-323`).
- Why it matters: Comment edit reopen is a must-ship part of the "locked until edited" loop. If Devvit sends the typed `post` field alongside the edited `comment`, ReviewLock will fail to resolve the active comment lock and can leave edited reviewed comments locked until a later report happens to force a refetch path.
- Suggested fix: Make target id extraction kind-aware. For comment routes, prefer `commentId` and `comment?.id` before any post fields; for post routes, prefer `postId` and `post?.id`. Add route regressions for raw and `TriggerEvent`-wrapped `CommentUpdate` payloads that include both `post` and `comment`, asserting the resolved action reopens the `t1_*` lock and calls `unignoreReports:t1_comment`.
- Files reviewed: `src/routes/triggers.update.ts`, `src/routes/triggers.update.test.ts`, `node_modules/@devvit/protos/json/devvit/events/v1alpha/events.d.ts`, `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/commentv2.d.ts`, `node_modules/@devvit/protos/json/devvit/reddit/v2alpha/postv2.d.ts`
