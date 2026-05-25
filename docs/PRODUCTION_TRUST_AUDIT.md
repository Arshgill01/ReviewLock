# Production Trust Audit

Wave 30 reviewed the hardening record from Waves 15 through 29 and made one final pre-submission safety improvement.

## Weakest Remaining Area

The weakest area is not local correctness. The lock, reopen, dashboard, demo, namespace, race, and browser-mocked paths have substantial local coverage. The weakest area is production trust around runtime proof and release safety:

- Historical Wave 30 note: at the time of this audit, live moderation method proof was still unverified. Current status is narrower: controlled post-target `approve()`, `ignoreReports()`, and `unignoreReports()` are now verified; comment-target methods still need independently visible runtime proof. See `docs/RUNTIME_PROOF.md`.
- Controlled live `PostReport` suppression, `PostUpdate` body-edit reopening,
  and `CommentUpdate` body-edit reopening are verified. `CommentReport`,
  post NSFW, post spoiler, and post flair trigger variants remain unverified.
- The app can upload, install, and reach playtest, but a public publish must not happen until the claim boundary is resolved.
- `package.json` still exposed an `npm run launch` script that executed `npm run deploy && devvit publish`.

That script was too easy to run accidentally. A moderator-useful app that has honest unverified runtime boundaries should not have a one-command public publish path before final approval.

## Improvement Implemented

Changed `npm run launch` so it refuses to publish and exits with an explicit message:

```txt
Public publish requires explicit user instruction; run devvit publish manually after final approval.
```

The safe private upload path remains:

```bash
npm run deploy
```

This keeps the developer workflow for private upload rehearsal while preventing accidental public release from the ambiguous `launch` script.

## Evidence Reviewed

- `docs/TRIGGER_PROOF.md`: local trigger decisions are covered; controlled
  `PostReport`, `PostUpdate`, and `CommentUpdate` payload capture has passed;
  `CommentReport`, NSFW, spoiler, and flair payload capture remains open.
- `docs/FINGERPRINT_STRESS.md`: fingerprint edge cases are covered locally.
- `docs/REDIS_RACE_PROOF.md`: duplicate and failure behavior is locally covered against the adapter contract.
- `docs/UI_AUDIT.md`: dashboard states render locally with mocked API responses.
- `docs/BROWSER_REGRESSION.md`: built dashboard passes headless Chromium checks with mocked ReviewLock APIs.
- `docs/DEVVIT_REGISTRATION_PROOF.md`: app registration, upload, install, and playtest were proven; ModMirror comparison showed the same config shape.
- `docs/INSTALL_DEPLOY_REHEARSAL.md`: private upload to `0.0.2`, install on `r/reviewlock_dev`, playtest readiness, and log connectivity were proven.
- `/Users/arshdeepsingh/Developer/ModMirror/RESEARCH.md`: ModMirror records the same `isWebviewEnabled: false` app-level metadata while version capabilities and nutrition categories show WebView support. ReviewLock's current `appCapabilities: [10, 11]` and uploaded WebView assets match that pattern.

## Production Trust Answer

Would a mod drowning in report churn trust this app in production tomorrow?

No, not yet.

The app is locally strong and safe to keep hardening in the controlled test subreddit, but production trust requires live proof of the moderation loop:

1. A moderator locks controlled post and comment targets.
2. `approve()` and `ignoreReports()` are separately observed to succeed or fail honestly. Post-target proof has passed; comment-target proof remains open.
3. Repeat report events are generated and shown to hit `PostReport` and `CommentReport`; `PostReport` proof has passed, while `CommentReport` remains open.
4. Unchanged locked content increments suppressed metrics and audit records.
5. Edited content breaks the lock, calls `unignoreReports()` when supported, and appears in the reopen queue; controlled post and comment body-edit proof has passed, while flag/flair variants remain open.
6. The dashboard WebView runtime smoke writes under `r/reviewlock_dev`, not a fallback namespace.

Until the remaining steps pass, ReviewLock should be described as implemented,
locally tested, uploaded, installed, playtest-booted, and live-proven only for
the controlled post-report suppression plus post/comment body-edit reopen paths
documented in `docs/RUNTIME_PROOF.md`.

## Follow-up Waves

- Wave 31: isolated live WebView runtime smoke proof in the dedicated ReviewLock Zen/Aerospace window.
- Wave 32: controlled post/comment lock and moderation method proof.
- Wave 33: controlled report and edit trigger proof with log capture.
- Wave 34: claim boundary cleanup after live proof, including README, runtime docs, and submission copy.
