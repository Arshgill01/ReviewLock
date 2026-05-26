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

## 2026-05-25 15:42 IST - Recheck

- Area: Comment update trigger target extraction with sibling post ids
- Result: Resolved in the current worktree.
- Evidence: `src/routes/triggers.update.ts` now makes target extraction kind-aware, so comment routes prefer `targetId`, `commentId`, and `comment?.id` without considering sibling post ids. `src/routes/triggers.update.test.ts` now covers both raw and wrapped comment update payloads that include `post: { id: 't3_parent_post' }` plus `comment: { id: 't1_comment' }`, asserting the comment lock reopens and `unignoreReports:t1_comment` is called. The same kind-aware extraction pattern was applied to `src/routes/triggers.report.ts` with a comment-report sibling-post regression.

## 2026-05-25 15:43 IST - Recheck

- Area: Comment update trigger target extraction can choose the parent post id
- Result: Resolved in the current worktree.
- Evidence: `targetId()` in report and update trigger routes is now
  endpoint-kind-aware: post routes inspect post ids and comment routes inspect
  comment ids. Route tests cover comment report/update payloads with sibling
  `post.id` plus `comment.id`, including a wrapped comment update payload, and
  prove the route calls `unignoreReports:t1_comment` or
  `ignoreReports:t1_comment`.

## 2026-05-25 15:47 IST - Finding

- Severity: medium
- Area: Comment menu fallback target extraction can choose the parent post id
- Evidence: `src/routes/menu.ts:18-34` extends the Devvit `MenuItemRequest`
  body with optional `postId` and `commentId`, but `targetIdFromBody()` always
  falls back through `body.targetId ?? body.postId ?? body.commentId` before
  applying the endpoint kind. On `/lock-comment` or `/unlock-comment`, a
  context-shaped body with both `postId: "t3_parent"` and
  `commentId: "t1_comment"` but no `targetId` will normalize the parent post id
  as `t3_parent`, allowing the comment endpoint to resolve the parent post
  instead of the actual comment. The
  installed official `MenuItemRequest` type does provide exact `targetId`
  (`node_modules/@devvit/shared/types/menu-item.d.ts:2-12`), but Devvit context
  types also expose both `postId` and `commentId`
  (`node_modules/@devvit/public-api/types/context.d.ts:27-52`), and the route
  already added those fallback fields. Existing menu tests only cover post menu
  payloads and target-level open actions (`src/routes/menu.test.ts:33-151`);
  there is no lock/unlock regression for comment payloads with both ids.
- Why it matters: Comment lock and unlock proof is still pending, and comment
  menu availability is called out as a current live-proof gap. If the Web server
  sends a BaseContext-style body or a future test harness omits `targetId`, the
  comment menu action can fail before ReviewLock creates or unlocks the reviewed
  comment lock.
- Suggested fix: Make menu target extraction kind-aware, matching the trigger
  route fix: post endpoints should prefer `targetId`, `postId`; comment
  endpoints should prefer `targetId`, `commentId` and only inspect post ids for
  post routes. Add `/lock-comment` and `/unlock-comment` route tests with both
  `postId` and `commentId` present and no `targetId`.
- Files reviewed: `src/routes/menu.ts`, `src/routes/menu.test.ts`,
  `node_modules/@devvit/shared/types/menu-item.d.ts`,
  `node_modules/@devvit/public-api/types/context.d.ts`

## 2026-05-25 15:50 IST - Finding

- Severity: low
- Area: Demo-mode exit mutates client state before disable succeeds
- Evidence: `ReviewLockStore.setDemo(false)` captures the demo subreddit, then
  immediately sets `this.demo = false` and `this.subreddit = this.liveSubreddit`
  before awaiting `this.api.disableDemoMode(demoSubreddit)`
  (`src/client/state/store.ts:224-229`). If the disable request rejects, the
  catch block records the error but does not restore the prior demo state
  (`src/client/state/store.ts:231-235`). A subsequent call to
  `setDemo(false)` sees `demo === this.demo` and only fetches state without
  retrying `disableDemoMode()` (`src/client/state/store.ts:209-212`). Existing
  store tests cover only successful demo disable paths
  (`src/client/state/store.test.ts:205-232`), not a rejected disable request.
- Why it matters: Demo mode is a required, visibly labeled story. A transient
  API/Redis failure while exiting demo can leave the browser in live-mode state
  even though the demo disable operation never completed, and the same control
  path cannot retry the server-side disable because the client already believes
  it has exited demo.
- Suggested fix: Defer mutating `this.demo` and `this.subreddit` until
  `disableDemoMode()` succeeds, or snapshot and restore the previous demo state
  in the catch path. Add a store regression where `disableDemoMode()` rejects,
  asserting the store remains in `reviewlock_demo` with `demo === true` and a
  later `setDemo(false)` retries the disable call.
- Files reviewed: `src/client/state/store.ts`, `src/client/state/store.test.ts`,
  `docs/REVIEW_AGENT_FINDINGS.md`

## 2026-05-25 15:52 IST - Finding

- Severity: high
- Area: Thrown Reddit refetch errors bypass trigger fail-open reopen handling
- Evidence: `resolveTargetById()` awaits `reddit.getPostById()` /
  `reddit.getCommentById()` directly and only returns a structured
  `{ ok: false }` result when the adapter returns `undefined`
  (`src/server/services/targetResolver.ts:39-64`). Both report and update
  trigger services call it before their main `try` blocks
  (`src/server/services/reportTriggers.ts:178-188`,
  `src/server/services/reopenFlow.ts:96-124`). The fail-open paths that reopen a
  known active lock as `runtime_uncertain` only run after a structured
  unresolved result reaches those blocks (`src/server/services/reportTriggers.ts:199-230`,
  `src/server/services/reopenFlow.ts:124-170`). Existing regressions cover a
  missing target returned by `FakeRedditAdapter` (`src/server/services/reportTriggers.test.ts:410-437`,
  `src/server/services/reopenFlow.test.ts:114-120`), but there is no regression
  where `getPostById()` or `getCommentById()` rejects.
- Why it matters: Devvit/Reddit refetch can fail transiently during the exact
  report/update trigger pass where ReviewLock must avoid suppressing changed or
  uncertain content. If the refetch throws, the service rejects before it can
  acquire the target lock, queue a `runtime_uncertain` reopen, clear dedupe, or
  write an audit/runtime warning. That can leave a known active lock in place
  after an edit/update delivery instead of failing open.
- Suggested fix: Catch adapter errors inside `resolveTargetById()` and return
  `{ ok: false, targetKind, error }`, or move resolution inside the trigger
  service `try` blocks and map thrown errors to the existing runtime-uncertain
  path. Add report and update trigger regressions with a Reddit adapter whose
  refetch method rejects while an active lock and subreddit scope are present,
  asserting the lock reopens with `runtime_uncertain` and warnings are visible.
- Files reviewed: `src/server/services/targetResolver.ts`,
  `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `src/server/services/reopenFlow.test.ts`

## 2026-05-25 15:57 IST - Finding

- Severity: medium
- Area: Seeded demo warning example is not shown in the main dashboard lists
- Evidence: The required seeded warning case is created as a failed lock:
  `failedLock()` sets `status: 'failed'` and preserves `runtimeWarnings`
  (`src/shared/demoScenario.ts:85-89`), and `warningInput` is included in
  `demoLocks` (`src/shared/demoScenario.ts:386-406`). The demo summary counts
  this warning from all scenario locks (`src/server/services/demoData.ts:6-13`),
  but dashboard data only loads `listActiveLocks()` for the locks response
  (`src/server/services/dashboard.ts:66-87`,
  `src/routes/api.dashboard.ts:230-235`), and `listActiveLocks()` filters to
  `lock?.status === 'active'` (`src/server/services/locks.ts:103-111`). The
  client table repeats that active-only filter (`src/client/components/LockTable.ts:60-66`).
  The audit timeline does include the seeded `runtime_failure`, but renders only
  kind, timestamp, actor, and message, not the affected target, lock id, or
  warning detail (`src/shared/demoScenario.ts:477-485`,
  `src/client/components/AuditTimeline.ts:6-33`).
- Why it matters: Demo mode is mandatory and must visibly show one
  failure/warning example. In the current dashboard, the explicit warning lock
  is hidden from the active-lock and reopen-queue surfaces, so the demo mostly
  shows the happy edit-break loop plus a generic audit sentence. That makes the
  safety/recovery story weaker and can make the fixture-level warning coverage
  look present in tests while absent from the moderator-facing dashboard.
- Suggested fix: Add a small "Needs attention" dashboard list for failed locks
  or include failed warning locks in the locks endpoint/table as a distinct
  non-actionable row. At minimum, render target id/lock id and warning detail in
  the audit timeline for runtime failures. Add a dashboard/render regression
  that seeds `DEMO_SCENARIO` and asserts the runtime warning example target or
  warning text is visible in the main dashboard HTML.
- Files reviewed: `src/shared/demoScenario.ts`,
  `src/server/services/demoData.ts`, `src/server/services/dashboard.ts`,
  `src/server/services/locks.ts`, `src/routes/api.dashboard.ts`,
  `src/client/components/LockTable.ts`, `src/client/components/AuditTimeline.ts`

## 2026-05-25 22:38 IST - Resolution

- Resolved comment menu fallback extraction by making `src/routes/menu.ts`
  endpoint-kind-aware; comment lock/unlock routes now prefer `commentId` over a
  sibling parent `postId`.
- Added `/lock-comment` and `/unlock-comment` regressions with both ids present
  and no `targetId`.
- Resolved thrown Reddit refetch failures by catching adapter exceptions in
  `resolveTargetById()` and returning structured uncertainty to the existing
  report/update fail-open paths.
- Added report and update regressions proving a known active lock reopens as
  `runtime_uncertain` when refetch throws.
- Resolved demo exit retry drift by mutating client demo state only after
  `disableDemoMode()` succeeds, with a retry regression.
- Improved seeded warning visibility by rendering escaped audit target, lock,
  operation, reason, and error details; added render coverage for runtime
  failure audit details.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/routes/menu.test.ts src/client/state/store.test.ts src/client/render.test.ts --reporter verbose`
  - `npm run type-check`

## 2026-05-25 23:00 IST - Finding

- Severity: medium
- Area: Failed Reddit runtime smoke is not recorded in the proof ledger
- Evidence: `/api/smoke/redis` stores `smokeSubreddit` after scope resolution
  and records `failedSmokeResult('redis', ...)` through
  `recordCapabilityStatus()` when the namespaced write/read/delete check throws
  (`src/routes/api.ts:145-183`). `/api/smoke/reddit` records
  `redditContext verified` on success (`src/routes/api.ts:214-234`), but its
  catch block only returns `{ ok: false, capability: 'redditContext',
  status: 'failed', error }` and never writes the failed result to runtime proof
  (`src/routes/api.ts:243-254`). The contract tests include a regression for
  failed Redis smoke proof persistence (`src/routes/api.contract.test.ts:110-149`)
  but no corresponding failing Reddit-context case.
- Why it matters: `Verify runtime` is the moderator-facing proof surface. If
  Reddit context lookup fails after subreddit scope is known, the dashboard gets
  an error, but the persisted runtime panel can remain stale as `verified` or
  `unverified` instead of showing `redditContext failed`. That weakens the
  claim boundary and makes intermittent Devvit context failures harder to
  distinguish from never-run proof.
- Suggested fix: Mirror the Redis smoke path: capture the scoped subreddit
  before `getCurrentUsername()`, and on failure write the failed `redditContext`
  capability status when both Redis and subreddit are available. Add a contract
  regression using a Reddit adapter that returns `undefined` or throws from
  `getCurrentUsername()`, asserting `/api/smoke/reddit` returns 500 and
  `loadRuntimeProofStatus(redis, 'alpha')` contains `redditContext` with
  `status: 'failed'`.
- Files reviewed: `src/routes/api.ts`, `src/routes/api.contract.test.ts`,
  `src/client/state/store.ts`, `src/server/services/runtimeHardening.ts`,
  `docs/RUNTIME_PROOF.md`, `docs/REVIEW_AGENT_FINDINGS.md`

## 2026-05-25 23:07 IST - Resolution

- Resolved failed Reddit runtime smoke persistence by recording failed
  `redditContext` capability status when `/api/smoke/reddit` has already
  resolved a subreddit namespace and Redis is available.
- Added a contract regression for `getCurrentUsername()` returning `undefined`;
  the route now returns 500 and `loadRuntimeProofStatus(redis, 'alpha')`
  includes `redditContext failed`.
- Focused validation:
  - `npm run test -- src/routes/api.contract.test.ts --reporter verbose`

## 2026-05-25 23:04 IST - Finding

- Severity: low
- Area: Production trust audit has stale live-trigger claim boundary
- Evidence: The current proof ledger records controlled live `PostReport`
  suppression and controlled live `PostUpdate` body-edit reopen as passing
  evidence (`docs/RUNTIME_PROOF.md:49-56`). The trigger proof doc repeats that
  `PostReport` payload comparison and `PostUpdate` payload comparison are
  available, while comment report/update, NSFW, spoiler, and flair remain
  unverified (`docs/TRIGGER_PROOF.md:23-28`, `docs/TRIGGER_PROOF.md:52-99`).
  `docs/CLAIM_COPY_AUDIT.md:20-23` now uses the narrower safe wording:
  controlled post-report suppression and controlled post body-edit reopening are
  captured, with comment and remaining update variants pending. But
  `docs/PRODUCTION_TRUST_AUDIT.md:9-10` still says live report/update trigger
  delivery remains unverified, and `docs/PRODUCTION_TRUST_AUDIT.md:34` still
  says live trigger payload capture remains open.
- Why it matters: Wave 34/submission cleanup can accidentally understate or
  contradict the proof boundary. The safer current claim is not "all live
  trigger delivery is unverified"; it is "controlled post-report suppression and
  controlled post body-edit reopening are verified; comment report/update and
  NSFW/spoiler/flair variants remain unverified."
- Suggested fix: Update `docs/PRODUCTION_TRUST_AUDIT.md` as a historical audit
  with a current-status addendum, or point readers to the current proof ledger
  and remove stale blanket statements about live report/edit trigger delivery.
  Keep the production-trust answer cautious, but make the remaining proof gaps
  match `docs/RUNTIME_PROOF.md`, `docs/TRIGGER_PROOF.md`, and
  `docs/CLAIM_COPY_AUDIT.md`.
- Files reviewed: `docs/PRODUCTION_TRUST_AUDIT.md`, `docs/RUNTIME_PROOF.md`,
  `docs/TRIGGER_PROOF.md`, `docs/CLAIM_COPY_AUDIT.md`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:07 IST - Finding

- Severity: medium
- Area: Runtime proof still carries an unowned broad `triggers` capability after
  adding granular trigger proof
- Evidence: The runtime proof default matrix still seeds only
  `['approve', 'ignoreReports', 'unignoreReports', 'redis', 'triggers']`
  (`src/server/services/runtimeProof.ts:11`, `src/server/services/runtimeProof.ts:63-72`).
  Report routes now write granular `postReportTrigger` or
  `commentReportTrigger` capabilities (`src/server/services/reportTriggers.ts:153-171`),
  and update routes write `postUpdateTrigger`, `commentUpdateTrigger`,
  `postNsfwUpdateTrigger`, `postSpoilerUpdateTrigger`, or
  `postFlairUpdateTrigger` (`src/server/services/updateTriggers.ts:34-55`).
  The runtime banner renders only the persisted capability rows it receives
  (`src/client/components/RuntimeBanner.ts:33-60`). No code records or removes
  the old broad `triggers` capability after granular trigger proof is added.
  The runtime proof tests assert the malformed/default fallback contains
  `triggers`, but do not cover a fully granular trigger matrix or require the
  specific unverified trigger variants to appear (`src/server/services/runtimeProof.test.ts:8-18`,
  `src/server/services/runtimeProof.test.ts:53-96`). This also conflicts with
  D070's decision to keep unrelated trigger capabilities unverified at the
  specific trigger level (`decisions.md:1138-1158`).
- Why it matters: During the current partial proof state, the dashboard can show
  `postReportTrigger verified` and `postUpdateTrigger verified` while the
  remaining comment/flag/spoiler/flair trigger gaps are represented only by a
  vague stale `triggers unverified` row, not by explicit unverified capability
  rows. After the remaining trigger variants are proven, the broad `triggers`
  row can still keep overall runtime status unverified even if all granular
  trigger capabilities have passed, unless a human remembers to update that
  legacy row manually.
- Suggested fix: Replace the broad default `triggers` capability with explicit
  granular trigger defaults in `runtimeProof.ts`, or derive the broad trigger
  row from the granular statuses and remove it once granular proof is active.
  Add runtime proof tests that load the default matrix and assert every
  unverified trigger variant is visible, then record all granular trigger
  capabilities as verified and assert no stale broad `triggers` row keeps
  `overall` unverified.
- Files reviewed: `src/server/services/runtimeProof.ts`,
  `src/server/services/reportTriggers.ts`, `src/server/services/updateTriggers.ts`,
  `src/client/components/RuntimeBanner.ts`,
  `src/server/services/runtimeProof.test.ts`, `docs/RUNTIME_PROOF.md`,
  `decisions.md`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:09 IST - Resolution

- Resolved the failed Reddit runtime smoke ledger gap from the 23:00 finding.
- Evidence: `/api/smoke/reddit` now stores the resolved smoke subreddit before
  checking `getCurrentUsername()` and writes `redditContext failed` to runtime
  proof when username lookup fails after scope resolution (`src/routes/api.ts:198-265`).
  The contract test now covers a Reddit adapter returning `undefined`, asserts
  the route returns HTTP 500 with `capability: 'redditContext'`, and verifies
  `loadRuntimeProofStatus(redis, 'alpha')` contains a failed `redditContext`
  capability (`src/routes/api.contract.test.ts:151-185`).
- Focused validation:
  - `npm run test -- src/routes/api.contract.test.ts --reporter verbose`
  - PASS, 1 test file and 8 tests.

## 2026-05-25 23:10 IST - Finding

- Severity: low
- Area: Runtime proof default matrix omits `redditContext`
- Evidence: `/api/smoke/reddit` records a `redditContext` capability on success
  and now on scoped failure (`src/routes/api.ts:216-265`), and the live proof
  docs treat `redditContext` as a first-class runtime capability
  (`docs/RUNTIME_PROOF.md:95-96`, `docs/PLAYTEST_CHECKLIST.md:71-72`). But the
  default runtime proof matrix still seeds only
  `['approve', 'ignoreReports', 'unignoreReports', 'redis', 'triggers']`
  (`src/server/services/runtimeProof.ts:11`, `src/server/services/runtimeProof.ts:63-72`).
  The malformed-record fallback tests only require `redis` or `triggers`, not
  `redditContext` (`src/server/services/runtimeProof.test.ts:53-96`), and the
  runtime banner renders exactly the capability rows it receives
  (`src/client/components/RuntimeBanner.ts:33-60`).
- Why it matters: On first run, or after a malformed runtime proof record falls
  back to defaults, the moderator-facing runtime panel does not show
  `redditContext unverified`; the capability simply disappears until someone
  clicks `Verify runtime`. That makes the proof surface less explicit and can
  hide a missing Reddit-context check even though the product docs require it as
  part of the runtime boundary.
- Suggested fix: Add `redditContext` to the default capability matrix, alongside
  the granular trigger defaults from the 23:07 finding. Add runtime proof tests
  that default and malformed-ledger fallbacks include `redditContext` as
  `unverified`, and that recording a failed or verified Reddit smoke result
  updates that row rather than introducing it only after the first smoke run.
- Files reviewed: `src/server/services/runtimeProof.ts`,
  `src/server/services/runtimeProof.test.ts`, `src/routes/api.ts`,
  `src/client/components/RuntimeBanner.ts`, `docs/RUNTIME_PROOF.md`,
  `docs/PLAYTEST_CHECKLIST.md`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:11 IST - Resolution

- Resolved the runtime proof default-matrix findings from 23:07 and 23:10.
- Evidence: `defaultCapabilityNames` now includes `redditContext` and granular
  trigger capabilities (`postReportTrigger`, `commentReportTrigger`,
  `postUpdateTrigger`, `commentUpdateTrigger`, `postNsfwUpdateTrigger`,
  `postSpoilerUpdateTrigger`, and `postFlairUpdateTrigger`) and no longer seeds
  the broad legacy `triggers` row (`src/server/services/runtimeProof.ts:11-24`).
  Runtime proof tests now assert the default matrix includes granular trigger
  rows, malformed-ledger fallback returns granular unverified rows, and all
  granular trigger capabilities can verify without a stale broad `triggers` row
  keeping `overall` unverified (`src/server/services/runtimeProof.test.ts:11-160`).
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts src/routes/api.contract.test.ts --reporter verbose`
  - PASS, 2 test files and 14 tests.

## 2026-05-25 23:13 IST - Finding

- Severity: medium
- Area: Runtime proof normalization drops the demo-only proof warning
- Evidence: The seeded demo runtime status explicitly warns
  `Demo data only. Seeded records are not runtime proof.`
  (`src/shared/demoScenario.ts:571-622`), and demo seeding persists that status
  through `saveRuntimeProofStatus()` (`src/server/services/demoMode.ts:84-96`).
  Dashboard and `/api/runtime` reads then call `loadRuntimeProofStatus()`
  (`src/server/services/dashboard.ts:66-84`,
  `src/routes/api.dashboard.ts:287-307`). The new
  `normalizeRuntimeProofStatus()` path rebuilds `warnings` from capability
  status only, replacing every stored warning with either
  `Some runtime capabilities are not verified.` or `[]`
  (`src/server/services/runtimeProof.ts:104-125`). Existing runtime proof tests
  cover default/malformed migration and broad-trigger removal, but they do not
  seed demo runtime status or assert that stored warning text survives
  normalization (`src/server/services/runtimeProof.test.ts:63-187`,
  `src/server/services/demoMode.test.ts:14-26`).
- Why it matters: Demo/live separation is a non-negotiable product guardrail.
  After demo mode is enabled, the runtime panel can lose the strongest
  moderator-facing warning that seeded demo records are not runtime proof,
  showing only a generic unverified-capabilities warning. That makes seeded
  proof data easier to mistake for live Devvit evidence.
- Suggested fix: Preserve existing `status.warnings` during normalization and
  append generic warnings only when absent, or add an explicit demo-aware
  warning preservation path. Add a regression that seeds demo data, loads
  runtime proof through `loadRuntimeProofStatus()` or `/api/runtime?demo=true`,
  and asserts the returned warnings still contain
  `Demo data only. Seeded records are not runtime proof.`
- Files reviewed: `src/shared/demoScenario.ts`,
  `src/server/services/demoMode.ts`, `src/server/services/runtimeProof.ts`,
  `src/server/services/runtimeProof.test.ts`,
  `src/server/services/demoMode.test.ts`, `src/routes/api.dashboard.ts`,
  `src/client/components/RuntimeBanner.ts`.

## 2026-05-25 23:14 IST - Finding

- Severity: low
- Area: Redis race proof doc has a stale blanket trigger-proof boundary
- Evidence: The current runtime proof matrix marks controlled `PostReport`
  delivery, controlled `PostUpdate` body-edit reopening, and controlled
  `CommentUpdate` body-edit reopening verified, while keeping comment report and
  post NSFW/spoiler/flair update variants unverified
  (`docs/RUNTIME_PROOF.md:101-106`, `docs/TRIGGER_PROOF.md:23-28`). But
  `docs/REDIS_RACE_PROOF.md:80-82` still says live Devvit trigger delivery
  timing and trigger-driven suppression/reopening require controlled playtest
  proof before ReviewLock can claim live trigger suppression and reopening as
  verified. Unlike clearly historical Wave 21 and Wave 31 docs, this section is
  titled `Remaining Runtime Risk` and reads as the current boundary.
- Why it matters: Final claim cleanup can accidentally underclaim or contradict
  the runtime ledger. The safe current boundary is granular: controlled
  post-report suppression, post body-edit reopen, and comment body-edit reopen
  are verified; comment-report suppression and post flag/flair update variants
  remain unverified.
- Suggested fix: Update the `Remaining Runtime Risk` section to point to
  `docs/RUNTIME_PROOF.md` for current status and replace the blanket trigger
  sentence with the granular verified/unverified split. If the section is meant
  to remain historical for Wave 17, label it explicitly as historical.
- Files reviewed: `docs/REDIS_RACE_PROOF.md`, `docs/RUNTIME_PROOF.md`,
  `docs/TRIGGER_PROOF.md`, `docs/DEVVIT_REGISTRATION_PROOF.md`,
  `docs/INSTALL_DEPLOY_REHEARSAL.md`, `docs/LIVE_WEBVIEW_RUNTIME_SMOKE.md`.

## 2026-05-25 23:16 IST - Finding

- Severity: low
- Area: Route tests do not prove every granular update-trigger endpoint writes
  the expected proof row
- Evidence: `createUpdateTriggersRouter()` registers distinct endpoints for
  `/on-post-update`, `/on-comment-update`, `/on-post-nsfw-update`,
  `/on-post-spoiler-update`, and `/on-post-flair-update`
  (`src/routes/triggers.update.ts:111-115`), and
  `capabilityForUpdateTrigger()` maps those variants to separate runtime proof
  capabilities (`src/server/services/updateTriggers.ts:34-44`). The service
  tests cover reason mapping for flair, NSFW, and spoiler updates through
  `handleUpdateTrigger()` (`src/server/services/updateTriggers.test.ts:55-101`),
  and route tests cover post body, comment body, and flair route behavior
  (`src/routes/triggers.update.test.ts:61-85`,
  `src/routes/triggers.update.test.ts:253-379`,
  `src/routes/triggers.update.test.ts:381-427`). There are no route regressions
  for `/on-post-nsfw-update` or `/on-post-spoiler-update`, and the route tests
  only assert a runtime proof row for `postUpdateTrigger`, not
  `commentUpdateTrigger`, `postNsfwUpdateTrigger`, `postSpoilerUpdateTrigger`,
  or `postFlairUpdateTrigger` (`src/routes/triggers.update.test.ts:75-84`).
- Why it matters: The app now exposes a granular runtime proof matrix. A route
  registration typo or wrong `triggerKind` wiring for NSFW/spoiler/flair could
  leave the dashboard proving the wrong capability or reopening with the wrong
  reason while service-level tests still pass. That is exactly the kind of
  claim-boundary drift the granular matrix is trying to prevent.
- Suggested fix: Add route-level regressions for `/on-post-nsfw-update` and
  `/on-post-spoiler-update` that assert `nsfw_changed` / `spoiler_changed` and
  the matching runtime proof capability. Extend the existing comment and flair
  route tests to assert `commentUpdateTrigger` and `postFlairUpdateTrigger`
  become verified without marking unrelated update-trigger capabilities
  verified.
- Files reviewed: `src/routes/triggers.update.ts`,
  `src/routes/triggers.update.test.ts`,
  `src/server/services/updateTriggers.ts`,
  `src/server/services/updateTriggers.test.ts`,
  `src/server/services/runtimeProof.ts`.

## 2026-05-25 23:17 IST - Finding

- Severity: low
- Area: Runtime proof tests still do not assert `redditContext` appears in the
  default/fallback matrix
- Evidence: `defaultCapabilityNames` now includes `redditContext`
  (`src/server/services/runtimeProof.ts:11-24`), but the default-matrix test
  asserts only `ignoreReports` and the granular trigger rows
  (`src/server/services/runtimeProof.test.ts:11-29`). The malformed valid-JSON
  fallback test asserts granular trigger rows but not `redditContext`
  (`src/server/services/runtimeProof.test.ts:74-113`). The all-verified test
  records `redditContext` explicitly through `recordCapabilityStatus()`
  (`src/server/services/runtimeProof.test.ts:127-145`), so it would still pass
  even if `redditContext` were accidentally removed from the default matrix.
- Why it matters: `redditContext` is a first-class runtime smoke capability in
  the dashboard proof boundary. The code currently includes it, but the test
  suite does not lock that default/fallback behavior down, so a future edit can
  silently regress the first-run runtime panel back to hiding
  `redditContext unverified`.
- Suggested fix: Extend the default and malformed-ledger fallback tests to
  require `expect.objectContaining({ name: 'redditContext', status: 'unverified' })`.
  Optionally add a test that records only `redis verified` and confirms
  `redditContext` remains present as `unverified`.
- Files reviewed: `src/server/services/runtimeProof.ts`,
  `src/server/services/runtimeProof.test.ts`, `src/routes/api.ts`,
  `docs/RUNTIME_PROOF.md`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:19 IST - Resolution

- Resolved the 23:13 demo-warning preservation finding.
- Evidence: runtime proof normalization now preserves explicit stored warnings
  such as `Demo data only. Seeded records are not runtime proof.` while adding
  the generic unverified-capabilities warning only when needed
  (`src/server/services/runtimeProof.ts`). Regression coverage now asserts both
  direct runtime-proof normalization and seeded demo-mode runtime proof keep the
  demo warning visible (`src/server/services/runtimeProof.test.ts`,
  `src/server/services/demoMode.test.ts`).

## 2026-05-25 23:19 IST - Resolution

- Resolved the stale claim-boundary finding in the Redis race proof doc.
- Evidence: `docs/REDIS_RACE_PROOF.md` now points to `docs/RUNTIME_PROOF.md`
  for the current live matrix and states the granular split: controlled
  post-report suppression plus post/comment body-edit reopen paths are verified,
  while comment-report and post NSFW/spoiler/flair update variants remain
  unverified.

## 2026-05-25 23:19 IST - Resolution

- Resolved the route-level granular update-trigger proof finding.
- Evidence: route tests now assert `commentUpdateTrigger`,
  `postNsfwUpdateTrigger`, `postSpoilerUpdateTrigger`, and
  `postFlairUpdateTrigger` write their own runtime proof rows, and that
  unrelated update-trigger rows remain unverified during focused route
  exercises (`src/routes/triggers.update.test.ts`).

## 2026-05-25 23:19 IST - Resolution

- Resolved the runtime-proof `redditContext` default/fallback assertion gap.
- Evidence: `src/server/services/runtimeProof.test.ts` now requires
  `redditContext` to appear as `unverified` in the first-run default matrix and
  malformed-ledger fallback path.

## 2026-05-25 23:19 IST - Resolution

- Resolved the earlier stale production-trust claim-boundary finding.
- Evidence: `docs/PRODUCTION_TRUST_AUDIT.md` now distinguishes verified
  controlled post-report suppression and post/comment body-edit reopening from
  still-unverified comment-report and post flag/flair update variants.

## 2026-05-25 23:20 IST - Finding

- Severity: medium
- Area: Concurrent lock submissions can still create multiple active locks for one target
- Evidence: The sequential duplicate-submit regression now returns the existing
  lock when the second call observes the first persisted lock
  (`src/server/services/lockFlow.test.ts:95-126`). The production flow still
  performs a read-then-write without a per-target claim or Redis transaction:
  it loads the active lock by target (`src/server/services/lockFlow.ts:145-161`),
  then calls Reddit `approve()` / `ignoreReports()`
  (`src/server/services/lockFlow.ts:233-234`), and only later persists the new
  lock (`src/server/services/lockFlow.ts:281-299`). `saveLock()` writes the lock
  record, active sorted-set row, active-by-target hash, and target-lock pointer
  with ordinary `set`/`hset`/`zAdd` calls (`src/server/services/locks.ts:25-35`);
  the available `RedisStore.setIfNotExists()` helper is not used for lock
  creation (`src/server/adapters/redis.ts:6-20`). If two form submissions for
  the same reviewed content reach line 145 before either reaches `saveLock()`,
  both can see no active lock, both can call Reddit moderation methods, and
  both can save distinct active lock records when their clock timestamps differ.
  The target pointer will reference only the later lock, while
  `listActiveLocks()` still returns every active zset member
  (`src/server/services/locks.ts:103-111`). Current tests cover sequential
  duplicate calls but do not interleave two in-flight lock creations.
- Why it matters: ReviewLock's ledger should have one current review state per
  target. A moderator double-click, two moderators locking from stale menus, or
  a retry racing the original submission can strand an older active row that no
  target-based unlock/report/update path can reach, inflate lock-created
  metrics, and make dashboard state disagree with the target lock pointer.
- Suggested fix: Add an atomic per-target creation guard before Reddit
  moderation calls, such as a short-lived `setIfNotExists()` lock for
  `target:{thingId}:lock:create` or a transaction/CAS helper around the
  target-lock pointer. Recheck `getActiveLockByTarget()` after acquiring the
  guard and again before saving. Add a regression with a Redis adapter or
  Reddit adapter that pauses the first `ignoreReports()` call while a second
  `lockReviewedContent()` starts, then assert only one active lock row, one
  metrics increment, and one pair of Reddit moderation calls remain.
- Files reviewed: `src/server/services/lockFlow.ts`,
  `src/server/services/lockFlow.test.ts`, `src/server/services/locks.ts`,
  `src/server/adapters/redis.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:26 IST - Resolution

- Resolved the concurrent lock creation race.
- Evidence: `lockReviewedContent()` now acquires a short-lived per-target Redis
  creation lease before calling Reddit moderation methods, rechecks the active
  target lock after acquiring the lease, returns a retryable
  `lock_creation_in_progress` result when another creation is in flight, and
  releases the lease in `finally` (`src/server/services/lockFlow.ts`,
  `src/server/services/keys.ts`).
- Regression coverage: `src/server/services/lockFlow.test.ts` now pauses the
  first `ignoreReports()` call, starts a second lock submission for the same
  target while the first is in flight, and asserts one moderation call pair, one
  active lock, and one metrics increment.
- Focused validation:
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
  - PASS, 1 test file and 11 tests.

## 2026-05-25 23:21 IST - Finding

- Severity: low
- Area: Install/deploy rehearsal doc still lists obsolete live-proof blockers
- Evidence: Current proof docs record controlled post-target moderation methods,
  post-report suppression, post body-edit reopening, and comment body-edit
  reopening as verified while keeping comment report and post flag/flair
  variants unverified (`docs/RUNTIME_PROOF.md:98-105`,
  `docs/TRIGGER_PROOF.md:52-123`, `docs/KNOWN_LIMITATIONS.md:7-19`). The
  `Blockers and Next Actions` section in `docs/INSTALL_DEPLOY_REHEARSAL.md`
  still says live `approve()`, `ignoreReports()`, and `unignoreReports()`
  behavior is not proven on controlled Reddit content, and that live
  `PostReport`, update, NSFW, spoiler, and flair trigger delivery is not proven
  (`docs/INSTALL_DEPLOY_REHEARSAL.md:186-190`). The section is not labeled as a
  historical rehearsal snapshot, so it reads like the current live-proof TODO
  list.
- Why it matters: The final handoff depends on one coherent proof boundary.
  This stale next-action list can cause the team to underclaim already captured
  controlled proof, or to overlook the narrower remaining gaps: comment report,
  comment-target moderation method visibility, and post NSFW/spoiler/flair
  trigger variants.
- Suggested fix: Mark `docs/INSTALL_DEPLOY_REHEARSAL.md` as a historical
  rehearsal snapshot and add a pointer to `docs/RUNTIME_PROOF.md`, or update the
  blocker list to the current granular boundary: post-target moderation methods,
  `PostReport`, `PostUpdate`, and `CommentUpdate` verified; comment report and
  post NSFW/spoiler/flair variants still unverified.
- Files reviewed: `docs/INSTALL_DEPLOY_REHEARSAL.md`,
  `docs/RUNTIME_PROOF.md`, `docs/TRIGGER_PROOF.md`,
  `docs/KNOWN_LIMITATIONS.md`, `docs/CLAIM_COPY_AUDIT.md`,
  `docs/FULL_SCENARIO_WALKTHROUGH.md`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:25 IST - Finding

- Severity: medium
- Area: No-id report dedupe can double-count delayed duplicate deliveries
- Evidence: Live `PostReport` proof observed no direct top-level target/event id
  in the sanitized payload; the route had to use nested `post.id` and
  `post.numReports` (`docs/TRIGGER_PROOF.md:61-68`). When a report event lacks
  `eventId`, `dedupeKey()` falls back to
  `missing-event:${targetId}:count-${reportCount}:${bucket}`, where `bucket` is
  `now.slice(0, 16)` (`src/server/services/reportTriggers.ts:44-50`). For live
  report payloads without a stable event id or timestamp, `now` is the handler
  clock (`src/server/services/reportTriggers.ts:178`), so the same duplicate
  delivery with the same `post.numReports` will get a different dedupe key if it
  is retried after the minute changes. Existing no-id coverage only calls two
  same-count deliveries under the same fixed clock and proves the same-minute
  duplicate is ignored (`src/server/services/reportTriggers.test.ts:236-268`);
  there is no regression for the same no-id report count crossing a minute
  boundary.
- Why it matters: Devvit trigger delivery can be at-least-once, and the live
  shape already lacks the stable event id the service prefers. A delayed retry
  of one Reddit report can increment `suppressedReportCount`, daily report
  churn metrics, and audit entries twice, overstating the core "Reports
  suppressed" metric that judges and moderators will inspect.
- Suggested fix: For missing event ids, dedupe by a longer-lived fingerprint such
  as `targetId + reportCount` with a bounded TTL, or use a payload timestamp if
  live logs prove it is stable across retries. Keep distinct report-count
  increments countable, but do not include the processing minute in the primary
  missing-id dedupe key. Add a regression with two no-id deliveries for the same
  `targetId` and `reportCount` under different clock minutes, asserting the
  second returns `duplicate` and metrics/audit stay at one.
- Files reviewed: `src/server/services/reportTriggers.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `src/routes/triggers.report.ts`, `src/routes/triggers.report.test.ts`,
  `docs/TRIGGER_PROOF.md`, `docs/RUNTIME_PROOF.md`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:30 IST - Resolution

- Resolved the stale install/deploy rehearsal blocker list.
- Evidence: `docs/INSTALL_DEPLOY_REHEARSAL.md` now labels the section as a
  historical rehearsal snapshot, points to `docs/RUNTIME_PROOF.md`, and states
  the current granular boundary: post-target moderation methods, controlled
  `PostReport`, `PostUpdate`, and `CommentUpdate` are verified, while
  `CommentReport`, independent comment-target moderation visibility, and post
  NSFW/spoiler/flair update variants remain unverified.

## 2026-05-25 23:30 IST - Resolution

- Resolved the delayed no-id report dedupe risk.
- Evidence: `dedupeKey()` no longer includes the handler clock minute for
  missing-event fallback keys; it dedupes by target and report count under the
  existing seven-day TTL while still counting distinct report-count increases
  (`src/server/services/reportTriggers.ts`).
- Regression coverage: `src/server/services/reportTriggers.test.ts` now sends
  two no-id report deliveries with the same target and report count across
  different clock minutes and asserts the second is `duplicate`, with one
  moderation call, one suppressed-report increment, and one audit row.

## 2026-05-25 23:27 IST - Finding

- Severity: medium
- Area: Lock creation guard can delete a newer owner after TTL rollover
- Evidence: The new per-target lock creation guard stores only
  `JSON.stringify({ actor, createdAt })` and then always deletes the guard key
  in `finally` (`src/server/services/lockFlow.ts:148-182`,
  `src/server/services/lockFlow.ts:387-388`). Production Redis applies the
  30-second TTL (`src/server/adapters/redis.ts:164-165`). If the first
  `lockReviewedContent()` call stalls longer than that while waiting on Reddit
  or Redis, a second call can acquire the expired `target:{id}:lock:create`
  guard. When the first call eventually reaches `finally`, it deletes the same
  guard key without checking ownership, potentially removing the second call's
  lease and allowing a third creation to enter. The trigger mutex already avoids
  this exact stale-owner release problem by writing a token and deleting only
  when `redis.get(mutexKey) === token` (`src/server/services/triggerMutex.ts:24-39`).
  The new lock-flow regression covers an in-flight overlap before TTL expiry,
  but it does not simulate the first lease expiring and a newer owner acquiring
  the guard (`src/server/services/lockFlow.test.ts:128-189`).
- Why it matters: The guard is protecting the core one-active-lock-per-target
  invariant and preventing duplicate Reddit moderation calls. A slow Devvit
  Reddit call, Redis latency, or runtime suspension past 30 seconds can reopen
  the duplicate-creation window the guard was added to close.
- Suggested fix: Match `withTriggerMutex()`: generate a per-acquisition token,
  store that token in `setIfNotExists()`, and in `finally` read the guard key
  and delete it only when the stored token matches. Add a regression with a
  Redis test double that lets the first guard expire, lets a second call acquire
  a newer token, then completes the first call and asserts the second guard is
  not deleted.
- Files reviewed: `src/server/services/lockFlow.ts`,
  `src/server/services/lockFlow.test.ts`, `src/server/services/triggerMutex.ts`,
  `src/server/adapters/redis.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:28 IST - Finding

- Severity: medium
- Area: Concurrent distinct report events are collapsed as duplicates
- Evidence: `handleReportTrigger()` resolves the target, then enters
  `withTriggerMutex()` for the whole per-target report operation
  (`src/server/services/reportTriggers.ts:178-190`). The dedupe key is marked
  only inside the mutex (`src/server/services/reportTriggers.ts:190-197`). If
  another report trigger for the same target arrives while the first one is
  still processing, `withTriggerMutex()` throws before checking that second
  event's `eventId` or `reportCount`, and the catch block returns
  `action: 'duplicate'` with `ok: true`
  (`src/server/services/reportTriggers.ts:431-439`). The mutex itself blocks
  every same-target operation, not just same-event retries
  (`src/server/services/triggerMutex.ts:24-39`). Current report-trigger tests
  cover concurrent duplicate deliveries with the same `eventId`
  (`src/server/services/reportTriggers.test.ts:166-185`) and a sequential burst
  of distinct event ids (`src/server/services/reportTriggers.test.ts:308-335`),
  but there is no regression for two different event ids or two increasing
  no-id report counts arriving concurrently.
- Why it matters: Devvit can deliver report triggers close together during a
  report burst. Returning HTTP-success `duplicate` for a distinct second report
  means the platform has no reason to retry it, while ReviewLock skips the
  suppression metric, target metric, and audit row for that delivery. That
  undercounts the product's core "Reports suppressed" metric and can leave
  `lastReportCount` stale for active locks.
- Suggested fix: Distinguish mutex contention from true duplicate delivery.
  Options include marking/checking event dedupe before the per-target mutex and
  returning a retryable failure for distinct in-flight events, or queueing the
  second event after the first finishes and then applying normal
  event-id/report-count dedupe. Add regressions for concurrent distinct
  `eventId`s and concurrent no-id `reportCount` 5 then 6, asserting both are
  eventually counted once while same-event retries still collapse.
- Files reviewed: `src/server/services/reportTriggers.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `src/server/services/triggerMutex.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:32 IST - Resolution

- Resolved the stale-owner lock creation guard release risk.
- Evidence: lock creation guards now store an owner token and delete the guard
  in `finally` only when the stored token still matches the owner
  (`src/server/services/lockFlow.ts`). Regression coverage overwrites the
  in-flight guard with a newer owner token before the older flow finishes and
  asserts the older owner does not delete it (`src/server/services/lockFlow.test.ts`).

## 2026-05-25 23:32 IST - Resolution

- Resolved distinct report-event mutex contention being reported as successful
  duplicates.
- Evidence: report trigger dedupe is now checked before the per-target mutex.
  Same-event retries still return `duplicate`; distinct in-flight events clear
  their dedupe marker and return retryable `runtime_uncertain` with
  `concurrent_trigger_in_progress` (`src/server/services/reportTriggers.ts`).
  Regression coverage proves both distinct event ids and distinct no-id report
  counts become retryable during mutex contention and are counted once when
  retried (`src/server/services/reportTriggers.test.ts`).
- Focused validation:
  - `npm run test -- src/server/services/lockFlow.test.ts src/server/services/reportTriggers.test.ts --reporter verbose`
  - PASS, 2 test files and 36 tests.

## 2026-05-25 23:30 IST - Finding

- Severity: medium
- Area: No-id reports without report counts collapse for seven days
- Evidence: The fixed missing-event fallback dedupe key is now
  `missing-event:${targetId}:count-${reportCount ?? 'unknown'}`
  (`src/server/services/reportTriggers.ts:44-47`) and successful dedupe markers
  live for seven days (`src/server/services/reportTriggers.ts:64`,
  `src/server/services/reportTriggers.ts:106-118`). Report routes try to extract
  `reportCount`, `post.numberOfReports`, `post.numReports`,
  `comment.numberOfReports`, and `comment.numReports`
  (`src/routes/triggers.report.ts:84-93`), but if a live or future Devvit
  payload omits both a stable event id and those count fields, every report
  trigger for that target uses the same `count-unknown` key. Current tests cover
  no-id deliveries with explicit report counts 5 and 6, and delayed duplicates
  with the same count (`src/server/services/reportTriggers.test.ts:236-306`),
  but there is no regression for `eventId === undefined` and `reportCount ===
  undefined`.
- Why it matters: The live post-report payload happened to expose
  `post.numReports`, but comment report proof is still unverified and Devvit
  payload shape is treated as runtime evidence, not a permanent contract. If a
  report trigger arrives without count data, ReviewLock will suppress and count
  the first report, then treat all subsequent no-id/no-count report deliveries
  for the same locked target as duplicates for seven days. That undercounts
  "Reports suppressed", leaves `lastReportCount` stale, and hides churn on the
  reviewed item.
- Suggested fix: Make the missing-event fallback conditional: use
  `targetId + reportCount` only when `reportCount` is a finite number; when both
  event id and report count are absent, either return a retryable
  `runtime_uncertain` result without writing a long-lived dedupe marker, use a
  short processing-window key, or derive a bounded identity from a proven stable
  payload timestamp. Add a regression with two no-id/no-count deliveries for
  the same target that proves they are not collapsed for seven days.
- Files reviewed: `src/server/services/reportTriggers.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `src/routes/triggers.report.ts`, `src/routes/triggers.report.test.ts`,
  `docs/TRIGGER_PROOF.md`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:31 IST - Finding

- Severity: medium
- Area: Reopen dismiss can remove queue visibility before audit is durable
- Evidence: `dismissReopenEvent()` marks the event dismissed and removes it
  from the reopen queue before returning (`src/server/services/reopenQueue.ts:58-75`).
  Both the dashboard API dismiss route and the Devvit form dismiss route call
  `dismissReopenEvent()` first, then append the required `reopen_dismissed`
  audit event afterward (`src/routes/api.dashboard.ts:393-418`,
  `src/routes/forms.ts:269-296`). If the event write/zrem succeeds but the
  subsequent audit append fails, `withErrors()` returns a 500 for the dashboard
  route while the reopen item is already gone from the open queue, and a retry
  sees `Reopen event was not found.` The service and route tests cover happy
  path dismissal and audit output (`src/server/services/reopenQueue.test.ts:40-47`,
  `src/routes/api.dashboard.test.ts:230-247`,
  `src/routes/forms.test.ts:339-371`), but there is no regression where audit
  Redis writes fail after the queue mutation.
- Why it matters: `reopen_dismissed` is one of ReviewLock's required audit
  event kinds, and dismissing a reopened item is a human-confirmed moderation
  workflow action. Losing the queue item without a durable audit entry weakens
  moderator traceability and makes the UI report a failure even though retrying
  can no longer restore or audit the original action.
- Suggested fix: Make dismiss audit and queue mutation atomic enough for this
  workflow. The narrowest fix is to write the `reopen_dismissed` audit event
  before removing the event from the open queue, then only mark/zrem the reopen
  item after the audit write succeeds. Add dashboard API and form regressions
  with a Redis adapter that fails audit writes, asserting the route returns a
  failure and `listOpenReopenEvents()` still includes the event for retry.
- Files reviewed: `src/server/services/reopenQueue.ts`,
  `src/routes/api.dashboard.ts`, `src/routes/forms.ts`,
  `src/server/services/reopenQueue.test.ts`, `src/routes/api.dashboard.test.ts`,
  `src/routes/forms.test.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:32 IST - Finding

- Severity: medium
- Area: Dashboard runtime-context failure falls back to the `reviewlock` namespace
- Evidence: The embedded dashboard initializes its store with
  `requestedSubreddit ?? embeddedSubreddit ?? 'reviewlock'`
  (`src/client/main.ts:18-22`). When no explicit subreddit or embedded context
  is available, it calls `/api/context`, but catches and ignores failures before
  calling `store.fetchState()` (`src/client/main.ts:104-124`). The server
  `/api/context` route directly awaits `deps.reddit?.getCurrentSubredditName()`
  without a try/catch (`src/routes/api.ts:101-108`). The dashboard API scope
  resolver catches runtime subreddit lookup failures, treats the runtime
  subreddit as unavailable, and for non-demo requests falls back to
  `runtimeSubreddit ?? clientSubreddit ?? 'reviewlock'`
  (`src/routes/api.dashboard.ts:69-95`, `src/routes/api.dashboard.ts:159-164`).
  Runtime smoke uses the same pattern: if runtime context is unavailable but the
  client-supplied subreddit is `reviewlock`, smoke proof is accepted under that
  namespace (`src/routes/api.ts:39-90`). Existing contract tests cover
  mismatched runtime/client namespaces and missing smoke subreddit only when no
  client subreddit is supplied (`src/routes/api.contract.test.ts:72-108`), but
  not the embedded-dashboard case where runtime context throws and the client
  default supplies `reviewlock`.
- Why it matters: `reviewlock` is the app name, not evidence of the current
  subreddit. If Devvit context lookup is temporarily unavailable, the dashboard
  can show empty or stale data and `Verify runtime` can write `redis verified`
  or `redditContext verified` to `reviewlock:*` rather than the controlled
  subreddit. That weakens the runtime-proof boundary and can make a missing
  context look like a verified runtime state.
- Suggested fix: Remove the production `reviewlock` fallback for live embedded
  dashboard reads and smoke writes. If neither Devvit runtime context nor a
  trusted embedded subreddit can be resolved, fail closed with an explicit
  context error and avoid reading or writing runtime proof. Keep test/local
  defaults only behind explicit test setup. Add contract/client regressions
  where `getCurrentSubredditName()` throws and no embedded/requested subreddit
  exists, asserting dashboard reads and smoke routes do not use
  `reviewlock:*`.
- Files reviewed: `src/client/main.ts`, `src/client/state/store.ts`,
  `src/client/state/api.ts`, `src/routes/api.ts`, `src/routes/api.dashboard.ts`,
  `src/routes/api.contract.test.ts`, `src/integration.test.ts`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:39 IST - Resolution

- Resolved the no-id/no-count seven-day dedupe collapse.
- Evidence: missing-event report dedupe now uses `targetId + reportCount` only
  when `reportCount` is finite; when both event id and report count are absent,
  it uses a processing-window key instead of a seven-day `count-unknown` key
  (`src/server/services/reportTriggers.ts`). Regression coverage sends two
  no-id/no-count report deliveries for the same target across clock minutes and
  asserts both are counted (`src/server/services/reportTriggers.test.ts`).

## 2026-05-25 23:39 IST - Resolution

- Resolved reopen-dismiss audit durability ordering.
- Evidence: dashboard and form dismiss routes now fetch the reopen event and
  write `reopen_dismissed` audit before calling `dismissReopenEvent()`.
  Regressions simulate audit index write failure and assert the reopen item
  remains visible for retry (`src/routes/api.dashboard.ts`,
  `src/routes/forms.ts`, `src/routes/api.dashboard.test.ts`,
  `src/routes/forms.test.ts`).

## 2026-05-25 23:39 IST - Resolution

- Resolved the live dashboard/runtime smoke `reviewlock` namespace fallback.
- Evidence: the embedded client no longer initializes live mode with
  `reviewlock` when requested and embedded subreddit context are absent, and
  server-side dashboard/smoke scope resolution rejects `reviewlock` when runtime
  context is unavailable (`src/client/main.ts`, `src/routes/api.dashboard.ts`,
  `src/routes/api.ts`). Contract coverage asserts dashboard reads and runtime
  smoke writes fail closed instead of using `reviewlock:*`
  (`src/routes/api.contract.test.ts`).
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/routes/api.dashboard.test.ts src/routes/forms.test.ts src/routes/api.contract.test.ts --reporter verbose`
  - PASS, 4 test files and 56 tests.

## 2026-05-25 23:42 IST - Resolution

- Resolved runtime proof capability writes dropping explicit warnings.
- Evidence: `recordCapabilityStatus()` now uses the same non-generic warning
  preservation path as runtime proof normalization, so demo/runtime warnings
  survive later capability transitions (`src/server/services/runtimeProof.ts`).
  Regression coverage seeds a warning-bearing runtime status, records a later
  capability transition, and asserts the explicit warning remains
  (`src/server/services/runtimeProof.test.ts`).

## 2026-05-25 23:42 IST - Resolution

- Tightened the dashboard/runtime smoke context fix so live routes require a
  trusted runtime subreddit, not just a non-`reviewlock` client query value.
- Evidence: live dashboard scope resolution now fails when Devvit runtime
  subreddit context is unavailable; runtime smoke scope resolution also fails
  without runtime context instead of trusting `subreddit=alpha`
  (`src/routes/api.dashboard.ts`, `src/routes/api.ts`). Dashboard tests provide
  explicit runtime context for live success paths, and contract coverage
  continues to assert context-outage requests fail closed
  (`src/routes/api.dashboard.test.ts`, `src/routes/api.contract.test.ts`).
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/reportTriggers.test.ts src/routes/api.dashboard.test.ts src/routes/forms.test.ts src/routes/api.contract.test.ts --reporter verbose`
  - PASS, 5 test files and 65 tests.

## 2026-05-25 23:35 IST - Finding

- Severity: medium
- Area: Runtime proof writes drop explicit demo/runtime warnings
- Evidence: The new runtime proof normalization path preserves stored explicit
  warnings while adding missing granular capability rows
  (`src/server/services/runtimeProof.ts:104-137`), and the new regression only
  proves that read-time normalization keeps the demo warning
  (`src/server/services/runtimeProof.test.ts:191-224`). However
  `recordCapabilityStatus()` rebuilds `warnings` from the capability matrix and
  writes either `['Some runtime capabilities are not verified.']` or `[]`
  (`src/server/services/runtimeProof.ts:160-186`). It does not carry forward
  `current.warnings` after `loadRuntimeProofStatus()` has already normalized
  and preserved them. `recordCapabilityStatus()` is used by Redis/Reddit smoke
  routes and trigger proof writes (`src/routes/api.ts:145-176`,
  `src/routes/api.ts:224-265`, `src/server/services/reportTriggers.ts:159-168`,
  `src/server/services/reopenFlow.ts:109-121`).
- Why it matters: Demo/live separation is a product guardrail, and the seeded
  demo status explicitly warns `Demo data only. Seeded records are not runtime
  proof.` (`src/shared/demoScenario.ts:642`). A later capability write under a
  warning-bearing namespace can erase that warning from the runtime proof panel,
  even though the recent TODO/log entries say explicit demo warnings are
  preserved. The same pattern would also drop any future non-generic runtime
  proof warning the service stores before the next capability transition.
- Suggested fix: In `recordCapabilityStatus()`, preserve non-generic
  `current.warnings` the same way `normalizeRuntimeProofStatus()` does, then
  append or remove only the generic unverified-capabilities warning based on
  the updated capability matrix. Add a regression that seeds a runtime status
  with the demo warning, calls `recordCapabilityStatus()`, and asserts the demo
  warning remains alongside the generic warning when any capability is still
  unverified.
- Files reviewed: `src/server/services/runtimeProof.ts`,
  `src/server/services/runtimeProof.test.ts`, `src/shared/demoScenario.ts`,
  `src/routes/api.ts`, `src/server/services/reportTriggers.ts`,
  `src/server/services/reopenFlow.ts`, `src/client/components/RuntimeBanner.ts`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:37 IST - Resolution

- Resolved the no-id/no-count report dedupe collapse from the 23:30 finding.
- Evidence: missing-event report dedupe now uses `targetId + reportCount` only
  when `reportCount` is finite, and otherwise uses a bounded
  `unknown-count:${now.slice(0, 16)}` processing window instead of a seven-day
  `count-unknown` key (`src/server/services/reportTriggers.ts:44-52`,
  `src/server/services/reportTriggers.ts:111-123`). Regression coverage sends
  two no-id/no-count deliveries for the same target across different clock
  minutes and asserts both are counted (`src/server/services/reportTriggers.test.ts`).
- Focused validation:
  - `npm run test -- src/routes/api.dashboard.test.ts src/routes/forms.test.ts src/server/services/reportTriggers.test.ts src/server/services/runtimeProof.test.ts --reporter verbose`
  - PASS, 4 test files and 55 tests.

## 2026-05-25 23:37 IST - Resolution

- Resolved the reopen-dismiss audit durability ordering risk from the 23:31
  finding.
- Evidence: both dashboard API and form dismiss flows now read the reopen event,
  append the `reopen_dismissed` audit event, and only then call
  `dismissReopenEvent()` to mark and remove the queue item
  (`src/routes/api.dashboard.ts:407-427`, `src/routes/forms.ts:269-290`).
  Regression coverage forces audit `zAdd` failure and asserts the reopened item
  remains visible for retry in both routes (`src/routes/api.dashboard.test.ts`,
  `src/routes/forms.test.ts`).
- Focused validation:
  - `npm run test -- src/routes/api.dashboard.test.ts src/routes/forms.test.ts src/server/services/reportTriggers.test.ts src/server/services/runtimeProof.test.ts --reporter verbose`
  - PASS, 4 test files and 55 tests.

## 2026-05-25 23:37 IST - Finding

- Severity: medium
- Area: Dashboard and runtime smoke still trust client subreddit when runtime
  context is unavailable
- Evidence: The new dashboard guard correctly rejects live requests when there
  is no runtime subreddit and the client namespace is missing or exactly
  `reviewlock` (`src/routes/api.dashboard.ts:159-171`). But the same resolver
  then returns `runtimeSubreddit ?? clientSubreddit` for live requests
  (`src/routes/api.dashboard.ts:173-178`), so `/api/locks?subreddit=alpha` is
  accepted when `deps.reddit?.getCurrentSubredditName()` throws or returns
  undefined. Runtime smoke has the same shape: it rejects `reviewlock` when
  runtime context is absent, but accepts any other client-supplied subreddit via
  `runtimeSubreddit ?? clientSubreddit` (`src/routes/api.ts:75-103`). Existing
  regressions cover mismatched runtime/client namespaces and the app-name
  fallback (`src/routes/api.contract.test.ts:72-130`,
  `src/routes/api.dashboard.test.ts:289-305`), but not runtime-context
  unavailable plus a non-`reviewlock` client namespace.
- Why it matters: The original runtime-context fix needs to fail closed when no
  trusted Devvit runtime subreddit is available. A query string or header
  supplied by the client is not proof of the current subreddit, so accepting
  arbitrary values during context outages can still read dashboard state or
  write runtime proof under the wrong `reviewlock:{subreddit}:*` namespace. That
  leaves the runtime-proof boundary vulnerable to stale or cross-namespace
  evidence even though the literal app-name fallback is blocked.
- Suggested fix: Distinguish trusted embedded/context-derived subreddit values
  from untrusted request query/header values, or require runtime subreddit
  context for all live dashboard and smoke requests unless the caller is in an
  explicit test/local mode. Add regressions where `getCurrentSubredditName()`
  throws or returns undefined and the request supplies `subreddit=alpha`,
  asserting dashboard reads and both smoke routes fail without touching
  `reviewlock:alpha:*`.
- Files reviewed: `src/routes/api.dashboard.ts`,
  `src/routes/api.dashboard.test.ts`, `src/routes/api.ts`,
  `src/routes/api.contract.test.ts`, `src/client/main.ts`,
  `src/client/state/runtimeContext.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:42 IST - Resolution

- Resolved runtime proof writes dropping explicit demo/runtime warnings.
- Evidence: runtime proof warning composition now preserves non-generic stored
  warnings and only recalculates the generic unverified-capabilities warning
  (`src/server/services/runtimeProof.ts:104-121`,
  `src/server/services/runtimeProof.ts:166-188`). Regression coverage seeds the
  demo warning, records a later capability transition, and asserts the demo
  warning remains visible alongside the generic warning
  (`src/server/services/runtimeProof.test.ts`).
- Focused validation:
  - `npm run test -- src/routes/api.contract.test.ts src/routes/api.dashboard.test.ts src/server/services/runtimeProof.test.ts --reporter verbose`
  - PASS, 3 test files and 28 tests.

## 2026-05-25 23:42 IST - Resolution

- Resolved the remaining client-supplied namespace fallback when runtime
  context is unavailable.
- Evidence: dashboard scope resolution now fails closed whenever live mode has
  no runtime subreddit and returns only the runtime subreddit for live
  namespaces (`src/routes/api.dashboard.ts:159-180`). Runtime smoke scope
  resolution now also requires runtime subreddit context and no longer accepts a
  query/header subreddit as a substitute (`src/routes/api.ts:39-103`).
  Contract coverage includes missing runtime context and rejects smoke/dashboard
  requests instead of writing proof under the app-name namespace
  (`src/routes/api.contract.test.ts`).
- Focused validation:
  - `npm run test -- src/routes/api.contract.test.ts src/routes/api.dashboard.test.ts src/server/services/runtimeProof.test.ts --reporter verbose`
  - PASS, 3 test files and 28 tests.

## 2026-05-25 23:45 IST - Finding

- Severity: medium
- Area: Lock creation rollback can leave a false `lock_created` audit event
- Evidence: The success path saves the active lock, immediately appends a
  `lock_created` audit event, and only then records created-lock metrics
  (`src/server/services/lockFlow.ts:322-339`). If the later metrics write
  fails, the catch path calls `unignoreReports()` and removes the active lock
  when rollback succeeds (`src/server/services/lockFlow.ts:347-353`), then
  returns `ok: false` with `redis_write_failed`
  (`src/server/services/lockFlow.ts:377-386`). The regression for this exact
  failure mode verifies the lock and active-target index are removed, but does
  not assert anything about the audit ledger
  (`src/server/services/lockFlow.test.ts:426-459`). Because `removeLock()` only
  clears lock indexes and the lock body (`src/server/services/locks.ts:82-85`),
  the already-written `lock_created` audit event remains.
- Why it matters: ReviewLock's audit log is the moderator-visible ledger for
  lock, unlock, suppress, reopen, dismiss, and runtime failure events. A failed
  lock attempt that has been unignored and removed from active locks should not
  leave the same durable audit signal as a successful lock. Otherwise the
  dashboard can show an audit trail claiming "Reviewed content locked until it
  changes" for content that ReviewLock explicitly returned as not locked.
- Suggested fix: Move `lock_created` audit append after all fallible
  success-path persistence that can still trigger rollback, or write a
  compensating `runtime_failure`/rollback audit when a post-audit step fails.
  Add a regression using the existing `MetricsFailingRedisStore` that asserts a
  successful rollback leaves no standalone `lock_created` event for the failed
  lock, or leaves an explicit failure audit that makes the rollback outcome
  unambiguous.
- Files reviewed: `src/server/services/lockFlow.ts`,
  `src/server/services/lockFlow.test.ts`, `src/server/services/locks.ts`,
  `src/server/services/audit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:02 IST - Finding

- Severity: medium
- Area: Comment route payloads still prefer generic `targetId` before
  comment-specific ids
- Evidence: The comment report route builds the candidate id list as
  `[payload.targetId, payload.commentId, payload.comment?.id]` for comment
  triggers (`src/routes/triggers.report.ts:61-71`). The comment update route
  uses the same order (`src/routes/triggers.update.ts:58-68`), and comment menu
  actions also choose `body.targetId ?? body.commentId`
  (`src/routes/menu.ts:31-35`). The new regressions cover sibling `post.id`
  plus `comment.id` payloads and `postId` plus `commentId` menu fallbacks
  (`src/routes/triggers.report.test.ts:296-317`,
  `src/routes/triggers.update.test.ts:352-395`,
  `src/routes/menu.test.ts:85-104`), but they do not cover a Devvit payload
  that includes a generic `targetId` for the sibling post alongside
  `commentId` or `comment.id`. In that shape, the comment routes normalize the
  generic `targetId` as a comment id before the actual comment id is examined.
- Why it matters: The hardening intent is to prefer the comment thing id over a
  sibling post id on comment menu/report/update callbacks. If Devvit supplies
  both a generic target field and a comment-specific field, ReviewLock can
  refetch the wrong thing, miss a known active comment lock, or reopen/suppress
  using a synthetic `t1_...` id derived from the post id. That is directly in
  the live trigger proof boundary for comment reports and comment updates.
- Suggested fix: For `kind === 'comment'`, order candidates as
  `commentId`, `comment.id`, then generic `targetId` only as a last fallback.
  For comment menu actions, use `body.commentId ?? body.targetId`. Add
  regressions where `/on-comment-report`, `/on-comment-update`,
  `/lock-comment`, and `/unlock-comment` receive both `targetId: 't3_parent'`
  and a valid comment id, asserting the comment id wins.
- Files reviewed: `src/routes/triggers.report.ts`,
  `src/routes/triggers.update.ts`, `src/routes/menu.ts`,
  `src/routes/triggers.report.test.ts`, `src/routes/triggers.update.test.ts`,
  `src/routes/menu.test.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:08 IST - Finding

- Severity: medium
- Area: Bare `demo=true` dashboard URLs can be overwritten to a live subreddit
  before the first demo fetch
- Evidence: The client store correctly initializes `initialDemo` sessions with
  `subreddit = 'reviewlock_demo'` (`src/client/state/store.ts:44-52`). But
  `main.ts` still applies inferred embedded subreddit context before the first
  fetch whenever no explicit `subreddit` query parameter exists
  (`src/client/main.ts:105-118`). `updateSubredditContext()` always assigns
  `this.subreddit = subreddit`, even while `this.demo` is true
  (`src/client/state/store.ts:201-206`). A URL such as `...?demo=true` opened
  inside the Reddit WebView can therefore initialize to `reviewlock_demo`, then
  immediately overwrite the active request namespace to `reviewlock_dev` before
  `fetchState()`. The dashboard API intentionally rejects
  `demo=true&subreddit=reviewlock_dev` with
  `Demo dashboard requests must use the isolated ReviewLock demo namespace.`
  (`src/routes/api.dashboard.ts:110-121`). Existing store coverage constructs
  demo boot with an explicit initial live subreddit and calls `fetchState()`
  directly (`src/client/state/store.test.ts:205-221`), but it does not exercise
  the `main.ts` bootstrap sequence where runtime context arrives while
  `store.demo === true`.
- Why it matters: Demo mode is mandatory and must be visibly labeled. The
  recent hardening intent was to bootstrap `demo=true` dashboard URLs into the
  deterministic demo namespace, but a bare demo URL in an embedded context can
  fail before rendering seeded data because the live subreddit context overwrote
  the demo namespace. This creates a brittle demo entrypoint exactly where
  judges or reviewers are likely to use a short demo URL.
- Suggested fix: Make `updateSubredditContext()` update only `liveSubreddit`
  when `this.demo` is true, leaving `this.subreddit` as `reviewlock_demo`, or
  have `main.ts` skip runtime-context writes to the active namespace during
  demo mode. Add a regression for a demo-mode store receiving
  `updateSubredditContext('reviewlock_dev')` before `fetchState()`, asserting
  the fetch still uses `reviewlock_demo` with `demo=true` while
  `getLiveSubreddit()` is preserved for exiting demo.
- Files reviewed: `src/client/main.ts`, `src/client/state/store.ts`,
  `src/client/state/store.test.ts`, `src/routes/api.dashboard.ts`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:47 IST - Resolution

- Resolved comment callback target precedence for mixed Devvit payloads.
- Evidence: comment report/update routes now check `commentId` and
  `comment.id` before falling back to generic `targetId`, while comment menu
  routes use `commentId` before generic `targetId`
  (`src/routes/triggers.report.ts`, `src/routes/triggers.update.ts`,
  `src/routes/menu.ts`).
- Regression coverage:
  - `/on-comment-report` with `targetId: 't3_parent_post'` and
    `commentId: 't1_comment'` suppresses `t1_comment`.
  - `/on-comment-update` with `targetId: 't3_parent_post'` and
    `commentId: 't1_comment'` reopens `t1_comment`.
  - `/lock-comment` and `/unlock-comment` with generic post `targetId` plus
    bare `commentId` resolve to `t1_comment`.
- Resolved bare `demo=true` namespace overwrite during dashboard bootstrap.
- Evidence: `ReviewLockStore.updateSubredditContext()` now preserves
  `subreddit = 'reviewlock_demo'` while demo mode is active and only records
  the live subreddit for later demo exit (`src/client/state/store.ts`).
- Regression coverage asserts a demo-mode store receiving runtime context
  before `fetchState()` still fetches `reviewlock_demo` with `demo=true`.
- Focused validation:
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts src/routes/menu.test.ts src/client/state/store.test.ts --reporter verbose`
  - PASS, 4 test files and 53 tests.

## 2026-05-26 00:14 IST - Finding

- Severity: medium
- Area: Comment report payloads can use the parent post report count
- Evidence: `reportCount()` in the report trigger router is not target-kind
  aware. It scans every candidate payload in the order
  `payload.reportCount`, `payload.post?.numberOfReports`,
  `payload.post?.numReports`, `payload.comment?.numberOfReports`,
  `payload.comment?.numReports` (`src/routes/triggers.report.ts:84-93`).
  On `/on-comment-report`, a live-shaped payload with both a parent `post`
  object and the reported `comment` object will therefore prefer the parent
  post's report count over the comment's count. The report service uses
  `input.reportCount` for the dedupe key when no event id exists
  (`src/server/services/reportTriggers.ts:47-52`), the lock's
  `lastReportCount`, and the `report_suppressed` audit data
  (`src/server/services/reportTriggers.ts:313-332`). Existing comment-report
  route tests cover `comment.numReports` alone and `post.id` plus
  `comment.id`, but they do not include a conflicting parent
  `post.numReports`/`numberOfReports` value
  (`src/routes/triggers.report.test.ts:244-359`).
- Why it matters: Suppressed-report metrics and audit output are ReviewLock's
  proof that repeat report churn was avoided. For comment reports, recording
  the parent post report count can make the comment lock ledger show the wrong
  count, dedupe unrelated deliveries by the wrong number, or fail to dedupe
  retries consistently. This is especially risky because the current live
  `CommentReport` path remains unverified and depends on local route fixtures
  matching Devvit payload shape.
- Suggested fix: Make `reportCount()` accept the target kind and, for comment
  routes, prefer `comment.numberOfReports` / `comment.numReports` before any
  parent post counts. Keep generic top-level `reportCount` only if it is known
  to describe the target object, or use it after target-specific fields. Add a
  regression where `/on-comment-report` receives both `post.numReports = 99`
  and `comment.numReports = 5`, asserting the persisted lock
  `lastReportCount` and audit `reportCount` use `5`.
- Files reviewed: `src/routes/triggers.report.ts`,
  `src/routes/triggers.report.test.ts`, `src/server/services/reportTriggers.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:20 IST - Finding

- Severity: high
- Area: Update-trigger mutex contention can drop an edit-break event
- Evidence: `breakLockForChangedContent()` catches
  `TriggerConcurrencyError` and returns `{ ok: true, action: 'no_lock' }`
  with `concurrent_trigger_in_progress` (`src/server/services/reopenFlow.ts:203-210`).
  Report triggers were recently hardened in the same situation to clear the
  dedupe marker and return retryable `runtime_uncertain` instead
  (`src/server/services/reportTriggers.ts:437-445`). The mixed report/update
  race test only proves that when both paths see already-edited content, one
  path reopens and the other may be `no_lock`/`runtime_uncertain`
  (`src/server/services/reopenFlow.test.ts:246-267`). It does not cover the
  dangerous ordering where an update trigger for an edit arrives while a report
  trigger is still holding the mutex for an unchanged suppression path. In that
  ordering, the update trigger exits as a successful terminal no-op and Devvit
  may not retry it, while the report trigger can complete with
  `suppress_unchanged`, leaving the active lock in place after the edit.
- Why it matters: The edit-aware reopen loop is ReviewLock's core product
  promise. A content-edit trigger should not be acknowledged as a successful
  no-op merely because another trigger is processing the same target. If the
  winning trigger does not itself observe and reopen the edited content, the
  losing update delivery is the only signal that should break the lock.
- Suggested fix: Treat update-trigger mutex contention as retryable
  `runtime_uncertain`, matching the report-trigger behavior, or enqueue a
  follow-up/runtime-uncertain reopen when a known active lock exists. Add a
  regression with a report trigger paused inside `ignoreReports()` on unchanged
  content while `breakLockForChangedContent()` is called for the same target
  with edited current content; assert the update result is not terminal
  `no_lock` and the lock cannot remain active without a retryable warning.
- Files reviewed: `src/server/services/reopenFlow.ts`,
  `src/server/services/reopenFlow.test.ts`,
  `src/server/services/reportTriggers.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `src/server/services/triggerMutex.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:50 IST - Resolution

- Resolved comment report count precedence for mixed parent/comment payloads.
- Evidence: `reportCount()` is now target-kind aware. Comment report routes
  inspect `comment.numberOfReports` and `comment.numReports` before generic or
  parent post counts (`src/routes/triggers.report.ts`).
- Regression coverage sends `/on-comment-report` a parent `post.numReports =
  99` and target `comment.numReports = 5`, then asserts the active lock
  `lastReportCount` and `report_suppressed` audit data use `5`
  (`src/routes/triggers.report.test.ts`).
- Resolved update-trigger mutex contention as retryable instead of terminal.
- Evidence: `breakLockForChangedContent()` now returns
  `ok: false`, `action: 'runtime_uncertain'`, and
  `concurrent_trigger_in_progress` when another trigger already holds the
  target mutex (`src/server/services/reopenFlow.ts`).
- Regression coverage pauses a report trigger inside `ignoreReports()` on
  unchanged content, sends an edited update for the same target, and asserts the
  update result is retryable rather than `no_lock`
  (`src/server/services/reopenFlow.test.ts`).
- Focused validation:
  - `npm run test -- src/routes/triggers.report.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 test files and 25 tests.

## 2026-05-25 23:44 IST - Resolution

- Resolved false `lock_created` audit entries after rollback-triggering metrics
  failures.
- Evidence: the lock success path now records lock-created metrics before
  appending the `lock_created` audit event, so a metrics failure rolls back the
  active lock before a success audit is written (`src/server/services/lockFlow.ts`).
  Regression coverage asserts the existing metrics-failure rollback leaves no
  `lock_created` audit event for the removed lock
  (`src/server/services/lockFlow.test.ts`).
- Focused validation:
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
  - PASS, 1 test file and 12 tests.

## 2026-05-25 23:58 IST - Finding

- Severity: high
- Area: Lock form submit can lock content that changed after the moderator saw
  the review summary
- Evidence: The lock menu resolves the target, renders a `Reviewed content`
  summary in the form, and creates a form binding (`src/routes/menu.ts:201-224`).
  The binding stores only action, subreddit, target id, lock id, and creation
  time (`src/server/services/formBindings.ts:8-15`,
  `src/server/services/formBindings.ts:39-46`); it does not store the content
  hash or any fingerprint of the target state the moderator reviewed. On
  submit, the form route validates only token, subreddit, target id, and reason
  before calling `lockReviewedContent()` (`src/routes/forms.ts:114-154`).
  `lockReviewedContent()` then refetches the current target, fingerprints that
  current content, and approves/ignores it as the new lock
  (`src/server/services/lockFlow.ts:127-146`,
  `src/server/services/lockFlow.ts:274-345`). Existing form tests cover token,
  target-id, reason, and subreddit mismatches, but not a target whose body,
  title, flair, nsfw, or spoiler state changed between menu render and submit
  (`src/routes/forms.test.ts:65-180`).
- Why it matters: Human confirmation is required for locking, and the product
  promise is that reviewed content stays reviewed only until it changes. In the
  first-lock path, a moderator can confirm a stale form summary while ReviewLock
  silently locks a different current fingerprint that the moderator did not see.
  That is the same edit-abuse gap ReviewLock is meant to close, just inside the
  lock creation flow instead of after a lock already exists.
- Suggested fix: Store the menu-time fingerprint in the form binding, or store
  enough reviewed target data to recompute it. On lock submit, compare the
  current refetched fingerprint to the bound fingerprint before calling
  `approve()` or `ignoreReports()`. If it differs or is uncertain, reject the
  submit with a stale-review message and force the moderator to reopen the lock
  form with the updated summary. Add a regression where the menu binding is
  created for `Reviewed body`, the submit refetch sees `Edited body`, and no
  `approve()` / `ignoreReports()` call or active lock is written.
- Files reviewed: `src/routes/menu.ts`, `src/routes/forms.ts`,
  `src/server/services/formBindings.ts`, `src/server/services/lockFlow.ts`,
  `src/routes/forms.test.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-25 23:59 IST - Finding

- Severity: high
- Area: Devvit Redis NX failures are treated as successful lock acquisition
- Evidence: The Devvit Redis adapter implements `setIfNotExists()` as
  `client.set(key, value, { nx: true })` and returns true for any result that is
  not `undefined`, `null`, or boolean `false`
  (`src/server/adapters/redis.ts:153-155`). Installed Devvit typings show
  `RedisClient.set()` returns `Promise<string>`
  (`node_modules/@devvit/public-api/types/redis.d.ts:859`,
  `node_modules/@devvit/public-api/types/redis.d.ts:1620-1626`), and the
  installed Devvit Redis implementation returns `response.value`
  (`node_modules/@devvit/public-api/apis/redis/RedisClient.js:366-382`). Its
  Redis mock maps a failed `SET ... NX` result to an empty string
  (`node_modules/@devvit/redis/test/mocks/RedisMock.js:96-105`), so the adapter
  currently treats a pre-existing key as successful acquisition. The app relies
  on `setIfNotExists()` for the lock creation guard
  (`src/server/services/lockFlow.ts:148-180`), report dedupe
  (`src/server/services/reportTriggers.ts:111-123`), and trigger mutex
  (`src/server/services/triggerMutex.ts:24-33`). Existing adapter coverage uses
  only `InMemoryRedisStore`, whose `setIfNotExists()` correctly returns false on
  duplicates (`src/server/adapters/redis.test.ts:31-32`), so the live Devvit
  behavior is not covered.
- Why it matters: In live Devvit, duplicate lock submissions, duplicate report
  deliveries, and concurrent report/update triggers can all enter critical
  sections that were designed to be mutually exclusive. That can recreate the
  duplicate lock race, double-count report suppressions, and let an edit-break
  update run concurrently with unchanged-report suppression despite the
  protection added in earlier fixes.
- Suggested fix: Treat only the Devvit success string as acquired, for example
  `result === 'OK'`, and treat `''` as false. Add an adapter-level regression
  using a fake Devvit Redis client whose second `{ nx: true }` set returns `''`,
  then assert `createDevvitRedisStore(...).setIfNotExists()` returns false and
  does not let `withTriggerMutex()` or the lock-creation guard proceed twice.
- Files reviewed: `src/server/adapters/redis.ts`,
  `src/server/adapters/redis.test.ts`, `src/server/services/lockFlow.ts`,
  `src/server/services/reportTriggers.ts`,
  `src/server/services/triggerMutex.ts`,
  `node_modules/@devvit/public-api/types/redis.d.ts`,
  `node_modules/@devvit/public-api/apis/redis/RedisClient.js`,
  `node_modules/@devvit/redis/test/mocks/RedisMock.js`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:02 IST - Finding

- Severity: high
- Area: Runtime proof marks failed trigger deliveries as verified
- Evidence: `handleReportTrigger()` resolves the target, derives subreddit and
  target kind, then records `postReportTrigger` or `commentReportTrigger` as
  `verified` as soon as `subreddit !== 'unknown'`
  (`src/server/services/reportTriggers.ts:177-189`). The actual fail-open path
  for `!resolution.ok || !resolution.target` runs later and can return
  `runtime_uncertain`, either reopening a known active lock without a target or
  writing a runtime failure when no lock can be found
  (`src/server/services/reportTriggers.ts:200-267`). Update triggers have the
  same ordering: `breakLockForChangedContent()` records the provided trigger
  capability as `verified` before entering the mutex, before loading the active
  lock, and before deciding whether target resolution was missing or uncertain
  (`src/server/services/reopenFlow.ts:92-124`,
  `src/server/services/reopenFlow.ts:137-165`). Runtime proof treats those rows
  as authoritative capability status (`src/server/services/runtimeProof.ts:166-190`),
  and the dashboard renders only the capability name plus `verified` label, not
  the later fail-open result (`src/client/components/RuntimeBanner.ts:33-64`).
  Existing route tests assert verified rows for successful report/update
  deliveries (`src/routes/triggers.report.test.ts:63-91`,
  `src/routes/triggers.update.test.ts:62-92`) and separately assert
  `runtime_uncertain` reopen behavior for unresolved targets
  (`src/routes/triggers.report.test.ts:223-243`,
  `src/routes/triggers.update.test.ts:210-258`), but they do not assert that an
  unresolved or failed delivery leaves the trigger capability unverified or
  failed.
- Why it matters: Runtime claims must be proven by playtest or clearly labeled
  unverified. A live payload with a valid subreddit and target id but failed
  refetch can put `postReportTrigger`, `commentReportTrigger`, or an update
  trigger into `verified` even though ReviewLock never proved it could inspect
  the target, suppress reports, or reopen based on a material fingerprint for
  that delivery. That can make the dashboard and runtime proof artifacts
  overstate live Devvit support for trigger paths that are still failing open.
- Suggested fix: Record trigger capability only after a successful processed
  outcome that proves the intended route path, or split the model into distinct
  `delivered` and `processed` statuses so failed target resolution cannot be
  displayed as `verified`. Add regressions where a route receives a live-shaped
  payload with `subreddit: { name: 'alpha' }` and a prefixed target id while
  the Reddit adapter cannot refetch the target; assert the service still
  returns the correct `runtime_uncertain` fail-open result, but runtime proof
  does not mark that trigger capability `verified`.
- Files reviewed: `src/server/services/reportTriggers.ts`,
  `src/server/services/reopenFlow.ts`, `src/server/services/updateTriggers.ts`,
  `src/server/services/runtimeProof.ts`,
  `src/client/components/RuntimeBanner.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `src/server/services/reopenFlow.test.ts`,
  `src/routes/triggers.report.test.ts`,
  `src/routes/triggers.update.test.ts`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:02 IST - Finding

- Severity: high
- Area: Manual unlock can succeed in Reddit but leave ReviewLock actively
  suppressing future reports
- Evidence: `unlockReviewedContent()` calls `unignoreReportsForReviewLock()`
  first, records runtime proof, and only then updates the lock to `unlocked`
  through `updateLockStatus()` (`src/server/services/unlockFlow.ts:77-125`).
  There is no `try/catch` or compensating cleanup around that status write. If
  `updateLockStatus()` fails before the lock record is saved as `unlocked`,
  the function throws after Reddit has already accepted `unignoreReports()`.
  The dashboard route wraps that exception as a generic error response
  (`src/routes/api.dashboard.ts:329-376`), and the Devvit form route does not
  catch it locally (`src/routes/forms.ts:197-208`). The active lock index can
  therefore remain reachable by `getActiveLockByTarget()` because that helper
  trusts the target index and returns records whose stored status is still
  `active` (`src/server/services/locks.ts:45-58`). Current unlock tests cover
  the success path, stale lock id, subreddit mismatch, and failed
  `unignoreReports()` (`src/server/services/unlockFlow.test.ts:62-160`), but
  there is no regression where `unignoreReports()` succeeds and Redis fails
  during `updateLockStatus()`.
- Why it matters: Manual unlock is a human-confirmed action. If Reddit reports
  were returned to normal handling but ReviewLock still records an active lock,
  the next report trigger will find that active lock, call `ignoreReports()`,
  and resume suppressing reports on content the moderator explicitly unlocked.
  This can make the dashboard/API look failed while the underlying moderation
  state has already changed, then silently undo the moderator's intent on the
  next trigger delivery.
- Suggested fix: Treat post-`unignoreReports()` Redis failures as a fail-open
  unlock path. If the status write fails, best-effort remove active lock
  indexes and append a `runtime_failure` audit event so future report/update
  triggers cannot continue suppressing the target as active. Add a regression
  with a Redis store that throws on `keys.lock('alpha', 'lock-1')` during
  `updateLockStatus()`: assert `unignoreReports:t3_post` was called,
  `getActiveLockByTarget()` is undefined or the lock is no longer active, and
  the result exposes `redis_write_failed` instead of throwing a generic 500.
- Files reviewed: `src/server/services/unlockFlow.ts`,
  `src/server/services/locks.ts`, `src/server/services/reportTriggers.ts`,
  `src/routes/api.dashboard.ts`, `src/routes/forms.ts`,
  `src/server/services/unlockFlow.test.ts`,
  `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:06 IST - Finding

- Severity: medium
- Area: Failed runtime smoke proof can be persisted but not shown after the
  Verify runtime click
- Evidence: The smoke routes now persist failed capability rows when Redis or
  Reddit context checks fail after subreddit scope is known
  (`src/routes/api.ts:162-187`, `src/routes/api.ts:243-268`), and route tests
  assert `loadRuntimeProofStatus(redis, 'alpha')` contains `redis failed` or
  `redditContext failed` for those server-side failures
  (`src/routes/api.contract.test.ts:134-209`). The dashboard store only refreshes
  runtime status after `runRuntimeSmoke()` resolves successfully
  (`src/client/state/store.ts:178-184`). If either smoke endpoint rejects,
  `verifyRuntime()` jumps to the catch block, sets `store.error`, and never calls
  `fetchRuntimeStatus()` (`src/client/state/store.ts:185-190`). The store tests
  cover only the successful verify path and demo-mode block
  (`src/client/state/store.test.ts:176-193`), while the API client test covers a
  malformed smoke rejection but not whether the store refreshes the persisted
  failed proof after that rejection (`src/client/state/api.test.ts:187-193`).
- Why it matters: The product has already hardened failed smoke checks so the
  runtime proof ledger can show `failed` instead of stale `verified` or
  `unverified`. In the actual dashboard workflow, the moderator who clicks
  `Verify runtime` can still see only a transient error while the runtime panel
  remains on the pre-click status until a later full refresh. That weakens the
  proof boundary exactly when intermittent Devvit context or Redis failures need
  to be visible.
- Suggested fix: In `verifyRuntime()` catch, best-effort call
  `fetchRuntimeStatus(this.subreddit, false)` and update `runtimeStatus`,
  `dailyMetrics`, and `topChurnTargets` before surfacing the error. Add a store
  regression where `runRuntimeSmoke()` rejects after the server persisted a
  failed runtime row; assert `fetchRuntimeStatus()` is still called and the
  store updates `runtimeStatus.overall` to `failed`.
- Files reviewed: `src/client/state/store.ts`,
  `src/client/state/store.test.ts`, `src/client/state/api.ts`,
  `src/client/state/api.test.ts`, `src/routes/api.ts`,
  `src/routes/api.contract.test.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:09 IST - Finding

- Severity: medium
- Area: NSFW/spoiler update routes do not accept the wrapper names implied by the installed Devvit service definitions.
- Evidence:
  - The update route only unwraps `nsfwPostUpdate` and `spoilerPostUpdate` for nested payloads; it does not look for `postNsfwUpdate` or `postSpoilerUpdate`: `src/routes/triggers.update.ts:31-52`.
  - The sanitized payload logger mirrors the same two wrapper names, so a live payload under `postNsfwUpdate` or `postSpoilerUpdate` would be logged as absent and then fail target extraction: `src/routes/triggerPayloadLog.ts:71-78`.
  - Installed Devvit definitions name these callbacks `OnPostNsfwUpdate` and `OnPostSpoilerUpdate`, with method fields `onPostNsfwUpdate` and `onPostSpoilerUpdate`: `node_modules/@devvit/protos/types/devvit/actor/automation/v1alpha/event_handlers.js:578-610`; the shared trigger request types are `PostNsfwUpdate` and `PostSpoilerUpdate`: `node_modules/@devvit/shared/types/triggers.d.ts:52-59`.
  - Local route coverage proves direct `{ postId: 't3_post' }` bodies for NSFW/spoiler and a wrapped `postFlairUpdate`, but it does not cover wrapped NSFW or wrapped spoiler payloads: `src/routes/triggers.update.test.ts:452-541`.
  - `docs/TRIGGER_PROOF.md` explicitly says NSFW/spoiler/flair live payloads have not been captured yet and remain representative local fixtures: `docs/TRIGGER_PROOF.md:23-28`.
- Why it matters: if Devvit delivers these remaining unverified callbacks with the same `postNsfwUpdate` / `postSpoilerUpdate` spelling implied by its service names, ReviewLock will return `400 Update trigger target id is required` and fail to break locks on NSFW/spoiler changes.
- Suggested fix: accept both wrapper spellings (`postNsfwUpdate` plus `nsfwPostUpdate`, and `postSpoilerUpdate` plus `spoilerPostUpdate`) in `TriggerBody`, `payloads()`, and `logTriggerPayloadShape()`, then add wrapped route regressions for the method-style names before live proof.

## 2026-05-26 00:10 IST - Finding

- Severity: medium
- Area: Reopen dismiss can write a durable dismissal audit even when the queue mutation fails.
- Evidence:
  - Both dismiss entry points now append `reopen_dismissed` audit first, then call `dismissReopenEvent()`: `src/routes/forms.ts:277-296` and `src/routes/api.dashboard.ts:416-429`.
  - `dismissReopenEvent()` performs two additional Redis writes after the audit: it writes the dismissed event body, then removes the event id from the reopen queue: `src/server/services/reopenQueue.ts:71-73`.
  - If `redis.set(keys.reopenEvent(...))` throws, the event stays open but the audit already claims it was dismissed. If the later `zRem()` throws, the event body has `dismissedAt` and `listOpenReopenEvents()` filters it out even though the queue removal failed: `src/server/services/reopenQueue.ts:50-55`, `:71-73`.
  - Current regressions cover audit write failure before dismissal and happy-path dismissal, but not `dismissReopenEvent()` failures after the audit succeeds: `src/routes/forms.test.ts:378-416`, `src/routes/api.dashboard.test.ts:255-288`, `src/server/services/reopenQueue.test.ts:40-47`.
- Why it matters: dismiss is a human-confirmed moderation workflow. A transient Redis failure can produce either an audit trail that says a still-open item was dismissed or a hidden dismissed event with a route failure, making retries and moderator traceability unreliable.
- Suggested fix: move audit plus event dismissal into one durability boundary, preferably a small service that can use Redis transaction semantics or a compensating `runtime_failure` audit on post-audit dismiss failure. Add dashboard and form regressions that fail `keys.reopenEvent(...)` set and `keys.reopenQueue(...)` zRem separately after audit success.

## 2026-05-26 00:13 IST - Finding

- Severity: medium
- Area: Report suppression rollback can leave the lock's suppressed counters incremented.
- Evidence:
  - The unchanged-report path calls `ignoreReports()`, then persists the lock-level suppression count through `incrementLockSuppression()`, then writes daily/target metrics, then appends the `report_suppressed` audit event: `src/server/services/reportTriggers.ts:285-333`.
  - If either `incrementSuppressedReportMetric()` or the later audit append throws after `incrementLockSuppression()` succeeded, the catch calls `unignoreReports()` and clears the report dedupe marker, but it does not restore the lock record's `suppressedReportCount`, `lastSuppressedAt`, or `lastReportCount`: `src/server/services/reportTriggers.ts:334-366`.
  - `incrementLockSuppression()` saves those fields directly through `updateLock()`: `src/server/services/locks.ts:114-125`.
  - Current Redis-failure regressions only fail the lock write itself before the counters can be persisted; they assert rollback calls but do not cover metric or audit failure after the lock counter update has already succeeded: `src/server/services/reportTriggers.test.ts:758-840`.
- Why it matters: ReviewLock returns `runtime_uncertain` and attempts to undo Reddit `ignoreReports()` when the post-suppression ledger write fails. In the metric/audit failure ordering, the active lock can still show an extra suppressed report even though the suppression was rolled back and the dedupe marker was cleared for retry. A retry can then increment the same lock again, overstating "Reports suppressed" and item-level churn for a report delivery ReviewLock explicitly treated as not durably processed.
- Suggested fix: make the unchanged-report persistence atomic enough to roll back the lock-level counter when a later success-path write fails, or move the counter update after all fallible metric/audit writes and write the lock last. Add regressions that fail `keys.metricsDaily(...)`, `keys.metricsTarget(...)`, and `keys.audit(...)` after `incrementLockSuppression()` succeeds, asserting `unignoreReports()` is called, dedupe is cleared, and the active lock's suppressed counters remain unchanged.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/locks.ts`, `src/server/services/metrics.ts`, `src/server/services/audit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:24 IST - Codex integration status

- Resolved high finding: lock form submit can lock content that changed after
  the moderator saw the review summary. Lock form bindings now store the
  reviewed content hash/version, and submit rejects stale fingerprints before
  moderation side effects. Regression added in `src/routes/forms.test.ts`.
- Resolved high finding: Devvit Redis NX failures are treated as successful
  lock acquisition. `createDevvitRedisStore().setIfNotExists()` now treats only
  `OK` or boolean `true` as acquired. Regression added in
  `src/server/adapters/redis.test.ts`.
- Resolved high finding: runtime proof marks failed trigger deliveries as
  verified. Report/update trigger proof rows are now written only after target
  resolution and successful processing. Regressions added in
  `src/server/services/reportTriggers.test.ts`,
  `src/server/services/reopenFlow.test.ts`, and route proof expectations.
- Resolved high finding: manual unlock can succeed in Reddit but leave
  ReviewLock active. Unlock now best-effort clears active indexes and writes a
  runtime-failure audit if status persistence fails after `unignoreReports()`.
  Regression added in `src/server/services/unlockFlow.test.ts`.
- Resolved medium finding: failed runtime smoke proof can be persisted but not
  shown after Verify runtime. Client store now refreshes runtime status in the
  smoke failure path. Regression added in `src/client/state/store.test.ts`.
- Resolved medium finding: NSFW/spoiler update wrapper names. Update routes and
  payload-shape logging now accept `postNsfwUpdate`/`postSpoilerUpdate` as well
  as `nsfwPostUpdate`/`spoilerPostUpdate`. Regressions added in
  `src/routes/triggers.update.test.ts`.
- Partially resolved medium finding: report suppression rollback can leave lock
  counters incremented. The unchanged-report catch path now restores the
  original lock record if a later persistence write fails after
  `incrementLockSuppression()`. Regression added in
  `src/server/services/reportTriggers.test.ts`. Broader audit/metric
  transactionality remains a hardening target.
- Resolved medium finding added at 00:18: lock/unlock form submissions trust
  submitted subreddit when runtime context is missing. Form actions now require
  trusted runtime subreddit context and keep bindings unconsumed on missing or
  throwing context. Regressions added in `src/routes/forms.test.ts`.
- Resolved high finding added at 00:26: no-lock report/update deliveries can
  mark trigger runtime proof verified. No-lock paths no longer write verified
  trigger capability rows; regressions added in
  `src/server/services/reportTriggers.test.ts` and
  `src/server/services/reopenFlow.test.ts`.
- Resolved medium finding added at 00:22: dashboard metric counters can lose
  updates under concurrent cross-target writes. Metric mutations are now
  serialized with a short subreddit-scoped Redis mutex. Regression added in
  `src/server/services/metrics.test.ts`.
- Resolved medium finding added at 00:23: suppression rollback can leave metrics
  incremented when the success audit write fails. Report trigger rollback now
  decrements daily and target suppressed-report metrics after audit failure.
  Regression added in `src/server/services/reportTriggers.test.ts`.
- Resolved medium finding: reopen dismiss can write durable dismissal audit
  before queue mutation failure. Dashboard and form dismiss routes now append a
  compensating `runtime_failure` audit when queue/event mutation fails after the
  dismissal audit. Regressions added in `src/routes/api.dashboard.test.ts` and
  `src/routes/forms.test.ts`.
- Resolved medium finding: reopen flows can lose required `lock_reopened` audit
  after state is already reopened. Report and update reopen paths now append a
  compensating `runtime_failure` audit and return `runtime_uncertain`.
  Regressions added in `src/server/services/reportTriggers.test.ts` and
  `src/server/services/reopenFlow.test.ts`.
- Resolved medium finding added at 00:30: stale relock can fail after reopening
  the old lock but before creating the replacement lock. The stale-reopen
  section now catches metrics/audit failures, attempts a runtime-failure audit,
  returns a structured `LockFlowResult`, and does not call replacement
  `approve()`/`ignoreReports()`. Regression added in
  `src/server/services/lockFlow.test.ts`.
- Remaining medium findings for later pass:
  - None from the currently logged reviewer list.
- Validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 40 files / 301 tests.
  - `npm run build` PASS.

## 2026-05-26 00:14 IST - Finding

- Severity: medium
- Area: Reopen flows can lose the required `lock_reopened` audit after the lock is already reopened.
- Evidence:
  - Update-trigger reopen writes the reopen event, marks the lock `reopened`, writes reopen metrics, and only then appends the `lock_reopened` audit event: `src/server/services/reopenFlow.ts:166-190`.
  - Changed-content report reopen follows the same ordering: it enqueues the reopen event, marks the lock reopened, increments reopen metrics, then appends the `lock_reopened` audit event: `src/server/services/reportTriggers.ts:377-402`.
  - If the final audit append throws, both services fall into their outer `catch` and return `runtime_uncertain`/`redis_write_failed`, but the lock has already left the active index and the reopen queue event is already visible: `src/server/services/reopenFlow.ts:203-223`, `src/server/services/reportTriggers.ts:436-459`.
  - A retry then sees `no_lock` because `getActiveLockByTarget()` filters for active status only: `src/server/services/locks.ts:45-58`; it will not recreate the missing audit row.
  - Current reopen tests assert happy-path audit presence and status-write/index-failure behavior, but they do not fail the `lock_reopened` audit write after queue/status/metric persistence succeeds: `src/server/services/reopenFlow.test.ts:109-270`, `src/server/services/reportTriggers.test.ts:551-647`.
- Why it matters: `lock_reopened` is one of ReviewLock's required audit event kinds, and edit-break reopening is the core product loop. Losing the audit after the queue/status transition leaves moderators with a reopened queue item and metrics, but no durable ledger entry explaining who/what reopened it or whether `unignoreReports()` succeeded.
- Suggested fix: include audit creation in the same durability boundary as the reopen event and status transition, or write a compensating `runtime_failure` audit if the success audit fails after the reopen state is committed. Add regressions for update-trigger and report-trigger reopen where `keys.audit(...)` zAdd fails after queue/status writes, asserting the result does not leave an unaudited reopened item without a visible runtime-failure ledger entry.
- Files reviewed: `src/server/services/reopenFlow.ts`, `src/server/services/reopenFlow.test.ts`, `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/locks.ts`, `src/server/services/audit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:18 IST - Finding

- Severity: medium
- Area: Lock/unlock form submissions still trust submitted subreddit when runtime context is missing.
- Evidence:
  - `scopedFormSubreddit()` calls `reddit.getCurrentSubredditName()`, but if that returns `undefined`, it returns the normalized submitted subreddit instead of failing closed: `src/routes/forms.ts:75-103`.
  - Lock and unlock submit routes use that value before consuming the binding and before calling `lockReviewedContent()` / `unlockReviewedContent()`: `src/routes/forms.ts:126-154`, `src/routes/forms.ts:175-202`.
  - The form tests cover runtime mismatch for lock and unlock (`src/routes/forms.test.ts:161-187`, `src/routes/forms.test.ts:302-337`) and missing runtime context for dashboard launch (`src/routes/forms.test.ts:205-226`), but there is no lock/unlock form regression where `getCurrentSubredditName()` returns `undefined` or throws while the request supplies `subreddit: 'alpha'`.
  - This differs from the live dashboard and runtime-smoke hardening, which now requires trusted runtime subreddit context instead of accepting a client/query namespace during context outages: `src/routes/api.dashboard.ts:83-180`, `src/routes/api.ts:39-89`.
- Why it matters: internal Devvit form callbacks are moderation actions. If Devvit runtime subreddit lookup is temporarily unavailable, a still-valid form token plus submitted subreddit can approve/ignore or unignore content under a client-provided namespace instead of forcing the moderator to reopen the menu in a trusted subreddit context. That weakens the same namespace/proof boundary that dashboard actions already fail closed on.
- Suggested fix: make `scopedFormSubreddit()` require a runtime subreddit for lock, unlock, and reopen-dismiss form actions, and reject missing runtime context with the same neutral toast used for mismatches. Add lock and unlock regressions with a Reddit adapter whose `getCurrentSubredditName()` returns `undefined` and one that throws; assert the binding remains unconsumed, no Reddit moderation call is made, and the active lock state is unchanged.
- Files reviewed: `src/routes/forms.ts`, `src/routes/forms.test.ts`, `src/server/services/formBindings.ts`, `src/routes/api.dashboard.ts`, `src/routes/api.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:22 IST - Finding

- Severity: medium
- Area: Dashboard metrics counters can lose updates under concurrent cross-target writes.
- Evidence:
  - `recordLockCreatedMetric()`, `incrementSuppressedReportMetric()`, and `incrementReopenedMetric()` each load the whole daily metric and target metric JSON, increment in memory, then write the whole object back: `src/server/services/metrics.ts:131-195`.
  - The persistence helpers use `redis.set()` with full JSON records and `zAdd()` score updates rather than Redis atomic counters: `src/server/services/metrics.ts:57-79`.
  - Trigger mutexes are per target (`reviewlock:{subreddit}:trigger:mutex:{targetId}`), so they do not serialize reports or updates for different targets in the same subreddit: `src/server/services/triggerMutex.ts:14-28`; lock creation guards are also per target: `src/server/services/lockFlow.ts:148-183`.
  - Current metrics tests are sequential and cover ordering/malformed records, but not two simultaneous metric increments against the same daily key or same target key: `src/server/services/metrics.test.ts:28-112`.
- Why it matters: high-volume report bursts across different locked items are a core use case. Two successful trigger deliveries in the same subreddit/day can both read `reportsSuppressed = 0`, each write `1`, and leave the dashboard undercounting "Reports suppressed"; the same applies to lock-created and reopen counts. That weakens the product's evidence of avoided report churn even when moderation behavior succeeded.
- Suggested fix: store mutable counters in Redis hashes and use `hincrby`/transactional updates for daily and target metrics, or add a scoped metrics mutex/transaction around read-modify-write. Add concurrent tests for same-day different-target suppressed reports, concurrent lock creation metrics, and concurrent reopen metrics proving aggregate counters reach `2` and top-target ordering remains correct.
- Files reviewed: `src/server/services/metrics.ts`, `src/server/services/metrics.test.ts`, `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/lockFlow.ts`, `src/server/services/triggerMutex.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:23 IST - Finding

- Severity: medium
- Area: Report suppression rollback still leaves metrics incremented when the success audit write fails.
- Evidence:
  - The unchanged-report path persists the lock counter, then calls `incrementSuppressedReportMetric()`, then appends the `report_suppressed` audit event: `src/server/services/reportTriggers.ts:317-340`.
  - The catch block now restores the lock record with `updateLock(deps.redis, lock)` after a later failure, but it does not undo daily or target metrics that may already have been written: `src/server/services/reportTriggers.ts:341-347`.
  - `incrementSuppressedReportMetric()` writes both the daily `reportsSuppressed` JSON record and the target `reportsSuppressed` JSON record before the audit call can fail: `src/server/services/metrics.ts:153-172`; `appendAuditEvent()` has two fallible Redis writes after that: `src/server/services/audit.ts:22-31`.
  - The new rollback regression only fails the daily metric write before metrics can persist, and asserts the lock counters are restored; there is still no regression where `keys.audit(...)` or `keys.auditEvent(...)` fails after metrics were incremented: `src/server/services/reportTriggers.test.ts:797-836`.
- Why it matters: the service returns `runtime_uncertain`, calls `unignoreReports()`, and clears the dedupe marker when the final audit write fails, so the delivery is explicitly treated as not durably processed. Leaving dashboard metrics incremented in that state overstates "Reports suppressed"; a retry can then increment metrics again for the same report delivery.
- Suggested fix: make suppression persistence one atomic durability boundary, or add compensating metric rollback when the audit write fails after `incrementSuppressedReportMetric()` succeeds. Add regressions that fail `keys.auditEvent(...)` and `keys.audit(...)` after metric writes, asserting Reddit rollback occurs, dedupe is cleared, lock counters are restored, and daily/target suppressed metrics remain unchanged.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/metrics.ts`, `src/server/services/audit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:26 IST - Finding

- Severity: high
- Area: Trigger runtime proof can still be marked verified by no-lock no-op deliveries.
- Evidence:
  - Report triggers call `recordReportTriggerProcessed()` before returning `action: 'no_lock'` when the target resolves but has no active ReviewLock lock: `src/server/services/reportTriggers.ts:265-286`.
  - Update triggers call `recordUpdateTriggerProcessed()` before returning `action: 'no_lock'` when the target resolves but no active lock exists: `src/server/services/reopenFlow.ts:134-154`.
  - Both helpers write the corresponding trigger capability as `status: 'verified'`: `src/server/services/reportTriggers.ts:157-175`, `src/server/services/reopenFlow.ts:92-114`.
  - The new decision note explicitly includes "successful no-lock" as enough to mark trigger runtime proof verified: `decisions.md:1568-1578`.
  - Current live proof docs correctly distinguish the stronger evidence for verified rows as locked-content behavior: post report proof kept a lock active, incremented suppression metrics, and wrote `report_suppressed`; post/comment update proof changed fingerprints and wrote reopen state: `docs/RUNTIME_PROOF.md:101-104`.
- Why it matters: ReviewLock's core claim is not "Devvit delivered a trigger." It is "locked reviewed content suppresses repeat reports while unchanged, and reopens when changed." If a report or update arrives for unrelated unlocked content, the runtime panel can mark `commentReportTrigger`, `postNsfwUpdateTrigger`, `postSpoilerUpdateTrigger`, or `postFlairUpdateTrigger` verified without proving any lock lookup, suppression, fingerprint comparison, or reopen behavior. That weakens the exact live-proof boundary both external reviews called out as the project’s biggest core risk.
- Suggested fix: split proof levels or tighten the verified condition. For example, record no-lock deliveries as `unverified` with evidence/notes, or add a separate `delivered` capability state if the schema supports it; reserve `verified` for locked-content outcomes that exercise the ReviewLock loop (`suppress_unchanged`, `reopen_changed`, update reopen, or unchanged active-lock comparison). Add regressions where no-lock report/update deliveries do not mark the capability `verified`, while locked suppress/reopen paths still do.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/runtimeProof.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/reopenFlow.test.ts`, `src/routes/triggers.report.test.ts`, `src/routes/triggers.update.test.ts`, `docs/RUNTIME_PROOF.md`, `decisions.md`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:30 IST - Finding

- Severity: medium
- Area: Manual stale relock can fail after reopening the old lock but before creating the replacement lock.
- Evidence:
  - When `lockReviewedContent()` finds an existing active lock whose fingerprint differs from the current target, it calls `unignoreReports()`, enqueues a reopen event, marks the old lock `reopened`, increments reopen metrics, and only then appends the `lock_reopened` audit before attempting the replacement `approve()` / `ignoreReports()` flow: `src/server/services/lockFlow.ts:221-291`.
  - Failures in `incrementReopenedMetric()` or the stale-reopen `appendAuditEvent()` are outside the inner replacement-lock persistence `try/catch`, which starts later at `src/server/services/lockFlow.ts:338`. They therefore reject out of the service after the old lock may already be reopened and removed from active indexes.
  - The Devvit form submit route awaits `lockReviewedContent()` directly and only converts returned `LockFlowResult` objects into toasts: `src/routes/forms.ts:154-168`. It does not catch a thrown stale-reopen metrics/audit failure.
  - Current stale relock tests cover the happy path, replacement `ignoreReports()` failure, and stale `unignoreReports()` failure, but not Redis metrics/audit failure between old-lock reopen and replacement-lock creation: `src/server/services/lockFlow.test.ts:237-396`.
- Why it matters: This is fail-open for report suppression, which is good, but it can leave a moderator with a failed form submission after ReviewLock already reopened the old lock and before a replacement active lock exists. The moderator intended to lock newly reviewed edited content, but the service can stop halfway with no structured runtime-failure audit/toast explaining that only the old lock was reopened.
- Suggested fix: Put the stale-reopen transition and replacement-lock attempt behind one explicit durability boundary. At minimum, catch metrics/audit failures in the stale-reopen section, write or attempt a `runtime_failure` audit, and return a structured `LockFlowResult` that tells the moderator the old lock was reopened but the new lock was not created. Add regressions that fail `incrementReopenedMetric()` and the stale `lock_reopened` audit after `markLockReopenedAfterQueue()`.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/routes/forms.ts`, `src/server/services/metrics.ts`, `src/server/services/audit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:32 IST - Finding

- Severity: medium
- Area: Suppression metrics rollback still misses partial metric writes inside the metrics helper.
- Evidence:
  - The current report-trigger catch only compensates metrics when `incrementSuppressedReportMetric()` returns and flips `metricsIncremented = true`: `src/server/services/reportTriggers.ts:313-351`.
  - `incrementSuppressedReportMetric()` writes daily metrics first and target metrics second: `src/server/services/metrics.ts:191-212`. Each helper also performs multiple Redis writes, such as daily record `set` then daily index `zAdd`: `src/server/services/metrics.ts:94-115`.
  - If `saveDailyMetrics()` succeeds but `saveTargetMetrics()` fails, or if the daily record `set` succeeds and the daily index `zAdd` fails, `incrementSuppressedReportMetric()` rejects before `metricsIncremented` becomes true. The report-trigger rollback restores the lock counter and calls `unignoreReports()`, but it skips `decrementSuppressedReportMetric()`.
  - The new regressions cover failure before daily metrics persist and audit failure after the full metrics helper returns, but not a partial write inside `incrementSuppressedReportMetric()`: `src/server/services/reportTriggers.test.ts:802-883`.
- Why it matters: ReviewLock would return `runtime_uncertain`, clear the dedupe marker, and undo Reddit suppression for a report delivery that was not durably processed, while the dashboard daily metric can still show an extra "Reports suppressed." A retry of the same report can then count again, overstating the core churn-suppression evidence.
- Suggested fix: Make the metrics helper itself atomic/compensating, or have it return a write-state that lets the report-trigger catch undo partial daily/target writes even when the helper throws. Add regressions that fail `keys.metricsTarget(...)`, `keys.metricsDailyIndex(...)`, and `keys.metricsTargetIndex(...)` after the daily metric record has been updated.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/metrics.ts`, `src/server/services/metrics.test.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:33 IST - Finding

- Severity: medium
- Area: Stale relock failure can leave a reopen queue item while the old lock remains active.
- Evidence:
  - The current stale-relock block writes the reopen event first, then marks the old lock `reopened` and removes active indexes: `src/server/services/lockFlow.ts:263-270`.
  - `enqueueReopenEvent()` itself writes the reopen event body and queue index before returning: `src/server/services/reopenQueue.ts:22-35`.
  - If `enqueueReopenEvent()` succeeds but `markLockReopenedAfterQueue()` fails, the catch returns a structured failure and writes a `runtime_failure` audit, but it does not remove the already-queued reopen event or force the old lock out of the active indexes: `src/server/services/lockFlow.ts:289-321`. `getActiveLockByTarget()` will still return the old active lock when its status/index writes were not updated: `src/server/services/locks.ts:45-58`.
  - The new stale-relock persistence regression fails `keys.metricsDaily(...)`, which happens after `markLockReopenedAfterQueue()` has already removed the active lock; it explicitly expects no active lock and a visible reopen event: `src/server/services/lockFlow.test.ts:337-396`. There is no regression where the status/index update fails after the reopen event has been queued.
- Why it matters: A moderator can see an item in the reopen queue while ReviewLock still treats the same target as actively locked. Future report triggers can continue to evaluate the stale active lock, and a retry can enqueue another reopen event for the same old lock. That undercuts the clean "lock breaks and returns to review" state model.
- Suggested fix: Reorder the stale-relock transition so the old active lock cannot remain active after a durable queue write, or compensate by removing the queued reopen event if status/index mutation fails. Add a regression that fails `keys.lock(...)`, `keys.activeLocks(...)`, `keys.activeLocksByTarget(...)`, or `keys.targetLock(...)` during `markLockReopenedAfterQueue()` after `enqueueReopenEvent()` has succeeded, asserting the final state is either active-with-no-queue or reopened-with-queue.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/server/services/reopenQueue.ts`, `src/server/services/locks.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:41 IST - Finding

- Severity: medium
- Area: Manual unlock can lose the required `lock_unlocked` audit after the lock is already inactive.
- Evidence:
  - `unlockReviewedContent()` calls `unignoreReports()`, records runtime proof, then persists the lock as `unlocked` via `updateLockStatus()`: `src/server/services/unlockFlow.ts:82-127`.
  - Only after the active indexes have been removed does it append the `lock_unlocked` audit event: `src/server/services/unlockFlow.ts:160-172`.
  - That final audit write is not wrapped in a compensating catch. If `appendAuditEvent()` throws, the service rejects after the lock is no longer active, and a retry returns "No active ReviewLock lock was found" before it can recreate the missing audit: `src/server/services/unlockFlow.ts:64-70`, `src/server/services/unlockFlow.ts:160-180`.
  - Current unlock tests cover successful unlock, `updateLockStatus()` failure after `unignoreReports()`, stale lock id, subreddit mismatch, and `unignoreReports()` failure, but not a final `lock_unlocked` audit failure after status persistence succeeds: `src/server/services/unlockFlow.test.ts:63-200`.
- Why it matters: Manual unlock is one of the human-confirmed state transitions required by the product. Losing the audit after Reddit reports have been returned to normal handling and the active lock index has been cleared leaves moderators without a durable ledger entry explaining who unlocked the content.
- Suggested fix: Catch `lock_unlocked` audit failures after the status transition and write a compensating `runtime_failure` audit if possible, mirroring the reopen audit hardening. Add a regression that fails `keys.auditEvent(...)` or `keys.audit(...)` for the unlock success audit after `updateLockStatus()` succeeds, asserting the final state is inactive and the dashboard/audit trail still exposes the audit persistence failure.
- Files reviewed: `src/server/services/unlockFlow.ts`, `src/server/services/unlockFlow.test.ts`, `src/server/services/audit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:45 IST - Integration Status

- Resolved medium finding added at 00:32: report-trigger rollback now attempts
  a suppressed-report metric decrement whenever the lock suppression counter
  moved, including partial metric helper failures before the helper returns.
  Regression added in `src/server/services/reportTriggers.test.ts` for
  target-record, daily-index, and target-index metric persistence failures.
- Resolved medium finding added at 00:33: stale relock now removes the queued
  reopen event best-effort when a stale-reopen transition fails and the old
  lock still resolves as the active lock. Regression added in
  `src/server/services/lockFlow.test.ts`.
- Resolved medium finding added at 00:41: manual unlock now writes a
  compensating `runtime_failure` audit when the success `lock_unlocked` audit
  fails after unlock state is persisted. Regression added in
  `src/server/services/unlockFlow.test.ts`.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
    PASS, 1 file / 29 tests.
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
    PASS, 1 file / 14 tests.
  - `npm run test -- src/server/services/unlockFlow.test.ts src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts --reporter verbose`
    PASS, 3 files / 50 tests.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 40 files / 304 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.

## 2026-05-26 00:45 IST - Finding

- Severity: medium
- Area: Lock creation rollback can leave created-lock metrics behind after removing the lock.
- Evidence:
  - The lock success path saves the active lock, records created-lock metrics, then appends the `lock_created` audit event: `src/server/services/lockFlow.ts:402-419`.
  - Any failure in that block falls into the rollback catch. When `unignoreReports()` succeeds, the catch removes the lock and active indexes, then returns `ok: false`: `src/server/services/lockFlow.ts:427-466`.
  - The rollback does not undo `recordLockCreatedMetric()` if metrics already returned before a later `lock_created` audit failure. It also cannot undo partial writes inside `recordLockCreatedMetric()` if daily metrics persist but target metrics or an index write fails: `src/server/services/metrics.ts:168-189`.
  - Current lock-flow regressions fail the first metrics `set`, proving no `lock_created` audit remains and active indexes are removed, but they do not fail the later success audit after metrics have incremented or a later metrics sub-write after the daily record persists: `src/server/services/lockFlow.test.ts:560-598`.
- Why it matters: ReviewLock can return "not locked", call `unignoreReports()`, remove the local lock, and still show an extra created lock in daily/target metrics. That overstates the core dashboard story and makes "active locks" disagree with "locks created" for failed attempts.
- Suggested fix: Make created-lock metrics part of the same compensating boundary as lock persistence, or add a decrement/rollback helper for `locksCreated` analogous to suppressed-report rollback. Add regressions that fail the `lock_created` audit after metrics succeed, and fail `keys.metricsTarget(...)`, `keys.metricsDailyIndex(...)`, or `keys.metricsTargetIndex(...)` after daily lock-created metrics have been written.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/server/services/metrics.ts`, `src/server/services/audit.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:47 IST - Integration Status

- Resolved medium finding added at 00:45: lock creation rollback now calls a
  compensating `decrementLockCreatedMetric()` after a saved lock is removed
  during successful Reddit rollback.
- Regression added in `src/server/services/lockFlow.test.ts` for
  `lock_created` audit failure after created-lock metrics succeeded.
- Regression added in `src/server/services/lockFlow.test.ts` for partial
  created-lock metric failures at target-record, daily-index, and target-index
  write points.
- Focused validation:
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
    PASS, 1 file / 16 tests.
- Full validation superseded by the 00:51 integration validation after the
  metric snapshot/restore changes landed.

## 2026-05-26 00:43 IST - Finding

- Severity: medium
- Area: Suppression metric rollback can now undercount previously valid suppressions when the metric write fails before incrementing.
- Evidence:
  - The current report-trigger catch now calls `decrementSuppressedReportMetric()` whenever the lock counter was incremented, regardless of whether `incrementSuppressedReportMetric()` wrote any daily or target metric data: `src/server/services/reportTriggers.ts:313-348`.
  - `incrementSuppressedReportMetric()` can fail before changing metrics, for example on the first `saveDailyMetrics()` `set`: `src/server/services/metrics.ts:191-212`, `src/server/services/metrics.ts:94-103`.
  - `decrementSuppressedReportMetric()` subtracts one from any existing daily and target counters, bounded at zero: `src/server/services/metrics.ts:214-237`.
  - The existing regression for early daily-metric failure sets `keys.metricsDaily(...)` to throw before any metric write, but it only asserts lock counters and dedupe cleanup; it does not seed prior metrics or assert the daily/target counters remain unchanged: `src/server/services/reportTriggers.test.ts:845-884`.
- Why it matters: If a subreddit already has valid "Reports suppressed" metrics and a later report trigger hits a Redis failure before writing this delivery's metric increment, ReviewLock will roll back Reddit suppression and lock counters but also decrement an unrelated prior suppression. That makes the dashboard understate the core churn-reduction metric.
- Suggested fix: Make `incrementSuppressedReportMetric()` internally compensating and report whether it actually wrote an increment, or snapshot the previous daily/target metric values and restore them on failure. Add a regression that seeds `reportsSuppressed: 3`, fails the first daily metric write for the next report, and asserts daily and target counters remain `3` after rollback.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/metrics.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:44 IST - Finding

- Severity: medium
- Area: Reopen audit hardening still misses metrics failures before the audit write.
- Evidence:
  - Update-trigger reopen enqueues the reopen event, marks the lock `reopened`, then calls `incrementReopenedMetric()` before entering the new `lock_reopened` audit `try/catch`: `src/server/services/reopenFlow.ts:184-197`.
  - Changed-report reopen follows the same ordering: queue event, mark lock reopened, increment reopened metrics, then enter the audit `try/catch`: `src/server/services/reportTriggers.ts:400-414`.
  - If `incrementReopenedMetric()` throws, both services skip the success-audit catch entirely and fall to their outer catch handlers. The update path returns `runtime_uncertain` without writing any audit event: `src/server/services/reopenFlow.ts:260-280`. The report path clears dedupe and returns `runtime_uncertain`, also without a compensating audit: `src/server/services/reportTriggers.ts:496-520`.
  - Current regressions cover audit-write failure after reopen state is committed, but not reopen-metric failure after queue/status persistence and before the audit block: `src/server/services/reopenFlow.test.ts:299-340`, `src/server/services/reportTriggers.test.ts:452-486`.
- Why it matters: Edit-break reopen is the product's core loop and `lock_reopened` is a required audit kind. A metrics outage can leave a visible reopen queue item and inactive lock with no durable audit explaining why the lock broke or whether `unignoreReports()` succeeded.
- Suggested fix: Treat `incrementReopenedMetric()` as part of the same post-reopen durability boundary as the audit write. Either catch metrics failures and append a `runtime_failure` audit, or move metrics after a durable reopen audit and make metrics best-effort. Add report-trigger and update-trigger regressions that fail `keys.metricsDaily(...)` or `keys.metricsTarget(...)` after queue/status writes, asserting a runtime-failure audit remains visible.
- Files reviewed: `src/server/services/reopenFlow.ts`, `src/server/services/reopenFlow.test.ts`, `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/metrics.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:46 IST - Finding

- Severity: medium
- Area: Created-lock metric rollback can undercount prior successful locks when the failed attempt never incremented metrics.
- Evidence:
  - The current lock creation rollback tracks only `lockSaved`, which flips before `recordLockCreatedMetric()` is called: `src/server/services/lockFlow.ts:402-405`.
  - In the rollback catch, any saved lock with successful `unignoreReports()` calls `decrementLockCreatedMetric()`, regardless of whether `recordLockCreatedMetric()` wrote an increment for this attempt: `src/server/services/lockFlow.ts:427-439`.
  - `recordLockCreatedMetric()` can fail before changing metrics, for example on the first daily metric `set`: `src/server/services/metrics.ts:168-189`, `src/server/services/metrics.ts:94-103`.
  - `decrementLockCreatedMetric()` subtracts one from any existing daily and target `locksCreated` counters, bounded at zero: `src/server/services/metrics.ts:191-214`.
  - Current lock-flow regressions fail metrics with no seeded prior created-lock metrics, so an erroneous decrement is hidden at zero; they do not seed prior `locksCreated` counters and assert they remain unchanged when the failed attempt's metric write never happened: `src/server/services/lockFlow.test.ts:560-598`.
- Why it matters: A transient Redis failure during one lock attempt can erase evidence of a previous successful lock from the dashboard. That makes ReviewLock understate successful moderation work and creates disagreement between the audit/lock history and aggregate metrics.
- Suggested fix: Track whether `recordLockCreatedMetric()` actually incremented metrics, or make the metric helper internally compensating/restorative. Add a regression that seeds `locksCreated: 2`, fails the first daily metric write during the next lock attempt, and asserts daily and target `locksCreated` remain `2` after rollback.
- Files reviewed: `src/server/services/lockFlow.ts`, `src/server/services/lockFlow.test.ts`, `src/server/services/metrics.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:51 IST - Integration Status

- Resolved medium finding added at 00:43: suppression metric rollback no longer
  decrements previous valid metrics when the next attempt fails before this
  attempt's metric increment. Regression added in
  `src/server/services/reportTriggers.test.ts` with seeded prior
  `reportsSuppressed: 3`.
- Resolved medium finding added at 00:44: report-trigger and update-trigger
  reopen paths now treat reopen metrics and success audit as one post-reopen
  proof boundary, and write a compensating `runtime_failure` audit if either
  fails after reopen state is visible. Regressions added in
  `src/server/services/reportTriggers.test.ts` and
  `src/server/services/reopenFlow.test.ts`.
- Resolved medium finding added at 00:46: created-lock metric rollback no
  longer decrements previous valid metrics when the failed lock attempt never
  incremented. Regression added in `src/server/services/lockFlow.test.ts` with
  seeded prior `locksCreated: 2`.
- Metric increment helpers for lock-created, suppression, and reopened metrics
  now snapshot and restore prior daily/target records on partial write failure.
- Focused validation:
  - `npm run test -- src/server/services/metrics.test.ts src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
    PASS, 4 files / 66 tests.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 40 files / 310 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.

## 2026-05-26 00:53 IST - Finding

- Severity: medium
- Area: Demo read-only enforcement is client-only for dashboard mutation APIs.
- Evidence:
  - The dashboard scope resolver explicitly permits `demo=true` requests for `reviewlock_demo` even when the live runtime subreddit is different: `src/routes/api.dashboard.ts:141-160`.
  - The dashboard unlock route calls `unlockReviewedContent()` after scope resolution without rejecting demo mode: `src/routes/api.dashboard.ts:329-375`.
  - The dashboard reopen-dismiss route appends `reopen_dismissed` audit and calls `dismissReopenEvent()` after scope resolution without rejecting demo mode: `src/routes/api.dashboard.ts:379-464`.
  - The client does render demo rows as read-only (`src/client/components/LockTable.ts:25-32`, `src/client/components/ReopenQueue.ts:38-46`), and render tests assert demo controls are absent, but `rg` found no server-side regression for `demo=true` unlock/dismiss mutation attempts.
- Why it matters: Demo mode is a judge-facing, seeded scenario and the UI correctly says "Demo read-only." If a dashboard request bypasses the rendered controls, `/api/reopen-queue/dismiss?demo=true` with `subreddit: "reviewlock_demo"` can mutate the seeded reopen queue and audit state. That makes demo isolation depend on the client instead of the server and can make a demo session drift from the deterministic story.
- Suggested fix: Reject dashboard mutation routes when `demoFrom(context)` is true, or require dedicated demo-reset/enable endpoints for all demo mutations. Add regressions that `POST /api/locks/unlock?subreddit=reviewlock_demo&demo=true` and `POST /api/reopen-queue/dismiss?demo=true` with `subreddit: "reviewlock_demo"` return a non-mutating error and leave demo locks/reopen events/audit unchanged.
- Files reviewed: `src/routes/api.dashboard.ts`, `src/routes/api.dashboard.test.ts`, `src/client/components/LockTable.ts`, `src/client/components/ReopenQueue.ts`, `src/client/render.test.ts`, `docs/REVIEW_AGENT_FINDINGS.md`.

## 2026-05-26 00:55 IST - Integration Status

- Resolved medium finding added at 00:53: dashboard mutation routes now reject
  `demo=true` unlock and reopen-dismiss requests with
  `Demo dashboard data is read-only.` before Reddit calls, audit writes, or
  lock/reopen queue state changes.
- Regressions added in `src/routes/api.dashboard.test.ts` for demo unlock and
  demo reopen-dismiss mutation attempts, asserting seeded state and audit logs
  remain unchanged.
- Focused validation:
  - `npm run test -- src/routes/api.dashboard.test.ts --reporter verbose`
    PASS, 1 file / 13 tests.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 40 files / 312 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.
  - Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
    proof checklists; no production UI copy match was found.

## 2026-05-26 01:14 IST - Finding

- Severity: medium
- Area: Update-trigger audit reconciliation can verify edit-break proof when `unignoreReports()` failed.
- Evidence:
  - `breakLockForChangedContent()` records `unignoreReportsOk: unignoreResult?.ok ?? false` in the `lock_reopened` audit data after changed content reopens: `src/server/services/reopenFlow.ts:197-211`.
  - `capabilityFromUpdateAudit()` verifies the update-trigger capability from that audit using only known `triggerCapabilityName`, matching reason, and matching target kind; it does not inspect `event.data.unignoreReportsOk`: `src/server/services/runtimeProof.ts:191-214`.
  - The existing unignore-failure regression proves the lock is reopened and the `unignoreReports` capability becomes `failed`, but it does not pass `triggerCapabilityName` or assert the corresponding update-trigger row stays unverified when unignore fails: `src/server/services/reopenFlow.test.ts:168-185`.
  - Runtime proof docs describe verified post/comment update trigger delivery as the edit-break path that reopened the lock and surfaced it back to the queue: `docs/RUNTIME_PROOF.md:109-110`.
- Why it matters: fail-open reopening is correct, but a green `postUpdateTrigger` or `commentUpdateTrigger` row can overstate the full edit-break loop if Reddit reports are still ignored because `unignoreReports()` failed. The separate `unignoreReports` row may be failed, but the trigger row evidence text still reads as durable reopen proof for the target. Judges inspecting capability rows could see the update trigger as verified even though the lock did not fully return reports to normal handling.
- Suggested fix: decide the proof boundary explicitly. If update-trigger proof is meant to prove the complete edit-break moderation loop, require `event.data.unignoreReportsOk === true` before reconciling update-trigger audits, and add a regression with `triggerCapabilityName` plus forced unignore failure. If the row is only meant to prove Devvit trigger delivery and local reopen queueing, change the capability notes/docs to say that unignore success is tracked separately and keep a regression proving the failed `unignoreReports` row remains visible beside the verified trigger row.
- Files reviewed: `src/server/services/reopenFlow.ts`, `src/server/services/runtimeProof.ts`, `src/server/services/reopenFlow.test.ts`, `docs/RUNTIME_PROOF.md`.

## 2026-05-26 01:16 IST - Finding

- Severity: medium
- Area: Dashboard headline active-lock count is capped by the display list limit.
- Evidence:
  - `MAX_ACTIVE_LOCKS` is `50`: `src/shared/constants.ts:5`.
  - `getDashboardData()` loads active locks with `listActiveLocks(redis, options.subreddit, limit)` where `limit` defaults to `MAX_ACTIVE_LOCKS`: `src/server/services/dashboard.ts:65-69`.
  - `aggregateDashboardOverview()` sets `activeLockCount` to `activeLocks.length`, so the overview count cannot exceed the loaded display list length: `src/server/services/dashboard.ts:38-51`.
  - `listActiveLocks()` itself reads only the requested sorted-set range: `src/server/services/locks.ts:103-111`.
  - The high-volume dashboard test seeds `MAX_ACTIVE_LOCKS + 20` active locks and asserts the returned list is capped, but it does not assert that `overview.activeLockCount` reflects the true 70 active locks rather than the capped 50: `src/server/services/dashboard.test.ts:144-220`.
- Why it matters: the first-viewport metric is supposed to show how many reviewed items are locked. For larger communities, the dashboard can understate active locks as soon as more than 50 locks exist. That makes the cap look like a product scale limit instead of a UI display limit and weakens the measurable-impact story.
- Suggested fix: separate list limits from aggregate counts. Add a `countActiveLocks()` helper that counts the active-lock sorted-set members without truncating, or store/maintain an active-lock counter. Use that true count for `overview.activeLockCount` while keeping the table capped at `MAX_ACTIVE_LOCKS`. Add a regression that seeds `MAX_ACTIVE_LOCKS + 20` locks and expects `data.activeLocks.length === MAX_ACTIVE_LOCKS` but `data.overview.activeLockCount === MAX_ACTIVE_LOCKS + 20`.
- Files reviewed: `src/shared/constants.ts`, `src/server/services/dashboard.ts`, `src/server/services/dashboard.test.ts`, `src/server/services/locks.ts`.

## 2026-05-26 01:18 IST - Finding

- Severity: medium
- Area: Dashboard "Reports suppressed" headline is a capped 30-day slice but reads like an unqualified total.
- Evidence:
  - `getDashboardData()` loads daily metrics through `listDailyMetrics(redis, options.subreddit, MAX_DAILY_METRICS)`: `src/server/services/dashboard.ts:65-72`.
  - `MAX_DAILY_METRICS` is `30`: `src/shared/constants.ts:8`.
  - `listDailyMetrics()` only reads the requested sorted-set range, so older daily metric records are not included in the returned metrics array: `src/server/services/metrics.ts:155-170`.
  - `aggregateDashboardOverview()` computes `reportsSuppressed` by summing only the loaded `dailyMetrics`: `src/server/services/dashboard.ts:30-47`.
  - The first-viewport metric label and tooltip say `Reports suppressed` without indicating a 30-day/recent window: `src/client/components/MetricStrip.ts:15-18`.
- Why it matters: the app's strongest impact proof is suppressed report churn. If a community has more than 30 days of use, the headline can understate total value while presenting the number as a total. That is a claim/documentation mismatch and can confuse judges or moderators comparing dashboard totals to the audit/history.
- Suggested fix: either make the UI label explicit, such as `Reports suppressed, 30d`, and document the window in dashboard/API docs, or maintain a cumulative metric counter separate from the bounded daily chart. Add a regression with `MAX_DAILY_METRICS + 5` daily records that asserts the intended behavior: either the overview is labeled/windowed or the total includes all persisted days.
- Files reviewed: `src/server/services/dashboard.ts`, `src/server/services/metrics.ts`, `src/shared/constants.ts`, `src/client/components/MetricStrip.ts`.

## 2026-05-26 01:20 IST - Finding

- Severity: low
- Area: Initial-load error guidance can mention demo mode without rendering a demo action.
- Evidence:
  - The initial-load error branch renders only the notice text and a single `Retry` button when `store.error && !store.overview`: `src/client/pages/DashboardPage.ts:58-69`.
  - `classifyClientNotice()` tells users to "switch to labeled demo data" for runtime-unavailable errors: `src/client/state/clientNotice.ts:39-50`.
  - Static-preview/API-unavailable errors say "or use demo mode": `src/client/state/clientNotice.ts:80-91`.
  - The new render tests cover retryable initial-load errors and subreddit-context guidance, but they do not cover runtime-unavailable or static-preview notices on the full-page error branch, nor do they assert that a demo toggle/action is present when the text recommends demo mode: `src/client/render.test.ts:322-348`.
- Why it matters: demo mode is the judge-facing fallback for non-live contexts. If the dashboard fails before any overview has loaded, the UI can instruct a reviewer to use demo mode while only giving them Retry. That can turn a recoverable static-preview/runtime-context failure into a dead end during judging or screenshots.
- Suggested fix: either render the Live/Demo toggle or a dedicated `Try demo` action on initial-load notices whose action copy references demo mode, or change those action strings to only recommend a path that the current screen can perform. Add a render regression for a static-preview error asserting either `data-action="toggle-mode" data-mode="demo"` is present or the notice copy does not mention demo mode.
- Files reviewed: `src/client/pages/DashboardPage.ts`, `src/client/state/clientNotice.ts`, `src/client/render.test.ts`.

## 2026-05-26 01:18 IST - Integration Status

- Resolved medium finding added at 01:14: update-trigger proof reconciliation
  now requires concrete successful unignore evidence before durable reopen
  audits can upgrade granular update trigger capability rows.
- Resolved medium finding added at 01:16: dashboard overview active-lock count
  now uses an uncapped active-lock count while keeping the displayed active-lock
  list bounded by `MAX_ACTIVE_LOCKS`.
- Resolved medium finding added at 01:18: dashboard overview reports-suppressed
  count now uses cumulative daily metric totals while keeping the daily chart
  bounded by `MAX_DAILY_METRICS`.
- Regressions added for high-volume active-lock count, cumulative suppressed
  reports, strict update-trigger proof reconciliation, and client notice
  classification/rendering.
- Resolved low finding added at 01:20: the initial-load error view now renders
  a direct demo-mode action alongside Retry when not already in demo mode.
- Focused validation:
  - `npm run type-check` PASS.
  - `npm run test -- src/server/services/dashboard.test.ts src/server/services/runtimeProof.test.ts src/server/services/reopenFlow.test.ts src/client/state/clientNotice.test.ts src/client/render.test.ts --reporter verbose`
    PASS, 5 files / 53 tests.
  - `npm run test -- src/client/state/clientNotice.test.ts src/client/render.test.ts --reporter verbose`
    PASS, 2 files / 21 tests after the demo-action regression.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 41 files / 326 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.
  - Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
    proof checklists; no production UI copy match was found.

## 2026-05-26 01:00 IST - Finding

- Severity: medium
- Area: Runtime proof audit reconciliation can falsely verify comment report delivery.
- Evidence:
  - `capabilityFromReportAudit()` derives the trigger capability with `event.targetKind === 'post' ? 'postReportTrigger' : 'commentReportTrigger'`: `src/server/services/runtimeProof.ts:147-160`.
  - `AuditEvent.targetKind` is optional in the shared type: `src/shared/schema.ts:95-101`.
  - The audit schema guard accepts audit events with no `targetKind`: `src/shared/schema.ts:291-298`.
  - That means a non-demo `report_suppressed` audit with missing `targetKind` is treated as `commentReportTrigger` proof, even though live comment-report proof is still explicitly unverified in `docs/RUNTIME_PROOF.md` and `docs/KNOWN_LIMITATIONS.md`.
- Why it matters: comment report suppression is one of the remaining runtime-proof gaps. A legacy, partial, or manually malformed-but-schema-valid `report_suppressed` audit can turn the dashboard/runtime proof row for `commentReportTrigger` green without a controlled `CommentReport` delivery.
- Suggested fix: make `capabilityFromReportAudit()` return `undefined` unless `event.targetKind` is exactly `post` or `comment`, and add a regression in `src/server/services/runtimeProof.test.ts` showing a `report_suppressed` audit with missing `targetKind` does not verify either report-trigger capability.
- Files reviewed: `src/server/services/runtimeProof.ts`, `src/shared/schema.ts`, `docs/RUNTIME_PROOF.md`, `docs/KNOWN_LIMITATIONS.md`.

## 2026-05-26 01:02 IST - Integration Status

- Resolved medium finding added at 01:00: runtime proof audit reconciliation
  now ignores `report_suppressed` audit events unless `targetKind` is exactly
  `post` or `comment`.
- Regression added in `src/server/services/runtimeProof.test.ts` for a
  schema-valid missing-kind suppression audit, asserting neither
  `postReportTrigger` nor `commentReportTrigger` is verified.
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts --reporter verbose`
    PASS, 1 file / 12 tests.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 40 files / 315 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.
  - Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
    proof checklists; no production UI copy match was found.

## 2026-05-26 01:04 IST - Finding

- Severity: medium
- Area: Reloaded demo URLs can lose the live subreddit needed to exit demo mode.
- Evidence:
  - `main.ts` treats any `subreddit` query param as authoritative and skips embedded/runtime context inference when it is present: `src/client/main.ts:10-22` and `src/client/main.ts:105-122`.
  - The demo toggle writes `subreddit=reviewlock_demo` into the URL: `src/client/main.ts:80-92`.
  - `ReviewLockStore` initializes `liveSubreddit` to hardcoded `reviewlock` when `initialSubreddit === 'reviewlock_demo'`: `src/client/state/store.ts:44-52`.
  - Existing store tests cover `new ReviewLockStore(apiClient, 'reviewlock_dev', true)`, not the actual reloaded URL shape `new ReviewLockStore(apiClient, 'reviewlock_demo', true)`: `src/client/state/store.test.ts:226-254`.
- Why it matters: if a moderator reloads or shares a demo URL containing `?demo=true&subreddit=reviewlock_demo`, exiting demo mode can send the dashboard back to `r/reviewlock` instead of the real Devvit runtime subreddit such as `r/reviewlock_dev`. The server will then reject live reads for scope mismatch, making demo exit look broken in the WebView.
- Suggested fix: when `demo=true`, still fetch `/api/context` or infer the embedded subreddit even if the query subreddit is `reviewlock_demo`, then call `store.updateSubredditContext(runtimeSubreddit)` before the first fetch. Add a client/store regression that boots from `reviewlock_demo` demo mode, receives runtime context `reviewlock_dev`, exits demo, and fetches `reviewlock_dev` live data.
- Files reviewed: `src/client/main.ts`, `src/client/state/store.ts`, `src/client/state/store.test.ts`, `src/client/state/runtimeContext.ts`.

## 2026-05-26 01:05 IST - Finding

- Severity: medium
- Area: Update-trigger audit reconciliation verifies runtime-uncertain refetch failures.
- Evidence:
  - `breakLockForChangedContent()` writes `triggerCapabilityName` into every `lock_reopened` audit whenever the input has one, even when the reopen reason is `runtime_uncertain` and the target could not be refetched: `src/server/services/reopenFlow.ts:168-210`.
  - `capabilityFromUpdateAudit()` verifies any non-demo `lock_reopened` audit with a known `triggerCapabilityName` without checking `event.data.reason`, target resolution, or whether `unignoreReports()` actually ran: `src/server/services/runtimeProof.ts:175-192`.
  - Existing regression `fails open to runtime uncertain when Reddit refetch throws` expects `postUpdateTrigger` to remain unverified after a refetch failure: `src/server/services/reopenFlow.test.ts:198-231`.
  - Focused validation failed after the current diff: `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/reopenFlow.test.ts --reporter verbose` failed because `postUpdateTrigger` became `verified` from `lock_reopened audit audit-update-reopened-1779584400000-lock-1`.
- Why it matters: runtime proof rows are supposed to turn green only after successful target resolution and route processing. A fail-open reopen is good product behavior, but treating it as verified update-trigger proof overclaims the exact Devvit/runtime evidence judges will inspect.
- Suggested fix: only include or reconcile `triggerCapabilityName` for update audits when `resolution.target` exists and the comparison was a real material change, not `runtime_uncertain`. Alternatively, have `capabilityFromUpdateAudit()` require `event.data.reason !== 'runtime_uncertain'` plus a valid `targetKind`/target id before deriving proof. Keep the failing `reopenFlow.test.ts` expectation green and add a direct `runtimeProof.test.ts` regression for runtime-uncertain update audits.
- Files reviewed: `src/server/services/reopenFlow.ts`, `src/server/services/runtimeProof.ts`, `src/server/services/reopenFlow.test.ts`, `src/server/services/runtimeProof.test.ts`.

## 2026-05-26 01:10 IST - Finding

- Severity: medium
- Area: Update-trigger audit reconciliation does not require target kind to match the verified trigger.
- Evidence:
  - `capabilityFromUpdateAudit()` now requires a known `triggerCapabilityName` and matching reopen `reason`, but it does not inspect `event.targetKind` before returning a verified capability: `src/server/services/runtimeProof.ts:183-205`.
  - `AuditEvent.targetKind` is optional in the shared type: `src/shared/schema.ts:95-105`.
  - The audit schema guard accepts missing `targetKind` or either valid target kind: `src/shared/schema.ts:291-302`.
  - The current update-proof tests cover a valid post-flair audit, unknown trigger names, demo audits, and mismatched reasons, but not missing target kind or a mismatched target kind such as `targetKind: 'comment'` with `triggerCapabilityName: 'postFlairUpdateTrigger'`: `src/server/services/runtimeProof.test.ts:230-312`.
- Why it matters: post NSFW/spoiler/flair trigger proof is still an explicit live-proof gap. A schema-valid legacy or malformed `lock_reopened` audit with `reason: 'flair_changed'` and `triggerCapabilityName: 'postFlairUpdateTrigger'` can mark the post-flair proof row verified even if the audit is missing target kind or points at a comment. Runtime proof rows should require the durable audit evidence to match the concrete trigger family being claimed.
- Suggested fix: require update-proof audit records to have a target kind consistent with the capability before reconciling: `post*` capabilities require `event.targetKind === 'post'`, `commentUpdateTrigger` requires `event.targetKind === 'comment'`, and missing or mismatched kinds return `undefined`. Add runtime proof regressions for missing `targetKind` and mismatched comment/post target kinds.
- Files reviewed: `src/server/services/runtimeProof.ts`, `src/server/services/runtimeProof.test.ts`, `src/shared/schema.ts`.

## 2026-05-26 01:12 IST - Integration Status

- Resolved medium finding added at 01:04: reloaded demo URLs now still infer or
  fetch the embedded runtime subreddit when the URL uses
  `demo=true&subreddit=reviewlock_demo`, preserving the live subreddit for demo
  exit while seeded demo reads stay isolated in `reviewlock_demo`.
- Regression added in `src/client/state/store.test.ts` for the actual reloaded
  demo URL state: boot from `reviewlock_demo`, receive runtime context
  `reviewlock_dev`, exit demo, and fetch live `reviewlock_dev`.
- Resolved medium finding added at 01:05: update-trigger proof reconciliation
  now requires a known trigger capability, concrete matching reopen reason, and
  no longer upgrades `runtime_uncertain` failed-refetch reopen audits.
- Resolved medium finding added at 01:10: update-trigger proof reconciliation
  now requires `targetKind` to match the trigger family, so post update proof
  cannot be verified by missing-kind or comment-target reopen audits.
- Regressions added in `src/server/services/runtimeProof.test.ts` and
  `src/server/services/reopenFlow.test.ts` for strict reason matching,
  failed-refetch runtime uncertainty, and missing/mismatched target kinds.
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
    PASS, 2 files / 29 tests.
  - `npm run test -- src/client/state/store.test.ts --reporter verbose`
    PASS, 1 file / 16 tests.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 40 files / 319 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.
  - Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
    proof checklists; no production UI copy match was found.

## 2026-05-26 01:21 IST - Finding

- Severity: medium
- Area: Granular update-trigger proof can still be marked verified by unchanged active-lock deliveries.
- Evidence:
  - `recordUpdateTriggerProcessed()` always writes the provided update capability as `verified`: `src/server/services/reopenFlow.ts:92-115`.
  - The unchanged branch calls `recordUpdateTriggerProcessed()` before returning `action: 'unchanged'`: `src/server/services/reopenFlow.ts:151-164`.
  - The current regression only proves no-lock update deliveries stay unverified; the unchanged active-lock test does not pass `triggerCapabilityName` or assert runtime proof state: `src/server/services/reopenFlow.test.ts:102-122`.
  - Runtime proof docs describe verified post/comment update trigger rows using controlled body edits that changed fingerprints, reopened locks, enqueued reopen events, and wrote `lock_reopened` audits: `docs/RUNTIME_PROOF.md:109-111`.
- Why it matters: an unchanged active-lock delivery does prove Devvit reached ReviewLock and the fingerprint compare ran, but it does not prove the edit-break loop. For still-unverified post NSFW/spoiler/flair rows, a stale or no-op delivery could make the runtime panel say `verified` before the controlled flag/flair change actually reopens a lock. That weakens the proof boundary the project is using to avoid overclaiming live edit-aware behavior.
- Suggested fix: either split the meaning explicitly, e.g. `delivered` vs `edit_break_verified`, or keep granular update-trigger capabilities `unverified` on unchanged deliveries and reserve `verified` for changed-content reopen audits with successful target resolution and `unignoreReportsOk === true`. Add a regression where an unchanged active lock with `triggerCapabilityName: 'postFlairUpdateTrigger'` does not mark the flag/flair capability verified unless the intended proof boundary is deliberately delivery-only and the UI/docs say so.
- Files reviewed: `src/server/services/reopenFlow.ts`, `src/server/services/reopenFlow.test.ts`, `docs/RUNTIME_PROOF.md`.

## 2026-05-26 01:21 IST - Finding

- Severity: medium
- Area: Changed-content report triggers can verify report-trigger proof even when `unignoreReports()` failed.
- Evidence:
  - The changed-report path calls `unignoreReportsForReviewLock()` and records its runtime proof, but carries on regardless of `unignoreResult.ok`: `src/server/services/reportTriggers.ts:399-410`.
  - After queueing the reopen event, marking the lock reopened, writing metrics, and appending `lock_reopened` audit data with `unignoreReportsOk`, the path always calls `recordReportTriggerProcessed()`: `src/server/services/reportTriggers.ts:411-461`.
  - `recordReportTriggerProcessed()` writes `postReportTrigger` or `commentReportTrigger` as `verified`: `src/server/services/reportTriggers.ts:161-180`.
  - Existing changed-report tests cover successful post/comment reopen and post-reopen Redis failures, but there is no regression where changed-content report handling sees `unignoreReports()` fail and asserts the report-trigger capability remains unverified or explicitly scoped: `src/server/services/reportTriggers.test.ts:561-744`.
- Why it matters: fail-open local reopening is correct, but if Reddit still ignores reports then the full report-driven edit-break loop did not return the item to normal report handling. The runtime panel can still show a green `commentReportTrigger`/`postReportTrigger` row from that delivery, which is especially risky for the still-unverified comment-report path judges care about.
- Suggested fix: decide the same proof boundary used for update triggers. If report-trigger proof means the complete locked-content moderation loop, only call `recordReportTriggerProcessed()` on changed-content report reopens when `unignoreResult.ok === true`; otherwise keep the failed `unignoreReports` row visible and leave the trigger row unverified. If proof means delivery-only, change the capability notes/docs so the row cannot be read as suppression/reopen proof. Add a regression with forced `unignoreReports` failure on a changed comment report.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`.

## 2026-05-26 01:24 IST - Finding

- Severity: medium
- Area: Unlock form depends on a disabled `lockId` field even though the lock id is already server-bound.
- Evidence:
  - `buildUnlockReviewForm()` renders `lockId` as a disabled string field with `required: true`: `src/routes/menu.ts:136-143`.
  - `createFormBinding()` stores the confirmed `lockId` in Redis for unlock bindings: `src/server/services/formBindings.ts:44-52`.
  - `/unlock-review-submit` rejects the form before consuming the binding unless `body.lockId` is present: `src/routes/forms.ts:177-181`.
  - The submit path then compares `body.lockId` to the bound `binding.lockId`, but the actual unlock operation already uses `binding.lockId`: `src/routes/forms.ts:191-209`.
  - Current form tests manually include `lockId` in the JSON body and do not cover the platform-like case where a disabled field is omitted from submitted results: `src/routes/forms.test.ts:311-319`.
- Why it matters: disabled form fields are display-only in many form systems, and Devvit submit results are platform-provided rather than generated by these route tests. If Devvit omits disabled fields, a moderator can open a valid Unlock review form and submit it, but ReviewLock will respond `ReviewLock form token and lock are required.` even though the Redis binding has the exact confirmed lock id. This is a user-visible installability/runtime failure on a core moderation action.
- Suggested fix: treat `body.lockId` as optional on form submit. Require `formToken` and `subreddit`, consume the unlock binding, require `binding.lockId`, and only reject when a submitted `body.lockId` is present and mismatches `binding.lockId`. Add a regression that submits an unlock form with `subreddit` and `formToken` but no `lockId`, proving it unlocks the bound lock.
- Files reviewed: `src/routes/menu.ts`, `src/routes/forms.ts`, `src/server/services/formBindings.ts`, `src/routes/forms.test.ts`.

## 2026-05-26 01:27 IST - Integration Status

- Resolved medium finding added at 01:21: unchanged active-lock update
  deliveries no longer mark granular update-trigger runtime proof rows
  verified. Runtime proof verification remains reserved for material
  fingerprint changes that reopen a lock and successfully unignore reports.
- Regression expanded in `src/server/services/reopenFlow.test.ts` so an
  unchanged active lock delivered through `postFlairUpdateTrigger` leaves that
  capability `unverified`.
- Resolved medium finding added at 01:21: changed-content report-trigger
  reopens keep local fail-open behavior when `unignoreReports()` fails, but no
  longer mark the post/comment report-trigger proof row verified.
- Regression added in `src/server/services/reportTriggers.test.ts` for forced
  comment `unignoreReports()` failure during a changed-report reopen.
- Resolved medium finding added at 01:24: unlock form submit no longer depends
  on a disabled `lockId` field being present in Devvit's submit payload. The
  server consumes the Redis form binding and only rejects a submitted lock id
  when it is present and mismatched.
- Regression added in `src/routes/forms.test.ts` for an unlock submission with
  `subreddit` and `formToken` but no submitted `lockId`.
- Focused validation:
  - `npm run test -- src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts src/routes/forms.test.ts --reporter verbose`
    PASS, 3 files / 64 tests.
  - `npm run type-check` PASS.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 41 files / 328 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.
  - Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
    proof checklists; no production UI copy match was found.

## 2026-05-26 01:25 IST - Finding

- Severity: medium
- Area: Endpoint-kind target extraction accepts already-prefixed IDs for the wrong thing kind.
- Evidence:
  - `normalizeTargetId(kind, id)` returns any `t1_` or `t3_` id unchanged without checking that it matches the requested endpoint kind: `src/server/services/targetResolver.ts:27-36`.
  - Comment update routes prefer `commentId` and `comment.id`, but then fall back to generic `targetId`; if that fallback is `t3_parent_post`, `normalizeTargetId('comment', 't3_parent_post')` still returns the post id: `src/routes/triggers.update.ts:62-72`.
  - `handleUpdateTrigger()` derives `commentUpdateTrigger` solely from the route's `triggerKind`, not from the resolved target kind: `src/server/services/updateTriggers.ts:34-55`.
  - `recordUpdateTriggerProcessed()` writes the supplied capability name as `verified` without checking target kind: `src/server/services/reopenFlow.ts:92-115`.
  - Existing route tests prove comment routes prefer `commentId` when present, but there is no regression that a comment endpoint with only a prefixed post `targetId` is rejected instead of processing a post lock: `src/routes/triggers.update.test.ts:386-417`.
- Why it matters: a malformed or partial comment-trigger payload can make the comment endpoint operate on a post target. In the update path that can also mark `commentUpdateTrigger` verified for work done on a post, which undermines the granular runtime-proof boundary around still-sensitive comment proof. The same normalization helper is used by report and menu routes, so rejecting wrong-kind prefixed ids at the boundary is safer than relying on every caller to re-check.
- Suggested fix: make `normalizeTargetId()` return `undefined` when an already-prefixed id contradicts the supplied `kind`, or add a stricter `normalizeTargetIdForEndpoint()` for routes. Add regressions for `/on-comment-update`, `/on-comment-report`, `/lock-comment`, and `/unlock-comment` with only `targetId: 't3_parent_post'`, expecting a neutral/400 target-id error and no moderation or runtime-proof writes.
- Files reviewed: `src/server/services/targetResolver.ts`, `src/routes/triggers.update.ts`, `src/server/services/updateTriggers.ts`, `src/server/services/reopenFlow.ts`, `src/routes/triggers.update.test.ts`.

## 2026-05-26 01:30 IST - Integration Status

- Resolved medium finding added at 01:25: shared target id normalization now
  rejects already-prefixed ids when their thing kind contradicts the endpoint
  kind.
- Comment-specific fields still win when present, so mixed payloads with
  `commentId` or `comment.id` continue to process the comment target.
- Regressions added:
  - `src/server/services/targetResolver.test.ts` rejects `normalizeTargetId('comment', 't3_post')`
    and `normalizeTargetId('post', 't1_comment')`.
  - `src/routes/triggers.update.test.ts` rejects `/on-comment-update` when
    only `targetId: 't3_parent_post'` is supplied.
  - `src/routes/triggers.report.test.ts` rejects `/on-comment-report` when
    only `targetId: 't3_parent_post'` is supplied.
  - `src/routes/menu.test.ts` rejects `/lock-comment` and `/unlock-comment`
    when only a post `targetId` is supplied.
- Focused validation:
  - `npm run test -- src/server/services/targetResolver.test.ts src/routes/triggers.update.test.ts src/routes/triggers.report.test.ts src/routes/menu.test.ts --reporter verbose`
    PASS, 4 files / 51 tests.
  - `npm run type-check` PASS.
- Full validation:
  - `npm run type-check` PASS.
  - `npm run lint` PASS.
  - `npm run test` PASS, 41 files / 333 tests.
  - `npm run build` PASS.
  - `git diff --check` PASS.
  - `rg -n "TODO" src` returned no source TODOs.
  - Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
    proof checklists; no production UI copy match was found.

## 2026-05-26 12:59 IST - Finding

- Severity: high
- Area: Runtime-uncertain reopens can clear the active lock without ever returning Reddit reports to normal handling.
- Evidence:
  - When a report trigger cannot resolve a known locked target, it enqueues a `runtime_uncertain` reopen and marks the lock reopened without calling `unignoreReports()`: `src/server/services/reportTriggers.ts:207-248`.
  - The update-trigger path has the same shape: if `resolution.target` is missing, `unignoreResult` is `undefined`, but the code still enqueues a reopen and removes active indexes through `markLockReopenedAfterQueue()`: `src/server/services/reopenFlow.ts:147-182`.
  - The audit records `unignoreReportsOk: false` for this state, but the active lock is already gone: `src/server/services/reportTriggers.ts:226-238`, `src/server/services/reopenFlow.ts:189-203`.
  - Recovery actions only operate on active locks by resolving the target and then calling `getActiveLockByTarget()`; if no active lock remains, unlock returns "No active ReviewLock lock was found": `src/server/services/unlockFlow.ts:40-69`, `src/routes/api.dashboard.ts:342-388`, `src/routes/menu.ts:227-258`.
  - Current regressions assert that the active lock disappears on target-refetch failure, but they do not assert any later recovery path can retry `unignoreReports()`: `src/server/services/reportTriggers.test.ts:313-342`, `src/server/services/reopenFlow.test.ts:199-238`.
- Why it matters: ReviewLock's safety story depends on reopened content returning to moderator attention and reports no longer being suppressed. If the target refetch fails transiently, ReviewLock can remove its own active lock while Reddit may still have reports ignored from the original lock. The dashboard then shows a reopened item, but the normal unlock path cannot find an active lock to retry `unignoreReports()`, so moderators may not have a ReviewLock-controlled way to restore report handling.
- Suggested fix: keep target-resolution failures in a retryable state until `unignoreReports()` succeeds, or add an explicit reopen-queue recovery action that refetches the target by `event.targetId`, retries `unignoreReports()`, records runtime proof, and only then allows dismissal. Add regressions proving report/update refetch failure does not strand a Reddit-side ignored target with no active-lock or reopen-queue recovery path.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/unlockFlow.ts`, `src/routes/api.dashboard.ts`, `src/routes/menu.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/reopenFlow.test.ts`.

## 2026-05-26 13:04 IST - Finding

- Severity: high
- Area: Honorable-mention submission and launch hardening work order.
- Evidence:
  - Devpost rules require a Reddit Developer Platform project, text description, Reddit usernames, app listing link, and project-impact communities; the optional demo video must be under 1 minute and show the app functioning on the intended device: `https://mod-tools-migration.devpost.com/rules`.
  - Devpost judging gives equal weight to Community Impact, Polish, Reliable UX, and New Mod Tool Ecosystem Impact for this project category: `https://mod-tools-migration.devpost.com/rules`.
  - Devvit Rules say moderation apps should be transparent, locally/sandbox tested, provide detailed app descriptions, and give mods safe/responsible usage instructions: `https://developers.reddit.com/docs/devvit_rules`.
  - Devvit launch FAQ says `npx devvit upload` creates a private uploaded build, `npx devvit publish` is the launch-review step, public App Directory distribution uses `npx devvit publish --public`, and publish-readiness depends on stable mobile/web behavior, multiple-account testing, and an installer-friendly README: `https://developers.reddit.com/docs/guides/faq`.
  - Current `README.md` is still a 17-line development stub and does not explain the moderator problem, install/use flow, proof boundary, impact model, safety posture, or demo loop: `README.md:1-17`.
  - Current tracker still has Wave 33, Wave 34, Wave 14, screenshots, and comment-target proof open: `TODO.md:36-58`.
  - Current limitations still honestly mark `CommentReport`, post NSFW/spoiler/flair triggers, and comment-target moderation methods as unverified: `docs/KNOWN_LIMITATIONS.md:7-25`, `docs/KNOWN_LIMITATIONS.md:43-53`.
  - `devvit.json` already provides the app name, moderator menu actions, trigger endpoints, Reddit permission, Redis permission, and default playtest subreddit needed for an app listing and publish rehearsal: `devvit.json:1-99`.
- Why it matters: The project is now strong enough that the limiting factor for a Best New Mod Tool honorable mention is no longer raw implementation breadth alone; it is whether judges can immediately see a launch-ready Devvit mod tool with a crisp safety boundary, a real time-savings story, a verified demo loop, and an installable app listing. The current README/submission package is too thin to carry that story, and publishing without first fixing the open high runtime-safety finding risks failing the Reliable UX criterion.
- Suggested fix:
  - First, close the open high runtime-safety finding above: runtime-uncertain report/update reopens must not strand a Reddit-side ignored target with no retry path to `unignoreReports()`. Add focused regressions, then run at least `npm run type-check`, targeted tests, and the full final gate before launch packaging.
  - Then execute a submission-hardening wave with these deliverables:
    - Rewrite `README.md` as the installer/judge landing page: problem, solution, "Lock reviewed content until it changes", exact mod workflow, install/playtest instructions, dashboard screenshots, proof matrix, safety/privacy boundaries, known limitations, and validation commands. Keep unverified paths clearly labeled.
    - Add a single `SUBMISSION.md` or `docs/DEVPOST_SUBMISSION.md` containing final Devpost-ready copy for: app listing link placeholder, Reddit usernames placeholder, tool overview, project impact, 1-3 target community types, time-savings model, demo-video script, proof summary, and optional feedback/helper sections.
    - Add a concise `docs/APP_LISTING.md` for the developer.reddit.com app listing: app name, short tagline, long description, safe usage instructions for moderators, data stored, permissions used, support/contact route, and current proof limitations.
    - Add `docs/LAUNCH_CHECKLIST.md` with exact commands and required evidence: `npx devvit whoami`, `npm run type-check`, `npm run lint`, `npm run test`, `npm run build`, controlled playtest smoke, `devvit logs`, `npx devvit upload`, app listing URL capture, and only then `npx devvit publish` or `npx devvit publish --public` if the owner intentionally wants launch review/public listing before submission.
    - Capture or list required screenshots only after the runtime-safety fix and final demo state: lock form, active lock dashboard, reports suppressed metric, reopened-after-edit queue, runtime proof panel, demo-mode banner.
    - Produce a sub-60-second demo script with three visible beats: lock reviewed content, repeat report suppressed on unchanged content, edit breaks lock and reopens. Do not spend time on generic product narration.
  - Honorable-mention optimization scorecard for the main agent to target:
    - Community Impact: current about 7.5/10, ceiling 8.5/10. Improve by naming concrete community types and adding a conservative time-savings model, e.g. repeated reports per week converted into exception-only reopens.
    - Polish: current about 6.5/10 because the app is strong but the README/submission package is missing. Ceiling 9/10 with the judge landing README, app listing copy, screenshots, and tight demo.
    - Reliable UX: current about 7.5/10, ceiling 8.5/10 after the open high runtime-safety finding is fixed, final validation passes, and install/use instructions are explicit.
    - Ecosystem Impact: current about 7.5/10, ceiling 8.5/10 if the copy repeatedly frames ReviewLock as an integrity-bound review ledger, not an `ignoreReports()` wrapper.
  - Final submission protocol:
    - No public claim may exceed `docs/RUNTIME_PROOF.md` and `docs/KNOWN_LIMITATIONS.md`.
    - Use "implemented and locally tested" for unverified trigger variants.
    - Use "verified" only for controlled live paths already documented.
    - Do not say "not reportable", "disable reports", "reports disabled", "unreportable", "permanent", or "forever" except in explicit guardrail/limitation text.
    - Treat the app listing link from upload as required for Devpost; treat public publish/App Directory approval as desirable if time allows but not guaranteed before the May 28, 2026 06:30 IST deadline.
- Files reviewed: `README.md`, `TODO.md`, `docs/KNOWN_LIMITATIONS.md`, `devvit.json`, Devpost rules, Devvit Rules, Devvit launch FAQ.

## 2026-05-26 13:06 IST - Finding

- Severity: high
- Area: Runtime-uncertain recovery hardening is currently partial and failing focused validation.
- Evidence:
  - Dirty in-progress `src/server/services/reportTriggers.ts` now keeps the active lock on report refetch failure and writes a `runtime_failure` audit instead of queueing a `runtime_uncertain` reopen, which addresses the report side of the 12:59 finding directionally.
  - Focused validation currently fails: `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose` exits 1.
  - The failing report-trigger regressions still expect the old unsafe behavior: `getActiveLockByTarget(..., 't3_post')` should be `undefined` and `result.reopenEvent` should exist after target refetch failure, but the dirty implementation now leaves the active lock in place: `src/server/services/reportTriggers.test.ts:331`, `src/server/services/reportTriggers.test.ts:817`.
  - The update-trigger service still has the original unsafe shape: when `resolution.target` is missing, `unignoreResult` is `undefined`, but `breakLockForChangedContent()` still builds a `runtime_uncertain` reopen event, enqueues it, and removes active indexes through `markLockReopenedAfterQueue()`: `src/server/services/reopenFlow.ts:142-180`.
  - The update-trigger refetch-failure regression still asserts the active lock disappears and a `runtime_uncertain` reopen is queued: `src/server/services/reopenFlow.test.ts:199-238`.
- Why it matters: The report-trigger half of the high safety fix is not yet test-aligned, and the update-trigger half still permits the stranded-state risk. Shipping submission docs or publishing before this is closed would leave the Reliable UX/safety story weaker than the public copy will need to claim.
- Suggested fix: Finish the high finding as a two-path change. For report triggers, update the two affected tests to assert the lock remains active, runtime warning is stored, no reopen queue item is created, dedupe is cleared, and a `runtime_failure` audit records `active_lock_retry_required`. For update triggers, mirror the same recovery behavior when target resolution is uncertain: keep the active lock retryable with `target_resolution_failed`, avoid queueing a reopen until `unignoreReports()` can be attempted or succeeds, write a runtime-failure audit, keep granular update-trigger proof unverified, and add focused regressions for both missing target and thrown refetch. Re-run the focused command above before moving to submission hardening.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/reopenFlow.test.ts`.

## 2026-05-26 13:09 IST - Finding

- Severity: medium
- Area: Launch checklist should distinguish existing app listing from final upload/public publish.
- Evidence:
  - Prior install/deploy rehearsal already confirmed the signed-in Devvit account, registered app slug `reviewlock`, app id, owner `BrightyBrainiac`, and latest uploaded version `0.0.2`: `docs/INSTALL_DEPLOY_REHEARSAL.md:9-40`.
  - The same rehearsal captured the app listing URL from `npx devvit upload`: `https://developers.reddit.com/apps/reviewlock`: `docs/INSTALL_DEPLOY_REHEARSAL.md:78-97`.
  - Controlled install to `r/reviewlock_dev` was already proven for that uploaded version: `docs/INSTALL_DEPLOY_REHEARSAL.md:99-112`.
  - Product/release audit intentionally blocks one-command public publish and keeps `npm run deploy` as the private upload path: `docs/PRODUCTION_TRUST_AUDIT.md:23-37`, `decisions.md:320-328`, `package.json:14-16`.
  - Production trust audit still says public publish must wait until live proof and claim boundaries are resolved: `docs/PRODUCTION_TRUST_AUDIT.md:52-70`.
- Why it matters: Devpost requires an app listing link, and ReviewLock already has one. The remaining launch work should not create a new Devvit app or conflate `upload` with public App Directory approval. The correct path is to preserve the existing app identity, fix the high runtime-safety issue, run final validation, upload a final version to refresh the existing listing, and only run `devvit publish`/`devvit publish --public` if the owner intentionally accepts launch review timing and remaining proof boundaries.
- Suggested fix: In `docs/LAUNCH_CHECKLIST.md` and Devpost copy, use `https://developers.reddit.com/apps/reviewlock` as the app listing link, record the final uploaded version after the last `npm run deploy`/`npx devvit upload`, and keep public publish as an explicit owner-approved step after final claim-boundary review. Include a "do not run `devvit init --force`" note so the registered app identity from D016 is preserved.
- Files reviewed: `docs/INSTALL_DEPLOY_REHEARSAL.md`, `docs/PRODUCTION_TRUST_AUDIT.md`, `decisions.md`, `package.json`.

## 2026-05-26 13:08 IST - Finding

- Severity: high
- Area: Runtime-uncertain recovery implementation now covers report and update paths, but focused tests are still red.
- Evidence:
  - Dirty `src/server/services/reportTriggers.ts` keeps the active lock on report refetch failure, appends `target_resolution_failed`, writes a `runtime_failure` audit with `active_lock_retry_required`, and clears report dedupe.
  - Dirty `src/server/services/reopenFlow.ts` now has the matching update-trigger shape: `comparison === 'uncertain'` updates the active lock with `target_resolution_failed`, writes a `runtime_failure` audit, and returns `ok: false, action: 'runtime_uncertain'` without queueing a reopen or removing active indexes.
  - Focused validation still fails: `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose` exits 1 with 4 failed tests.
  - Failing tests are stale relative to the intended safer behavior: `src/server/services/reopenFlow.test.ts:207` still expects a `runtime_uncertain` reopen event, `src/server/services/reopenFlow.test.ts:227` still expects `ok: true`, `src/server/services/reportTriggers.test.ts:331` still expects no active lock, and `src/server/services/reportTriggers.test.ts:817` still expects `result.reopenEvent`.
- Why it matters: The implementation direction now matches the high safety finding, but until tests assert the new contract, the project has no regression proof that runtime-uncertain report/update deliveries remain retryable and do not strand Reddit-side ignored targets.
- Suggested fix: Update the four stale tests to assert the new contract: result is `ok: false`, action is `runtime_uncertain`, active lock remains present with deduped `target_resolution_failed`, no reopen queue event is created, report dedupe is cleared for retries where applicable, runtime proof rows remain unverified, and a `runtime_failure` audit records `recovery: active_lock_retry_required`. Then run the same focused command; only after it passes should the main agent run `npm run type-check`, `npm run lint`, `npm run test`, and `npm run build`.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`, `src/server/services/reopenFlow.ts`, `src/server/services/reopenFlow.test.ts`.

## 2026-05-26 13:09 IST - Integration Status

- Update-trigger runtime-uncertain tests have been aligned with the safer active-lock retry contract.
- Focused validation still fails only on the report-trigger side:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
    exits 1 with 2 failing tests.
  - Remaining stale assertions are in `src/server/services/reportTriggers.test.ts:331`
    and `src/server/services/reportTriggers.test.ts:817`.
- The remaining expected test updates are the report-trigger equivalents of the
  now-passing update-trigger tests: assert active lock remains retryable, no
  reopen event is queued, runtime failure audit is written, report dedupe is
  cleared, and runtime proof remains unverified.

## 2026-05-26 13:10 IST - Integration Status

- The high runtime-uncertain recovery fix is now focused-test green.
- Report and update refetch-failure paths both keep the active lock retryable
  instead of queueing a `runtime_uncertain` reopen before `unignoreReports()`
  can run.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
    PASS, 2 files / 48 tests.
- Remaining gate before submission hardening: main agent should still run the
  full final app gate (`npm run type-check`, `npm run lint`, `npm run test`,
  `npm run build`) after finishing any cleanup, then proceed to README,
  Devpost, app-listing, launch-checklist, and screenshot/demo-script work.

## 2026-05-26 13:12 IST - Finding

- Severity: high
- Area: Runtime-uncertain recovery fix is focused-test green but currently fails type-check.
- Evidence:
  - `npm run lint` PASS.
  - `npm run type-check` FAILS with `src/server/services/reopenFlow.ts(204,78): error TS2345: Argument of type 'ReviewLockTarget | undefined' is not assignable to parameter of type 'ReviewLockTarget'.`
  - The failing line passes `resolution.target` to `unignoreReportsForReviewLock()` after the `comparison === 'uncertain'` and `comparison === 'unchanged'` branches: `src/server/services/reopenFlow.ts:203-212`.
  - Runtime tests pass because the branch is logically reachable only for changed content with a target, but TypeScript does not infer that `resolution.target` is defined from the `comparison` discriminant.
- Why it matters: The high runtime-safety behavior is now covered by focused tests, but the app cannot proceed to final gate, upload, or submission hardening while type-check is red.
- Suggested fix: After the `comparison === 'unchanged'` return, introduce a narrowed local target before moderation operations, for example `const target = resolution.target; if (!target) { ...runtime_uncertain retryable fallback... }`, then use `target` for `unignoreReportsForReviewLock()` and `buildReopenEvent()`. Keep the fallback behavior identical to the new runtime-uncertain active-lock retry contract. Re-run `npm run type-check`, then the focused report/update suite.
- Files reviewed: `src/server/services/reopenFlow.ts`.

## 2026-05-26 13:12 IST - Integration Status

- Route-level report/update trigger tests are aligned with the new retryable
  runtime-uncertain contract.
- Focused route validation:
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
    PASS, 2 files / 39 tests.
- Current blocker remains the TypeScript narrowing failure in
  `src/server/services/reopenFlow.ts:204`; `npm run type-check` is still the
  next gate to re-run after the main agent narrows `resolution.target`.

## 2026-05-26 13:12 IST - Finding

- Severity: high
- Area: New report refetch-failure branch can leave retryable deliveries deduped if audit writing fails.
- Evidence:
  - The new locked-target report refetch-failure branch updates the active lock warning, writes a `runtime_failure` audit, then clears the report dedupe marker: `src/server/services/reportTriggers.ts:195-220`.
  - The outer catch returns `runtime_uncertain` with `redis_write_failed` on any thrown Redis/audit error, but this branch does not clear the dedupe marker in a `finally` or before the audit write: `src/server/services/reportTriggers.ts:491-505`.
  - Existing tests cover the happy retryable branch and older audit-failure branches, but there is no regression that forces `appendAuditEvent()` to fail in the target-refetch-failure branch and asserts the same event id can retry: `src/server/services/reportTriggers.test.ts:313-339`, `src/server/services/reportTriggers.test.ts:799-831`, `src/server/services/reportTriggers.test.ts:623-700`.
- Why it matters: This path is explicitly supposed to be retryable. If Redis accepts the dedupe marker and active-lock warning update but fails the audit write, a repeated Devvit delivery with the same report event id can be treated as `duplicate`, leaving moderators with a warning but no durable runtime-failure audit and no real retry of the unresolved report event.
- Suggested fix: In the locked-target refetch-failure branch, clear the dedupe marker in a `try`/`catch`/`finally` on all `runtime_uncertain` exits after the marker is created, including audit-write failure. Add a regression that injects an audit write failure for this branch, asserts the handler returns `runtime_uncertain`, asserts the dedupe key is absent, and then retries the same event id successfully into the active-lock retryable warning/audit path.
- Files reviewed: `src/server/services/reportTriggers.ts`, `src/server/services/reportTriggers.test.ts`.

## 2026-05-26 13:15 IST - Integration Status

- Dirty audit timeline UI changes in `src/client/components/AuditTimeline.ts`
  and `src/client/styles.css` pass the focused render coverage.
- Focused validation:
  - `npm run test -- src/client/render.test.ts --reporter verbose`
    PASS, 1 file / 17 tests.
- This does not replace browser/mobile screenshot validation before final
  submission screenshots; it only verifies the rendered HTML helpers and
  escaping expectations.

## 2026-05-26 13:16 IST - Integration Status

- The runtime-uncertain recovery hardening now passes the local app gate.
- Validation:
  - `npm run type-check` PASS.
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
    PASS, 2 files / 48 tests.
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
    PASS, 2 files / 39 tests.
  - `npm run test -- src/client/render.test.ts --reporter verbose`
    PASS, 1 file / 17 tests.
  - `npm run lint` PASS.
  - `npm run test` PASS, 43 files / 375 tests.
  - `npm run build` PASS.
- Remaining reviewer caveat: the high finding about clearing report dedupe if
  the new runtime-failure audit write fails still appears open; I did not see a
  dedicated regression for audit failure in the locked-target refetch-failure
  branch.

## 2026-05-26 13:19 IST - Recheck

- Area: Report-trigger runtime-uncertain dedupe cleanup after audit failure.
- Result: Implementation appears directionally resolved, but regression proof is
  still missing.
- Evidence:
  - The report-trigger catch path now calls `clearDedupe(...)` for non-concurrency
    errors before returning `runtime_uncertain`: `src/server/services/reportTriggers.ts`.
  - The locked-target refetch-failure branch still writes the active-lock warning
    and `runtime_failure` audit before its local `clearDedupe(...)` call.
  - Existing tests prove normal refetch-failure retryability and other audit
    failure rollback paths, but I still did not find a test that forces the
    `audit-report-runtime-active` write to fail and then retries the same event id.
- Why it matters: This is now a proof gap more than an obvious production bug,
  because the outer catch should clear the marker. A focused regression is still
  worth adding before final upload because retryability under transient Redis
  failure is part of the Reliable UX story.

## 2026-05-26 13:25 IST - Integration Status

- The report-trigger runtime-uncertain dedupe proof gap is closed.
- Added regression:
  `clears report dedupe when retryable target resolution audit persistence fails`.
- The regression forces `audit-report-runtime-active` persistence to fail,
  verifies the report dedupe key is removed, keeps the active lock retryable
  with `target_resolution_failed`, then retries the same event id after target
  refetch recovers and reaches `suppress_unchanged`.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
    PASS, 1 file / 34 tests.
- Also updated `docs/TRIGGER_PROOF.md` so runtime-uncertain target-refetch
  failures document the current safer behavior: keep active locks retryable with
  a runtime-failure audit and no reopen queue item until current content can be
  loaded and `unignoreReports()` can be attempted.
- Suggested fix: Add a targeted report-trigger test where `appendAuditEvent()`
  fails for the locked-target refetch-failure branch, assert the result is
  `runtime_uncertain`, assert `reviewlock:alpha:report:dedupe:<event>` is absent,
  then retry the same `eventId` with the audit write restored and assert the
  active lock stays retryable with a `runtime_failure` audit.

## 2026-05-26 13:19 IST - Honorable Mention Execution Packet

- Severity: high
- Area: Final app hardening, submission hardening, and Devvit launch path.
- Current status:
  - The highest-risk runtime-uncertain active-lock safety issue is locally gate
    green after the main-agent patch.
  - `README.md` is still a 17-line development stub.
  - No submission artifacts exist yet: `SUBMISSION.md`,
    `docs/DEVPOST_SUBMISSION.md`, `docs/APP_LISTING.md`, and
    `docs/LAUNCH_CHECKLIST.md` are absent.
  - The app listing already exists and should be preserved:
    `https://developers.reddit.com/apps/reviewlock`.
- Work order for the main agent:
  1. Add the missing report-trigger audit-failure regression above, then rerun
     `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`.
  2. Run the final local gate after that regression:
     `npm run type-check`, `npm run lint`, `npm run test`, `npm run build`,
     and `git diff --check`.
  3. Rewrite `README.md` as the judge and installer landing page. It should
     contain the problem, the core promise, how the mod workflow works, what the
     dashboard shows, install/playtest instructions, validation commands, proof
     matrix, safety/privacy boundaries, and known limitations. The first screen
     of the README must make "Lock reviewed content until it changes" obvious.
  4. Add `docs/DEVPOST_SUBMISSION.md` with paste-ready fields for:
     app listing, Reddit usernames, tool overview, project impact, target
     community types, time-savings model, proof summary, screenshots needed,
     sub-60-second video script, optional feedback award, and helper nomination.
  5. Add `docs/APP_LISTING.md` with developer.reddit.com listing copy:
     short tagline, long description, moderator usage instructions, permissions,
     data stored, safety limits, support/contact note, and verified/unverified
     runtime boundaries.
  6. Add `docs/LAUNCH_CHECKLIST.md` with exact preflight and launch commands:
     `npx devvit whoami`, `npx devvit view --json`, final local gate,
     controlled playtest smoke, `npx devvit logs ...`, `npx devvit upload`,
     app listing URL capture, install confirmation, and optional owner-approved
     `npx devvit publish` / `npx devvit publish --public`.
  7. Capture final screenshots only after the docs and app-hardening regression
     land: lock form, active-lock dashboard, reports-suppressed metric,
     reopened-after-edit queue, runtime proof panel, and demo-mode banner.
  8. Run a copy guardrail scan before upload:
     `rg -n "not reportable|disable reports|reports disabled|unreportable|ignore reports wrapper|AI decides|automatic removal|remove automatically|report disabling|permanent|forever" README.md docs src package.json devvit.json`.
- Submission scoring target:
  - Community Impact: get to 8+ by naming 1-3 community types and quantifying
    repeat-report time savings conservatively.
  - Polish: get to 9 by making README, Devpost copy, app listing, launch
    checklist, screenshots, and demo script coherent and proof-bound.
  - Reliable UX: get to 8.5 by finishing the retryability regression, running
    the full gate, and making install/config/use instructions explicit.
  - Ecosystem Impact: get to 8.5 by framing ReviewLock as an integrity-bound
    review ledger, not as native `ignoreReports()` with a UI.
- Claim boundaries for all new copy:
  - May claim verified controlled post lock, post report suppression, post edit
    reopen, comment edit reopen, dashboard runtime smoke, and post-target
    moderation methods only as documented in `docs/RUNTIME_PROOF.md`.
  - Must label comment report, post NSFW/spoiler/flair triggers, and independent
    comment-target moderation methods as implemented/local-tested or unverified
    until controlled proof exists.
  - Must not describe ReviewLock as making content not reportable, disabling
    reports, blocking user reports, permanently suppressing reports, or making
    automated removals.

## 2026-05-26 13:24 IST - Finding

- Severity: medium
- Area: Trigger proof documentation is stale after retryable runtime-uncertain
  safety hardening.
- Evidence:
  - `docs/TRIGGER_PROOF.md:49` still says a report trigger that cannot load a
    target with a known active lock marks the lock `reopened`, removes the active
    target index, writes `reopenReason: runtime_uncertain`, and enqueues a
    `runtime_uncertain` reopen event.
  - `docs/TRIGGER_PROOF.md:130-134` still says missing target resolution with a
    known active lock reopens the lock so it cannot continue suppressing reports.
  - The current report-trigger code keeps the active lock in place, adds
    `target_resolution_failed`, writes a `runtime_failure` audit, clears report
    dedupe, and returns `runtime_uncertain` with no reopen event:
    `src/server/services/reportTriggers.ts:191-225`.
  - The current update-trigger reopen flow mirrors that safer behavior for
    target refetch uncertainty: `src/server/services/reopenFlow.ts:160-190`.
- Why it matters: `docs/TRIGGER_PROOF.md` is exactly the kind of proof-boundary
  source the final README and Devpost copy will cite. Leaving the old behavior
  there can cause the submission to either overclaim runtime-uncertain reopen
  behavior or document the unsafe state the code just removed, weakening the
  Reliable UX story.
- Suggested fix: Update `docs/TRIGGER_PROOF.md` after the main-agent safety patch
  settles. The report table and fail-open section should say target-refetch
  uncertainty keeps known active locks retryable with runtime warnings and a
  `runtime_failure` audit; no reopen queue event is created until ReviewLock can
  load current content and safely attempt `unignoreReports()`. Also update the
  test-evidence counts if the new focused regression is added.
- Files reviewed: `docs/TRIGGER_PROOF.md`,
  `src/server/services/reportTriggers.ts`, `src/server/services/reopenFlow.ts`.

## 2026-05-26 13:27 IST - Finding

- Severity: medium
- Area: Reopened items with unresolved runtime warnings can still be dismissed
  with no recovery step.
- Evidence:
  - Reopened events can carry `unignoreReports()` failure warnings after a
    changed-content reopen: `src/server/services/reopenFlow.ts:215-232` builds
    and queues the event with `unignoreResult.warnings`; the report-trigger path
    follows the same shape.
  - The dashboard now renders those warnings as `Needs attention`:
    `src/client/components/ReopenQueue.ts:22-32`,
    `src/client/components/ReopenQueue.ts:105-112`, and
    `src/client/components/ReopenQueue.ts:132-138`.
  - The same component still renders the normal dismiss confirmation for warned
    events; `renderDismissAction()` does not inspect `event.runtimeWarnings`:
    `src/client/components/ReopenQueue.ts:35-66`.
  - The dismiss API removes the reopen item after recording a dismissal audit and
    does not block or require a recovery action when `event.runtimeWarnings` is
    non-empty: `src/routes/api.dashboard.ts:435-489`.
- Why it matters: Rendering the warning is an improvement, but if
  `unignoreReports()` failed, dismissing the reopen item can remove the only
  moderator-facing task while Reddit may still be ignoring reports. That leaves
  the app relying on a human seeing and acting on a warning with no ReviewLock
  retry/recovery path, which is weaker than the safety story we want in the
  final submission.
- Suggested fix: Before final launch packaging, either block dismissals for
  reopen events with unresolved runtime warnings or add a dedicated recovery
  action that retries target refetch plus `unignoreReports()` and only allows
  dismissal once the warning is resolved. At minimum, strengthen the confirmation
  copy and server audit data for warned dismissals, and add a route/render
  regression that a warned reopen cannot be silently dismissed like a clean
  reopen.
- Files reviewed: `src/server/services/reopenFlow.ts`,
  `src/server/services/reportTriggers.ts`,
  `src/client/components/ReopenQueue.ts`, `src/routes/api.dashboard.ts`.

## 2026-05-26 13:31 IST - Integration Status

- The warning-bearing reopen dismissal finding is closed with the stricter
  option: block dismissal until runtime warnings are resolved.
- Client render change: warned reopen items render `Resolve warning first` and
  no `dismiss-reopen` / `confirm-dismiss-reopen` action.
- Dashboard API change: `/api/reopen-queue/dismiss` returns 409 and keeps the
  queue item visible when `event.runtimeWarnings` is non-empty.
- Devvit form change: `/internal/form/reopen-action-submit` returns a toast and
  keeps the queue item visible when `event.runtimeWarnings` is non-empty.
- Focused validation:
  - `npm run test -- src/client/render.test.ts src/routes/api.dashboard.test.ts src/routes/forms.test.ts --reporter verbose`
    PASS, 3 files / 54 tests.
  - `npm run type-check` PASS.

## 2026-05-26 13:31 IST - Finding

- Severity: medium
- Area: Runtime proof doc still describes the old report-refetch recovery
  behavior.
- Evidence:
  - `docs/RUNTIME_PROOF.md:208-211` says report-trigger target resolution
    failure was hardened by reopening known active locks as `runtime_uncertain`.
  - The current report-trigger code keeps the known active lock active, appends
    `target_resolution_failed`, writes a `runtime_failure` audit with
    `active_lock_retry_required`, clears dedupe, and returns no reopen event:
    `src/server/services/reportTriggers.ts:190-225`.
  - The current focused regression asserts exactly that retryable active-lock
    behavior and an empty reopen queue:
    `src/server/services/reportTriggers.test.ts:313-342`.
- Why it matters: `docs/RUNTIME_PROOF.md` is the primary claim-boundary source
  for README and Devpost copy. If it still says ReviewLock reopens known locks
  on target-refetch uncertainty, the final submission can end up citing a
  behavior that no longer exists and describing the safety model incorrectly.
- Suggested fix: Update the runtime failure/hardening bullet in
  `docs/RUNTIME_PROOF.md` to match the current contract: known active locks stay
  active and retryable with item-level runtime warnings until current content can
  be loaded and ReviewLock can safely attempt `unignoreReports()`. Cross-link
  the matching `docs/TRIGGER_PROOF.md` row once that doc is updated too.
- Files reviewed: `docs/RUNTIME_PROOF.md`,
  `src/server/services/reportTriggers.ts`,
  `src/server/services/reportTriggers.test.ts`.

## 2026-05-26 13:34 IST - Finding

- Severity: medium
- Area: Dashboard launch creates a new custom post every time instead of
  reusing an existing dashboard.
- Evidence:
  - The dashboard launch form tells moderators it will create a visible custom
    post and labels the action `Create dashboard post`:
    `src/routes/menu.ts:172-188`.
  - Every `/dashboard-launch-submit` call directly invokes
    `deps.reddit.submitDashboardPost(...)` and then navigates to that new
    permalink; there is no Redis lookup/write for an existing dashboard
    permalink or post id: `src/routes/forms.ts:239-275`.
  - The Reddit adapter maps that call to `submitCustomPost(...)`:
    `src/server/adapters/reddit.ts:163-175`.
  - The route test only proves one create-and-navigate call; it does not cover
    idempotent reopen behavior or duplicate launch prevention:
    `src/routes/forms.test.ts:318-333`.
- Why it matters: Devpost requires an app listing and judges will likely try the
  install/open flow more than once. Repeated `Open ReviewLock dashboard` clicks
  can create multiple visible dashboard posts in a subreddit, which is noisy for
  moderators and weakens the "close to publishable" installability story.
- Suggested fix: Store the dashboard custom-post permalink/id in the subreddit
  namespace after first creation and have subsequent dashboard launches navigate
  to the existing dashboard when it is available. If Devvit cannot reliably
  check whether the post still exists, keep a conservative "Create new dashboard
  post" fallback, but make the normal path idempotent. Add a regression where
  two `/dashboard-launch-submit` calls result in one `submitDashboardPost` call
  and the second response navigates to the stored permalink.
- Files reviewed: `src/routes/menu.ts`, `src/routes/forms.ts`,
  `src/server/adapters/reddit.ts`, `src/routes/forms.test.ts`.

## 2026-05-26 13:37 IST - Integration Status

- The missing report-trigger audit-failure regression from the 13:19 execution
  packet has been added and is focused-test green.
- Validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
    PASS, 1 file / 34 tests.
- The stale `docs/TRIGGER_PROOF.md` finding from 13:24 appears resolved in the
  current worktree: the report table and fail-open section now say known active
  locks stay active/retryable on target-refetch uncertainty.
- Still open from this reviewer pass:
  - `docs/RUNTIME_PROOF.md` still says report-refetch uncertainty reopens known
    active locks, so the primary claim-boundary doc still needs cleanup.
  - Reopened items with unresolved runtime warnings can still be dismissed with
    no recovery step.
  - Dashboard launch still creates a new custom post on every submit instead of
    reusing an existing dashboard.
  - Submission docs and README rewrite are still absent.

## 2026-05-26 13:39 IST - Finding

- Severity: medium
- Area: Successful retry after transient report-refetch failure leaves stale
  active-lock warning.
- Evidence:
  - The refetch-failure path adds `target_resolution_failed` to the active lock
    runtime warnings: `src/server/services/reportTriggers.ts:196-200`.
  - A later successful unchanged-content retry calls `incrementLockSuppression()`
    with the original lock object; that helper increments counters but preserves
    existing `runtimeWarnings`: `src/server/services/reportTriggers.ts:297-305`
    and `src/server/services/locks.ts:124-135`.
  - The new audit-failure retry regression verifies the retry succeeds but does
    not assert the warning is cleared after recovery:
    `src/server/services/reportTriggers.test.ts:871-891`.
  - Active locks render runtime warnings as `Needs attention`, so the stale
    warning remains moderator-visible: `src/client/components/LockTable.ts:84`.
- Why it matters: Keeping the lock active on target-refetch uncertainty is the
  right safety behavior, but once the exact same report delivery retries and
  successfully suppresses unchanged content, the recovery has completed. Leaving
  `target_resolution_failed` on the active lock can make the dashboard continue
  showing a resolved transient failure as an unresolved attention item, which
  weakens the proof/status story during final judging.
- Suggested fix: On a successful retry after target resolution recovers, remove
  resolved transient warnings such as `target_resolution_failed` from the active
  lock while preserving non-transient warnings like failed moderation operations.
  Add a regression where the first delivery records `target_resolution_failed`,
  the retry resolves the target and suppresses unchanged content, and the active
  lock no longer renders that warning.
- Files reviewed: `src/server/services/reportTriggers.ts`,
  `src/server/services/locks.ts`,
  `src/server/services/reportTriggers.test.ts`,
  `src/client/components/LockTable.ts`.

## 2026-05-26 13:29 IST - Finding

- Severity: medium
- Area: Successful update-trigger retry after transient refetch failure leaves
  stale active-lock warning.
- Evidence:
  - The update-trigger refetch-failure path adds `target_resolution_failed` to
    the active lock runtime warnings and returns without queueing a reopen:
    `src/server/services/reopenFlow.ts:160-191`.
  - When a later update delivery successfully refetches the target and finds the
    fingerprint unchanged, the unchanged branch returns without updating the
    lock or clearing resolved transient warnings:
    `src/server/services/reopenFlow.ts:194-200`.
  - Current update-trigger tests assert the warning is added on refetch failure,
    but do not retry with a recovered unchanged target and assert the warning is
    cleared: `src/server/services/reopenFlow.test.ts:199-258`.
  - Active locks render runtime warnings as `Needs attention`, so the stale
    warning remains moderator-visible in the dashboard.
- Why it matters: A transient Reddit refetch failure can become a permanent
  item-level warning even after the next update delivery proves the reviewed
  content is unchanged. That makes the dashboard status noisy and can confuse
  judges or moderators during the edit-break demo, because the app appears to
  need attention after the uncertainty has already recovered.
- Suggested fix: Clear resolved transient warnings such as
  `target_resolution_failed` when a later update-trigger delivery successfully
  resolves the target and returns `unchanged`. Preserve non-transient warnings
  such as failed moderation operations. Add a regression covering failure,
  recovered unchanged retry, and the final active lock warning list.
- Files reviewed: `src/server/services/reopenFlow.ts`,
  `src/server/services/reopenFlow.test.ts`,
  `src/client/components/LockTable.ts`.

## 2026-05-26 13:30 IST - Integration Status

- The reopened-item runtime-warning dismiss finding from 13:27 is resolved in
  the current dirty worktree.
- Implementation now blocks warned reopen dismissals in:
  - `src/client/components/ReopenQueue.ts`
  - `src/routes/api.dashboard.ts`
  - `src/routes/forms.ts`
- Regression coverage now includes:
  - Client render proof that warned reopened items show `Resolve warning first`
    and do not render dismiss action buttons.
  - Dashboard API proof that warned reopened items return 409, remain visible,
    and do not write a dismiss audit.
- Validation:
  - `npm run test -- src/client/render.test.ts src/routes/api.dashboard.test.ts src/routes/forms.test.ts --reporter verbose`
    PASS, 3 files / 53 tests.
- Still open from this reviewer pass:
  - `docs/RUNTIME_PROOF.md` still has stale report-refetch recovery wording.
  - Report/update successful retry paths can leave resolved
    `target_resolution_failed` warnings visible on active locks.
  - Dashboard launch still creates a new dashboard custom post on every submit.
  - Submission docs and README rewrite are still absent.

## 2026-05-26 13:32 IST - Honorable Mention Hardening Packet

- Severity: execution-critical
- Area: Final app hardening, Devvit publishing, and Devpost submission package.
- External requirement check:
  - Devpost rules list a May 27, 2026 6:00 PM PDT submission deadline and
    require a Reddit Developer Platform app, a text description explaining
    functionality, all participant Reddit usernames, the app listing link
    `developers.reddit.com/apps/{app-name}`, 1-3 impact communities, and
    working testing access through a Reddit post running the app.
  - Devpost says judging uses Community Impact, Polish, Reliable UX, and New
    Mod Tool Ecosystem Impact for this category; Moderator's Choice uses the
    same criteria.
  - Reddit's Devvit launch guide says launch-ready apps should be polished and
    stable, tested across mobile and web, tested from multiple permission
    roles where practical, have clear UX flows, and include a user-friendly
    `README.md` before `npx devvit publish`.
  - The same guide says public App Directory listing uses
    `npx devvit publish --public` and requires a detailed `README.md` with a
    comprehensive overview, installer-facing instructions, and changelogs.
- Current repo state:
  - App listing URL is already established by prior upload proof:
    `https://developers.reddit.com/apps/reviewlock`.
  - `README.md` is still a development stub and is not launch/listing grade.
  - No judge-facing single source exists yet for Devpost copy:
    `docs/DEVPOST_SUBMISSION.md`, `docs/APP_LISTING.md`,
    `docs/LAUNCH_CHECKLIST.md`, or root `SUBMISSION.md` are absent.
  - `docs/RUNTIME_PROOF.md` still contains stale wording that report-refetch
    uncertainty reopens active locks as `runtime_uncertain`; current code and
    `docs/TRIGGER_PROOF.md` instead keep active locks retryable with
    `target_resolution_failed`.
  - Dashboard launch still creates a new visible custom post on every launch
    submit, which is a publishability/installability risk.
  - Successful retry after transient report/update target-resolution failure
    can still leave stale `target_resolution_failed` warnings visible on active
    locks unless main implementation changes after this note.
- Honorable mention target rubric:
  - Community Impact: target 8/10. Submission must quantify repeat-report
    churn as a time-saving workflow, name 1-3 concrete community types, and
    avoid claiming universality.
  - Polish: target 8/10. README, Devpost story, app listing copy, screenshots,
    video script, proof matrix, and known limitations must all agree and avoid
    stale/runtime-unverified claims.
  - Reliable UX: target 8/10. Before docs polish, fix the duplicate dashboard
    launch behavior or explicitly downgrade it in known limitations; clear
    resolved transient warnings after successful retries; keep warning-bearing
    reopens non-dismissable as already implemented.
  - Ecosystem Impact: target 8/10. Frame ReviewLock as a Devvit-native
    reviewed-content ledger tied to content integrity, not an `ignoreReports`
    wrapper or generic modqueue.
- Required work order for the main agent:
  1. Close app-risk blockers first:
     - Update stale `docs/RUNTIME_PROOF.md` wording to match retryable active
       lock behavior.
     - Fix or consciously defer duplicate dashboard custom-post launch. The
       preferred fix is one dashboard post per subreddit, stored in Redis and
       reused on later launches, with a fallback create path if the stored
       post is unavailable.
     - Clear resolved `target_resolution_failed` warnings after successful
       report-trigger and update-trigger retries, preserving non-transient
       warnings.
  2. Run the full local gate after blocker fixes:
     - `npm run type-check`
     - `npm run lint`
     - `npm run test`
     - `npm run build`
     - `git diff --check`
     - copy guardrail scan for forbidden phrasing in production docs/UI.
  3. Rewrite `README.md` for App Directory review:
     - opening thesis: `Lock reviewed content until it changes.`
     - what moderators do: lock, suppress unchanged repeat reports, reopen on
       edits/material state changes, dismiss clean reopens, inspect audit and
       metrics.
     - install/setup: app listing URL, permissions, dashboard launch, demo
       mode, first lock workflow, expected configuration.
     - safety boundaries: no permanent report disabling, no AI judgment, no
       reporter identity storage, non-destructive reopen by default, runtime
       uncertainties fail open or stay visible.
     - verified/known limitations: mirror `docs/RUNTIME_PROOF.md` exactly.
     - changelog section suitable for public listing.
  4. Create `docs/DEVPOST_SUBMISSION.md` as paste-ready Devpost copy:
     - category: Best New Mod Tool.
     - app listing: `https://developers.reddit.com/apps/reviewlock`.
     - Reddit usernames: leave an obvious `TODO` slot if the final team list
       is not known.
     - tool overview with all capabilities.
     - project impact with 1-3 community examples.
     - time-savings model with conservative assumptions.
     - 45-60 second demo script matching the verified loop.
     - testing instructions and known limitations with no overclaims.
     - explicit `Not a ported project` note so port-only fields are not
       accidentally answered.
  5. Create `docs/APP_LISTING.md`:
     - short listing title/subtitle.
     - directory description.
     - permission explanation for Reddit + Redis.
     - moderator install/use steps.
     - support/limitations text.
     - screenshot captions.
  6. Create `docs/LAUNCH_CHECKLIST.md`:
     - pre-publish local gate.
     - screenshot/video capture checklist.
     - controlled public test post requirement.
     - `devvit upload` rehearsal.
     - final approval checkpoint before `npx devvit publish`.
     - public listing checkpoint before `npx devvit publish --public`.
     - post-submit freeze notes: no changing Devpost submission after deadline
       except allowed Devpost/sponsor correction cases.
  7. Capture final screenshots/video only after docs and blockers align:
     - lock form.
     - active lock dashboard.
     - reports suppressed metric/audit.
     - reopened-after-edit queue.
     - runtime proof/known limitation state if visible.
- Copy guardrails for every submission artifact:
  - Prefer: `Lock reviewed content until it changes`, `suppress repeat reports
    on unchanged reviewed content`, `reopened after edit`, `reports
    suppressed`, `review state tied to content integrity`.
  - Avoid: `not reportable`, `reports disabled`, `disable reports`,
    `unreportable`, `forever`, `permanent`, `AI decides`, or any wording that
    implies users cannot submit reports.
- Reviewer acceptance criteria:
  - A judge can read only `README.md` plus `docs/DEVPOST_SUBMISSION.md` and
    understand the problem, workflow, proof status, limitations, install path,
    and impact in under five minutes.
  - All runtime claims in README/Devpost/app listing are traceable to
    `docs/RUNTIME_PROOF.md`, `docs/TRIGGER_PROOF.md`, or focused local tests.
  - The app can be submitted as a new Devvit mod tool without relying on
    unpublished bug-fix promises.

## 2026-05-26 13:38 IST - Integration Status

- The stale `target_resolution_failed` warning findings are closed.
- Report-trigger retries now clear resolved target-refetch warnings after
  successful unchanged suppression while preserving non-transient warnings.
- Update-trigger retries now clear resolved target-refetch warnings after a
  successful unchanged fingerprint comparison.
- `docs/RUNTIME_PROOF.md` now matches `docs/TRIGGER_PROOF.md`: known active
  locks stay active/retryable on target-refetch uncertainty and no
  `runtime_uncertain` reopen is queued until current content can be loaded.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
    PASS, 2 files / 50 tests.
  - `npm run type-check` PASS.

## 2026-05-26 13:32 IST - Blocker Recheck

- Rechecked the current clean implementation state after the hardening packet.
- Still open:
  - `docs/RUNTIME_PROOF.md` still says report-trigger target-resolution
    failure was hardened by reopening active locks as `runtime_uncertain`.
  - `/internal/form/dashboard-launch-submit` still calls
    `submitDashboardPost(...)` on every submit with no stored dashboard lookup
    or reuse path.
  - Report/update trigger services still add `target_resolution_failed` to
    active locks, but no reviewed code path clears that warning after a later
    successful unchanged retry.
  - No submission artifacts exist outside the current stub `README.md`.
- Validation:
  - `git diff --check -- docs/REVIEW_AGENT_FINDINGS.md` PASS.
- Recommendation: Treat these as the final app-hardening lane before the main
  agent begins judge-facing copy. The submission docs should not be written
  around stale proof wording or known UX gaps that can still be closed today.

## 2026-05-26 13:35 IST - Finding

- Severity: medium
- Area: Moderator configuration is modeled but not surfaced or applied.
- Evidence:
  - `src/server/services/config.ts:18-27` defines default configurable
    `lockExpiryDays`, `demoModeEnabled`, and `reasonPresets`.
  - The config service supports loading, saving, and merging config records:
    `src/server/services/config.ts:29-57`.
  - Production code only uses `updateConfig()` for demo enable/disable paths:
    `src/server/services/demoMode.ts:100` and
    `src/server/services/demoMode.ts:135`; `rg` finds no production
    `loadConfig()` use outside the config service itself.
  - The lock form hardcodes the reason options instead of reading configured
    `reasonPresets`: `src/routes/menu.ts:92-104`.
  - The lock form does not render an expiry field; form submission only accepts
    an optional `expiresAt` if some caller supplies it:
    `src/routes/forms.ts:119-137`.
  - The dashboard UI has no settings/config panel or install-time setup affordance:
    `src/client/pages/DashboardPage.ts:81-127`.
- Why it matters: Devpost judges explicitly score Reliable UX, including
  install/configure ease. Right now ReviewLock has a credible config data model,
  but moderators cannot see or change it through the app, and normal lock
  creation does not apply the default expiry setting. That makes the project
  easier to critique as "no setup story" during App Directory/public listing
  review, even though the underlying pieces exist.
- Suggested fix: For the final hardening pass, either surface a minimal
  moderator settings panel or remove config claims from submission copy. The
  smallest useful product fix is a dashboard settings section showing lock
  expiry days and reason presets, plus using the loaded config to build the
  lock form options/default expiry. Add route/client tests proving the
  configured presets appear in the lock form and default expiry is applied to
  new locks. If time is too tight, document config as internal/demo-only and do
  not present it as a moderator-facing capability.
- Files reviewed: `src/server/services/config.ts`,
  `src/server/services/demoMode.ts`, `src/routes/menu.ts`,
  `src/routes/forms.ts`, `src/client/pages/DashboardPage.ts`.

## 2026-05-26 13:35 IST - Finding

- Severity: high
- Area: Devpost testing-access requirement is not yet captured as an artifact.
- Evidence:
  - `docs/INSTALL_DEPLOY_REHEARSAL.md:5-8` says the deployment rehearsal used
    the signed-in developer account and controlled test subreddit
    `r/reviewlock_dev`.
  - `docs/INSTALL_DEPLOY_REHEARSAL.md:78-97` records `npx devvit upload` only
    as a private upload and explicitly says no public publish occurred.
  - `docs/INSTALL_DEPLOY_REHEARSAL.md:125-141` records a playtest URL, not a
    judge-facing installed/public Reddit post URL.
  - `docs/PRODUCTION_TRUST_AUDIT.md:18` says the app can upload, install, and
    reach playtest, but public publish should wait until claim boundaries are
    resolved.
  - `rg -n "public subreddit|less than 200|200 members|testing access|judges.*test|judge.*testing|running your app" docs README.md TODO.md log.md`
    finds no current launch/submission checklist entry outside this review
    findings file.
- Why it matters: Devpost's rules require access to a working project for
  judging/testing by providing a Reddit post running the app in a public
  subreddit with fewer than 200 members. The current proof is valuable, but a
  playtest/private-upload URL is not the same artifact. If Wave 14 waits until
  the last hour to discover this, the project can be technically strong but
  operationally awkward to submit.
- Suggested fix: Add this to `docs/LAUNCH_CHECKLIST.md` and
  `docs/DEVPOST_SUBMISSION.md`: final public/test subreddit name, member-count
  check, installed app version, public Reddit post URL running ReviewLock,
  app listing URL, and exact commands used immediately before submission. If
  public publish/listing approval is still pending, state the approved fallback
  path clearly and do not present the playtest URL as the required judge access
  artifact unless Devpost/Reddit explicitly confirms it is acceptable.
- Files reviewed: `docs/INSTALL_DEPLOY_REHEARSAL.md`,
  `docs/PRODUCTION_TRUST_AUDIT.md`, `docs/RUNTIME_PROOF.md`, `TODO.md`,
  `log.md`, `README.md`.

## 2026-05-26 13:37 IST - Integration Status

- The stale `target_resolution_failed` warning findings from 13:39/13:29 are
  addressed in the current dirty implementation worktree.
- Implementation observed:
  - `src/server/services/reportTriggers.ts` now clears
    `target_resolution_failed` before successful unchanged suppression retries
    and changed-content reopen processing.
  - `src/server/services/reopenFlow.ts` now clears
    `target_resolution_failed` after a recovered unchanged update retry and
    before changed-content reopen processing.
  - `src/server/services/reportTriggers.test.ts` now asserts the active lock
    warning list is empty after a successful report-trigger retry.
  - `src/server/services/reopenFlow.test.ts` already contains a focused
    regression named `clears resolved target-resolution warnings after an
    unchanged update retry succeeds`.
- Validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
    PASS, 2 files / 50 tests.
- Still open after this integration check:
  - `docs/RUNTIME_PROOF.md` stale `runtime_uncertain` reopen wording.
  - Duplicate dashboard custom-post launch behavior.
  - Submission docs/README/app listing/launch checklist/testing-access
    artifacts.
  - Moderator configuration remains modeled but not surfaced/applied.

## 2026-05-26 13:39 IST - Finding

- Severity: low
- Area: Stale TODO wording still describes the old refetch-failure behavior.
- Evidence:
  - `TODO.md:74` still has a checked item saying
    `Reopen known active locks when report-trigger target resolution is uncertain.`
  - Current product/runtime decision `D133` says the opposite: known active
    locks stay active and retryable with `target_resolution_failed`, and no
    reopen event is queued until ReviewLock can load current content and safely
    attempt report restoration.
  - `docs/RUNTIME_PROOF.md:208-219` has now been corrected to the active-lock
    retry behavior, and `TODO.md:181` / `TODO.md:185` also describe the newer
    retry/clear behavior.
- Why it matters: `TODO.md` is one of the first files agents are instructed to
  read. During submission hardening, stale checked tracker language can lead to
  README/Devpost copy or follow-up docs saying ReviewLock reopens locks on
  target-refetch uncertainty, which is no longer the implemented safety
  behavior.
- Suggested fix: Rename the historical checked item to match the current
  behavior, for example `Keep known active locks retryable when report-trigger
  target resolution is uncertain`, or add an indented note that D133 superseded
  the earlier reopen wording.
- Files reviewed: `TODO.md`, `decisions.md`, `docs/RUNTIME_PROOF.md`,
  `docs/TRIGGER_PROOF.md`.
