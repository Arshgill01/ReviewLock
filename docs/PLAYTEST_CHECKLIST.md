# ReviewLock Playtest Checklist

Date started: 2026-05-24.

Controlled subreddit: `r/reviewlock_dev`.

Dev account: `u/BrightyBrainiac`.

## Local verification

- [x] Run `npm run type-check`.
- [x] Run focused runtime/client tests while hardening failures.
- [x] Run full `npm run test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Devvit app and playtest

- [x] Confirm CLI login with `npx devvit whoami`.
- [x] Confirm app registration with `npx devvit view --json`.
- [x] Start playtest with `npm run dev -- reviewlock_dev`.
- [x] Confirm playtest URL is `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`.
- [x] Confirm server hot reload reaches `v0.0.1.19`.
- [x] Capture `devvit logs` without a local port collision.

## Dashboard launch

- [x] Open subreddit menu action `Open ReviewLock dashboard`.
- [x] Confirm Devvit accepts the menu response as a valid `UiResponse`.
- [x] Confirm dashboard launch creates a ReviewLock custom post in `r/reviewlock_dev`.
- [x] Confirm the custom post WebView renders instead of showing a Devvit error toast.
- [x] Re-run dashboard launch after the `/api/context` hardening patch in an isolated browser window.

## Lock flows

- [x] Create or reuse a controlled test post.
- [x] Use `Lock review` on the test post.
- [x] Confirm lock form shows target summary, reports, edit state, and reason.
- [x] Submit lock reason and confirm post approval/ignoreReports behavior.
- [ ] Create a controlled test comment.
- [ ] Use `Lock review` on the test comment.
- [ ] Submit lock reason and confirm comment approval/ignoreReports behavior.

## Report trigger flow

- [x] Define a controlled live scenario matrix before generating real report events.
- [ ] Generate or simulate a repeated post report against an unchanged locked post.
- [ ] Confirm `PostReport` reaches `/internal/triggers/on-post-report`.
- [ ] Confirm active lock is loaded.
- [ ] Confirm current fingerprint matches the lock fingerprint.
- [ ] Confirm `ignoreReports()` is called.
- [ ] Confirm suppressed counters and audit event are written.
- [ ] Generate or simulate a repeated comment report against an unchanged locked comment.
- [ ] Confirm the same path for `/internal/triggers/on-comment-report`.

## Edit-aware reopen flow

- [ ] Edit the locked test post.
- [ ] Confirm post update trigger reaches ReviewLock.
- [ ] Confirm new fingerprint differs.
- [ ] Confirm lock status changes to `reopened`.
- [ ] Confirm `unignoreReports()` is called when supported.
- [ ] Confirm reopen queue event and audit event are written.
- [ ] Edit the locked test comment.
- [ ] Confirm comment update trigger path and reopen behavior.

## Dashboard runtime proof

- [x] Open the dashboard in Zen.
- [x] Confirm live header shows `r/reviewlock_dev`.
- [x] Click `Verify runtime`.
- [x] Confirm `redditContext` moves to `verified`.
- [x] Confirm `redis` moves to `verified`.
- [x] Confirm unverified moderation operations remain labeled unverified until separately tested.
- [x] Confirm dashboard unlock records `unignoreReports verified` on the controlled post target.
- [x] Confirm lock review records `approve verified` and `ignoreReports verified` on the controlled post target.
- [x] Confirm no product copy says "not reportable", "disable reports", or "blocked reports".

## Browser safety notes

- [x] Document the controlled browser automation misclick that removed and then restored `t3_1tm8nak`.
- [ ] Avoid coordinate clicks around Reddit native moderation menu actions in future live proof.

## Demo mode

- [x] Toggle demo mode from the dashboard.
- [x] Confirm demo banner is visible.
- [x] Confirm seeded active locks, suppressed reports, reopened-after-edit items, report churn, audit timeline, and runtime warning appear.
- [x] Confirm toggling back to live mode does not show demo data as live proof.
