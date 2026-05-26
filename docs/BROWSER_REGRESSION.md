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

## Wave 32 Current UI Rerun

After the Antigravity-assisted dashboard redesign and the inline confirmation
hardening, the browser regression was rerun against the current built client
bundle.

Commands:

- `npm run build`
- `mkdir -p output/playwright`
- `npx --yes http-server dist/client -a 127.0.0.1 -p 4173`
- `npx --yes --package=playwright node <<'NODE' ... NODE`
- `kill 19788`

The Playwright script mocked ReviewLock API responses and exercised:

- live desktop dashboard;
- runtime verification action;
- inline unlock confirmation;
- demo mode switch;
- inline reopen-dismiss confirmation;
- demo mobile dashboard;
- return to live mobile dashboard.

Assertions repeated for each captured state:

- required first-viewport phrases are present;
- forbidden copy is absent;
- no horizontal document overflow;
- no nested panels;
- no `undefined` or `NaN` visible text;
- no clipped button text.

Generated screenshot paths:

- `output/playwright/wave32-live-desktop-current.png`
- `output/playwright/wave32-runtime-verified-desktop-current.png`
- `output/playwright/wave32-unlock-confirm-desktop-current.png`
- `output/playwright/wave32-demo-desktop-current.png`
- `output/playwright/wave32-dismiss-confirm-demo-desktop-current.png`
- `output/playwright/wave32-demo-mobile-current.png`
- `output/playwright/wave32-live-mobile-current.png`

Browser run output:

```txt
live-desktop-current: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave32-live-desktop-current.png text=1257
runtime-verified-desktop-current: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave32-runtime-verified-desktop-current.png text=1255
unlock-confirm-desktop-current: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave32-unlock-confirm-desktop-current.png text=1309
demo-desktop-current: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave32-demo-desktop-current.png text=1309
dismiss-confirm-demo-desktop-current: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave32-dismiss-confirm-demo-desktop-current.png text=1363
demo-mobile-current: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave32-demo-mobile-current.png text=1363
live-mobile-current: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/wave32-live-mobile-current.png text=1363
```

Result: PASS for the current dashboard bundle. This remains local browser proof
with mocked API responses, not live Reddit trigger proof.

## Runtime Proof Evidence Panel Recheck

After the runtime proof panel started rendering capability evidence, checked
timestamps, and notes, the browser regression was rerun against the current built
client bundle.

Commands:

- `npm run build`
- `mkdir -p output/playwright`
- `npx --yes http-server dist/client -a 127.0.0.1 -p 4173`
- `npx --yes --package=playwright node <<'NODE' ... NODE`

The Playwright script mocked ReviewLock API responses and exercised:

- live desktop dashboard;
- runtime verification action;
- live mobile dashboard.

Assertions repeated for each captured state:

- required first-viewport phrases are present;
- runtime proof evidence text is visible;
- runtime proof target-specific note text is visible;
- forbidden copy is absent;
- no horizontal document overflow;
- no nested panels;
- no `undefined` or `NaN` visible text;
- capability names, evidence text, statuses, and buttons do not clip horizontally.

Generated screenshot paths:

- `output/playwright/runtime-proof-evidence-desktop.png`
- `output/playwright/runtime-proof-evidence-desktop-verified.png`
- `output/playwright/runtime-proof-evidence-mobile.png`

Browser run output:

```txt
desktop: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/runtime-proof-evidence-desktop.png text=1479
desktop-verified: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/runtime-proof-evidence-desktop-verified.png text=1506
mobile: ok screenshot=/Users/arshdeepsingh/Developer/ReviewLock/output/playwright/runtime-proof-evidence-mobile.png text=1506
```

Result: PASS for the runtime proof evidence rendering change. This remains local
browser proof with mocked API responses, not live Reddit WebView proof.

## Audit Timeline Layout Recheck

After the audit timeline detail-row fix, a local browser render was checked with
representative long target and lock ids matching the live Reddit embed issue.

Artifact note: the screenshot paths in this section were later recaptured for
the timestamp-specific pass below. Use "Audit Timeline Timestamp Recheck" for
the current files at those paths.

Commands:

- `npx vite --host 127.0.0.1 --port 5197`
- `agent-browser --session reviewlock-audit open 'http://127.0.0.1:5197/?subreddit=reviewlock_dev&demo=false'`
- `agent-browser --session reviewlock-audit eval --stdin`
- `agent-browser --session reviewlock-audit screenshot output/playwright/audit-timeline-layout-fixed.png`
- `agent-browser --session reviewlock-audit set viewport 420 720`
- `agent-browser --session reviewlock-audit screenshot output/playwright/audit-timeline-layout-fixed-mobile.png`

Generated screenshot paths:

- `output/playwright/audit-timeline-layout-fixed.png`
- `output/playwright/audit-timeline-layout-fixed-mobile.png`

Result: PASS. The audit timestamp, kind, actor, message, target, lock, and
reason fields render as separate rows without overlap at desktop width and at a
420px mobile viewport. This was local browser proof of the client CSS/markup,
not live Reddit WebView proof.

## Audit Timeline Timestamp Recheck

After the live Reddit screenshot showed long locale timestamps crowding the
audit timeline, the timestamp presentation was shortened to a date/time stack
while preserving the full timestamp in the `time` title and the row aria label.

Commands:

- `npm run test -- src/client/render.test.ts src/client/state/store.test.ts --reporter verbose`
- `npm run build`
- `python3 -m http.server 8765 --directory /tmp`
- `python3 -m http.server 8766 --directory /Users/arshdeepsingh/Developer/ReviewLock`
- `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh goto http://127.0.0.1:8765/reviewlock-audit-timeline.html`
- `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh resize 1280 720`
- `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename /Users/arshdeepsingh/Developer/ReviewLock/output/playwright/audit-timeline-layout-fixed.png`
- `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh resize 390 720`
- `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename /Users/arshdeepsingh/Developer/ReviewLock/output/playwright/audit-timeline-layout-fixed-mobile.png`

Generated screenshot paths:

- `output/playwright/audit-timeline-layout-fixed.png`
- `output/playwright/audit-timeline-layout-fixed-mobile.png`

Result: PASS. The regenerated screenshots load the ReviewLock CSS, show compact
`May 25` / `3:29 PM` style timestamps, preserve spacing between audit kind and
actor, and keep target/lock/reason details readable at desktop and 390px mobile
widths. This is styled local browser proof, not live Reddit WebView proof.

## Live WebView Target Link Recheck

After browser testing found that safe relative Reddit permalinks resolved under
the Devvit WebView host, target links were canonicalized to absolute Reddit
URLs.

Commands and runtime actions:

- `npm run test -- src/client/utils/format.test.ts src/client/render.test.ts --reporter verbose`
- `npm run type-check`
- `npm run lint`
- `npm run dev -- reviewlock_dev`
- Zen browser opened
  `https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock`, then the
  ReviewLock dashboard post.
- Zen browser clicked `Verify runtime`.

Result: PASS. The live dashboard rendered on playtest `v0.0.3.3`; first
viewport showed active locks `2`, reports suppressed `1`, reopened after edit
`2`, and latest edit-break event `comment:ontlx1k`. The embedded WebView showed
`Runtime proof refreshed.` and active lock target links resolved to
`reddit.com/r/...` URLs instead of the Devvit WebView host.

No screenshot artifact was captured in this pass; the proof source was the Zen
browser accessibility tree inside the live Reddit WebView.
