# Runtime Proof

Last updated: 2026-05-24 16:21 IST.

This file distinguishes implemented behavior from verified Devvit runtime behavior. README, submission, and demo claims may cite only rows marked `verified`.

## Environment

- Local workspace: `/Users/arshdeepsingh/Developer/ReviewLock`
- Dev account: `u/BrightyBrainiac`
- Devvit app: `reviewlock`
- App id: `5201a616-7c35-48d6-a030-743e41456e69`
- Controlled subreddit: `r/reviewlock_dev`
- Default playtest subreddit id: `t5_i1a3xr`
- Devvit package family: `devvit`, `@devvit/web`, `@devvit/start` at `0.12.24`

## Commands Run

- `npx devvit whoami`
  - Result: PASS, logged in as `u/BrightyBrainiac`.
- `npx devvit view --json`
  - Result: PASS, app `reviewlock` exists, install count is `1`, owner is `BrightyBrainiac`, versions count is `20`.
- `npm run dev -- reviewlock_dev`
  - Result: PASS, playtest served `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.
  - Latest observed hot reload in this pass: `v0.0.1.19`.
- `npm run type-check`
  - Result: PASS after runtime hardening patches.
- `npm run test -- --run src/integration.test.ts src/client/state/runtimeContext.test.ts src/client/state/store.test.ts src/client/render.test.ts src/server/services/runtimeHardening.test.ts`
  - Result: PASS, 5 files and 27 tests.
- `npm run test`
  - Result: PASS, 36 files and 117 tests.
- `npm run lint`
  - Result: PASS.
- `npm run build`
  - Result: PASS.
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime`
  - Result: BLOCKED while playtest was running; Devvit CLI reported `listen EADDRINUSE: address already in use :::5678`.
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps`
  - Result: BLOCKED while playtest was running; Devvit CLI reported `listen EADDRINUSE: address already in use :::5678`.
- `npx devvit logs reviewlock_dev reviewlock --connect --since 10m --show-timestamps`
  - Result: BLOCKED while playtest was running; Devvit CLI reported `listen EADDRINUSE: address already in use :::5678`.
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps`
  - Result: PASS after stopping playtest; stream connected and showed the existing ReviewLock dashboard WebView connection.

## Capability Matrix

| Capability                                   | Status      | Evidence                                                                                                                                                                         | Notes                                                                                                                                                       |
| -------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devvit config schema loads                   | verified    | Playtest reached `v0.0.1.19` after removing unsupported manifest fields and recursive dev script.                                                                                | Earlier failures are logged in `decisions.md` as D006 and D007.                                                                                             |
| Devvit Web server boot                       | verified    | Playtest served `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.                                                                                                  | Runtime server uses `createServer`, `getServerPort`, `reddit`, `redis`, and `context` from `@devvit/web/server`.                                            |
| Subreddit dashboard menu response            | verified    | `Open ReviewLock dashboard` no longer returns the Devvit `UiResponse` unknown-key error after replacing `{ ok: true }` with valid `showForm`/`navigateTo`/`showToast` responses. | Valid response keys confirmed from installed `@devvit/build-pack` validator.                                                                                |
| Dashboard custom post launch                 | verified    | A ReviewLock dashboard custom post was created in `r/reviewlock_dev` and opened as a Reddit custom post WebView.                                                                 | Existing post observed at `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.                                                                       |
| Dashboard subreddit context                  | implemented | `/api/context` now prefers Devvit server `context.subredditName` over the Reddit adapter fallback, and the integration test covers `reviewlock_dev` precedence.                  | Needs a fresh isolated browser rerun before marking verified.                                                                                               |
| Redis smoke from authorized WebView          | partial     | The dashboard `Verify runtime` button previously moved `redis` to verified from an embedded WebView.                                                                             | The run occurred before the subreddit context fix and wrote under the wrong `reviewlock` namespace, so it is not counted as final `r/reviewlock_dev` proof. |
| Reddit context smoke from authorized WebView | partial     | The dashboard `Verify runtime` button previously moved `redditContext` to verified from an embedded WebView.                                                                     | Same namespace issue as Redis smoke; rerun required in `r/reviewlock_dev`.                                                                                  |
| Direct terminal WebView API smoke            | blocked     | Direct API calls to Devvit WebView routes are not authorized without Reddit-injected WebView headers.                                                                            | Smoke endpoints are intentionally meant to run from the embedded dashboard.                                                                                 |
| `approve()` live behavior                    | unverified  | Adapter and tests exist.                                                                                                                                                         | Must be tested on controlled test post and comment.                                                                                                         |
| `ignoreReports()` live behavior              | unverified  | Adapter and tests exist.                                                                                                                                                         | Must be tested separately before claiming live report suppression.                                                                                          |
| `unignoreReports()` live behavior            | unverified  | Adapter and tests exist.                                                                                                                                                         | Must be tested separately before claiming edit-aware reopen runtime behavior.                                                                               |
| Report trigger delivery                      | unverified  | `devvit.json` registers `onPostReport` and `onCommentReport`; routes and services are locally tested.                                                                            | Need live or controlled trigger proof in a dedicated playtest pass.                                                                                         |
| Update trigger delivery                      | unverified  | `devvit.json` registers post/comment update, NSFW, spoiler, and flair update triggers; routes and services are locally tested.                                                   | Need live or controlled trigger proof in a dedicated playtest pass.                                                                                         |
| Devvit logs                                  | verified    | After stopping playtest, `devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps` connected and streamed the existing ReviewLock dashboard WebView connection.      | No trigger payload logs captured yet.                                                                                                                       |

## Runtime Failures Found And Hardened

- Devvit rejected `devvit.json` with a top-level `version` field.
  - Hardened by removing the unsupported field.
- Devvit playtest recursively launched itself through `devvit.json` `scripts.dev`.
  - Hardened by keeping package `npm run dev` as `devvit playtest` and changing manifest `scripts.dev` to a build/watch command.
- Devvit rejected menu/form responses with unknown key `ok`.
  - Hardened by returning only valid `UiResponse` keys from internal menu/form endpoints.
- Dashboard WebView initially defaulted to `r/reviewlock`.
  - Hardened by adding `/api/context`, using Devvit server `context.subredditName`, and falling back to URL/referrer inference only before API context arrives.
- Runtime smoke status could only be proven from an authorized Reddit WebView.
  - Hardened by making smoke checks dashboard-driven and storing capability results in ReviewLock runtime status.

## Current Claim Boundary

Allowed claims:

- ReviewLock has implemented lock, unlock, report-trigger, update-trigger, dashboard, demo, audit, and runtime proof flows.
- Local type-checks and tests pass for the runtime hardening patches listed above.
- The Devvit app can be playtested in `r/reviewlock_dev`.
- The dashboard menu can open a ReviewLock custom post.

Not allowed yet:

- Do not claim live report suppression is verified.
- Do not claim live edit-trigger reopening is verified.
- Do not claim `approve()`, `ignoreReports()`, or `unignoreReports()` are verified in production-like Devvit runtime.
- Do not claim `devvit logs` has been captured for trigger payloads.
