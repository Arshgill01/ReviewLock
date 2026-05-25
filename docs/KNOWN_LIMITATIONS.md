# Known Limitations

Last updated: 2026-05-25 23:07 IST.

## Runtime proof gaps

- `approve()` and `ignoreReports()` are live-verified for controlled post target `t3_1tm8nak` through ReviewLock `Lock review`. S08 proves the comment lock flow persisted and later reopened, but comment-target moderation method proof is not independently visible yet and still needs a stronger runtime check.
- `unignoreReports()` is live-verified on controlled post target `t3_1tm8nak` through the dashboard unlock flow. S08 proves the comment update reopen path reached ReviewLock, but comment-target `unignoreReports()` still needs an independently visible runtime check.
- `PostReport` trigger delivery is live-verified for unchanged controlled post
  target `t3_1tm8nak`; `CommentReport` trigger delivery is implemented and
  locally tested but still needs live payload proof.
- `PostUpdate` trigger delivery is live-verified for controlled body edit
  target `t3_1tnfgqf`; `CommentUpdate` trigger delivery is live-verified for
  controlled body edit target `t1_ontlx1k`; `PostNsfwUpdate`,
  `PostSpoilerUpdate`, and `PostFlairUpdate` are implemented and locally tested
  but still need live payload proof.
- `devvit logs` captured sanitized `on-post-report`, `on-post-update`, and
  `on-comment-update` payload-shape evidence; remaining trigger variants have
  not yet been captured.

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
- ReviewLock may claim controlled live post-report suppression on unchanged
  locked post target `t3_1tm8nak`, controlled live post body-edit reopening on
  locked post target `t3_1tnfgqf`, and controlled live comment body-edit
  reopening on locked comment target `t1_ontlx1k`; it must not claim live
  comment-report, NSFW, spoiler, or flair-trigger proof until controlled
  playtest demonstrates those paths.
- ReviewLock may claim live moderation-method proof only for the controlled post-target paths documented in `docs/MODERATION_METHOD_PROOF.md`.
