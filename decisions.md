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
