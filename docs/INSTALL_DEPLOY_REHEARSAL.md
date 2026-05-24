# Install and Deploy Rehearsal

Wave 29 rehearsed the Devvit account, private upload, install, playtest, and log access path on May 24, 2026.

## Scope

This rehearsal did not publish ReviewLock publicly. It used the signed-in developer account and the controlled test subreddit `r/reviewlock_dev`.

## Account and App Status

Command:

```bash
npx devvit whoami
```

Result:

- PASS.
- CLI reported `Logged in as u/BrightyBrainiac`.
- No browser login was requested.

Command:

```bash
npx devvit view --json
```

Result:

- PASS.
- App slug: `reviewlock`.
- App id: `5201a616-7c35-48d6-a030-743e41456e69`.
- Owner: `BrightyBrainiac`.
- Public API version: `0.12.24`.
- Install count: `1`.
- Versions count after upload: `32`.
- Latest uploaded version: `0.0.2`.
- Default playtest subreddit id: `t5_i1a3xr`.
- `isWebviewEnabled` reported `false`.

## CLI Capability Checks

Command:

```bash
npx devvit upload --help
```

Result:

- PASS.
- Help output described upload as a developer-visible app version and test-subreddit install path.
- No public publish was implied by this command.

Command:

```bash
npx devvit install --help
```

Result:

- PASS.
- Help output confirmed the shape `devvit install SUBREDDIT [APPWITHVERSION]`.

Command:

```bash
npx devvit logs --help
```

Result:

- PASS.
- Help output confirmed `devvit logs SUBREDDIT [APP]` with `--since`, `--show-timestamps`, and `--log-runtime`.

## Private Upload

Command:

```bash
npx devvit upload
```

Result:

- PASS.
- Vite build completed as part of upload.
- CLI automatically bumped app version to `0.0.2`.
- Upload completed and reported: `Visit https://developers.reddit.com/apps/reviewlock to view your app!`
- Two new WebView assets were uploaded.

Public publish status:

- No `devvit publish` command was run.
- No public release action was taken.

## Controlled Subreddit Install

Command:

```bash
npx devvit install reviewlock_dev
```

Result:

- PASS.
- CLI reported the app was currently on version `0.0.1.30`.
- Install to `r/reviewlock_dev` completed successfully.
- CLI reported: `Successfully installed version 0.0.2!`

Permission surface shown by CLI:

- Observe Reddit events.
- Appear in subreddit, post, and comment menu entries, and custom posts.
- Execute when installed or upgraded.
- Create a custom post.
- Read and write Reddit data.
- Read and write app data to Reddit servers.
- Appear and act as a moderator on installed subreddits.
- Embed webapps.

## Playtest Rehearsal

Command:

```bash
npm run dev -- reviewlock_dev
```

Result:

- PASS.
- Build completed.
- Client rebuild completed.
- Server rebuild completed.
- CLI reported `Playtest ready`.
- Playtest URL reported: `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.
- Playtest version reported: `v0.0.2.2`.

Runner note:

- The playtest process continued as a watcher after reaching the ready state.
- The command session did not keep stdin open, so the watcher was stopped by killing its local `npm run dev reviewlock_dev` and `devvit playtest reviewlock_dev` processes after proof was captured.

## Logs Rehearsal

Command:

```bash
npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime
```

Result:

- PASS with limited evidence.
- CLI connected and reported: `streaming logs for reviewlock on r/reviewlock_dev`.
- No runtime log lines were emitted during the sample window.
- The stream was stopped by killing the local logs process after the connection proof was captured.

Interpretation:

- Log access is verified.
- Trigger handling is not verified by this log sample because no controlled report or edit events were generated during the sample window.

## Required Local Verification

Commands:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

Results:

- `npm run type-check`: PASS.
- `npm run test`: PASS, 40 test files and 182 tests passed.
- `npm run lint`: PASS.
- `npm run build`: PASS.

## Blockers and Next Actions

- Live `approve()`, `ignoreReports()`, and `unignoreReports()` behavior is still not proven on controlled Reddit content. Next action: create controlled post/comment content in `r/reviewlock_dev`, use the menu flows, and verify each moderation method separately.
- Live `PostReport`, `CommentReport`, update, NSFW, spoiler, and flair trigger delivery is still not proven. Next action: generate controlled report and edit events in `r/reviewlock_dev`, stream logs, and compare Redis/audit/dashboard results.
- `devvit view --json` reports `isWebviewEnabled: false` even though the uploaded version includes WebView assets and playtest reached the ready state. Next action: verify the playtest URL in an isolated ReviewLock Zen/Aerospace window before making any live dashboard claim.
- No browser login was needed for this rehearsal. If a future command requests browser login, it must use the dedicated ReviewLock Zen/Aerospace window and must not open links in the user's active workspace.
