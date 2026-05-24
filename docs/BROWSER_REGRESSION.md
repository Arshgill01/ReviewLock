# Browser Regression

Wave 28 exercised the built ReviewLock dashboard in headless Chromium using Playwright against a locally served production client bundle with mocked ReviewLock API responses.

This pass did not use Zen or a visible desktop browser window, to avoid disturbing the user's Aerospace workspace.

## Local Browser Setup

Commands:

- `npm run build`
- `mkdir -p output/playwright`
- `python3 -m http.server 5173 --bind 127.0.0.1 --directory dist/client`
- `npx --yes --package=playwright node <<'NODE' ... NODE`
- `lsof -ti tcp:5173 | xargs -r kill`

The browser script intercepted ReviewLock API requests and served deterministic live/demo responses for:

- `/api/context`
- `/api/overview`
- `/api/locks`
- `/api/reopen-queue`
- `/api/audit`
- `/api/runtime`
- `/api/smoke/redis`
- `/api/smoke/reddit`
- `/api/demo/enable`
- `/api/demo/disable`
- `/internal/form/unlock-review-submit`
- `/internal/form/reopen-action-submit`

## Viewports and Interactions

Desktop viewport: `1365x900`

Mobile viewport: `390x844`

Interactions exercised:

- Loaded live dashboard for `r/reviewlock_dev`.
- Clicked `Verify runtime` and confirmed `Runtime proof refreshed.` appears.
- Accepted the unlock confirmation and clicked the first visible `Unlock` action.
- Toggled from live mode to demo mode.
- Accepted the dismiss confirmation and clicked the first visible reopen dismiss action.
- Rechecked the demo dashboard at mobile size.
- Toggled back to live mode at mobile size.

## Automated Browser Assertions

Every captured state asserted:

- dashboard text length was greater than 100 characters;
- first viewport retained the required phrases:
  - `Lock reviewed content until it changes.`
  - `Reports suppressed`
  - `Reopened after edit`
- no forbidden production copy appeared:
  - `not reportable`
  - `disable reports`
  - `blocked reports`
  - `ai decides`
  - `automatic removal`
  - `permanent`
  - `forever`
- document width did not exceed viewport width;
- `.panel .panel` count was `0`;
- rendered text did not leak `undefined` or `NaN`;
- common text containers and buttons did not have clipped horizontal text.

## Screenshot Evidence

Generated screenshot paths:

- `output/playwright/wave28-live-desktop.png`
- `output/playwright/wave28-runtime-verified-desktop.png`
- `output/playwright/wave28-unlock-after-click-desktop.png`
- `output/playwright/wave28-demo-desktop.png`
- `output/playwright/wave28-dismiss-after-click-desktop.png`
- `output/playwright/wave28-demo-mobile.png`
- `output/playwright/wave28-live-mobile.png`

Browser run output:

```txt
live-desktop: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave28-live-desktop.png text=5448
runtime-verified-desktop: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave28-runtime-verified-desktop.png text=5428
unlock-after-click-desktop: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave28-unlock-after-click-desktop.png text=5428
demo-desktop: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave28-demo-desktop.png text=4260
dismiss-after-click-desktop: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave28-dismiss-after-click-desktop.png text=4260
demo-mobile: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave28-demo-mobile.png text=4079
live-mobile: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave28-live-mobile.png text=5220
```

## Result

No visual or interaction regression needed a client code fix in Wave 28. The dashboard remained usable on desktop and mobile, and the visible controls exercised by the browser pass completed without blank states, horizontal body overflow, nested panels, forbidden copy, or broken text.

## Boundary

This is real-browser proof of the built client bundle with mocked ReviewLock API responses. It is not live Reddit WebView proof and does not verify live Reddit moderation methods or live trigger delivery.
