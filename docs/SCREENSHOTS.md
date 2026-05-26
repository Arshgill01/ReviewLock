# Screenshot Manifest

Last updated: 2026-05-26.

This file maps the final Devpost screenshot set to stable repository artifacts.
Use the captions here so live Reddit proof and local browser regression proof
are not mixed together.

## Final Devpost Set

| Slot | File | Source | Caption |
| --- | --- | --- | --- |
| 1. Lock form | `output/submission/01-live-lock-form-zen.png` | Live Reddit in Zen, captured from `r/reviewlock_dev` playtest `v0.0.10.2` with the Devvit `Lock review` form open. | A moderator opens `Lock review` on controlled post `t3_1tnfgqf`; the form shows reviewed-content identity, snapshot time, reason, and note fields without exposing a raw review token. |
| 2. Dashboard and runtime proof | `output/submission/02-live-dashboard-runtime-proof.png` | Live Reddit in Zen, captured from `r/reviewlock_dev` playtest `v0.0.10.2`. | ReviewLock dashboard runtime proof/status and audit timeline rows separating verified and unverified behavior without overlapping timeline text. |
| 3. Active locks and report churn | `output/submission/03-local-dashboard-active-locks.png` | Local browser regression capture from the built client with mocked dashboard API data. | First-viewport dashboard state showing active locks, `Reports suppressed`, reopened-after-edit count, and report churn sections. |
| 4. Reopened after edit | `output/submission/04-local-reopened-after-edit.png` | Local browser regression capture from the built client with mocked dashboard API data. | Reopen queue and latest edit-break event showing `Reopened after edit` and fingerprint transition details. |
| 5. Demo mode | `output/submission/05-local-demo-mode.png` | Local browser regression capture from the built client with mocked dashboard API data. | Clearly labeled demo mode with seeded ReviewLock data for the four-beat story. |

## Boundaries

- `01-live-lock-form-zen.png` is a live Reddit/Devvit UI capture from the
  no-visible-token form proof on playtest `v0.0.10.2`.
- `02-live-dashboard-runtime-proof.png` is a live Reddit/Devvit UI capture from
  the audit timeline and runtime-status recheck on playtest `v0.0.10.2`.
- `03-local-dashboard-active-locks.png`, `04-local-reopened-after-edit.png`,
  and `05-local-demo-mode.png` are regenerated from the built client and mocked
  API responses. They are useful for Devpost visual storytelling, but should be
  captioned as local dashboard proof rather than live Reddit WebView proof.
- The live proof boundary remains `docs/RUNTIME_PROOF.md`.
