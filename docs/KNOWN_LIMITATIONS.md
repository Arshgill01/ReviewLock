# Known Limitations

Last updated: 2026-05-24 16:21 IST.

## Runtime proof gaps

- `approve()`, `ignoreReports()`, and `unignoreReports()` are implemented behind the Reddit adapter but are not yet live-verified on controlled post and comment targets.
- `PostReport` and `CommentReport` trigger delivery is implemented and locally tested, but live payload shape and delivery timing are unverified.
- `PostUpdate`, `CommentUpdate`, `PostNsfwUpdate`, `PostSpoilerUpdate`, and `PostFlairUpdate` are implemented and locally tested, but live payload shape and delivery timing are unverified.
- `devvit logs` can stream after stopping playtest, but trigger payload logs have not yet been captured.

## Browser proof gaps

- The dashboard `Verify runtime` button was exercised in an embedded WebView before the subreddit context fix, but it wrote proof under the fallback `reviewlock` namespace.
- A fresh browser rerun must confirm the live header and runtime smoke writes use `r/reviewlock_dev`.
- Zen browser automation is paused until a dedicated ReviewLock window can be targeted without disturbing other browsing windows.

## Dashboard/API gaps

- Runtime smoke endpoints require Reddit WebView authorization; direct terminal calls to WebView API routes are expected to fail without Reddit-injected headers.
- Dashboard unlock and dismiss actions currently reuse internal form endpoints and interpret valid Devvit `UiResponse` responses. Wave 22 should consider dedicated dashboard API endpoints to make this contract cleaner.

## Product claim limits

- ReviewLock must not be described as making content unreportable.
- ReviewLock must not claim to disable user reporting.
- ReviewLock must not claim live report suppression or edit reopening until controlled playtest demonstrates those paths.
