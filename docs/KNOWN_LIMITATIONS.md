# Known Limitations

Last updated: 2026-05-24 22:41 IST.

## Runtime proof gaps

- `approve()` and `ignoreReports()` are live-verified for controlled post target `t3_1tm8nak` through ReviewLock `Lock review`, but still need repeat proof on a controlled comment target.
- `unignoreReports()` is live-verified on controlled post target `t3_1tm8nak` through the dashboard unlock flow, but still needs repeat proof on a controlled comment target.
- `PostReport` and `CommentReport` trigger delivery is implemented and locally tested, but live payload shape and delivery timing are unverified.
- `PostUpdate`, `CommentUpdate`, `PostNsfwUpdate`, `PostSpoilerUpdate`, and `PostFlairUpdate` are implemented and locally tested, but live payload shape and delivery timing are unverified.
- `devvit logs` can stream after stopping playtest, but trigger payload logs have not yet been captured.

## Browser proof gaps

- Zen browser live WebView smoke now confirms the dashboard header and runtime smoke use `r/reviewlock_dev`.
- A coordinate-based browser action accidentally clicked Reddit's native `Remove` action on the controlled dashboard post. The post was immediately restored with Reddit's native `Approve`; future live proof should prefer accessibility element selection and stop when destructive menu targets are ambiguous.

## Dashboard/API gaps

- Runtime smoke endpoints require Reddit WebView authorization; direct terminal calls to WebView API routes are expected to fail without Reddit-injected headers.
- Dashboard unlock and dismiss actions now use dedicated `/api/locks/unlock` and `/api/reopen-queue/dismiss` routes instead of internal Devvit form endpoints.
- Dashboard destructive actions now use inline confirmation controls because `window.confirm()` was unreliable inside the Devvit WebView.
- Dashboard and runtime smoke routes reject client-supplied subreddit namespaces that do not match the Devvit runtime subreddit; demo endpoints remain explicitly isolated under the demo namespace.
- Unlock requests require the exact active `lockId` that the moderator confirmed. Stale confirmation surfaces must refresh before they can unlock.

## Product claim limits

- ReviewLock must not be described as making content unreportable.
- ReviewLock must not claim to disable user reporting.
- ReviewLock must not claim live report suppression or edit reopening until controlled playtest demonstrates those paths.
- ReviewLock may claim live moderation-method proof only for the controlled post-target paths documented in `docs/MODERATION_METHOD_PROOF.md`.
