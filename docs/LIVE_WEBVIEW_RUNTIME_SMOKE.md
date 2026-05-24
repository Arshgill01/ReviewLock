# Live WebView Runtime Smoke

Last updated: 2026-05-24 18:58 IST.

## Scope

Wave 31 proves that ReviewLock renders inside the live Reddit Devvit WebView for the controlled subreddit and that dashboard-driven runtime smoke writes to the `reviewlock_dev` namespace.

This pass does not prove live moderation methods or live report/edit trigger delivery. Those remain Wave 32 and Wave 33 work.

## Browser Isolation

- Browser app: Zen.
- Aerospace window observed before UI work: `100757 | Zen | 1 | ReviewLock dashboard : r/reviewlock_dev`.
- The existing Zen tab was used for the ReviewLock playtest.
- No new browser windows were opened and no non-Zen app windows were used for live UI actions.

## Live Environment

- Devvit account: `u/BrightyBrainiac`.
- App: `reviewlock`.
- Controlled subreddit: `r/reviewlock_dev`.
- Dashboard custom post: `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.
- Playtest URL: `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.
- Fixed WebView version observed in Zen: `reviewlock-i1a3xr-0-0-2-6-webview.devvit.net/index.html`.

## Failure Found

The first isolated Zen run rendered the embedded dashboard under the fallback namespace:

- Playtest version: `v0.0.2.4`.
- Reddit page: `r/reviewlock_dev`.
- WebView header: `r/reviewlock`.

The runtime smoke button was not used for final proof in that state because it would have written proof under the wrong namespace.

## Fix

The client now resolves subreddit context in this order when no explicit `?subreddit=` parameter is present:

1. Devvit-injected WebView context: `globalThis.devvit.context.subredditName`.
2. Reddit URL path from the WebView location.
3. Reddit URL path from `document.referrer`.
4. Final fallback: `reviewlock`.

The client also refuses to overwrite a verified embedded subreddit with a mismatched weaker `/api/context` value.

## Verified In Zen

After the fix hot reloaded:

- Playtest version: `v0.0.2.6`.
- Embedded header showed `r/reviewlock_dev`.
- `Verify runtime` completed from the embedded WebView.
- Runtime panel showed:
  - `redditContext verified`
  - `redis verified`
  - `approve unverified`
  - `ignoreReports unverified`
  - `unignoreReports unverified`
  - `triggers unverified`
- Runtime message showed `Runtime proof refreshed.`

## Commands Run

- `npm run dev -- reviewlock_dev`
- `npx prettier --write src/client/main.ts src/client/state/runtimeContext.ts src/client/state/runtimeContext.test.ts`
- `npm run test -- --run src/client/state/runtimeContext.test.ts src/client/state/store.test.ts`
- `npm run type-check`
- `npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime`
  - Result: PASS, stream connected for `reviewlock` on `r/reviewlock_dev`; no trigger payload logs were emitted during the sample window.
- `npm run test`
  - Result: PASS, 40 files and 185 tests.
- `npm run lint`
  - Result: PASS.
- `npm run build`
  - Result: PASS.

## Open Risks

- `approve()`, `ignoreReports()`, and `unignoreReports()` still need controlled live method proof on test subreddit content.
- `PostReport`, `CommentReport`, and edit/update trigger delivery still need controlled live event proof.
- Runtime smoke endpoint proof is dashboard/WebView-only; direct terminal calls remain intentionally unauthorized without Reddit WebView headers.
