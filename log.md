# log.md

## 2026-05-23 - Planning pass

- Created ReviewLock planning structure in an empty Git-linked directory.
- Confirmed local Codex skill format from `skill-creator`.
- Confirmed Devvit primitives from official docs and ModMirror local typings.
- Locked product thesis around edit-aware reviewed-content locks.
- Created 14-wave execution plan with isolated ownership.

## 2026-05-24 - Wave 01

- Created the ReviewLock Devvit Web TypeScript scaffold, baseline build/lint/test config, Devvit manifest, Hono route shells, minimal client shell, README, and repository hygiene files.
- Verified installed package versions and relevant Devvit trigger/moderation typings in `RESEARCH.md`.
- Commands run:
  - `npm view devvit version`
  - `npm view @devvit/web version`
  - `npm view @devvit/start version`
  - `npm install`
  - `node -p "require('./node_modules/devvit/package.json').version"`
  - `node -p "require('./node_modules/@devvit/web/package.json').version"`
  - `rg -n "onPostReport|onCommentReport|onPostUpdate|onCommentUpdate|onPostNsfwUpdate|onPostSpoilerUpdate|onPostFlairUpdate" node_modules/@devvit -g '*.d.ts'`
  - `rg -n "ignoreReports\\(|unignoreReports\\(|approve\\(" node_modules/@devvit -g '*.d.ts'`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `python3 /Users/arshdeepsingh/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/reviewlock-wave-execution`
- Pass/fail status: PASS after replacing the unsupported Vite config array with the project-native `prebuild` server build plus `build` client build.
- Open risks:
  - Runtime Devvit behavior is unverified until Wave 13.
  - `npm install` reported transitive vulnerabilities in installed packages; no production runtime claim is made from this wave.

## 2026-05-24 - Wave 02

- Defined shared ReviewLock constants, unions, interfaces, validators, and deterministic demo scenario data.
- Added server fixture exports and tests for validators, fixture counts, post/comment coverage, suppression counts, and the four-beat demo story.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/shared/schema.test.ts src/server/fixtures/demoScenario.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Demo data is static seed data only; live dashboard aggregation and demo seeding are owned by later waves.

## 2026-05-24 - Wave 03

- Implemented deterministic text normalization, SHA-256 content fingerprinting, fingerprint comparison, and content-change classification.
- Added tests for whitespace normalization, stable hashes, post/comment edits, flair/NSFW/spoiler reopen reasons, and fail-open missing content behavior.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/server/services/fingerprint.test.ts src/server/services/contentChange.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Fingerprints are local pure-service proof only; trigger/runtime refetch behavior is owned by later waves.

## 2026-05-24 - Wave 04

- Implemented a narrow Redis adapter, in-memory fake, namespaced key helper, lock indexes, reopen queue, audit log, metrics, and config persistence.
- Added tests for key names, namespace isolation, missing keys/defaults, list ordering, index removal, and metrics increments.
- Commands run:
  - `rg -n "interface RedisClient|class RedisClient|zAdd|zRange|hincrby|multi\\(" node_modules/@devvit -g '*Redis*.d.ts' -g '*.d.ts' | head -80`
  - `npm run type-check`
  - `npm run test -- --run src/server/adapters/redis.test.ts src/server/services/keys.test.ts src/server/services/locks.test.ts src/server/services/reopenQueue.test.ts src/server/services/audit.test.ts src/server/services/metrics.test.ts src/server/services/config.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Devvit Redis runtime behavior is adapter-compatible by typing only; live storage behavior is unverified until Wave 13.

## 2026-05-24 - Wave 05

- Implemented Reddit adapter interfaces, Devvit/fake adapter implementations, target mapping/resolution, structured moderation operations, clock adapters, and persisted runtime capability status.
- Added tests for post/comment id inference, target resolution errors, adapter mapping, structured moderation failure results, and runtime proof transitions.
- Commands run:
  - `rg -n "getPostById|getCommentById|getCurrentUsername|ignoreReports\\(|unignoreReports\\(|approve\\(" node_modules/@devvit -g '*.d.ts' | head -100`
  - `rg -n "export .*Context|interface .*Context|reddit" node_modules/@devvit/web -g '*.d.ts' | head -80`
  - `npm run type-check`
  - `npm run test -- --run src/server/adapters/reddit.test.ts src/server/adapters/clock.test.ts src/server/services/targetResolver.test.ts src/server/services/moderation.test.ts src/server/services/runtimeProof.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Reddit approve/ignore/unignore behavior is isolated and typing-verified, but not live verified until Wave 13.

## 2026-05-24 - Wave 06

- Implemented lock/unlock menu form construction, form submission routes, lock orchestration, unlock orchestration, audit writes, and metrics writes.
- Added tests for form field construction, lock success, target-not-found, ignoreReports failure, Redis rollback, no-active-lock unlock, and unlock success.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/routes/menu.test.ts src/routes/forms.test.ts src/server/services/lockFlow.test.ts src/server/services/unlockFlow.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Route factories are implemented and testable, but final app-level dependency wiring is owned by Wave 12.

## 2026-05-24 - Wave 07

- Implemented report trigger decisions, report trigger orchestration, dedupe keys, unchanged-content suppression, changed-content reopen path, runtime-uncertain audit logging, and standalone report trigger routes.
- Added tests for no-lock, suppress-unchanged, reopen-changed, missing target fail-open, duplicate event dedupe, ignoreReports failure, and route JSON shape.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/server/services/reportTriggers.test.ts src/server/services/triggerDecisions.test.ts src/routes/triggers.report.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Live trigger payload shape is not playtest-verified; Wave 13 must verify before runtime claims.

## 2026-05-24 - Wave 08

- Implemented the edit-aware reopen flow, update trigger reason mapping, update trigger handlers, and standalone update trigger routes.
- Added tests for unchanged updates, content edits, flair/NSFW/spoiler changes, comment edits, runtime-uncertain refetch failure, unignoreReports failure visibility, duplicate idempotency, and route JSON shape.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/server/services/reopenFlow.test.ts src/server/services/updateTriggers.test.ts src/routes/triggers.update.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Live Devvit update trigger delivery is not playtest-verified; Wave 13 must verify or keep claims marked unverified.

## 2026-05-24 - Wave 09

- Implemented dashboard aggregation and standalone dashboard API routes for overview, locks, reopen queue, audit, and runtime status.
- Added tests for empty state, demo flag propagation, active lock counts, suppressed report totals, reopened edit counts, top churn ordering, and API JSON/error shapes.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/server/services/dashboard.test.ts src/routes/api.dashboard.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Dashboard routes are standalone until Wave 12 mounts central API wiring.

## 2026-05-24 - Wave 10

- Launched Antigravity from tmux with a frontend-only prompt. It edited only Wave 10-owned client files, but its first implementation used forbidden dark/glass styling and external font imports, so Codex reviewed and replaced the violating UI locally before acceptance.
- Implemented the dashboard client API wrapper, store, render helpers, operational dashboard layout, visible demo banner, metrics first viewport, active locks table, reopened-after-edit queue, report churn, audit timeline, and runtime proof/status sections.
- Commands run:
  - `command -v agy && command -v tmux`
  - `tmux new-session -d -s reviewlock_wave10 'cd /Users/arshdeepsingh/Developer/ReviewLock && agy --dangerously-skip-permissions' && tmux load-buffer /tmp/reviewlock-wave10-antigravity-prompt.txt && tmux paste-buffer -t reviewlock_wave10 && tmux send-keys -t reviewlock_wave10 Enter && tmux capture-pane -pt reviewlock_wave10 -S -40`
  - `npm run type-check`
  - `npm run test -- --run src/client/state/store.test.ts src/client/render.test.ts`
  - `npm run lint`
  - `npm run build`
  - `rg -n "glass|gradient|orb|bokeh|not reportable|disable reports|blocked reports|Inter|Outfit|premium|dark slate|hero|AI decides|automatic removal|🛡️" src/client || true`
- Pass/fail status: PASS.
- Open risks:
  - Dashboard API is still mounted only by standalone modules until Wave 12 central wiring.
  - The final `rg` output only hits the forbidden-copy test fixture, not production UI copy.

## 2026-05-24 - Wave 11

- Implemented deterministic demo data helpers, demo seeding/reset/enable/disable/status services, and standalone demo API routes.
- Demo seeding writes locks, reopen events, audit events, metrics, runtime status, demo status, and config state with `demo: true` data separation.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/server/services/demoData.test.ts src/server/services/demoMode.test.ts src/routes/api.demo.test.ts`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Demo API routes are standalone until Wave 12 central API wiring.

## 2026-05-24 - Wave 12

- Wired central API routes, demo routes, menu/form routes, report/update trigger routes, app install/upgrade trigger handlers, app factory dependencies, and shared integrated status.
- Added integration tests for every `devvit.json` endpoint, duplicate endpoint detection, empty overview, demo enable-to-overview data, and representative trigger handling.
- Commands run:
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `rg -n "scaffolded|placeholder|route scaffolded|form scaffolded|trigger scaffolded" src || true`
- Pass/fail status: PASS.
- Open risks:
  - `npm run build` emits a Vite warning about mixed named/default exports in `src/index.ts`; build passes and the default export remains available for Devvit.
  - Default app wiring uses in-memory fallback dependencies for local integration tests; runtime Devvit adapter wiring must be proven or documented in Wave 13.

## 2026-05-24 - Wave 13

- Hardened the runtime entrypoint to use Devvit Web server primitives, real Redis and Reddit adapters, and a testable `createApp()` factory.
- Fixed Devvit manifest playtest blockers: unsupported top-level `version` and recursive `scripts.dev`.
- Fixed invalid Devvit `UiResponse` payloads from internal menu/form routes.
- Added dashboard custom post launch and runtime smoke checks for Redis and Reddit context.
- Added `/api/context` and client context resolution so the embedded dashboard can use the actual Devvit subreddit instead of a hardcoded fallback.
- Added runtime proof docs, playtest checklist, known limitations, and runtime hardening tests.
- Commands run so far:
  - `npx devvit whoami`
  - `npx devvit view --json`
  - `npm run dev -- reviewlock_dev`
  - `npm run type-check`
  - `npm run test -- --run src/integration.test.ts src/client/state/runtimeContext.test.ts src/client/state/store.test.ts src/client/render.test.ts src/server/services/runtimeHardening.test.ts`
  - `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime`
  - `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps`
  - `npx devvit logs reviewlock_dev reviewlock --connect --since 10m --show-timestamps`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps`
- Pass/fail status: PASS for Wave 13 local verification and Devvit logs connectivity; live moderation methods/triggers remain unverified and are carried to Wave 15.
- Open risks:
  - `devvit logs` attempts were blocked by `listen EADDRINUSE: address already in use :::5678` while playtest was active, then streamed successfully after stopping playtest.
  - The dashboard runtime smoke must be rerun from an isolated ReviewLock browser window after the subreddit context fix.
  - Live `approve()`, `ignoreReports()`, `unignoreReports()`, report triggers, and update triggers remain unverified.

## 2026-05-24 - Wave 15

- Expanded report trigger tests to prove unchanged post/comment suppression, changed post/comment reopening, duplicate report idempotency, runtime-uncertain target resolution, and ignoreReports failure behavior.
- Expanded update trigger tests to prove unchanged updates stay active, post/comment content edits reopen, and NSFW/spoiler/flair material changes reopen with the correct reason.
- Expanded route tests to cover post/comment report routes, post/comment update routes, and flair update reason mapping.
- Added `docs/TRIGGER_PROOF.md` with a path-by-path trace from trigger payload to moderation call, Redis lock state, metrics, audit, and reopen queue.
- Commands run so far:
  - `npm run type-check`
  - `npm run test -- --run src/server/services/reportTriggers.test.ts src/server/services/updateTriggers.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - Live Devvit trigger payloads have not been captured yet; local route payloads remain representative fixtures.
  - Live `ignoreReports()` and `unignoreReports()` trigger behavior still requires controlled Reddit events.

## 2026-05-24 - Wave 16

- Added fingerprint stress tests for outer whitespace-only edits, space/tab runs, markdown line break changes, post body cleared/rewritten, comment body cleared/rewritten, title changes, URL changes, flair text/template changes, NSFW toggles, spoiler toggles, and missing-current-content uncertainty.
- Added content-change classification tests for the same material/non-material boundaries.
- Added `docs/FINGERPRINT_STRESS.md` with the expected behavior matrix and result.
- No fingerprint engine code changes were required; the current engine already avoided the tested false positives and false negatives.
- Commands run so far:
  - `npm run type-check`
  - `npm run test -- --run src/server/services/fingerprint.test.ts src/server/services/contentChange.test.ts`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - Fingerprints remain v1 normalization rules; future live payload fields may require new material fields if Devvit exposes more moderation-relevant state.

## 2026-05-24 - Wave 17

- Added Redis NX-style `setIfNotExists()` and `expire()` adapter operations so trigger dedupe and per-target mutexes can use Redis-like atomic acquisition.
- Added a per-subreddit, per-target trigger mutex for report/update critical sections.
- Hardened report suppression so Redis failure after `ignoreReports()` returns `runtime_uncertain` and attempts `unignoreReports()` rollback.
- Hardened report/update reopen races so exactly one trigger path records the reopen and the other exits idempotently.
- Added direct mutex tests, duplicate report race tests, report/update reopen race tests, Redis suppression rollback tests, and strengthened lock creation rollback proof.
- Added `docs/REDIS_RACE_PROOF.md` and logged Wave 17 decisions D012-D014.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/server/adapters/redis.test.ts src/server/services/lockFlow.test.ts src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts`
  - `npm run test -- --run src/server/adapters/redis.test.ts src/server/services/lockFlow.test.ts src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/server/services/triggerMutex.test.ts`
  - `npx prettier --write docs/REDIS_RACE_PROOF.md decisions.md src/server/adapters/redis.ts src/server/adapters/redis.test.ts src/server/services/lockFlow.test.ts src/server/services/reportTriggers.ts src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.ts src/server/services/reopenFlow.test.ts src/server/services/triggerMutex.ts src/server/services/triggerMutex.test.ts`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - Race guarantees are locally verified against the adapter contract; live Devvit trigger delivery timing and Reddit moderation operations still require controlled playtest proof.

## 2026-05-24 - Wave 18

- Audited dashboard rendering across empty live, demo seeded, active lock, reopened after edit, runtime failed/unverified, high-volume active locks, and high-volume report churn states at desktop and mobile widths.
- Added `docs/UI_AUDIT.md` with browser evidence for all required states.
- Added a visible stale-data error banner when dashboard refresh fails after data has already loaded.
- Fixed mobile/high-volume overflow by allowing dashboard columns and panels to shrink around horizontally scrollable active-lock tables.
- Added wrapping for long table, queue, audit, churn, and latest-event text.
- Added a render test proving stale dashboard data is visibly marked when refresh fails.
- Commands run:
  - `npm run type-check`
  - `npm run test -- --run src/client/state/store.test.ts src/client/render.test.ts`
  - `npm run build`
  - `npx vite --host 127.0.0.1 --port 5173`
  - `python3 -m http.server 5173 --bind 127.0.0.1 --directory dist/client`
  - `npx --yes --package=playwright node <<'NODE' ... NODE`
  - `lsof -ti tcp:5173 | xargs -r kill`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - Browser evidence used mocked dashboard API responses against the built client bundle; live Devvit WebView rendering and live moderation operations still require controlled playtest proof.
  - Plain Vite dev serving is blocked by the Devvit Vite plugin, so the browser audit used the built client served statically.

## 2026-05-24 - Wave 19

- Added `src/fullScenario.test.ts`, a route-level integration harness for the full post and comment story: lock review, suppress repeat reports, edit content, reopen, dashboard metrics, reopen queue, audit output, and Reddit operation log.
- Added `docs/FULL_SCENARIO_WALKTHROUGH.md` with route payloads, observed outputs, Redis-visible state, dashboard output, and live/unverified labels.
- Fixed report-trigger audit ids so distinct same-timestamp report events do not collapse into one `report_suppressed` audit entry.
- Logged D015 for event-aware report audit ids.
- Commands run:
  - `npm run test -- --run src/fullScenario.test.ts`
  - `npm run test -- --run src/fullScenario.test.ts src/server/services/reportTriggers.test.ts`
  - `npx prettier --write docs/FULL_SCENARIO_WALKTHROUGH.md decisions.md src/fullScenario.test.ts src/server/services/reportTriggers.ts`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - Scenario proof is an integration harness, not live Devvit report delivery.
  - Real Reddit moderation calls and live report/update trigger payloads still require controlled playtest proof before live behavior can be claimed verified.

## 2026-05-24 - Wave 20

- Completed the first whole-repo hardening audit across `src/`, `docs/`, `README.md`, and root config.
- Added `docs/HARDENING_PASS_01.md` with audit scope, scan commands, fixes, and remaining documented hits.
- Replaced the placeholder reopen-dismiss form behavior with real Redis dismissal, queue removal, and `reopen_dismissed` audit output.
- Hardened dashboard demo mode so the client seeds deterministic demo data and switches to `reviewlock_demo` instead of refetching the live subreddit with an empty demo flag.
- Added client attribute escaping for dynamic lock/reopen ids and permalinks.
- Updated stale runtime-proof docs that still referred to Wave 15 as future live trigger proof.
- Commands run:
  - `rg -n "TODO|placeholder|stub|coming soon|not implemented|scaffold|hack|FIXME|XXX" src docs README.md package.json devvit.json tsconfig.json vite.config.ts eslint.config.js || true`
  - `rg -n "not reportable|disable reports|blocked reports|unreportable|ignore reports wrapper|AI decides|automatic removal|remove automatically|report disabling" src docs README.md || true`
  - `rg -n "catch \\{|catch \\([^)]*\\) \\{|as unknown| as any|throw new Error\\('TODO|return undefined|console\\.log|debugger" src || true`
  - `rg -n "\\.only\\(|describe\\.skip|it\\.skip|console\\.log|debugger| as any|eslint-disable|ts-ignore|ts-expect-error" src || true`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `rg -n "TODO|placeholder|stub|coming soon|not implemented" src docs README.md || true`
- Pass/fail status: PASS.
- Open risks:
  - Live Reddit report generation and real moderation method proof remain unverified.
  - Remaining scan hits are documented in `docs/HARDENING_PASS_01.md` and are not unfinished implementation code.

## 2026-05-24 - Wave 21

- Compared ReviewLock's `devvit.json`, package scripts, dependencies, and build output against the known-good ModMirror workspace.
- Confirmed `npx devvit whoami` is logged in as `u/BrightyBrainiac`.
- Confirmed `npx devvit view --json` resolves the registered `reviewlock` app owned by `BrightyBrainiac`; final observed version count was `31`.
- Added Devvit menu descriptions, a `login` script, a Node engine floor, and audited overrides for Devvit transitive `protobufjs`, `tmp`, and `ws`.
- Added `docs/DEVVIT_REGISTRATION_PROOF.md` with exact account, registration, playtest, logs, and dependency-hardening evidence.
- Ran `npm run dev -- reviewlock_dev` four times; each run reached `Playtest ready` with no recursive build loop. Observed versions: `v0.0.1.24`, `v0.0.1.26`, `v0.0.1.28`, and `v0.0.1.30`.
- Commands run:
  - `npx devvit whoami`
  - `npx devvit init --help`
  - `npx devvit upload --help`
  - `npx devvit playtest --help`
  - `npx devvit logs --help`
  - `npx devvit view --json`
  - `npm run build`
  - `npm install --package-lock-only`
  - `npm audit --omit=dev --audit-level=critical`
  - `npm view protobufjs version`
  - `npm view protobufjs@8.4.2 engines peerDependencies dependencies --json`
  - `npm view protobufjs@8.4.2 type main exports --json`
  - `npm install`
  - `node -p "require('./node_modules/protobufjs/package.json').version"`
  - `npm run type-check`
  - `npm run dev -- reviewlock_dev`
  - `npx devvit logs reviewlock_dev reviewlock --since 1m --show-timestamps`
  - `npx prettier --write docs/DEVVIT_REGISTRATION_PROOF.md decisions.md package.json package-lock.json devvit.json`
  - `npm run test`
  - `npm run lint`
- Pass/fail status: PASS.
- Open risks:
  - `npx devvit view --json` reports `isWebviewEnabled: false` even though playtest serves and connects the ReviewLock WebView; this remains registration metadata to inspect before public submission.
  - Live `approve()`, `ignoreReports()`, `unignoreReports()`, report triggers, and edit/update triggers remain unverified on controlled Reddit content.
  - Playtest observed an existing ReviewLock dashboard WebView connection, but Wave 21 did not drive browser UI to avoid disrupting the user's active Aerospace windows.

## 2026-05-24 - Wave 22

- Added `docs/API_CLIENT_CONTRACT_PROOF.md` mapping every dashboard client endpoint to its server route and covered response shape.
- Hardened `src/client/state/api.ts` so non-200, malformed JSON, missing overview fields, missing arrays, malformed runtime payloads, malformed demo status, and malformed smoke responses become explicit retryable errors before render helpers receive them.
- Added client API contract tests for success, empty arrays, non-200 errors, malformed JSON, missing fields, Devvit UI form responses, and runtime smoke endpoint handling.
- Added route contract tests proving every dashboard client endpoint is routed and returns JSON instead of 404/405.
- Added store/render tests proving slow responses show loading state and initial API failures render a retryable ReviewLock error surface instead of a blank dashboard.
- Commands run:
  - `npm run test -- --run src/client/state/api.test.ts src/client/state/store.test.ts src/client/render.test.ts src/routes/api.contract.test.ts src/routes/api.dashboard.test.ts src/routes/api.demo.test.ts`
  - `npx prettier --write src/client/state/api.ts src/client/state/api.test.ts src/client/state/store.test.ts src/client/render.test.ts src/routes/api.contract.test.ts`
  - `npx prettier --write docs/API_CLIENT_CONTRACT_PROOF.md decisions.md`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - The contract proof is local route/client proof; live Reddit WebView request timing and platform outages still need later browser/runtime regression passes.
  - Runtime moderation operations remain live-unverified until controlled Reddit report/edit events are exercised.

## 2026-05-24 - Wave 23

- Hardened no-id report trigger fallback dedupe to include `reportCount` when present, preventing same-minute undercounting of distinct reports.
- Updated no-id report audit ids to include the report-count component so metrics and audit entries stay aligned.
- Added duplicate changed-report, missing-event-id, report-then-update, update-then-report, sequential update/update, and concurrent update/update idempotency tests.
- Added `docs/TRIGGER_IDEMPOTENCY_PROOF.md` with the duplicate/out-of-order proof matrix and remaining live-payload boundary.
- Logged D019 for no-id report trigger fallback identity.
- Commands run:
  - `npx prettier --write src/server/services/reportTriggers.ts src/server/services/reportTriggers.test.ts src/server/services/updateTriggers.test.ts`
  - `npm run test -- --run src/server/services/reportTriggers.test.ts src/server/services/updateTriggers.test.ts`
  - `npx prettier --write docs/TRIGGER_IDEMPOTENCY_PROOF.md decisions.md`
  - `npm run type-check`
  - `npm run lint`
  - `npm run build`
  - `npm run test`
- Pass/fail status: PASS.
- Open risks:
  - Live Devvit report payloads may omit both `eventId` and `reportCount`; in that case ReviewLock keeps the conservative target/minute fallback to avoid overcounting duplicate-looking deliveries.
  - Live moderation method behavior and real report/update delivery remain unverified until controlled Reddit content is exercised.

## 2026-05-24 - Wave 24

- Added `docs/DATA_NAMESPACE_AUDIT.md` with evidence for Redis key prefixing, dynamic key usage, demo/live separation, malformed-record fallback behavior, and the schema migration note.
- Hardened persistence JSON readers for locks, config, audit events, reopen events, metrics, runtime proof, and demo markers so malformed records degrade to defaults, `undefined`, or filtered lists.
- Restricted demo write operations to the `reviewlock_demo` namespace so seeded data and demo-disable writes cannot mutate a live subreddit namespace.
- Added namespace, demo-live separation, malformed lock, malformed config, malformed audit, malformed reopen, malformed metrics, malformed runtime, and malformed demo marker tests.
- Logged D020-D021 for demo namespace restrictions and malformed persisted JSON behavior.
- Commands run:
  - `npx prettier --write src/server/services/audit.ts src/server/services/config.ts src/server/services/demoMode.ts src/server/services/demoMode.test.ts src/server/services/keys.test.ts src/server/services/locks.ts src/server/services/locks.test.ts src/server/services/metrics.ts src/server/services/reopenQueue.ts src/server/services/runtimeProof.ts`
  - `npm run test -- --run src/server/services/keys.test.ts src/server/adapters/redis.test.ts src/server/services/demoMode.test.ts src/server/services/locks.test.ts`
  - `rg -n "JSON\\.parse|reviewlock:|keys\\." src/server/services src/server/adapters src/routes src/shared | head -n 240`
  - `npx prettier --write src/server/services/config.test.ts src/server/services/audit.test.ts src/server/services/metrics.test.ts src/server/services/reopenQueue.test.ts src/server/services/runtimeProof.test.ts`
  - `rg -n "redis\\.(get|set|del|exists|expire|hget|hset|hgetall|hdel|hincrby|zAdd|zRange|zRem|zRemRangeByScore|zIncrBy|setIfNotExists)\\(" src --glob '!**/*.test.ts'`
  - `rg -n "reviewlock:" src --glob '!**/*.test.ts'`
  - `npm run type-check`
  - `npm run test -- --run src/server/services/keys.test.ts src/server/adapters/redis.test.ts src/server/services/demoMode.test.ts src/server/services/locks.test.ts`
  - `npm run test -- --run src/server/services/config.test.ts src/server/services/audit.test.ts src/server/services/metrics.test.ts src/server/services/reopenQueue.test.ts src/server/services/runtimeProof.test.ts`
  - `npm run lint`
  - `npm run build`
  - `npm run test`
- Pass/fail status: PASS.
- Open risks:
  - Existing records remain unversioned except lock fingerprint versions; the migration note defines the next-step requirement before incompatible schema changes.

## 2026-05-24 - Wave 25

- Added `docs/SAFETY_PRIVACY_AUDIT.md` with concrete evidence for reporter privacy, moderator safety, no AI/external-service drift, non-destructive reopen behavior, and product-copy guardrails.
- Reviewed schema, Reddit adapter mapping, report/reopen/update services, metrics, dashboard aggregation, forms, client copy, package dependencies, Devvit permissions, README, and docs.
- Confirmed reporter usernames are not stored; report handling persists counts and moderation workflow metadata only.
- Confirmed moderator actors are audit traceability fields only; no per-moderator productivity metrics or surveillance features exist.
- Confirmed reopen remains non-destructive in implementation: unignore reports, update lock state, enqueue reopen, audit, and metrics; no remove/ban/delete calls are used.
- Logged D022 to preserve actor traceability while prohibiting moderator productivity analytics.
- Commands run:
  - `rg -n "reporter|reporters|userReportReasons|modReportReasons|authorName|lockedBy|actor|moderator|productivity|surveillance|AI decides|AI|automatic removal|remove automatically|external service|webhook|fetch\\(|axios|openai|llm|not reportable|disable reports|blocked reports|unreportable" src docs README.md package.json devvit.json || true`
  - `rg -n "remove|approve|ignoreReports|unignoreReports|delete|ban|report" src/server src/routes src/client | head -n 240`
  - `rg -n "reporter|AI decides|automatic removal|productivity|surveillance|external service" src docs README.md || true`
  - `rg -n "not reportable|disable reports|blocked reports|unreportable|report disabling|ignore reports wrapper|remove automatically|automated removal|AI judgment|LLM|OpenAI|external" src docs README.md package.json || true`
  - `find . -maxdepth 3 -type f \\( -name '*.env*' -o -name '*secret*' -o -name '*token*' \\) -print`
  - `rg -n "process\\.env|SECRET|TOKEN|API_KEY|fetch\\(|https?://|webhook|discord|slack|openai|anthropic|gemini|llm|ai" src docs README.md package.json devvit.json || true`
  - `rg -n "remove|delete|ban|spam|distinguish|unignoreReports|approve\\(" src/server src/routes src/shared src/client | head -n 260`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `rg -n "reporter|AI decides|automatic removal|productivity|surveillance|external service" src docs README.md || true`
- Pass/fail status: PASS.
- Open risks:
  - Live `unignoreReports()` behavior remains runtime-unverified until controlled playtest proof is captured.

## 2026-05-24 - Wave 26

- Added high-volume dashboard aggregation coverage for locks, reopen events, audit events, daily metrics, and churn target metrics above configured dashboard limits.
- Added high-volume report-trigger coverage for 50 distinct unchanged reports and a 50-delivery duplicate storm.
- Added `docs/PERFORMANCE_HARDENING.md` with the tested volumes, bounded dashboard behavior, trigger behavior, and remaining exact-count boundary.
- Logged D023 to keep dashboard reads bounded instead of introducing unbounded count scans.
- Commands run:
  - `npx prettier --write src/server/services/dashboard.test.ts src/server/services/reportTriggers.test.ts`
  - `npm run test -- --run src/server/services/dashboard.test.ts src/server/services/reportTriggers.test.ts`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - `overview.activeLockCount` remains a bounded slice count until exact counters or a verified Redis cardinality primitive are added.

## 2026-05-24 - Wave 27

- Added `docs/CLAIM_COPY_AUDIT.md` with a claim status matrix covering verified, verified-locally, implemented-not-live-verified, implemented-not-final-verified, demo-only, and cut claims.
- Extended rendered dashboard copy tests to reject the full Wave 27 forbidden phrase set: `not reportable`, `disable reports`, `blocked reports`, `ai decides`, `automatic removal`, `permanent`, and `forever`.
- Confirmed production UI copy preserves `Lock reviewed content until it changes.`, `Reports suppressed`, and `Reopened after edit`.
- Reviewed forbidden-framing hits manually; hits are guardrails, scan commands, limitation docs, or tests rather than production-facing claims.
- Logged D024 to require proof-level labels for runtime claims.
- Commands run:
  - `rg -n "not reportable|disable reports|blocked reports|AI decides|automatic removal|permanent|forever" README.md docs src || true`
  - `rg -n "verified|unverified|implemented|live|playtest|suppress|suppressed|reopen|reopened|ignoreReports|unignoreReports|approve\\(\\)|Lock reviewed content until it changes|Reports suppressed|Reopened after edit|demo" README.md docs src/client src/routes src/server | head -n 400`
  - `rg -n "not reportable|disable reports|blocked reports|unreportable|permanent|forever|AI|automatic|verified|live" src/client README.md docs/*.md || true`
  - `npx prettier --write docs/CLAIM_COPY_AUDIT.md decisions.md log.md TODO.md src/client/render.test.ts`
  - `npm run test -- --run src/client/render.test.ts`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - `rg -n "not reportable|disable reports|blocked reports|AI decides|automatic removal|permanent|forever" README.md docs src || true`
- Pass/fail status: PASS.
- Open risks:
  - Live report suppression and edit reopening remain implemented-not-live-verified until controlled Reddit events are generated.

## 2026-05-24 - Wave 28

- Ran a headless Chromium browser regression against the built dashboard served from `dist/client` with mocked ReviewLock API responses.
- Exercised live dashboard load, runtime verification, unlock confirmation/action, demo toggle, reopen dismiss confirmation/action, demo mobile state, and return-to-live mobile state.
- Captured screenshot evidence under `output/playwright/` and documented paths/results in `docs/BROWSER_REGRESSION.md`.
- Automated browser assertions checked core product phrases, forbidden copy, body overflow, nested panels, `undefined`/`NaN` leaks, and clipped text in common controls/content rows.
- No client code fixes were required.
- Commands run:
  - `command -v npx >/dev/null 2>&1 && echo npx-ok`
  - `npm run build`
  - `mkdir -p output/playwright`
  - `python3 -m http.server 5173 --bind 127.0.0.1 --directory dist/client`
  - `npx --yes --package=playwright node <<'NODE' ... NODE`
  - `lsof -ti tcp:5173 | xargs -r kill`
  - `npm run type-check`
  - `npm run test -- --run src/client/state/store.test.ts src/client/render.test.ts`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - Browser proof used mocked API responses; live Reddit WebView and live moderation methods remain unverified.

## 2026-05-24 - Wave 29

- Added `docs/INSTALL_DEPLOY_REHEARSAL.md` with the Devvit account, private upload, controlled install, playtest, logs, local verification, blockers, and next actions from the rehearsal.
- Verified CLI account access as `u/BrightyBrainiac` and app metadata for `reviewlock`.
- Uploaded a private developer version; the CLI bumped the app to `0.0.2` and uploaded two WebView assets.
- Installed `reviewlock` `0.0.2` on the controlled test subreddit `r/reviewlock_dev`.
- Started playtest successfully and captured the playtest URL `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock` with version `v0.0.2.2`.
- Connected to Devvit logs for `r/reviewlock_dev`; no runtime log lines were emitted during the sample window.
- Did not run `devvit publish` and did not make any public release.
- Commands run:
  - `npx devvit whoami`
  - `npx devvit view --json`
  - `npx devvit upload --help`
  - `npx devvit install --help`
  - `npx devvit upload`
  - `npx devvit install reviewlock_dev`
  - `npm run dev -- reviewlock_dev`
  - `ps -ax -o pid,ppid,command | rg 'devvit playtest|npm run dev|reviewlock_dev'`
  - `kill 18687 18664`
  - `npx devvit logs --help`
  - `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime`
  - `ps -ax -o pid,ppid,command | rg 'devvit logs reviewlock_dev|node .*devvit logs'`
  - `kill 30809 30573`
  - `ps -ax -o pid,ppid,command | rg 'devvit playtest|devvit logs reviewlock_dev|npm run dev reviewlock_dev'`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS.
- Open risks:
  - Live `approve()`, `ignoreReports()`, and `unignoreReports()` behavior remains unverified on controlled Reddit content.
  - Live report and edit trigger delivery remains unverified because no controlled Reddit report/edit events were generated during this wave.
  - `npx devvit view --json` still reports `isWebviewEnabled: false`; playtest booted and uploaded WebView assets, but live WebView rendering still needs isolated browser verification.

## 2026-05-24 - Wave 30

- Added `docs/PRODUCTION_TRUST_AUDIT.md` with the weakest-area assessment, evidence reviewed, production-trust answer, and Wave 31-34 follow-up queue.
- Hardened release safety by changing `npm run launch` from `npm run deploy && devvit publish` to an explicit refusal that requires final user approval before public publish.
- Logged D025 to preserve private upload rehearsal while preventing accidental public publish before live proof.
- Marked Wave 30 complete and added Wave 31-34 follow-up items because the production-trust answer is not yet yes.
- Commands run:
  - `rg -n "Open risks|open risks|unverified|not verified|isWebviewEnabled|WebView|webview|Next action|live" docs log.md TODO.md README.md`
  - `sed -n '1,260p' devvit.json`
  - `cat package.json`
  - `find /Users/arshdeepsingh/Developer -maxdepth 3 -iname '*mod*mirror*' -o -iname 'mod_mirror'`
  - `rg -n '"launch"|devvit publish|isWebviewEnabled|entrypoints|webview|post' /Users/arshdeepsingh/Developer/ModMirror /Users/arshdeepsingh/Developer/modmirror-worktrees -g 'devvit.json' -g 'package.json' -g '*.md' -g '*.ts'`
  - `rg -n 'isWebviewEnabled|webview|entrypoints|config-file.v1|devvit publish|devvit upload' node_modules/devvit node_modules/@devvit -g '*.json' -g '*.ts' -g '*.d.ts' -g '*.md'`
  - `npx prettier --write package.json docs/PRODUCTION_TRUST_AUDIT.md TODO.md decisions.md log.md`
  - `npm run launch`
  - `npm run type-check`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS. `npm run launch` intentionally exits 1 after refusing public publish; the four required verification commands passed.
- Open risks:
  - Live WebView smoke, moderation methods, report triggers, and edit triggers still require controlled runtime proof before ReviewLock can be trusted for production use.

## 2026-05-24 - Wave 31

- Ran the live ReviewLock WebView smoke inside the existing Zen browser window only.
- Found a live context bug where the dashboard custom post in `r/reviewlock_dev` rendered the embedded dashboard under the fallback `r/reviewlock` namespace.
- Hardened client subreddit resolution to prefer Devvit-injected WebView context, then URL/referrer inference, and to avoid overwriting a verified embedded subreddit with a mismatched weaker runtime context response.
- Added runtime context tests for subreddit normalization, Devvit WebView context extraction, context precedence, and invalid-context fallback.
- Confirmed in Zen that the fixed WebView version `reviewlock-i1a3xr-0-0-2-6-webview.devvit.net/index.html` renders `r/reviewlock_dev`.
- Clicked `Verify runtime` in the embedded WebView and observed `Runtime proof refreshed.`, `redditContext verified`, and `redis verified`.
- Added `docs/LIVE_WEBVIEW_RUNTIME_SMOKE.md`, updated runtime proof, known limitations, TODO, and decisions.
- Commands run:
  - `aerospace list-windows --all --format '%{window-id} | %{app-name} | %{workspace} | %{window-title}'`
  - `npm run dev -- reviewlock_dev`
  - Zen browser live smoke at `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`
  - `npx prettier --write src/client/main.ts src/client/state/runtimeContext.ts src/client/state/runtimeContext.test.ts`
  - `npm run test -- --run src/client/state/runtimeContext.test.ts src/client/state/store.test.ts`
  - `npm run type-check`
  - `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime`
  - `npx devvit view --json`
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- Pass/fail status: PASS for the live WebView/runtime-smoke scope.
- Open risks:
  - Live `approve()`, `ignoreReports()`, and `unignoreReports()` behavior remains unverified on controlled Reddit content.
  - Live report and edit trigger delivery remains unverified because controlled Reddit report/edit events still need to be generated.

## 2026-05-24 - Wave 32 partial moderation-method proof

- Added runtime proof recording for `approve`, `ignoreReports`, and `unignoreReports` results from the lock/unlock service paths.
- Hardened the dashboard unlock flow after live WebView testing showed that `window.confirm()` was unreliable inside the embedded Devvit WebView.
- Added inline dashboard confirmation controls for unlock and reopen-dismiss actions.
- Added dedicated dashboard API routes:
  - `POST /api/locks/unlock`
  - `POST /api/reopen-queue/dismiss`
- Hardened server-side audit actor handling so Reddit runtime username takes precedence over client-supplied actor payloads.
- Verified through controlled live dashboard unlock that `unignoreReports()` records `unignoreReports verified` for target `t3_1tm8nak`.
- Opened the live `Lock review` form for `t3_1tm8nak` and confirmed target id, content summary, report count, edit state, permalink, and reason picker rendered.
- A `Lock review` submit attempt happened during Devvit hot reload and did not create an active lock; treated as inconclusive.
- Documented the controlled browser automation misclick that removed and then restored `t3_1tm8nak` through Reddit native moderation UI.
- Added `docs/MODERATION_METHOD_PROOF.md`.
- Added `docs/ANTIGRAVITY_UI_REFRESH_PROMPT.md` and launched Antigravity/Gemini in tmux for a frontend-only redesign draft.
- Added `docs/CODEX_REVIEW_AGENT_PROMPT.md` for the planned fresh Codex review agent coordination loop.
- Commands run so far:
  - `npm run dev -- reviewlock_dev`
  - Zen browser live dashboard unlock proof on `r/reviewlock_dev`
  - Zen browser live `Lock review` form proof on `t3_1tm8nak`
  - `npx prettier --write src/routes/api.dashboard.ts src/routes/forms.ts`
  - `npm run test -- --run src/routes/forms.test.ts src/routes/api.dashboard.test.ts src/routes/api.contract.test.ts src/server/services/lockFlow.test.ts src/server/services/unlockFlow.test.ts src/server/services/runtimeProof.test.ts`
- Pass/fail status: PARTIAL. Targeted local tests passed and live `unignoreReports()` proof passed; live `approve()` and `ignoreReports()` proof remains incomplete.
- Open risks:
  - Live `approve()` and `ignoreReports()` still need a successful controlled ReviewLock lock submission after runtime proof instrumentation.
  - Live report and edit trigger delivery still need controlled proof.
  - The Antigravity frontend diff must be reviewed before integration.

## 2026-05-24 - Wave 32 continued hardening and reviewer fixes

- Confirmed the second Codex reviewer was active and reviewed `docs/REVIEW_AGENT_FINDINGS.md`.
- Integrated and corrected the Antigravity/Gemini frontend redesign draft, keeping edits in `src/client/**` and removing external font, inline style, emoji/status-symbol, negative letter-spacing, and oversized-radius violations before accepting it.
- Live-verified `approve()` and `ignoreReports()` on controlled post target `t3_1tm8nak` through ReviewLock `Lock review`; the dashboard showed an active lock and runtime statuses `approve verified` and `ignoreReports verified`.
- Hardened partial lock creation failure handling so a post-save audit/metric failure rolls back Reddit `ignoreReports()` and removes active lock records/indexes.
- Hardened manual unlock failure handling so `unignoreReports()` failure keeps the lock active, adds runtime warnings, writes a runtime failure audit event, and returns a retryable error.
- Bound dashboard/form unlock requests to the confirmed `lockId` and reject stale confirmations before calling Reddit.
- Hardened dashboard and runtime smoke namespace handling so Devvit runtime subreddit context is authoritative and mismatched client-supplied namespaces are rejected.
- Hardened dashboard unlock so it rejects targets outside the Devvit runtime subreddit before any Reddit moderation call.
- Hardened report/update trigger routes to accept installed Devvit nested `post.id` and `comment.id` payload shapes.
- Hardened Devvit lock/unlock forms with server-stored Redis form bindings so editable form target IDs cannot redirect the confirmed moderation action.
- Hardened reopen persistence ordering so reopen events are queued before active lock indexes are removed.
- Hardened demo namespace reads so `reviewlock_demo` cannot render without demo mode enabled.
- Validated lock reason submissions against shared presets and escaped rendered reason labels.
- Added required post/comment `Open ReviewLock` menu actions that route to the dashboard launch flow.
- Reran Playwright browser regression for the current dashboard bundle across live/demo desktop/mobile states and inline confirmation controls.
- Updated proof and claim docs to reflect controlled post-target moderation proof while preserving live trigger and comment-target proof boundaries.
- Commands run:
  - `npm run dev -- reviewlock_dev`
  - Zen browser controlled `Lock review` proof on `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`
  - `npm run test -- --run src/routes/forms.test.ts src/routes/api.dashboard.test.ts src/routes/api.contract.test.ts src/server/services/lockFlow.test.ts src/server/services/unlockFlow.test.ts src/server/services/runtimeProof.test.ts`
  - `npm run test -- --run src/client/render.test.ts src/client/state/store.test.ts src/client/state/api.test.ts`
  - `npm run type-check`
  - `git diff --check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test -- --run src/server/services/lockFlow.test.ts src/server/services/unlockFlow.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts src/routes/forms.test.ts src/routes/api.dashboard.test.ts src/routes/api.contract.test.ts src/client/state/api.test.ts src/client/state/store.test.ts`
  - `npm run type-check`
  - `npx prettier --write TODO.md decisions.md docs/API_CLIENT_CONTRACT_PROOF.md docs/SAFETY_PRIVACY_AUDIT.md docs/CLAIM_COPY_AUDIT.md docs/RUNTIME_PROOF.md docs/KNOWN_LIMITATIONS.md docs/PLAYTEST_CHECKLIST.md docs/REVIEW_AGENT_FINDINGS.md log.md src/server/services/locks.ts src/server/services/lockFlow.ts src/server/services/lockFlow.test.ts src/server/services/unlockFlow.ts src/server/services/unlockFlow.test.ts src/routes/api.ts src/routes/api.dashboard.ts src/routes/api.dashboard.test.ts src/routes/api.contract.test.ts src/routes/forms.ts src/routes/forms.test.ts src/routes/triggers.report.ts src/routes/triggers.report.test.ts src/routes/triggers.update.ts src/routes/triggers.update.test.ts src/client/state/api.ts src/client/state/api.test.ts src/client/state/store.ts src/client/state/store.test.ts`
  - `npm run test -- --run src/integration.test.ts src/routes/api.dashboard.test.ts src/routes/api.contract.test.ts`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `npm run test -- --run src/routes/menu.test.ts src/routes/forms.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts src/routes/api.dashboard.test.ts src/client/render.test.ts src/integration.test.ts`
  - `npm run type-check`
  - `npm run test -- --run src/fullScenario.test.ts src/routes/forms.test.ts`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `npm run test -- --run src/routes/api.dashboard.test.ts src/server/services/unlockFlow.test.ts`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `mkdir -p output/playwright`
  - `npx --yes http-server dist/client -a 127.0.0.1 -p 4173`
  - `npx --yes --package=playwright node <<'NODE' ... NODE`
  - `kill 19788`
- Pass/fail status: PASS. Latest full validation passed with 40 test files and 212 tests.
- Open risks:
  - Live report and edit trigger delivery still need controlled proof.
  - Comment-target moderation method proof is still unverified.
  - Devvit trigger live delivery remains unverified even though installed nested payload shapes are now covered locally.

## 2026-05-24 - Wave 33 preparation hardening

- Reviewed fresh findings from the active second Codex reviewer in `docs/REVIEW_AGENT_FINDINGS.md` before attempting live trigger proof.
- Hardened lock creation rollback when `ignoreReports()` succeeds, Redis persistence fails, and `unignoreReports()` rollback also fails:
  - rollback now uses `unignoreReportsForReviewLock()`;
  - runtime proof records the rollback result;
  - failed rollback keeps a visible `failed` lock record with runtime warnings when Redis remains writable.
- Hardened report trigger dedupe:
  - successful dedupe markers now get a seven-day TTL;
  - runtime-uncertain paths clear the dedupe key so Devvit retries can reprocess the same event id;
  - regressions cover retry after target-resolution failure and `ignoreReports()` failure.
- Hardened the Devvit Redis adapter by passing explicit `{ by: 'rank' }` options to `zRange()` calls.
- Escaped Redis-backed runtime proof text in the dashboard runtime banner.
- Improved client action error extraction so non-200 dashboard action responses with a `message` field surface moderator-actionable text.
- Commands run:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts src/server/adapters/redis.test.ts src/client/render.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test -- src/client/state/api.test.ts src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts src/server/adapters/redis.test.ts src/client/render.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Pass/fail status: PASS. Full validation passed with 40 test files and 219 tests.
- Open risks:
  - Controlled live report and edit trigger delivery still need proof in `r/reviewlock_dev`.
  - Comment-target moderation method proof remains unverified.
  - The active reviewer may append more findings before the next commit; check `docs/REVIEW_AGENT_FINDINGS.md` again before staging.

## 2026-05-24 - Wave 33 form scope hardening

- Reviewed the active second Codex reviewer finding that Devvit lock/unlock form
  submit callbacks did not enforce current runtime subreddit scope before
  consuming form bindings.
- Hardened `lock-review-submit` and `unlock-review-submit` so they reject
  submitted subreddit values that do not match `reddit.getCurrentSubredditName()`.
- Added regressions proving mismatched lock/unlock form submissions:
  - return a neutral scope mismatch toast;
  - make no Reddit moderation calls;
  - do not consume the form token;
  - leave the active lock unchanged on unlock.
- Commands run:
  - `npm run test -- src/routes/forms.test.ts --reporter verbose`
  - `npm run test -- src/server/services/runtimeProof.test.ts src/client/state/api.test.ts src/routes/forms.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `git diff --check`
  - `npm run build`
- Pass/fail status: PASS. Full validation passed with 40 test files and 222 tests.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 reviewer hardening continued

- Reviewed new active reviewer findings before staging:
  - reopen transitions could leave an open reopen event plus an active lock if
    the lock status write failed after queueing;
  - `?demo=true` dashboard reloads could request the live subreddit namespace
    and trip the isolated demo guard.
- Hardened report-trigger and update-trigger reopen paths so status-write
  failures after a queued reopen event remove active lock indexes before
  returning `runtime_uncertain`.
- Hardened demo bootstrap so `initialDemo: true` fetches from
  `reviewlock_demo` immediately and preserves the original live subreddit for
  exiting demo mode.
- Hardened demo toggle URL state so entering demo writes
  `subreddit=reviewlock_demo` and leaving demo restores the live subreddit.
- Commands run:
  - `npx prettier --write src/server/services/reopenFlow.ts src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.ts src/server/services/reportTriggers.test.ts src/client/state/store.ts src/client/state/store.test.ts src/client/main.ts`
  - `npm run test -- src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts src/client/state/store.test.ts --reporter verbose`
  - `npx prettier --write TODO.md decisions.md docs/RUNTIME_PROOF.md docs/REVIEW_AGENT_FINDINGS.md log.md`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `git diff --check`
  - `npm run build`
- Pass/fail status: PASS. Targeted validation passed with 3 test files and 40 tests.
- Open risks:
  - A fresh reviewer check after full validation appended more findings, so this
    work is not committed yet.
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 dashboard ledger hardening

- Reviewed new active reviewer findings before staging:
  - valid-but-malformed Redis dashboard records could still crash render helpers;
  - duplicate lock attempts could create stale active lock rows and double-count
    lock metrics.
- Added shared schema guards for lock records, reopen events, audit events,
  daily metrics, and target metrics.
- Hardened Redis-backed service readers so valid-but-wrong-shape records are
  skipped like syntactically invalid JSON.
- Made `lockReviewedContent()` idempotent for already active targets before
  fingerprinting or calling Reddit moderation methods.
- Commands run:
  - `npx prettier --write src/shared/schema.ts src/server/services/locks.ts src/server/services/locks.test.ts src/server/services/reopenQueue.ts src/server/services/reopenQueue.test.ts src/server/services/audit.ts src/server/services/audit.test.ts src/server/services/metrics.ts src/server/services/metrics.test.ts src/server/services/lockFlow.ts src/server/services/lockFlow.test.ts`
  - `npm run test -- src/server/services/locks.test.ts src/server/services/reopenQueue.test.ts src/server/services/audit.test.ts src/server/services/metrics.test.ts src/server/services/lockFlow.test.ts --reporter verbose`
- Pass/fail status: PASS. Targeted validation passed with 5 test files and 20 tests.
- Open risks:
  - Full validation still needs to be rerun before commit.
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 report uncertainty hardening

- Reviewed a new active reviewer finding that report-trigger target resolution
  failures left known active locks suppressible.
- Hardened report-trigger target-resolution failure handling:
  - if the report payload supplies a subreddit and an active lock exists,
    ReviewLock now queues a `runtime_uncertain` reopen event and removes the
    active lock path;
  - if there is not enough scope to find a lock, ReviewLock preserves the
    previous retryable runtime-failure behavior and clears the dedupe marker.
- Commands run:
  - `npx prettier --write src/server/services/reportTriggers.ts src/server/services/reportTriggers.test.ts`
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
- Pass/fail status: PASS. Targeted validation passed with 1 test file and 19 tests.
- Open risks:
  - Full validation still needs to be rerun before commit.
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 lock-form fingerprint hardening

- Reviewed a new active reviewer finding that active-lock idempotency returned
  before comparing the freshly refetched target fingerprint.
- Moved duplicate-lock handling after fingerprint computation.
- If the current fingerprint matches the active lock, duplicate submissions
  still return the existing lock without another Reddit moderation call.
- If the fingerprint changed, ReviewLock now reopens the stale lock, records the
  reopen event and metrics, then creates a new lock for the moderator-reviewed
  current content.
- Commands run:
  - `npx prettier --write src/server/services/lockFlow.ts src/server/services/lockFlow.test.ts`
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
- Pass/fail status: PASS. Targeted validation passed with 1 test file and 8 tests.
- Open risks:
  - Full validation still needs to be rerun before commit.
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 demo action hardening

- Reviewed a new active reviewer finding that demo rows exposed live unlock and
  reopen-dismiss controls.
- Made demo dashboard rows read-only by replacing unlock and dismiss controls
  with a demo status marker.
- Kept live mode inline confirmation controls unchanged.
- Commands run:
  - `npx prettier --write src/client/components/LockTable.ts src/client/components/ReopenQueue.ts src/client/pages/DashboardPage.ts src/client/render.test.ts`
  - `npm run test -- src/client/render.test.ts --reporter verbose`
- Pass/fail status: PASS. Targeted validation passed with 1 test file and 12 tests.
- Open risks:
  - Full validation still needs to be rerun before commit.
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 stale-relock fail-open hardening

- Reviewed a high-severity active reviewer finding that stale-lock relock could
  reopen the old lock before proving the replacement lock had ignored reports.
- Hardened stale relock so ReviewLock calls `unignoreReports()` and records
  runtime proof before reopening the stale lock and attempting the replacement
  lock.
- Added a replacement `ignoreReports()` failure regression proving the old lock
  is reopened, `unignoreReports()` was called, no active lock remains, and the
  failed replacement lock stays visible.
- Commands run:
  - `npx prettier --write src/server/services/lockFlow.ts src/server/services/lockFlow.test.ts`
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
- Pass/fail status: PASS. Targeted validation passed with 1 test file and 9 tests.
- Open risks:
  - Full validation still needs to be rerun before commit.
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 proof-boundary doc hardening

- Reviewed a new active reviewer finding that older proof docs contradicted
  controlled post-target moderation proof.
- Reconciled historical status language in:
  - `docs/FULL_SCENARIO_WALKTHROUGH.md`
  - `docs/PRODUCTION_TRUST_AUDIT.md`
  - `docs/REDIS_RACE_PROOF.md`
- Current boundary is now consistent: controlled post-target `approve()`,
  `ignoreReports()`, and `unignoreReports()` are verified; comment-target
  methods and live report/update trigger delivery remain unverified.
- Commands run:
  - Documentation edit only; full validation must be rerun before commit.
- Pass/fail status: PARTIAL.
- Open risks:
  - Full validation still needs to be rerun before commit.
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 reviewer hardening validation

- Rechecked `docs/REVIEW_AGENT_FINDINGS.md` after the final full validation run;
  no newer actionable finding was present after the proof-boundary recheck.
- Confirmed no `TODO` comments remain under `src/`.
- Commands run:
  - `npx prettier --write docs/FULL_SCENARIO_WALKTHROUGH.md docs/PRODUCTION_TRUST_AUDIT.md docs/REDIS_RACE_PROOF.md TODO.md decisions.md docs/RUNTIME_PROOF.md docs/REVIEW_AGENT_FINDINGS.md log.md`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `git diff --check`
  - `npm run build`
  - `rg "TODO" src || true`
  - `rg "not reportable|disable reports|blocked reports|reports disabled" src docs README.md || true`
- Pass/fail status: PASS. Full validation passed with 40 test files and 228 tests.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.
  - Comment-target moderation method proof remains unverified.

## 2026-05-24 - Wave 33 runtime context fallback hardening

- Compared ReviewLock's Devvit wiring against the sibling ModMirror workspace
  and installed Devvit trigger typings.
- Found no evidence that trigger response bodies needed a route rewrite:
  `@devvit/web/shared` exposes trigger responses as an empty JSON object type,
  and ModMirror also returns an arbitrary success object from its trigger route.
- Removed the hidden `reviewlock_dev` fallback from runtime subreddit
  normalization.
- Hardened dashboard launch so ReviewLock refuses to submit a custom dashboard
  post if Devvit cannot provide the current subreddit context.
- Commands run:
  - `npm run test -- src/routes/forms.test.ts src/server/services/runtimeHardening.test.ts --reporter verbose`
  - `npx prettier --write src/routes/forms.ts src/routes/forms.test.ts src/server/services/runtimeHardening.ts src/server/services/runtimeHardening.test.ts TODO.md decisions.md log.md`
  - `npm run type-check`
  - `npm run lint`
  - `git diff --check`
  - `npm run test`
  - `rg "TODO" src || true`
  - `rg "not reportable|disable reports|blocked reports|reports disabled" src docs README.md || true`
  - `npm run build`
- Pass/fail status: PASS. Full validation passed with 40 test files and 229
  tests.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 dashboard unlock scope hardening

- Hardened dashboard inline unlock actions to send the current dashboard
  subreddit as explicit request scope.
- Updated the store and API client contract tests so unlock mirrors other
  dashboard scoped requests.
- Commands run:
  - `npm run test -- src/client/state/api.test.ts src/client/state/store.test.ts src/routes/api.dashboard.test.ts --reporter verbose`
  - `npx prettier --write src/client/state/api.ts src/client/state/api.test.ts src/client/state/store.ts src/client/state/store.test.ts TODO.md decisions.md log.md`
  - `npm run type-check`
  - `npm run lint`
  - `git diff --check`
  - `npm run test`
  - `rg "TODO" src || true`
  - `rg "not reportable|disable reports|blocked reports|reports disabled" src docs README.md || true`
  - `npm run build`
- Pass/fail status: PASS. Full validation passed with 40 test files and 229
  tests.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-24 - Wave 33 live WebView smoke recheck

- Started a fresh Devvit playtest for `r/reviewlock_dev`.
- Observed playtest version `v0.0.2.62`.
- Used the existing Zen browser tab for the ReviewLock dashboard custom post.
- Confirmed the dashboard still rendered under `r/reviewlock_dev` after runtime
  fallback and scoped-unlock hardening.
- Closed the previously open Reddit report modal without submitting a report.
- Clicked `Verify runtime` from the embedded dashboard.
- Confirmed the dashboard showed `Runtime proof refreshed.`, with
  `redditContext verified`, `redis verified`, moderation method proof still
  visible, and `triggers unverified`.
- Sampled Devvit logs; the CLI reported
  `listen EADDRINUSE: address already in use :::5678` while playtest was
  running, then connected to the log stream. No trigger payloads were emitted
  during the sample window.
- Commands run:
  - `npm run dev -- reviewlock_dev`
  - Zen browser live WebView runtime recheck on `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`
  - `npx devvit logs reviewlock_dev reviewlock --since 5m --show-timestamps --log-runtime`
- Pass/fail status: PASS for live WebView render and runtime smoke; PARTIAL for
  log sampling because of the Devvit CLI `EADDRINUSE` warning and no trigger
  payload events.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-25 - Wave 33 Devvit target model mapping hardening

- Compared ReviewLock's Reddit adapter against installed Devvit `PostV2` and
  `CommentV2` typings.
- Hardened post mapping to preserve `selftext`, `numReports`, and `authorId`
  fields when those are the available Devvit model names.
- Hardened comment mapping to preserve `author` when `authorName` is absent.
- Added adapter regression tests for installed trigger/nested model-shaped
  inputs.
- Commands run:
  - `nl -ba node_modules/@devvit/protos/json/devvit/reddit/v2alpha/postv2.d.ts | sed -n '1,90p'`
  - `nl -ba node_modules/@devvit/protos/json/devvit/reddit/v2alpha/commentv2.d.ts | sed -n '1,90p'`
  - `npm run test -- src/server/adapters/reddit.test.ts --reporter verbose`
  - `npx prettier --write src/server/adapters/reddit.ts src/server/adapters/reddit.test.ts RESEARCH.md TODO.md decisions.md log.md`
  - `npm run type-check`
  - `npm run lint`
  - `git diff --check`
  - `npm run test`
  - `rg "TODO" src || true`
  - `rg "not reportable|disable reports|blocked reports|reports disabled" src docs README.md || true`
  - `npm run build`
- Pass/fail status: PASS. Full validation passed with 40 test files and 231
  tests.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-25 - Wave 33 Devvit trigger wrapper hardening

- Compared ReviewLock's trigger route parsers against installed raw event and
  `TriggerEvent` wrapper typings.
- Hardened report trigger routes to extract ids, subreddit scope, report counts,
  event ids, and timestamps from raw or wrapped report payloads.
- Hardened update trigger routes to extract ids and subreddit scope from raw or
  wrapped update payloads, including flair/NSFW/spoiler wrapper names.
- Added route regressions for wrapped post report, comment report, post update,
  comment update, flair update, and fail-open runtime-uncertain paths when
  refetch fails.
- Commands run:
  - `nl -ba node_modules/@devvit/protos/json/devvit/events/v1alpha/events.d.ts | sed -n '30,110p'`
  - `nl -ba node_modules/@devvit/protos/json/devvit/triggers/v1alpha/triggers.d.ts | sed -n '1,60p'`
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
  - `npx prettier --write src/routes/triggers.report.ts src/routes/triggers.report.test.ts src/routes/triggers.update.ts src/routes/triggers.update.test.ts RESEARCH.md TODO.md decisions.md log.md`
  - `npm run type-check`
  - `npm run lint`
  - `git diff --check`
  - `npm run test`
  - `rg "TODO" src || true`
  - `rg "not reportable|disable reports|blocked reports|reports disabled" src docs README.md || true`
  - `npm run build`
- Pass/fail status: PASS. Full validation passed with 40 test files and 238
  tests.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission.

## 2026-05-25 - Wave 33 live WebView trigger-wrapper recheck

- Started a fresh Devvit playtest for `r/reviewlock_dev`.
- Observed playtest version `v0.0.2.64`.
- Used the existing Zen browser tab for the ReviewLock dashboard custom post.
- Confirmed the WebView updated to
  `reviewlock-i1a3xr-0-0-2-64-webview.devvit.net/index.html`.
- Confirmed the live dashboard rendered under `r/reviewlock_dev` with active
  locks, reports suppressed, reopened after edit, latest edit-break state, and
  active lock table in the first viewport.
- Clicked `Verify runtime` from the embedded dashboard.
- Confirmed the dashboard showed `Runtime proof refreshed.`, with
  `redditContext verified`, `redis verified`, `approve verified`,
  `ignoreReports verified`, `unignoreReports verified`, and
  `triggers unverified`.
- Opened demo mode from the same WebView and confirmed visible `Demo mode`
  labeling, `r/reviewlock_demo` scope, seeded active locks, reports suppressed,
  reopened after edit, report churn, read-only demo actions, runtime status, and
  audit timeline.
- Sampled Devvit logs; the CLI reported
  `listen EADDRINUSE: address already in use :::5678` while playtest was
  running, then connected to the log stream. No trigger payloads were emitted
  during the sample window.
- Commands run:
  - `npm run dev -- reviewlock_dev`
  - Zen browser live WebView runtime and demo recheck on `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`
  - `npx devvit logs reviewlock_dev reviewlock --since 5m --show-timestamps --log-runtime`
- Pass/fail status: PASS for live WebView render, runtime smoke, and demo mode;
  PARTIAL for log sampling because of the Devvit CLI `EADDRINUSE` warning and
  no trigger payload events.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission or controlled edit actions.

## 2026-05-25 - Wave 33 runtime smoke scope hardening

- Cross-checked ReviewLock's Devvit config and runtime proof patterns against
  the ModMirror workspace the user identified as a reference.
- Found and removed the remaining direct runtime smoke fallback to the
  controlled `reviewlock_dev` namespace.
- Runtime smoke routes now require Devvit runtime subreddit context or an
  explicit valid client scope, and return a structured 400 when both are absent.
- Commands run:
  - `sed -n '1,260p' /Users/arshdeepsingh/Developer/ModMirror/devvit.json`
  - `sed -n '1,260p' /Users/arshdeepsingh/Developer/ModMirror/src/routes/triggers.ts`
  - `sed -n '1,260p' /Users/arshdeepsingh/Developer/ModMirror/src/server/services/runtimeVerification.ts`
  - `npm run test -- src/routes/api.contract.test.ts src/server/services/runtimeHardening.test.ts --reporter verbose`
  - `npx prettier --write src/routes/api.ts src/routes/api.contract.test.ts TODO.md decisions.md log.md`
  - `npm run type-check`
  - `npm run lint`
  - `git diff --check`
- Pass/fail status: PASS. Targeted validation passed with 2 test files and 9
  tests, followed by type-check, lint, and whitespace checks.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission or controlled edit actions.

## 2026-05-25 - Wave 33 dashboard UI hardening with reviewed Antigravity output

- Delegated a frontend-only dashboard refresh to Antigravity/Gemini using the
  checked prompt in `docs/ANTIGRAVITY_UI_REFRESH_PROMPT.md`.
- Reviewed the generated diff before integration and kept changes limited to
  `src/client/**` and the client render test.
- Removed rejected UI output patterns from the Antigravity diff: external Google
  Fonts import, inline styles, dark one-note palette, non-ASCII arrows, and
  elevated landing-page styling.
- Refined the first viewport metrics to read as the ReviewLock loop:
  `1. Reviewed and locked`, `2. Reports suppressed`, and
  `3. Reopened after edit`.
- Tightened reopened-event presentation with compact target identifiers, clear
  edit-break status treatment, and "Content change fingerprint" copy.
- Started a fresh Devvit playtest for `r/reviewlock_dev`.
- Observed playtest version `v0.0.2.66`.
- Used Zen on the existing ReviewLock dashboard post.
- Confirmed live mode rendered under `r/reviewlock_dev` with active locks,
  reports suppressed, reopened after edit, latest edit-break empty state, active
  lock table, and runtime status visible.
- Opened demo mode and confirmed visible `Demo mode` labeling,
  `r/reviewlock_demo` scope, seeded active locks, reports suppressed, reopened
  after edit, latest edit-break event, report churn, read-only demo actions,
  runtime status, and audit timeline.
- Switched back to live mode and clicked `Verify runtime`; the dashboard showed
  `Runtime proof refreshed.`
- Commands run:
  - `tmux new-window -n agy-ui 'cd /Users/arshdeepsingh/Developer/ReviewLock && agy --dangerously-skip-permissions < docs/ANTIGRAVITY_UI_REFRESH_PROMPT.md'`
  - `npx prettier --write src/client/components/MetricStrip.ts src/client/components/ReopenQueue.ts src/client/render.test.ts src/client/styles.css`
  - `npm run test -- --run src/client/render.test.ts src/client/state/store.test.ts src/client/state/api.test.ts`
  - `npm run type-check`
  - `npm run lint`
  - `git diff --check`
  - `npm run build`
  - `npm run dev -- reviewlock_dev`
  - Zen browser live WebView runtime and demo recheck on `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`
- Pass/fail status: PASS for local frontend validation, build, live WebView
  render, runtime smoke, and demo mode.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission or controlled edit actions.

## 2026-05-25 - Wave 33 seeded demo data depth hardening

- Expanded the deterministic demo scenario from 12 locks to 18 locks: 12 active,
  5 reopened after edit, and 1 failed runtime-warning example.
- Raised seeded suppressed report churn to 47 reports across post and comment
  examples.
- Added richer reopen coverage for content, flair, NSFW, and spoiler changes.
- Kept demo mode clearly scoped to `r/reviewlock_demo`, with seeded data marked
  demo-only and trigger proof still unverified.
- Started a fresh Devvit playtest for `r/reviewlock_dev`.
- Observed playtest version `v0.0.2.68`.
- Used Zen on the existing ReviewLock dashboard post.
- Opened demo mode and confirmed visible `Demo mode` labeling,
  `r/reviewlock_demo` scope, 12 active locks, 47 reports suppressed, 5 reopened
  after edit, latest edit-break event for `post:demo018`, read-only demo
  actions, report churn, runtime status warning, and audit timeline.
- Commands run:
  - `npm run test -- src/server/fixtures/demoScenario.test.ts src/server/services/demoData.test.ts src/server/services/demoMode.test.ts src/integration.test.ts src/client/render.test.ts --reporter verbose`
  - `npm run test -- src/routes/api.demo.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `git diff --check`
  - `rg "TODO" src || true`
  - `rg "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md || true`
  - `npm run build`
  - `npm run dev -- reviewlock_dev`
  - Zen browser demo-mode recheck on `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`
- Pass/fail status: PASS for local tests, type-check, lint, build, and live
  WebView demo render.
- Open risks:
  - Controlled live report/edit trigger proof remains blocked pending explicit
    confirmation for live Reddit report submission or controlled edit actions.

## 2026-05-25 - Wave 33 live scenario matrix planning

- Evaluated whether ReviewLock should use arbitrary subreddit data, additional
  test subreddits, or richer controlled content for live proof.
- Chose controlled live proof only: `r/reviewlock_dev` first, with additional
  moderated test subreddits allowed only if ReviewLock is installed or
  playtested there.
- Added `docs/LIVE_SCENARIO_MATRIX.md` with 10 controlled post/comment
  scenarios covering unchanged report suppression, body edits, flair changes,
  NSFW toggles, spoiler toggles, whitespace normalization, comment locks, high
  churn, and stale-lock relock.
- Clarified that seeded demo data remains isolated in `reviewlock_demo` and is
  not live trigger evidence.
- Commands run:
  - `rg -n "DEMO_SUBREDDIT|demo=true|reviewlock_demo|normalizeSubreddit|subreddit" src/shared src/server src/client src/routes | head -n 120`
  - `sed -n '1,220p' src/shared/constants.ts`
  - `sed -n '1,220p' devvit.json`
  - Official Devvit docs reviewed:
    `https://developers.reddit.com/docs/get-started/playtest` and
    `https://developers.reddit.com/docs/cli/install`
- Pass/fail status: PASS for planning/documentation.
- Open risks:
  - Live report/edit trigger proof still requires controlled Reddit actions and
    sanitized log capture.

## 2026-05-25 - Wave 33 controlled live corpus copy prep

- Added exact controlled Reddit post and comment copy for S01-S10 in
  `docs/LIVE_SCENARIO_CONTENT.md`.
- Prepared S01 in Zen on the Reddit submit form for `r/reviewlock_dev` but did
  not click `Post`.
- Started `npm run dev -- reviewlock_dev`; playtest reached `v0.0.2.70`.
- Stopped the playtest cleanly after reaching the user-confirmation boundary.
- Commands run:
  - `git status --short`
  - `ps -axo pid,ppid,command | rg 'npm run dev|devvit playtest|webbit|reviewlock_dev'`
  - `npm run dev -- reviewlock_dev`
  - Zen browser submit-form prefill for S01
- Pass/fail status: PASS for preflight; BLOCKED for live post creation pending
  explicit user confirmation.
- Open risks:
  - S01 has not been posted yet.
  - No live report, edit, flair, NSFW, spoiler, comment, or trigger proof has
    been performed in this pass.

## 2026-05-25 - Wave 33 live trigger proof runbook

- Added `docs/LIVE_TRIGGER_PROOF_RUNBOOK.md` with the exact S01 unchanged-report
  suppression sequence and S02 body-edit reopen sequence.
- Included terminal setup, log capture commands, expected evidence, dashboard
  assertions, and claim boundaries.
- Kept live Reddit side effects behind action-time confirmation.
- Commands run:
  - `git status --short`
  - `tail -n 220 docs/REVIEW_AGENT_FINDINGS.md 2>/dev/null || true`
  - `rg -n "unverified|blocked|pending|TODO|not yet|needs|blocked" docs TODO.md log.md | head -n 200`
  - `find . -name AGENTS.md -print`
- Pass/fail status: PASS for non-risky runbook documentation.
- Open risks:
  - Live trigger proof remains blocked until the controlled S01 post is created
    and reported in `r/reviewlock_dev`.

## 2026-05-25 - Wave 33 report-trigger rollback hardening

- Hardened report-trigger moderation rollback after `ignoreReports()` succeeds
  but Redis writes fail:
  - the trigger path now records `ignoreReports` and `unignoreReports` runtime
    proof from report-trigger moderation calls;
  - failed `unignoreReports` rollback writes a `runtime_failure` audit event
    when Redis is still available;
  - failed rollback warnings are returned to the trigger result instead of
    being swallowed.
- Added a regression proving the report dedupe marker is cleared after this
  runtime-uncertain failure so Devvit retries can run again.
- Commands run:
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test -- src/server/services/reportTriggers.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
- Pass/fail status: PASS for focused service and trigger-route tests, lint, and
  type-check.
- Open risks:
  - The live S01 lock form is open but not submitted; live lock/report actions
    remain paused pending action-time confirmation.

## 2026-05-25 - Wave 33 Devvit bare target id hardening

- Added endpoint-kind-aware target id normalization for Devvit menu, report
  trigger, and update trigger routes.
- Bare post ids are normalized to `t3_*`; bare comment ids are normalized to
  `t1_*` before target resolution and Reddit refetch.
- Added route regressions for bare Devvit post/comment ids across lock menu,
  report triggers, and update triggers.
- Commands run:
  - `npm run test -- src/server/services/targetResolver.test.ts src/routes/menu.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
- Pass/fail status: PASS for targeted route/service tests, type-check, lint,
  full tests, build, and diff whitespace check.
- Open risks:
  - Live trigger payload shape still needs `devvit logs` evidence from
    controlled S01/S02 actions.

## 2026-05-25 - Wave 33 S01 live post proof state update

- Recorded that S01 has been posted in `r/reviewlock_dev`.
- Captured live target details:
  - permalink:
    `/r/reviewlock_dev/comments/1tmmeo6/reviewlock_proof_s01_reviewed_unchanged_policy/`
  - thing id: `t3_1tmmeo6`
  - author: `u/BrightyBrainiac`
- Updated the S01 runbook steps to start from the posted target and noted that
  the lock form must be reopened after action-time confirmation because
  playtest rebuilds closed the earlier form.
- Commands run:
  - `sed -n '1,70p' docs/LIVE_TRIGGER_PROOF_RUNBOOK.md`
  - `sed -n '1,100p' docs/LIVE_SCENARIO_CONTENT.md`
  - Zen browser state inspection on the S01 post page.
- Pass/fail status: PASS for proof-state documentation.
- Open risks:
  - S01 has not been locked through ReviewLock in the current live pass.
  - No controlled report or edit trigger has been generated yet.

## 2026-05-25 - Wave 33 sanitized trigger payload logging

- Added `reviewlock.trigger.payload_shape` logging for report and update
  trigger routes from the live Devvit bootstrap path.
- The logger records only route name, target kind, and payload shape booleans;
  tests assert raw event ids, thing ids, subreddit names, content text, and
  report reason text are not logged.
- Recorded the user's S01 update: the live post was locked through the
  ReviewLock action, pending dashboard/runtime verification in this playtest
  pass.
- Commands run:
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg "TODO" src || true`
  - `rg "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md || true`
- Pass/fail status: PASS for focused trigger-route tests, type-check, lint,
  full test suite, build, and diff whitespace check.
- Open risks:
  - S01 lock still needs dashboard/runtime verification after the current
    rebuild reaches a ready playtest version.
  - Controlled report/edit trigger events and sanitized `devvit logs` capture
    remain pending.

## 2026-05-25 - Wave 33 S01 active lock live verification

- Started a fresh playtest for `r/reviewlock_dev`; playtest reached
  `v0.0.2.84`.
- Verified in Zen on the live dashboard that S01 is active:
  - target: `post:1tmmeo6`
  - author: `u/BrightyBrainiac`
  - reason: `reviewed policy compliant`
  - suppressed reports before report proof: `0`
- Verified the dashboard first viewport at that point showed 2 active locks, 0
  reports suppressed, 0 reopened after edit, and trigger runtime proof still
  `unverified`.
- Found that S01 cannot be reported by the currently logged-in account because
  it is authored by `u/BrightyBrainiac`; Reddit exposes edit/delete/spoiler/NSFW
  actions instead of `Report`.
- Prepared a controlled report modal on the already locked dashboard post
  `t3_1tm8nak`, authored by `u/reviewlock`, with `Spam` selected. Stopped before
  clicking `Next` pending action-time confirmation because the next step can
  create a live Reddit report event.
- The user clicked the first `Next` step. I selected the low-specificity
  subtype `Other` and advanced to Reddit's final report `Submit` screen with
  optional additional context left blank. Stopped before final `Submit` because
  it transmits the live report.
- Commands run:
  - `npm run dev -- reviewlock_dev`
  - Zen browser dashboard inspection on
    `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`
  - Zen browser S01 inspection on
    `/r/reviewlock_dev/comments/1tmmeo6/reviewlock_proof_s01_reviewed_unchanged_policy/?playtest=reviewlock`
- Pass/fail status: PASS for active-lock verification; BLOCKED at final Reddit
  report `Submit`.
- Open risks:
  - No live trigger delivery has been generated yet in this pass.
  - The next controlled report target is `t3_1tm8nak`, not S01, because S01 is a
    self-authored post for the logged-in account.

## 2026-05-25 - Wave 33 stale relock unignore failure hardening

- Integrated reviewer finding on stale-lock relock failure ordering.
- Hardened `lockReviewedContent()` so changed-content relock stops immediately
  when stale `unignoreReports()` fails:
  - existing lock remains active and retryable;
  - runtime warning is persisted on the lock;
  - runtime proof records the failed moderation operation;
  - audit records a `runtime_failure`;
  - replacement `approve()` / `ignoreReports()` are not attempted.
- Added a regression that sets up edited current content, failed stale
  `unignoreReports()`, and failed replacement `ignoreReports()`; the test proves
  the replacement calls are not reached and the stale lock remains active.
- Reconciled live trigger proof docs so S01 is only the active-lock baseline
  from this same-account session, while `t3_1tm8nak` is the executable
  unchanged-report candidate.
- Commands run:
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg "TODO" src || true`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md || true`
- Pass/fail status: PASS for targeted lock-flow regression, type-check, lint,
  full test suite, build, and diff whitespace check.
- Open risks:
  - Forbidden-copy scan matched only guardrail tests and documentation references.
  - Controlled live report and edit trigger events remain pending.

## 2026-05-25 - Wave 33 controlled post report proof and reviewer hardening

- Submitted one controlled Reddit report against unchanged locked dashboard post
  `t3_1tm8nak` in `r/reviewlock_dev`.
- Verified live `PostReport` delivery and suppression evidence:
  - Devvit emitted sanitized `reviewlock.trigger.payload_shape` for
    `on-post-report`.
  - Reddit native status showed `Reports ignored 1`.
  - ReviewLock dashboard showed `Reports suppressed = 1`, active row
    `post:1tm8nak` suppressed count `1`, report churn `post:1tm8nak` count `1`,
    and audit `Report Suppressed 5/25/2026, 3:29:43 PM`.
- Integrated reviewer findings:
  - update-trigger `unignoreReports()` success/failure is now recorded in
    runtime proof;
  - active locks with runtime warnings now render a row-level `Needs attention`
    marker;
  - reopened queue/latest items with runtime warnings now render a row-level
    `Needs attention` marker;
  - accepted report/update trigger routes now record granular runtime proof
    capabilities such as `postReportTrigger` without marking unrelated trigger
    paths verified;
  - comment report/update trigger routes now prefer comment ids over sibling
    parent post ids;
  - duplicate dashboard-post candidate text was removed from the live scenario
    content.
- Commands run:
  - `npm run test -- src/server/services/reopenFlow.test.ts src/client/render.test.ts --reporter verbose`
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts src/client/render.test.ts --reporter verbose`
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg "TODO" src || true`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md || true`
  - `npm run dev -- reviewlock_dev`
  - `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`
  - Zen browser report flow and dashboard inspection on
    `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`
- Pass/fail status: PASS for controlled post report proof and focused
  regression tests.
- Open risks:
  - Comment report triggers remain unverified.
  - Update/edit trigger delivery remains unverified.

## 2026-05-25 - Wave 33 reviewer hardening pass: fail-open refetch and menu/demo fixes

- Integrated fresh reviewer findings before continuing live edit proof.
- Hardened `resolveTargetById()` so thrown Reddit refetch errors become
  structured uncertainty instead of bypassing report/update trigger fail-open
  handling.
- Made comment lock/unlock menu fallback extraction prefer `commentId` over a
  sibling parent `postId`, matching the trigger-route fix.
- Kept demo-mode exit retryable by deferring the client state switch until
  server-side demo disable succeeds.
- Rendered escaped audit target, lock, operation, reason, and error details so
  runtime-failure warning examples are visible in the dashboard audit surface.
- Commands run:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/routes/menu.test.ts src/client/state/store.test.ts src/client/render.test.ts --reporter verbose`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg "TODO" src || true`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md || true`
- Pass/fail status: PASS for focused regression tests, type-check, lint, full
  test suite, build, and diff whitespace check.
- Open risks:
  - Forbidden-copy scan matched only guardrail tests and documentation
    references.
  - Controlled live edit/update trigger proof remains pending.

## 2026-05-25 - Wave 33 controlled post update proof and Redis smoke hardening

- Posted and locked S02 in `r/reviewlock_dev`:
  `/r/reviewlock_dev/comments/1tnfgqf/reviewlock_proof_s02_body_edit_reopen/`
  (`t3_1tnfgqf`, author `u/BrightyBrainiac`).
- Verified `Lock review` created lock `lock-t3_1tnfgqf-1779729393648` at
  `5/25/2026, 10:46:33 PM` with reason `reviewed policy compliant`.
- Edited the S02 body to the planned material rewrite and verified the live
  `PostUpdate` path:
  - sanitized `reviewlock.trigger.payload_shape` emitted for `on-post-update`;
  - active locks changed from `3` to `2`;
  - `Reopened after edit` increased to `1`;
  - latest reopen event was `post:1tnfgqf`, reason `content changed`;
  - reopen queue showed fingerprint delta `c322d267` to `fc05f41b`;
  - audit recorded `Lock Reopened 5/25/2026, 10:53:00 PM`;
  - runtime proof showed `postUpdateTrigger verified`.
- Hardened Redis runtime smoke so failed checks update the runtime proof ledger
  when subreddit scope has already been resolved.
- Commands run so far:
  - `npm run dev -- reviewlock_dev`
  - `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`
  - Zen browser S02 post creation, `Lock review`, body edit, and dashboard
    inspection on playtest `v0.0.2.107`
  - `npm run test -- src/routes/api.contract.test.ts src/server/services/runtimeProof.test.ts --reporter verbose`
  - `npm run type-check`
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src || true`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md || true`
- Pass/fail status: PASS for controlled post update proof, type-check, lint,
  full test suite, build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.
- Open risks:
  - Comment report/update and post NSFW/spoiler/flair trigger variants remain
    unverified.

## 2026-05-25 - Wave 33 controlled comment update proof and Reddit smoke hardening

- Created and locked S08 comment under S02:
  `/r/reviewlock_dev/comments/1tnfgqf/comment/ontlx1k/` (`t1_ontlx1k`,
  author `u/BrightyBrainiac`).
- Verified `Lock review` on the comment created lock
  `lock-t1_ontlx1k-1779730303805` at `5/25/2026, 11:01:43 PM` with reason
  `reviewed policy compliant`.
- Edited the S08 comment body to the planned material rewrite and verified the
  live `CommentUpdate` path:
  - sanitized `reviewlock.trigger.payload_shape` emitted for
    `on-comment-update`;
  - active locks changed from `3` to `2`;
  - `Reopened after edit` increased from `1` to `2`;
  - latest reopen event was `comment:ontlx1k`, reason `content changed`;
  - reopen queue showed fingerprint delta `9da841c1` to `20abf990`;
  - audit recorded `Lock Reopened 5/25/2026, 11:05:07 PM`;
  - runtime proof showed `commentUpdateTrigger verified`.
- Integrated reviewer finding: failed `/api/smoke/reddit` checks now record a
  failed `redditContext` capability in runtime proof when subreddit scope has
  already been resolved.
- Integrated reviewer finding: runtime proof now uses explicit granular trigger
  defaults and removes the legacy broad `triggers` row on read, so partial or
  complete trigger proof cannot be hidden behind a stale bucket.
- Integrated reviewer finding: runtime proof normalization now preserves
  explicit demo warnings while adding missing default capability rows.
- Integrated reviewer finding: update-trigger route tests now prove the
  comment, NSFW, spoiler, and flair endpoints write the matching granular
  runtime proof capabilities without marking unrelated variants verified.
- Integrated reviewer finding: concurrent lock submissions now acquire a
  per-target Redis creation lease before Reddit moderation side effects, so a
  double-click or two stale menus cannot create duplicate active lock rows.
- Integrated reviewer finding: no-id report dedupe now uses target plus report
  count without the processing-minute bucket, preventing delayed duplicate
  deliveries from inflating suppressed-report metrics.
- Integrated reviewer finding: lock creation leases now delete only when the
  stored owner token still matches, preventing stale owners from clearing newer
  in-flight guards.
- Integrated reviewer finding: report trigger mutex contention now keeps
  distinct events retryable instead of returning a successful duplicate result.
- Integrated reviewer finding: no-id/no-count report deliveries now avoid the
  seven-day `count-unknown` dedupe collapse.
- Integrated reviewer finding: reopen dismiss routes now write audit before
  removing queue visibility, leaving items retryable if audit persistence fails.
- Integrated reviewer finding: live dashboard and runtime smoke no longer fall
  back to the app-name `reviewlock` namespace when runtime context is missing.
- Integrated reviewer finding: runtime proof capability writes now preserve
  explicit demo/runtime warnings across later status transitions.
- Tightened live dashboard and runtime smoke scope resolution to require
  trusted Devvit runtime subreddit context rather than arbitrary client query
  values.
- Integrated reviewer finding: `lock_created` audit is now written after
  metrics persistence, so rollback-triggering metrics failures do not leave a
  false success audit.
- Updated `docs/PRODUCTION_TRUST_AUDIT.md` to reflect the current controlled
  live proof boundary instead of the older blanket "live triggers unverified"
  statement.
- Updated `docs/REDIS_RACE_PROOF.md` to point to the current granular live
  trigger proof boundary.
- Updated `docs/INSTALL_DEPLOY_REHEARSAL.md` to label its blocker section as a
  historical snapshot and link the current granular runtime proof boundary.
- Commands run so far:
  - `npm run dev -- reviewlock_dev`
  - `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`
  - Zen browser S08 comment creation, `Lock review`, body edit, and dashboard
    inspection on playtest `v0.0.2.109`
  - `npm run test -- src/routes/api.contract.test.ts --reporter verbose`
  - `npm run test -- src/server/services/runtimeProof.test.ts src/routes/api.contract.test.ts --reporter verbose`
  - `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/demoMode.test.ts src/routes/triggers.update.test.ts src/routes/api.contract.test.ts --reporter verbose`
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
  - `npm run test -- src/server/services/lockFlow.test.ts src/server/services/reportTriggers.test.ts --reporter verbose`
  - `npm run test -- src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts --reporter verbose`
  - `npm run test -- src/server/services/reportTriggers.test.ts src/routes/api.dashboard.test.ts src/routes/forms.test.ts src/routes/api.contract.test.ts --reporter verbose`
  - `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/reportTriggers.test.ts src/routes/api.dashboard.test.ts src/routes/forms.test.ts src/routes/api.contract.test.ts --reporter verbose`
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src || true`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md || true`
- Pass/fail status: PASS for controlled comment update proof, targeted
  regressions, type-check, lint, full test suite, build, diff whitespace check,
  and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.
- Open risks:
  - Comment report and post NSFW/spoiler/flair trigger variants remain
    unverified.
  - Comment-target moderation method effects are not independently visible yet
    beyond successful lock persistence and later reopen.

## 2026-05-25 23:47 IST - Reviewer finding integration

- Integrated reviewer finding: comment report/update/menu routes now prefer
  comment-specific ids over generic `targetId` values when both are present.
- Integrated reviewer finding: demo-mode runtime context updates now preserve
  the active `reviewlock_demo` namespace while still remembering the live
  subreddit for exiting demo.
- Focused validation:
  - `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts src/routes/menu.test.ts src/client/state/store.test.ts --reporter verbose`
  - PASS, 4 test files and 53 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 40 test files / 282 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-25 23:50 IST - Reviewer finding integration

- Integrated reviewer finding: comment report routes now prefer
  comment-specific report counts over parent post report counts.
- Integrated reviewer finding: update-trigger mutex contention now returns
  retryable `runtime_uncertain` instead of terminal `no_lock`.
- Focused validation:
  - `npm run test -- src/routes/triggers.report.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 test files and 25 tests.
- Follow-up validation:
  - `npm run test` initially failed because
    `src/server/services/updateTriggers.test.ts` still expected concurrent
    update contention to return terminal `no_lock`.
  - Updated that regression to require retryable `runtime_uncertain` with
    `concurrent_trigger_in_progress`.
  - `npm run test -- src/server/services/updateTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 test files and 18 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 40 test files / 284 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 00:24 IST - Reviewer hardening integration

- Integrated reviewer finding: lock form bindings now store the reviewed
  content hash and fingerprint version. Lock submit refetches and rejects stale
  forms before `approve()` or `ignoreReports()` if content changed after the
  moderator opened the review summary.
- Integrated reviewer finding: Devvit Redis `setIfNotExists()` now treats the
  installed runtime's empty-string NX response as failed acquisition, preserving
  lock creation guards, report dedupe, and trigger mutex semantics.
- Integrated reviewer finding: report and update trigger runtime proof rows are
  marked `verified` only after target resolution and successful processing, not
  merely after a payload with subreddit scope is delivered.
- Integrated reviewer finding: manual unlock now fails open if Reddit
  `unignoreReports()` succeeds but the lock status write fails; active indexes
  are cleared best-effort and a runtime-failure audit is attempted.
- Integrated reviewer finding: dashboard runtime verification now refreshes the
  persisted runtime proof ledger even when the smoke endpoint rejects after
  writing a failed capability row.
- Integrated reviewer finding: NSFW and spoiler update routes accept both
  `postNsfwUpdate`/`postSpoilerUpdate` and
  `nsfwPostUpdate`/`spoilerPostUpdate` wrapper spellings, and sanitized payload
  logging records both shapes.
- Integrated reviewer finding: unchanged-report rollback now restores the
  original lock record if later metric/audit persistence fails after the
  lock-level suppressed counter was incremented.
- Integrated reviewer finding: lock/unlock form submissions now require trusted
  runtime subreddit context; missing or throwing context leaves bindings
  unconsumed and prevents moderation calls.
- Integrated reviewer finding: no-lock report/update deliveries no longer mark
  trigger runtime proof verified; verified rows are reserved for active-lock
  unchanged, suppression, or reopen paths.
- Integrated reviewer finding: dashboard metric writes are now serialized by a
  short subreddit-scoped Redis mutex to prevent concurrent cross-target
  read-modify-write losses.
- Integrated reviewer finding: suppression metrics are decremented when a
  success audit write fails after metrics increment, matching the retryable
  rollback path.
- Integrated reviewer finding: stale relock failures between old-lock reopen
  and replacement creation now return a structured failure with runtime-failure
  audit instead of throwing through the form route.
- Integrated reviewer finding: report/update reopen paths now write a
  compensating runtime-failure audit if the required `lock_reopened` audit
  fails after state is already reopened.
- Integrated reviewer finding: form and dashboard reopen-dismiss paths now
  write a compensating runtime-failure audit if queue mutation fails after the
  dismissal audit.
- Focused validation:
  - `npm run test -- src/server/adapters/redis.test.ts src/routes/forms.test.ts src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/server/services/unlockFlow.test.ts --reporter verbose`
  - PASS, 5 test files and 60 tests.
  - `npm run test -- src/routes/triggers.update.test.ts src/routes/triggers.report.test.ts src/client/state/store.test.ts src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 5 test files and 85 tests.
  - `npm run test -- src/server/services/reportTriggers.test.ts src/routes/triggers.update.test.ts src/client/state/store.test.ts --reporter verbose`
  - Initial FAIL on one overly strict `lastSuppressedAt: undefined`
    `toMatchObject` assertion; corrected to assert the property separately.
  - Re-run PASS, 3 test files and 61 tests.
  - `npm run test -- src/routes/forms.test.ts --reporter verbose`
  - PASS, 1 test file and 15 tests.
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 test files and 38 tests.
  - `npm run test -- src/server/services/metrics.test.ts src/server/services/reportTriggers.test.ts --reporter verbose`
  - PASS, 2 test files and 31 tests.
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
  - PASS, 1 test file and 13 tests.
  - `npm run test -- src/server/services/lockFlow.test.ts src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts --reporter verbose`
  - Initial FAIL because `src/server/services/reopenFlow.test.ts` needed
    `listAuditEvents` imported for the new audit-failure assertion; fixed and
    re-ran PASS, 3 test files and 54 tests.
  - `npm run test -- src/routes/api.dashboard.test.ts src/routes/forms.test.ts src/server/services/lockFlow.test.ts src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts --reporter verbose`
  - Initial FAIL because the dashboard dismiss failure test enabled the Redis
    fault before seeding the reopen event; fixed and re-ran PASS, 5 test files
    and 81 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Pass/fail status: PASS for type-check, lint, 40 test files / 301 tests, and
  build.

## 2026-05-26 00:44 IST - Reviewer hardening integration

- Integrated reviewer finding: unchanged-report rollback now compensates
  partial metric writes even when the metric helper throws before returning.
  The rollback always attempts a suppressed-report metric decrement after the
  lock-level counter moves.
- Integrated reviewer finding: stale relock failures after queueing a reopen
  event now remove that queued event if the old lock still resolves as active,
  preserving active-with-no-queue or reopened-with-queue states.
- Integrated reviewer finding: manual unlock now writes a compensating
  `runtime_failure` audit if the required `lock_unlocked` audit fails after
  the lock is already inactive.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
  - PASS, 1 test file and 29 tests.
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
  - PASS, 1 test file and 14 tests.
  - `npm run test -- src/server/services/unlockFlow.test.ts src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts --reporter verbose`
  - PASS, 3 test files and 50 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 40 test files / 304 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 00:46 IST - Reviewer hardening integration

- Integrated reviewer finding: lock creation rollback now compensates
  `locksCreated` metrics when a saved lock is rolled back after metric or
  success-audit persistence fails.
- Added `decrementLockCreatedMetric()` and lock-flow regressions for success
  audit failure after metrics succeeded, plus target-record, daily-index, and
  target-index metric failures after partial created-lock writes.
- Focused validation:
  - `npm run test -- src/server/services/lockFlow.test.ts --reporter verbose`
  - PASS, 1 test file and 16 tests.
- Full validation:
  - Superseded by the 00:50 validation pass after the metric snapshot/restore
    changes landed.

## 2026-05-26 00:50 IST - Reviewer hardening integration

- Integrated reviewer finding: suppression metric rollback no longer
  decrements prior valid metrics if the new attempt fails before incrementing.
  Metric increment helpers now snapshot and restore prior daily/target records
  on partial failure.
- Integrated reviewer finding: created-lock metric rollback uses the same
  snapshot/restore boundary and only decrements after the created-lock metric
  helper returns successfully.
- Integrated reviewer finding: report-trigger and update-trigger reopen flows
  now write compensating `runtime_failure` audits when reopen metric
  persistence fails after the reopen queue/status transition is already
  visible.
- Focused validation:
  - `npm run test -- src/server/services/metrics.test.ts src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 4 test files and 66 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 40 test files / 310 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 00:55 IST - Reviewer hardening integration

- Integrated reviewer finding: seeded demo dashboard mutations are now rejected
  server-side. `demo=true` unlock and reopen-dismiss requests return a
  read-only error before Reddit calls, audit writes, or lock/reopen queue state
  changes.
- Focused validation:
  - `npm run test -- src/routes/api.dashboard.test.ts --reporter verbose`
  - PASS, 1 test file and 13 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 40 test files / 312 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:00 IST - Runtime proof hardening

- Hardened runtime proof loading so unverified post/comment report-trigger rows
  reconcile from durable non-demo `report_suppressed` audit events.
- Demo audit events do not upgrade runtime proof rows, and explicit `failed`
  runtime rows remain failed.
- Integrated reviewer finding: audit reconciliation now requires
  `targetKind` to be exactly `post` or `comment`, preventing legacy
  missing-kind suppression audits from falsely verifying comment report proof.
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts src/routes/api.dashboard.test.ts --reporter verbose`
  - PASS, 2 test files and 24 tests.
  - `npm run test -- src/server/services/runtimeProof.test.ts --reporter verbose`
  - PASS, 1 test file and 12 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 40 test files / 315 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:04 IST - Live WebView proof recheck

- Rechecked the live Reddit embedded dashboard in Zen on playtest
  `v0.0.2.185`.
- Runtime proof/status showed `postReportTrigger verified` from durable
  suppression audit reconciliation while keeping `commentReportTrigger
  unverified`.
- `Verify runtime` completed and displayed `Runtime proof refreshed.`
- Dashboard still showed 2 active locks, 1 report suppressed, and 2 reopened
  after edit.
- No report submission, post edit, comment edit, unlock, dismiss, remove, or
  approval action was performed in this recheck.

## 2026-05-26 01:06 IST - Runtime proof hardening

- Update-trigger `lock_reopened` audits now include
  `triggerCapabilityName`.
- Runtime proof loading now reconciles unverified update-trigger rows from
  durable non-demo reopen audits only when the audit capability name is known
  and its concrete reopen reason matches the trigger type.
- The failed-refetch `runtime_uncertain` path remains unverified, so fail-open
  behavior cannot be mistaken for live content-change trigger proof.
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 test files and 29 tests.
- Integrated reviewer finding: update-trigger proof reconciliation now also
  requires a target kind matching the trigger family, so post-only update proof
  cannot be verified by missing-kind or comment-target reopen audits.
- Additional focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 test files and 29 tests.
- Full validation:
  - Completed with demo reload hardening below.

## 2026-05-26 01:10 IST - Demo reload context hardening

- Demo dashboard boot now still infers or fetches embedded runtime context when
  the URL contains `demo=true&subreddit=reviewlock_demo`.
- Seeded demo reads stay in the deterministic demo namespace, while the live
  runtime subreddit is preserved as the exit target for returning to live mode.
- Integrated reviewer finding: reloaded demo URLs no longer fall back to the
  hardcoded `reviewlock` live namespace after demo exit.
- Focused validation:
  - `npm run test -- src/client/state/store.test.ts --reporter verbose`
  - PASS, 1 test file and 16 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 40 test files / 319 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:18 IST - Client/runtime dashboard hardening

- Used ModMirror's client resilience pattern as a reference and added
  ReviewLock-specific dashboard error notice classification for subreddit
  context mismatch, unavailable runtime dependencies, static preview, network
  failures, API errors, and unexpected contract responses.
- Preserved raw error detail while adding a concrete, non-destructive recovery
  action in both full-page and stale-data inline error states.
- Full-page initial-load errors now include a direct demo-mode action alongside
  Retry when the dashboard is not already in demo mode.
- Integrated reviewer finding: update-trigger proof now requires successful
  `unignoreReports()` before the trigger row can be verified through direct
  processing or durable reopen-audit reconciliation.
- Integrated reviewer finding: dashboard active-lock headline totals now count
  all active locks even when the rendered table remains capped.
- Integrated reviewer finding: dashboard suppressed-report and reopened totals
  now sum all persisted daily metric records while keeping the daily metrics
  response capped for UI display.
- Focused validation:
  - `npm run test -- src/client/state/clientNotice.test.ts src/client/render.test.ts --reporter verbose`
  - PASS, 2 test files and 21 tests after adding the full-page demo action
    regression.
  - `npm run lint`
  - PASS.
  - `npm run test -- src/server/services/runtimeProof.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 test files and 29 tests.
  - `npm run test -- src/server/services/dashboard.test.ts src/server/services/metrics.test.ts --reporter verbose`
  - PASS, 2 test files and 9 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 41 test files / 326 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:27 IST - Trigger proof and unlock form hardening

- Integrated reviewer finding: unchanged active-lock update-trigger deliveries
  no longer verify granular edit-break proof rows. A no-op update delivery is
  treated as route processing evidence only, not proof that the reopen loop
  completed.
- Integrated reviewer finding: changed-content report-trigger reopens keep
  fail-open local reopen behavior when `unignoreReports()` fails, but the
  report-trigger capability row stays unverified until the full loop returns
  reports to normal handling.
- Integrated reviewer finding: unlock form submissions now trust the
  server-bound form binding when Devvit omits the disabled display-only
  `lockId` field, while still rejecting a submitted mismatched lock id.
- Focused validation:
  - `npm run test -- src/server/services/reopenFlow.test.ts src/server/services/reportTriggers.test.ts src/routes/forms.test.ts --reporter verbose`
  - PASS, 3 test files and 64 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 41 test files / 328 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:30 IST - Endpoint-kind hardening

- Integrated reviewer finding: shared target id normalization now rejects
  already-prefixed ids when their thing kind contradicts the endpoint target
  kind.
- Comment routes still prefer `commentId` and `comment.id` over generic
  `targetId`, preserving the mixed-payload behavior already proven in tests.
- Added regressions for the shared normalizer, `/on-comment-update`,
  `/on-comment-report`, `/lock-comment`, and `/unlock-comment`.
- Focused validation:
  - `npm run test -- src/server/services/targetResolver.test.ts src/routes/triggers.update.test.ts src/routes/triggers.report.test.ts src/routes/menu.test.ts --reporter verbose`
  - PASS, 4 test files and 51 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 41 test files / 333 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:32 IST - Form binding hardening

- Validated Redis-backed form binding JSON before returning it to lock/unlock
  submit handlers.
- Malformed binding records are deleted on consume instead of remaining
  retryable.
- Binding creation now rolls back the Redis `set` when the expiry write fails,
  preventing long-lived form tokens without TTL.
- Focused validation:
  - `npm run test -- src/server/services/formBindings.test.ts src/routes/forms.test.ts src/routes/menu.test.ts --reporter verbose`
  - PASS, 3 test files and 30 tests.
  - `npm run type-check`
  - PASS after fixing the explicit parser return shape.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 336 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:35 IST - Redis runtime smoke hardening

- Used ModMirror's runtime proof matrix as a reference for Redis sorted-set
  smoke coverage.
- Expanded ReviewLock's existing `/api/smoke/redis` route to verify both
  namespaced string set/get/delete and sorted-set newest-first ordering.
- The smoke route cleans up the sorted-set key in a `finally` block and records
  the `redis` runtime proof row as failed if sorted-set ordering is wrong.
- Focused validation:
  - `npm run test -- src/routes/api.contract.test.ts --reporter verbose`
  - PASS, 1 test file and 10 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 337 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:37 IST - Reopen dismiss visibility hardening

- Hardened `dismissReopenEvent` so queue removal happens before the event
  record is marked dismissed.
- If queue removal fails, the reopened event remains open and visible.
- If the dismissed record write fails after queue removal, ReviewLock re-adds
  the event to the queue before returning failure.
- Updated form-route regression for queue mutation failure to assert the
  reopened item remains visible.
- Focused validation:
  - `npm run test -- src/server/services/reopenQueue.test.ts src/routes/forms.test.ts src/routes/api.dashboard.test.ts --reporter verbose`
  - PASS, 3 test files and 35 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 339 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:40 IST - Live WebView Redis smoke recheck

- Rechecked the live Reddit Devvit WebView in Zen after Redis runtime smoke was
  expanded to include sorted-set newest-first ordering.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in the WebView links: `v0.0.2.234`.
- Live dashboard rendered under `r/reviewlock_dev`.
- First viewport showed 2 active locks, 1 report suppressed, and 2 reopened
  after edit.
- Latest edit-break event showed `comment:ontlx1k`.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status still showed `redis verified`, which means the updated
  Redis smoke route's string and sorted-set checks passed in the live WebView
  context.
- Remaining unverified rows stayed correctly unverified:
  `commentReportTrigger`, `postFlairUpdateTrigger`, `postNsfwUpdateTrigger`,
  and `postSpoilerUpdateTrigger`.
- No live report submission, post edit, comment edit, unlock, or dismiss action
  was performed in this recheck.

## 2026-05-26 01:42 IST - Runtime proof capability hardening

- Hardened runtime proof normalization so persisted proof rows are limited to
  the known ReviewLock capability matrix.
- Unknown persisted capability rows are dropped before summarizing overall
  runtime status, preventing malformed stale rows from polluting dashboard
  proof.
- `recordCapabilityStatus` now rejects unknown capability names instead of
  writing them.
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts --reporter verbose`
  - PASS, 1 test file and 16 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 341 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:45 IST - Config record validation hardening

- Added shared schema validation for `ReviewLockConfig`.
- `loadConfig` now rejects malformed config JSON, invalid reason presets,
  non-positive expiry days, and config records whose embedded subreddit does
  not match the Redis namespace being loaded.
- `saveConfig` now rejects invalid config objects instead of writing them to
  Redis.
- Focused validation:
  - `npm run test -- src/server/services/config.test.ts src/shared/schema.test.ts --reporter verbose`
  - PASS, 2 test files and 11 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 345 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:47 IST - Persisted counter validation hardening

- Tightened shared schema validators so persisted lock counters and metrics
  counters must be non-negative integers.
- `ReviewLockConfig.lockExpiryDays` now also requires a positive integer.
- Malformed lock records with negative report counters are skipped by lock
  loaders and active-lock lists.
- Malformed daily and target metrics with negative counters are skipped by
  metric loaders and aggregate lists.
- Focused validation:
  - `npm run test -- src/shared/schema.test.ts src/server/services/locks.test.ts src/server/services/metrics.test.ts src/server/services/config.test.ts --reporter verbose`
  - PASS, 4 test files and 22 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 346 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:48 IST - Live WebView state-integrity recheck

- Rechecked the live Reddit Devvit WebView in Zen after runtime proof, config,
  and persisted counter validation hardening.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.246`.
- Live dashboard rendered under `r/reviewlock_dev`.
- First viewport showed 2 active locks, 1 report suppressed, and 2 reopened
  after edit.
- Latest edit-break event showed `comment:ontlx1k`.
- Runtime proof/status rendered the expected known capability matrix only.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Rows remained at the current claim boundary: `approve`, `ignoreReports`,
  `unignoreReports`, `redditContext`, `redis`, `postReportTrigger`,
  `postUpdateTrigger`, and `commentUpdateTrigger` verified; `commentReportTrigger`,
  `postFlairUpdateTrigger`, `postNsfwUpdateTrigger`, and
  `postSpoilerUpdateTrigger` unverified.
- No live report submission, post edit, comment edit, unlock, or dismiss action
  was performed in this recheck.

## 2026-05-26 01:50 IST - Redis hash smoke hardening

- Used ModMirror's broader runtime health approach as a reference for Redis
  smoke coverage.
- Expanded `/api/smoke/redis` to verify namespaced hash operations with
  `hset`, `hgetall`, and `hdel` in addition to string and sorted-set checks.
- The smoke route cleans up the hash key in a `finally` block and records the
  `redis` runtime proof row as failed if hash readback or field deletion is
  wrong.
- Focused validation:
  - `npm run test -- src/routes/api.contract.test.ts src/server/adapters/redis.test.ts --reporter verbose`
  - PASS, 2 test files and 16 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 347 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:51 IST - Live WebView Redis hash smoke recheck

- Rechecked the live Reddit Devvit WebView in Zen after `/api/smoke/redis` was
  expanded to include hash operations.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.250`.
- Live dashboard rendered under `r/reviewlock_dev`.
- First viewport showed 2 active locks, 1 report suppressed, and 2 reopened
  after edit.
- Latest edit-break event showed `comment:ontlx1k`.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status kept `redis verified`, proving the live WebView context
  completed the expanded string/hash/sorted-set Redis smoke route.
- Remaining unverified trigger rows stayed correctly unverified:
  `commentReportTrigger`, `postFlairUpdateTrigger`, `postNsfwUpdateTrigger`,
  and `postSpoilerUpdateTrigger`.
- No live report submission, post edit, comment edit, unlock, or dismiss action
  was performed in this recheck.

## 2026-05-26 01:56 IST - Redis guard TTL hardening

- Hardened temporary Redis guard handling for trigger mutexes, metrics
  mutations, lock creation guards, and report trigger dedupe markers.
- Guard acquisition now fails closed if the TTL lease cannot be set, releases
  the just-created guard when the owner still matches, and avoids moderation or
  metric side effects.
- Report trigger dedupe markers now clear themselves if the seven-day TTL cannot
  be written, keeping trigger delivery retryable.
- Focused validation:
  - `npm run test -- src/server/services/triggerMutex.test.ts src/server/services/metrics.test.ts src/server/services/lockFlow.test.ts src/server/services/reportTriggers.test.ts --reporter verbose`
  - PASS, 4 test files and 59 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 350 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 01:59 IST - Live WebView Redis lease hardening recheck

- Rechecked the live Reddit Devvit WebView in Zen after Redis guard TTL
  hardening.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.255`.
- Live dashboard rendered under `r/reviewlock_dev`.
- First viewport showed 2 active locks, 1 report suppressed, and 2 reopened
  after edit.
- Latest edit-break event showed `comment:ontlx1k`.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status kept `redis verified` after the code path changes around
  temporary Redis leases.
- Remaining unverified trigger rows stayed correctly unverified:
  `commentReportTrigger`, `postFlairUpdateTrigger`, `postNsfwUpdateTrigger`,
  and `postSpoilerUpdateTrigger`.
- No live report submission, post edit, comment edit, unlock, or dismiss action
  was performed in this recheck.

## 2026-05-26 02:00 IST - Persisted timestamp validation hardening

- Tightened shared schema validation so persisted locks, reopen events, audit
  events, target metrics, and config records require strict ISO UTC timestamps.
- Tightened daily metrics validation to require real `YYYY-MM-DD` dates.
- Added regressions proving malformed or impossible dates are skipped from
  active locks, audit logs, reopen queues, and metrics aggregation.
- Focused validation:
  - `npm run test -- src/shared/schema.test.ts src/server/services/locks.test.ts src/server/services/audit.test.ts src/server/services/reopenQueue.test.ts src/server/services/metrics.test.ts src/server/services/config.test.ts --reporter verbose`
  - PASS, 6 test files and 31 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 351 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:02 IST - Live WebView timestamp validation recheck

- Rechecked the live Reddit Devvit WebView in Zen after strict persisted
  timestamp validation landed.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.264`.
- Live dashboard rendered under `r/reviewlock_dev` without dropping existing
  persisted data.
- First viewport still showed 2 active locks, 1 report suppressed, and 2
  reopened after edit.
- Audit timeline still showed 9 entries, and the latest edit-break event still
  showed `comment:ontlx1k`.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status kept `redis verified`; the remaining unverified trigger
  rows stayed correctly unverified.
- No live report submission, post edit, comment edit, unlock, or dismiss action
  was performed in this recheck.

## 2026-05-26 02:03 IST - Client target-link hardening

- Added `noopener` alongside `noreferrer` on active-lock target links that open
  in a new tab.
- Added a render regression proving new-tab target links keep
  `rel="noopener noreferrer"`.
- Focused validation:
  - `npm run test -- src/client/render.test.ts --reporter verbose`
  - PASS, 1 test file and 17 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 351 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:05 IST - Runtime proof contract hardening

- Exported and reused strict ISO timestamp validators for runtime proof
  records.
- Tightened server runtime proof loading and saving so unknown status values,
  malformed `generatedAt`, and malformed capability `checkedAt` values are not
  persisted or treated as proof.
- Tightened the client API contract validator so malformed runtime proof JSON is
  rejected before dashboard rendering.
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts src/client/state/api.test.ts src/shared/schema.test.ts --reporter verbose`
  - PASS, 3 test files and 33 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 353 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:06 IST - Live WebView runtime proof contract recheck

- Rechecked the live Reddit Devvit WebView in Zen after strict runtime proof
  status and timestamp validation landed.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.274`.
- Live dashboard rendered under `r/reviewlock_dev` without dropping existing
  persisted data.
- First viewport still showed 2 active locks, 1 report suppressed, and 2
  reopened after edit.
- Latest edit-break event still showed `comment:ontlx1k`, and the audit
  timeline still showed 9 entries.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status kept expected strict capability states:
  `approve verified`, `commentReportTrigger unverified`,
  `commentUpdateTrigger verified`, `ignoreReports verified`,
  `postFlairUpdateTrigger unverified`, `postNsfwUpdateTrigger unverified`,
  `postReportTrigger verified`, `postSpoilerUpdateTrigger unverified`,
  `postUpdateTrigger verified`, `redditContext verified`, `redis verified`,
  and `unignoreReports verified`.
- No live report submission, post edit, comment edit, unlock, or dismiss action
  was performed in this recheck.

## 2026-05-26 02:09 IST - Client API domain-record contract hardening

- Tightened the dashboard API client so locks, reopen events, audit events,
  daily metrics, and target metrics are validated with shared domain validators
  before rendering.
- Tightened overview validation so headline counts must be non-negative
  integers and nested churn/reopen records must match their domain contracts.
- Added client API regressions for malformed lock, reopen, audit, daily metric,
  target metric, overview count, overview churn, and overview latest-reopen
  payloads.
- Focused validation:
  - `npm run test -- src/client/state/api.test.ts --reporter verbose`
  - PASS, 1 test file and 11 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 355 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:10 IST - Live WebView client-record validation recheck

- Rechecked the live Reddit Devvit WebView in Zen after client API list-record
  validation landed.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.280`.
- Live dashboard rendered under `r/reviewlock_dev` with persisted locks,
  reopen events, churn metrics, runtime proof rows, and audit history accepted
  by the stricter client validators.
- First viewport still showed 2 active locks, 1 report suppressed, and 2
  reopened after edit.
- Latest edit-break event still showed `comment:ontlx1k`, and the audit
  timeline still showed 9 entries.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- No live report submission, post edit, comment edit, unlock, or dismiss action
  was performed in this recheck.

## 2026-05-26 02:15 IST - Moderator action body validation hardening

- Tightened dashboard unlock and reopen-dismiss API body handling so required
  ids must be strings before moderation, audit, or queue side effects.
- Tightened Devvit form submissions so form token, subreddit, target, lock, and
  reopen action fields are normalized before use.
- Malformed actor fallback values are now ignored instead of throwing before
  Reddit username lookup.
- Malformed optional lock notes are ignored, and malformed string expiry values
  are rejected before lock form tokens are consumed.
- Cross-checked the sibling ModMirror workspace at
  `/Users/arshdeepsingh/Developer/ModMirror`; its routes commonly cast parsed
  bodies after `req.json().catch`, so ReviewLock intentionally uses a stricter
  local boundary for moderator actions.
- Focused validation:
  - `npm run test -- src/routes/api.dashboard.test.ts src/routes/forms.test.ts --reporter verbose`
  - PASS, 2 test files and 35 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 360 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:21 IST - Live WebView moderator-action validation recheck

- Rechecked the live Reddit Devvit WebView in Zen after moderator action body
  validation landed.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.286`.
- Live dashboard rendered under `r/reviewlock_dev` with 2 active locks, 1
  report suppressed, 2 reopened after edit, latest edit-break target
  `comment:ontlx1k`, and 9 audit timeline entries.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status remained honestly scoped as `unverified` overall because
  some platform trigger capabilities are still unverified.
- No live report submission, post edit, comment edit, unlock, dismiss, or
  destructive moderation action was performed in this recheck.

## 2026-05-26 02:23 IST - Devvit route payload validation hardening

- Tightened menu, report-trigger, and update-trigger route body readers so
  JSON bodies are treated as unknown records before field-level validation.
- `normalizeTargetId()` now rejects non-string and blank ids, trims accepted
  strings, and still rejects wrong-kind prefixed ids at endpoint boundaries.
- Report/update route wrappers now only include nested payloads when they are
  objects, only accept event/subreddit/timestamp fields when they are non-empty
  strings, and only accept report counts when they are safe non-negative
  integers.
- Added regressions for malformed menu target ids, malformed report/update
  target ids, and malformed report counts falling back to the refetched target
  count.
- Focused validation:
  - `npm run test -- src/server/services/targetResolver.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts src/routes/menu.test.ts --reporter verbose`
  - PASS, 4 test files and 56 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 365 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:25 IST - Live WebView route-payload validation recheck

- Rechecked the live Reddit Devvit WebView in Zen after route payload
  validation landed.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.295`.
- Live dashboard rendered under `r/reviewlock_dev` with 2 active locks, 1
  report suppressed, 2 reopened after edit, latest edit-break target
  `comment:ontlx1k`, and 9 audit timeline entries.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status remained honestly scoped as `unverified` overall because
  some platform trigger capabilities are still unverified.
- No live report submission, post edit, comment edit, unlock, dismiss, or
  destructive moderation action was performed in this recheck.

## 2026-05-26 02:26 IST - Reddit adapter model validation hardening

- Tightened Devvit Reddit adapter model mapping so external model fields are
  validated before creating `ReviewLockTarget` records.
- Required target ids must now be concrete strings and wrong-kind prefixed ids
  throw inside the adapter, which routes trigger flows through existing
  target-refetch fail-open handling.
- Optional string metadata now becomes a string or safe absence/default.
- Report counts now require safe non-negative integers, and NSFW/spoiler flags
  require booleans or boolean-returning methods.
- Added adapter regressions for malformed optional fields, malformed model ids,
  and wrong-kind prefixed ids.
- Focused validation:
  - `npm run test -- src/server/adapters/reddit.test.ts --reporter verbose`
  - PASS, 1 test file and 6 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 367 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:28 IST - Live WebView Reddit adapter validation recheck

- Rechecked the live Reddit Devvit WebView in Zen after Reddit adapter model
  validation landed.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.299`.
- Live dashboard rendered under `r/reviewlock_dev` with 2 active locks, 1
  report suppressed, 2 reopened after edit, latest edit-break target
  `comment:ontlx1k`, and 9 audit timeline entries.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status remained honestly scoped as `unverified` overall because
  some platform trigger capabilities are still unverified.
- No live report submission, post edit, comment edit, unlock, dismiss, or
  destructive moderation action was performed in this recheck.

## 2026-05-26 02:31 IST - Client runtime context validation hardening

- Tightened client runtime subreddit discovery so Devvit WebView globals are
  treated as unknown records before reading `context.subredditName`.
- Rejected malformed Devvit globals, primitive nested contexts, array contexts,
  and invalid subreddit names before falling back to Reddit URL/referrer scope.
- Normalized query-string subreddit values before store construction.
- Normalized store constructor, `setSubreddit()`, and `updateSubredditContext()`
  inputs before using them for dashboard API fetches.
- Added regressions for malformed Devvit globals, invalid initial scope,
  invalid manual subreddit changes, and ignored invalid runtime-context updates.
- Focused validation:
  - `npm run test -- src/client/state/runtimeContext.test.ts src/client/state/store.test.ts --reporter verbose`
  - PASS, 2 test files and 24 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 370 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:33 IST - Live WebView client runtime-context validation recheck

- Rechecked the live Reddit Devvit WebView in Zen after client runtime-context
  validation landed.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.302`.
- Live dashboard rendered under `r/reviewlock_dev` with 2 active locks, 1
  report suppressed, 2 reopened after edit, latest edit-break target
  `comment:ontlx1k`, and 9 audit timeline entries.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime proof/status remained honestly scoped as `unverified` overall because
  some platform trigger capabilities are still unverified.
- No live report submission, post edit, comment edit, unlock, dismiss, or
  destructive moderation action was performed in this recheck.

## 2026-05-26 02:34 IST - Embedded audit timeline layout hardening

- Fixed the audit timeline layout after live Zen screenshots showed audit
  timestamps, messages, and lock details overlapping inside the Reddit embedded
  WebView.
- Split audit rows out of the shared horizontal queue/churn row CSS and made
  them vertical timeline entries.
- Added wrapping audit metadata, semantic `<time>` output, explicit timestamp
  attribute escaping, and long-id-safe wrapping for audit message/details text.
- Focused validation:
  - `npm run test -- src/client/render.test.ts --reporter verbose`
  - PASS, 1 test file and 17 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 370 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 42 test files / 370 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.
- Live/visual verification:
  - Reloaded the Reddit Devvit WebView in Zen; playtest links showed
    `v0.0.2.306`.
  - Built a temporary audit timeline preview with the real `src/client/styles.css`
    and representative long target/lock ids, served it locally, and captured a
    Playwright screenshot.
  - Visual preview confirmed audit kind, timestamp, actor, message, and long
    lock/target details now wrap vertically without overlap.

## 2026-05-26 02:41 IST - Audit timeline accessibility hardening

- Added an `aria-label` summary to each audit timeline row so browser
  accessibility tooling and assistive technology can read the audit kind,
  timestamp, actor, message, target, lock, operation, error, and reason as one
  coherent ledger entry.
- Reused the same normalized audit detail fields already rendered visually and
  escaped the generated label as an HTML attribute.
- Added a render regression that verifies audit rows include a readable
  accessible summary.
- Focused validation:
  - `npm run test -- src/client/render.test.ts --reporter verbose`
  - PASS, 1 test file and 17 tests.
  - `npm run type-check`
  - PASS.

## 2026-05-26 02:47 IST - Client render formatting hardening

- Centralized client string-template helpers for text escaping, attribute
  escaping, local date labels, enum-token labels, and displayed Reddit thing
  ids in `src/client/utils/format.ts`.
- Updated the dashboard page, active-lock table, reopen queue, latest reopen
  panel, runtime banner, and audit timeline to use the shared helpers.
- Added direct helper regressions for text escaping, attribute escaping,
  token-label rendering, and canonical thing-prefix trimming.
- Focused validation:
  - `npm run test -- src/client/render.test.ts src/client/utils/format.test.ts --reporter verbose`
  - PASS, 2 test files and 21 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 374 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 02:50 IST - Live audit timeline formatting recheck

- Rechecked the live Reddit Devvit WebView in Zen after the audit timeline
  layout, accessibility, and shared render-formatting hardening passes.
- Existing dashboard post:
  `https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- Logged-in browser account: `u/BrightyBrainiac`.
- Playtest version observed in WebView links: `v0.0.2.317`.
- Live dashboard rendered under `r/reviewlock_dev` with 2 active locks, 1
  report suppressed, 2 reopened after edit, latest edit-break target
  `comment:ontlx1k`, and 9 audit timeline entries.
- Runtime proof/status preserved the current claim boundary:
  `postReportTrigger`, `postUpdateTrigger`, and `commentUpdateTrigger`
  verified; `commentReportTrigger`, `postFlairUpdateTrigger`,
  `postNsfwUpdateTrigger`, and `postSpoilerUpdateTrigger` unverified.
- Audit timeline rows exposed separate kind, timestamp, actor, message, and
  target/lock/reason detail nodes in the live WebView accessibility tree.
- Computer Use bitmap capture and macOS `screencapture` both landed on the
  wrong visible desktop space during this pass, so no new live bitmap screenshot
  is claimed for this recheck.
- No live report submission, post edit, comment edit, unlock, dismiss, or
  destructive moderation action was performed in this recheck.

## 2026-05-26 12:59 IST - Runtime proof reconciliation evidence hardening

- Tightened runtime proof reconciliation so audit-derived report trigger proof
  requires a non-empty `targetId`, `targetKind`, and `lockId`.
- Tightened audit-derived update trigger proof so reopen audit evidence requires
  a non-empty `targetId`, matching `targetKind`, non-empty `lockId`, matching
  reopen reason, and successful `unignoreReports`.
- Added regressions that partial suppression audits and partial reopen audits do
  not turn `postReportTrigger`, `commentReportTrigger`, or update-trigger rows
  verified.
- Focused validation:
  - `npm run test -- src/server/services/runtimeProof.test.ts --reporter verbose`
  - PASS, 1 test file and 18 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 375 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 13:25 IST - Runtime-uncertain retry and audit timeline hardening

- Changed report and update trigger target-refetch uncertainty so known active
  locks remain active with `target_resolution_failed` runtime warnings instead
  of being moved to a `runtime_uncertain` reopen before `unignoreReports()` can
  run.
- Added runtime-failure audit data with `recovery: active_lock_retry_required`
  for those retryable target-resolution failures.
- Added a regression proving report dedupe is cleared even if the new
  retryable runtime-failure audit write fails, then the same report event id can
  retry and suppress unchanged content after target refetch recovers.
- Reworked the audit timeline markup/CSS into timestamp and content lanes with
  labeled detail rows so long target and lock ids do not overlap inside the
  Reddit embed.
- Captured local browser screenshots:
  - `output/playwright/audit-timeline-layout-fixed.png`
  - `output/playwright/audit-timeline-layout-fixed-mobile.png`
- Focused validation:
  - `npm run test -- src/client/render.test.ts --reporter verbose`
  - PASS, 1 file and 17 tests.
  - `npm run type-check`
  - PASS.
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
  - PASS, 4 files and 87 tests.
  - `npm run test -- src/server/services/reportTriggers.test.ts --reporter verbose`
  - PASS, 1 file and 34 tests.
  - `npm run build`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 376 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 13:31 IST - Reopen warning dismissal hardening

- Blocked dashboard and form dismissals for reopen queue items that still carry
  unresolved runtime warnings.
- Updated the reopened queue and latest edit-break panel so warned items show
  `Resolve warning first` instead of a dismiss button.
- Kept rejected warning-bearing dismissals from writing `reopen_dismissed`
  audits or removing queue visibility.
- Focused validation:
  - `npm run test -- src/client/render.test.ts src/routes/api.dashboard.test.ts src/routes/forms.test.ts --reporter verbose`
  - PASS, 3 files and 54 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 378 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 13:38 IST - Transient target warning recovery

- Cleared resolved `target_resolution_failed` warnings when a later report
  trigger successfully refetches the target and suppresses unchanged content.
- Cleared resolved `target_resolution_failed` warnings when a later update
  trigger successfully refetches the target and finds the fingerprint unchanged.
- Preserved non-transient runtime warnings by clearing only the resolved
  target-refetch warning.
- Updated `docs/RUNTIME_PROOF.md` so the primary runtime claim-boundary doc
  matches the retryable active-lock behavior.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 2 files and 50 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 379 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 13:45 IST - Dashboard launch idempotency hardening

- Stored the created ReviewLock dashboard custom-post permalink under the
  subreddit namespace and reused it on later dashboard launches.
- Added a short Redis creation lease for first-time dashboard post creation so
  concurrent menu submits do not create duplicate visible posts.
- Failed closed before post creation when the launch record cannot be read or
  the creation lease cannot be reserved.
- Returned a neutral warning when a post is created but the reuse record cannot
  be saved, instead of silently claiming durable reuse.
- Focused validation:
  - `npm run test -- src/routes/forms.test.ts src/server/services/keys.test.ts --reporter verbose`
  - PASS, 2 files and 27 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 383 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 13:50 IST - Trigger wrapper and retry-warning regression hardening

- Added direct update-route coverage for alternate Devvit wrapper aliases
  `nsfwPostUpdate` and `spoilerPostUpdate`.
- Added a report-trigger regression for the sequence target refetch failure,
  active-lock `target_resolution_failed` warning, changed-content retry,
  unignore failure, and visible reopen without the stale target-resolution
  warning.
- Added the same changed-content retry warning regression for update-trigger
  reopen flow.
- Focused validation:
  - `npm run test -- src/routes/triggers.update.test.ts src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts --reporter verbose`
  - PASS, 3 files and 76 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 387 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 13:58 IST - Config reason preset hardening

- Loaded subreddit config when rendering `Lock review` forms.
- Built form reason options and defaults from configured `reasonPresets`,
  falling back to the shared presets only when the config has no enabled
  reasons.
- Rejected lock submissions that use globally valid reason presets disabled by
  the current subreddit config without consuming the form token.
- Kept lock expiry out of moderator UI and submission claims until an expiry
  enforcement path exists.
- Focused validation:
  - `npm run test -- src/routes/menu.test.ts src/routes/forms.test.ts src/server/services/config.test.ts --reporter verbose`
  - PASS, 3 files and 44 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 390 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 14:03 IST - Config read failure hardening

- Loaded config before creating lock form bindings and fell back to default
  reason presets when the config read fails.
- Returned a clear retry toast when config cannot be read during lock submit,
  before consuming the form token or calling Reddit moderation methods.
- Added regressions for both menu-time config read failure and submit-time
  config read failure.
- Focused validation:
  - `npm run test -- src/routes/menu.test.ts src/routes/forms.test.ts src/server/services/config.test.ts --reporter verbose`
  - PASS, 3 files and 46 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 392 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 14:09 IST - Dashboard launch permalink hardening

- Scoped cached dashboard launch permalinks to the current subreddit before
  reuse.
- Ignored and replaced cached dashboard launch records that point to external
  URLs or another subreddit.
- Updated subreddit dashboard launch copy and `devvit.json` copy to describe
  first-run creation plus future reuse.
- Updated namespace and runtime proof docs so dashboard-post reuse is recorded
  as implemented and locally tested, not live verified.
- Focused validation:
  - `npm run test -- src/routes/forms.test.ts src/routes/menu.test.ts src/server/services/keys.test.ts --reporter verbose`
  - PASS, 3 files and 46 tests.
  - `npm run type-check`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 395 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 15:08 IST - Subreddit namespace and trigger boundary hardening

- Reviewed the reviewer agent's dirty implementation changes and kept the
  useful trigger-boundary direction.
- Canonicalized runtime subreddit names to lowercase for client context,
  server runtime hardening, form/API scope checks, dashboard launch records,
  runtime smoke, and trigger fallback paths.
- Kept malformed trigger fallback subreddit values from selecting arbitrary
  Redis namespaces when target refetch fails.
- Used the canonical selected report-trigger namespace after successful target
  refetches so `unknown` or mixed-case target subreddit fields do not miss
  active locks.
- Treated malformed report trigger timestamps as untrusted and used the server
  clock for dedupe, audit, and metric writes.
- Added dashboard launch regressions for mixed-case subreddit names and unsafe
  newly created post permalinks, plus retryable dashboard post creation
  failures.
- Focused validation:
  - `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/routes/forms.test.ts src/routes/api.contract.test.ts src/routes/api.dashboard.test.ts src/server/services/runtimeHardening.test.ts src/client/state/runtimeContext.test.ts --reporter verbose`
  - PASS, 7 files and 133 tests.
  - `npm run type-check`
  - PASS.
  - `npm run lint`
  - PASS.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 411 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 15:19 IST - Target namespace hardening

- Reviewed the active reviewer-agent findings after the handoff.
- Canonicalized lock creation target subreddit namespaces before Redis creation
  guards, active-lock lookup, persisted lock records, metrics, audit events,
  and runtime proof writes.
- Canonicalized lock/unlock menu form bindings and rendered subreddit fields
  so mixed-case target payloads do not create immediately expired forms.
- Canonicalized manual/dashboard unlock target scope before expected-subreddit
  comparison and active-lock lookup, with validated expected-subreddit fallback
  for `unknown` target context.
- Focused validation:
  - `npm run test -- src/server/services/lockFlow.test.ts src/server/services/unlockFlow.test.ts src/server/services/formBindings.test.ts src/routes/menu.test.ts src/routes/forms.test.ts src/routes/api.dashboard.test.ts --reporter verbose`
  - PASS, 6 files and 99 tests.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 417 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 15:28 IST - Audit timeline timestamp polish

- Shortened audit timeline timestamps from full locale date/time strings to a
  compact date/time stack while preserving full timestamp context in `title`
  and row aria labels.
- Tightened audit timeline desktop/mobile CSS so kind, actor, message, target,
  lock, and reason fields render as a readable vertical flow.
- Regenerated the tracked desktop and mobile audit timeline screenshots with
  ReviewLock CSS loaded over localhost after an initial blocked `file://`
  stylesheet attempt produced unstyled artifacts.
- Focused validation:
  - `npm run test -- src/client/render.test.ts src/client/state/store.test.ts --reporter verbose`
  - PASS, 2 files and 35 tests.
  - `npm run build`
  - PASS.
- Browser proof:
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename /Users/arshdeepsingh/Developer/ReviewLock/output/playwright/audit-timeline-layout-fixed.png`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename /Users/arshdeepsingh/Developer/ReviewLock/output/playwright/audit-timeline-layout-fixed-mobile.png`
  - PASS, styled screenshots captured at 1280x720 and 390x720.
- Full validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
  - `rg -n "TODO" src`
  - `rg -n "not reportable|disable reports|blocked reports|reports disabled|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src docs README.md`
- Pass/fail status: PASS for type-check, lint, 43 test files / 417 tests,
  build, diff whitespace check, and source TODO scan.
- Forbidden-copy scan matched only guardrail tests, audit docs, prompts, and
  proof checklists; no production UI copy match was found.

## 2026-05-26 18:34 IST - Reviewer handoff claim-boundary corrections

- Identified reviewer-agent work since the previous Codex pass: launch and
  submission docs, runtime-proof screenshots, demo/API hardening, target-link
  canonicalization, form-binding identity checks, and verified Devvit upload
  state for version `0.0.5`.
- Applied the current reviewer findings:
  - Reworded Devpost accomplishments so controlled post suppression and post
    edit reopening are described as separate controlled targets.
  - Reworded the older `npm run test` proof row as an earlier local gate.
  - Updated the claim-copy audit to match the expanded dashboard render-test
    forbidden phrase set.
  - Rephrased README and app-listing terms copy so product-facing copy avoids
    the exact "users cannot report" forbidden phrase while still stating the
    reporting-surface boundary.
- Validation:
  - `git diff --check`
  - PASS.
  - `test -s output/submission/01-live-lock-form-zen.png && test -s output/submission/02-live-dashboard-runtime-proof.png && test -s output/submission/03-local-dashboard-active-locks.png && test -s output/submission/04-local-reopened-after-edit.png && test -s output/submission/05-local-demo-mode.png`
  - PASS.
  - `rg -n "TODO" src || true`
  - PASS, no source TODO matches.
  - `rg -n "not reportable|disable reports|reports disabled|blocked reports|users cannot report|cannot report locked content|AI decides|automatic removal|permanent|forever" README.md docs src || true`
  - PASS after manual review: remaining matches are guardrail docs, tests,
    prompts, historical review notes, proof/audit documents, or fixtures;
    README and app-listing product copy no longer match the exact "users
    cannot report" phrase.
  - `npm run type-check`
  - PASS.
  - `npm run lint`
  - PASS.
  - `npm run test`
  - PASS, 43 files / 434 tests.
  - `npm run build`
  - PASS.

## 2026-05-26 18:40 IST - Submission screenshot manifest

- Addressed the reviewer finding that the final Devpost screenshot set had no
  stable artifact mapping.
- Captured `output/submission/01-live-lock-form-zen.png` from live Reddit in
  Zen with the Devvit `Lock review` form open and not submitted.
- Selected four existing browser proof artifacts into `output/submission/` for
  runtime proof, active-lock dashboard, reopened-after-edit queue, and demo
  mode slots.
- Added `docs/SCREENSHOTS.md` with source labels and captions so local
  regression artifacts are not presented as live Reddit WebView proof.
- Updated Devpost and launch checklist docs to reference the manifest.
- Validation:
  - `git diff --check`
  - PASS.
  - `test -s output/submission/01-live-lock-form-zen.png && test -s output/submission/02-live-dashboard-runtime-proof.png && test -s output/submission/03-local-dashboard-active-locks.png && test -s output/submission/04-local-reopened-after-edit.png && test -s output/submission/05-local-demo-mode.png`
  - PASS.
  - `rg -n "TODO" src || true`
  - PASS, no source TODO matches.
  - `rg -n "not reportable|disable reports|reports disabled|blocked reports|users cannot report|cannot report locked content|AI decides|automatic removal|permanent|forever" README.md docs src || true`
  - PASS after manual review: remaining matches are guardrail docs, tests,
    prompts, historical review notes, proof/audit documents, or fixtures;
    README and app-listing product copy no longer match the exact "users
    cannot report" phrase.
  - `npm run type-check`
  - PASS.
  - `npm run lint`
  - PASS.
  - `npm run test`
  - PASS, 43 files / 434 tests.
  - `npm run build`
  - PASS.
