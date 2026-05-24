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
