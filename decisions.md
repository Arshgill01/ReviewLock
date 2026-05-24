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
