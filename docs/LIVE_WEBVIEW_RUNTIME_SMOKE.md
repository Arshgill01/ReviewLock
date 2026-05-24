# Live WebView Runtime Smoke

Last updated: 2026-05-25 01:28 IST.

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
- Latest post-hardening playtest version observed in Zen: `v0.0.2.62`.
- Latest trigger-wrapper hardening playtest version observed in Zen: `v0.0.2.64`.
- Latest dashboard UI hardening playtest version observed in Zen: `v0.0.2.66`.

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

## Post-Hardening Recheck

After runtime fallback and scoped-unlock hardening:

- Playtest version: `v0.0.2.62`.
- Existing Zen tab remained on `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- The dashboard header still showed `r/reviewlock_dev`.
- The first viewport still showed active locks, reports suppressed, reopened after edit, latest edit-break state, active lock table, and runtime proof.
- `Verify runtime` completed from the embedded WebView.
- Runtime message showed `Runtime proof refreshed.`
- Runtime panel still showed:
  - `redditContext verified`
  - `redis verified`
  - `approve verified`
  - `ignoreReports verified`
  - `unignoreReports verified`
  - `triggers unverified`

No report submission, post edit, comment edit, unlock, or dismiss action was performed in this recheck.

## Trigger-Wrapper Hardening Recheck

After Reddit adapter mapping and trigger wrapper payload hardening:

- Playtest version: `v0.0.2.64`.
- Existing Zen tab remained on `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/?playtest=reviewlock`.
- The WebView URL updated to `reviewlock-i1a3xr-0-0-2-64-webview.devvit.net/index.html`.
- Live dashboard rendered under `r/reviewlock_dev`.
- First viewport showed the product thesis, active locks, reports suppressed,
  reopened after edit, latest edit-break state, and active lock table.
- The active lock table showed the controlled dashboard post lock for
  `post:1tm8nak`.
- `Verify runtime` completed from the embedded WebView and showed
  `Runtime proof refreshed.`
- Runtime panel showed:
  - `redditContext verified`
  - `redis verified`
  - `approve verified`
  - `ignoreReports verified`
  - `unignoreReports verified`
  - `triggers unverified`
- Demo mode was opened from the same WebView.
- Demo mode showed the visible `Demo mode` banner, switched to
  `r/reviewlock_demo`, showed 8 active locks, 17 reports suppressed, 3 reopened
  after edit, read-only demo actions, report churn, runtime proof/status, and
  audit timeline.

No live report submission, post edit, comment edit, unlock, or dismiss action was
performed in this recheck.

## Dashboard UI Hardening Recheck

After the reviewed Antigravity frontend refresh was cleaned and integrated:

- Playtest version: `v0.0.2.66`.
- Existing Zen tab was used on the ReviewLock dashboard post.
- Live dashboard rendered under `r/reviewlock_dev`.
- First viewport showed the product thesis, active locks, reports suppressed,
  reopened after edit, latest edit-break empty state, active lock table, and
  runtime proof/status.
- Metric stages read:
  - `1. Reviewed and locked`
  - `2. Reports suppressed`
  - `3. Reopened after edit`
- Demo mode was opened from the same WebView and showed the visible `Demo mode`
  banner, `r/reviewlock_demo` scope, 8 active locks, 17 reports suppressed, 3
  reopened after edit, latest edit-break event, read-only demo actions, report
  churn, runtime status, and audit timeline.
- Live mode was reopened and `Verify runtime` completed from the embedded
  WebView with `Runtime proof refreshed.`
- Runtime panel still showed:
  - `redditContext verified`
  - `redis verified`
  - `approve verified`
  - `ignoreReports verified`
  - `unignoreReports verified`
  - `triggers unverified`

No live report submission, post edit, comment edit, unlock, or dismiss action was
performed in this recheck.

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
- `npm run dev -- reviewlock_dev`
  - Result: PASS, playtest reached `v0.0.2.62`.
- Zen browser live WebView runtime recheck
  - Result: PASS, `Verify runtime` completed and showed `Runtime proof refreshed.` under `r/reviewlock_dev`.
- `npx devvit logs reviewlock_dev reviewlock --since 5m --show-timestamps --log-runtime`
  - Result: PARTIAL, CLI reported `listen EADDRINUSE: address already in use :::5678` and then connected to the log stream; no trigger payload logs were emitted during the sample window.
- `npm run dev -- reviewlock_dev`
  - Result: PASS, playtest reached `v0.0.2.64`.
- Zen browser live WebView runtime and demo recheck
  - Result: PASS, live dashboard rendered, `Verify runtime` completed, and demo mode showed visibly labeled seeded data under `reviewlock_demo`.
- `npx devvit logs reviewlock_dev reviewlock --since 5m --show-timestamps --log-runtime`
  - Result: PARTIAL, CLI reported `listen EADDRINUSE: address already in use :::5678` and then connected to the log stream; no trigger payload logs were emitted during the sample window.
- `npm run dev -- reviewlock_dev`
  - Result: PASS, playtest reached `v0.0.2.66`.
- Zen browser live WebView runtime and demo recheck
  - Result: PASS, live dashboard rendered with the polished metric loop, demo mode showed visibly labeled seeded data under `reviewlock_demo`, and `Verify runtime` completed with `Runtime proof refreshed.`

## Open Risks

- `PostReport`, `CommentReport`, and edit/update trigger delivery still need controlled live event proof.
- Runtime smoke endpoint proof is dashboard/WebView-only; direct terminal calls remain intentionally unauthorized without Reddit WebView headers.
