# UI Audit

Wave 18 audited the ReviewLock dashboard across required states at desktop and mobile widths using a built client served locally with mocked dashboard API responses.

## Browser Setup

- Built client: `npm run build`
- Static local server: `python3 -m http.server 5173 --bind 127.0.0.1 --directory dist/client`
- Browser runner: `npx --yes --package=playwright node ...`
- Viewports:
  - Desktop: `1365x900`
  - Mobile: `390x844`

`npx vite --host 127.0.0.1 --port 5173` was attempted first and failed because the Devvit Vite plugin reports: `This plugin only supports vite build. For development, run: npm run dev`. The audit therefore used the built client and a static server, which still exercises the production client bundle.

## States Inspected

| State                     | Desktop evidence                                                                                                                                                        | Mobile evidence                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Empty live                | Nonblank; first viewport includes Active locks, Reports suppressed, Reopened after edit; no horizontal body overflow; no nested panels; no forbidden copy.              | Same result.                                                       |
| Demo seeded               | Nonblank; demo banner visible; active locks, reopen queue, churn, runtime, and audit sections render; no horizontal body overflow; no nested panels; no forbidden copy. | Same result after fixing the lock table container shrink behavior. |
| Locked active state       | Nonblank; active lock table renders with Unlock action and suppressed counts; no horizontal body overflow; no nested panels; no forbidden copy.                         | Same result.                                                       |
| Reopened after edit       | Nonblank; latest edit-break event and reopened queue render; no horizontal body overflow; no nested panels; no forbidden copy.                                          | Same result.                                                       |
| Runtime failed/unverified | Nonblank; runtime failed/unverified state and warning text render; no horizontal body overflow; no nested panels; no forbidden copy.                                    | Same result.                                                       |
| High-volume active locks  | Nonblank with 24 active locks and long title content; table scroll remains contained; no horizontal body overflow; no nested panels; no forbidden copy.                 | Same result.                                                       |
| High-volume report churn  | Nonblank with high suppressed-report totals and churn list; no horizontal body overflow; no nested panels; no forbidden copy.                                           | Same result.                                                       |

## Automated Browser Assertions

For every state and viewport, the browser audit asserted:

- Body text length was greater than 30 characters.
- First viewport text contained `Active locks`.
- First viewport text contained `Reports suppressed`.
- First viewport text contained `Reopened after edit`.
- `document.documentElement.scrollWidth` did not exceed viewport width.
- `.panel .panel` count was `0`.
- Production UI text did not contain `not reportable`, `disable reports`, or `blocked reports`.
- Rendered text did not leak `undefined` or `NaN`.

Result summary from the passing browser run:

```txt
empty-live/desktop: overflow=false, nested=0, text=514
empty-live/mobile: overflow=false, nested=0, text=514
demo-seeded/desktop: overflow=false, nested=0, text=1822
demo-seeded/mobile: overflow=false, nested=0, text=1822
active-locks/desktop: overflow=false, nested=0, text=904
active-locks/mobile: overflow=false, nested=0, text=904
reopened-after-edit/desktop: overflow=false, nested=0, text=1234
reopened-after-edit/mobile: overflow=false, nested=0, text=1234
runtime-failed/desktop: overflow=false, nested=0, text=977
runtime-failed/mobile: overflow=false, nested=0, text=977
high-volume-locks/desktop: overflow=false, nested=0, text=5693
high-volume-locks/mobile: overflow=false, nested=0, text=5693
high-volume-churn/desktop: overflow=false, nested=0, text=3909
high-volume-churn/mobile: overflow=false, nested=0, text=3909
```

## Fixes From Audit

- Added a visible stale-data error banner when a refresh fails after dashboard data already exists.
- Added mobile wrapping for queue, audit, churn, table, and latest-event text.
- Added `min-width: 0` to panels and dashboard columns so wide active-lock tables scroll inside their table wrapper instead of widening the whole page.

## Open Risks

- This audit proves the built client renders correctly with mocked API responses. It does not prove live Devvit WebView rendering inside Reddit or live moderation operations.
- Browser audit used a static server because the Devvit Vite plugin does not support ordinary Vite dev serving in this project.
