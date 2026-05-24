# Devvit Registration Proof

Wave 21 checked ReviewLock's Devvit registration path against the known-good
ModMirror workspace and the logged-in Reddit developer account.

Date: 2026-05-24

## Account and app state

Command:

```bash
npx devvit whoami
```

Result:

```txt
Logged in as u/BrightyBrainiac
```

Command:

```bash
npx devvit view --json
```

Result after `npm run build`:

- app id: `5201a616-7c35-48d6-a030-743e41456e69`
- slug/name: `reviewlock`
- owner: `BrightyBrainiac`
- app account: `reviewlock`
- install count: `1`
- versions count before Wave 21 playtest loop: `23`
- public API version: `0.12.24`
- default playtest subreddit id: `t5_i1a3xr`
- `hasDevvitJson`: `true`
- app capabilities: `10`, `11`
- `isWebviewEnabled`: `false`

`npx devvit view --json` failed before a build with:

```txt
Error: Your devvit.json references files that don't exist: `config.server`
(dist/server/index.cjs). You may need to run your build script to fix this.
```

That is expected for a clean checkout with no `dist/` bundle. `npm run build`
creates:

```txt
dist/client/default.css
dist/client/default.js
dist/client/default.js.map
dist/client/index.html
dist/server/index.cjs
dist/server/index.cjs.map
```

## ModMirror comparison

Compared:

- `/Users/arshdeepsingh/Developer/ReviewLock/devvit.json`
- `/Users/arshdeepsingh/Developer/ReviewLock/package.json`
- `/Users/arshdeepsingh/Developer/ModMirror/devvit.json`
- `/Users/arshdeepsingh/Developer/ModMirror/package.json`

Matching schema-critical shape:

- schema v1 config file
- `server.dir: dist/server`
- `server.entry: index.cjs`
- `post.dir: dist/client`
- default WebView entry `index.html`
- `height: tall`
- `inline: true`
- Devvit script build command `vite build`
- Devvit script dev command `vite build --watch`
- `dev.subreddit` points to a small test subreddit

Intentional ReviewLock differences:

- `permissions.redis: true` because ReviewLock stores locks, metrics, audit,
  and reopen queues in Redis.
- Report/update trigger endpoints are registered because ReviewLock's core loop
  depends on report suppression and edit-aware reopen.
- ReviewLock uses post, comment, and subreddit menus for lock, unlock, and
  dashboard entry points.

Wave 21 aligned the remaining project ergonomics with ModMirror:

- added `login` script: `devvit login`
- added Node engine floor: `>=22.2.0`
- added menu descriptions using Devvit's accepted `description` field

## Devvit CLI surface

Command:

```bash
npx devvit init --help
```

Result:

- `devvit init [CODE]`
- supports `--config`, `--template`, and `--force`
- no code is required when using the browser app creation flow

Command:

```bash
npx devvit upload --help
```

Result:

- `devvit upload`
- supports `--config`, `--version`, `--bump`, `--copy-paste`, and `--verbose`
- uploaded apps are visible to the owner and can be installed to small test
  subreddits

Decision: do not run `devvit init --force`. The app is already registered to
`u/BrightyBrainiac` as `reviewlock`; forced init would create a new app identity
instead of hardening the existing registered app.

## Playtest loop

Command:

```bash
npm run dev -- reviewlock_dev
```

This command was run four times from the terminal. Each pass completed a build,
uploaded or reused WebView assets, updated the test subreddit install, and
reached `Playtest ready`.

Observed playtest versions:

- `v0.0.1.24`
- `v0.0.1.26`
- `v0.0.1.28`
- `v0.0.1.30`

Stable URL:

```txt
https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock
```

Observed WebView connection log line:

```txt
reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock connected
```

No recursive build loop was observed. Each pass had one client rebuild and one
server rebuild before install update. The playtest process remains a watcher, so
it was stopped with Ctrl-C after readiness was observed.

## Logs

Command:

```bash
npx devvit logs reviewlock_dev reviewlock --since 1m --show-timestamps
```

Result:

- connected to the same ReviewLock dashboard WebView
- began streaming logs for `reviewlock` on `r/reviewlock_dev`
- no runtime error log lines appeared during the observation window

## Dependency hardening

`npm install --package-lock-only` initially reported 30 vulnerabilities. The
same `tmp` and `ws` overrides used by ModMirror reduced that count to the Devvit
protobuf chain. ReviewLock then tested an explicit `protobufjs@8.4.2` override.

Commands:

```bash
npm view protobufjs version
npm install
node -p "require('./node_modules/protobufjs/package.json').version"
npm run type-check
npm run build
npm run dev -- reviewlock_dev
npm audit --omit=dev --audit-level=critical
```

Results:

- latest `protobufjs` reported by npm: `8.4.2`
- installed `protobufjs`: `8.4.2`
- TypeScript passed
- Devvit build passed
- Devvit playtest reached `Playtest ready` at `v0.0.1.30`
- production audit reported `found 0 vulnerabilities`

## Remaining live-proof boundary

Wave 21 proves the app is registered, builds, uploads, installs to the test
subreddit, and starts playtest repeatedly. It does not prove destructive or
moderation-side behavior such as live `approve()`, `ignoreReports()`,
`unignoreReports()`, real report trigger delivery, or real edit trigger
delivery. Those claims remain unverified until controlled Reddit test content
and report/update events are exercised.
