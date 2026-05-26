# Screenshot Manifest

Last updated: 2026-05-26.

This file maps the final Devpost screenshot set to stable repository artifacts.
Use the captions here so live Reddit proof and local browser regression proof
are not mixed together.

## Final Devpost Set

| Slot | File | Source | Caption |
| --- | --- | --- | --- |
| 1. Lock form | `output/submission/01-live-lock-form-zen.png` | Live Reddit in Zen, captured from `r/reviewlock_dev` with the Devvit `Lock review` form open and not submitted. | A moderator opens `Lock review` on controlled post `t3_1tnfgqf`; the form shows the reviewed-content summary, reason, and note fields before any lock action is submitted. |
| 2. Dashboard and runtime proof | `output/submission/02-live-dashboard-runtime-proof.png` | Live Reddit WebView runtime proof screenshot selected from `output/playwright/runtime-proof-evidence-desktop-verified.png`. | ReviewLock dashboard running in Reddit with runtime proof/status rows separating verified and unverified behavior. |
| 3. Active locks and report churn | `output/submission/03-local-dashboard-active-locks.png` | Local browser regression artifact selected from `output/playwright/wave32-live-desktop-current.png`. | First-viewport dashboard state showing active locks, `Reports suppressed`, reopened-after-edit count, and report churn sections. |
| 4. Reopened after edit | `output/submission/04-local-reopened-after-edit.png` | Local browser regression artifact selected from `output/playwright/wave32-unlock-confirm-desktop-current.png`. | Reopen queue and latest edit-break event showing `Reopened after edit` and fingerprint transition details. |
| 5. Demo mode | `output/submission/05-local-demo-mode.png` | Local browser regression artifact selected from `output/playwright/wave32-demo-desktop-current.png`. | Clearly labeled demo mode with seeded ReviewLock data for the four-beat story. |

## Boundaries

- `01-live-lock-form-zen.png` is a live Reddit/Devvit UI capture. The form was
  opened for proof and not submitted during capture.
- `02-live-dashboard-runtime-proof.png` is selected from the live runtime proof
  screenshot set recorded by the previous browser regression pass.
- `03-local-dashboard-active-locks.png`, `04-local-reopened-after-edit.png`,
  and `05-local-demo-mode.png` are local browser regression artifacts. They are
  useful for Devpost visual storytelling, but should be captioned as local
  dashboard proof rather than live Reddit WebView proof.
- The live proof boundary remains `docs/RUNTIME_PROOF.md`.
