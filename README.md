# ReviewLock

Lock reviewed content until it changes.

ReviewLock is a Reddit Devvit moderation app for teams that keep seeing the
same already-reviewed posts and comments return through repeat reports. A
moderator reviews an item once, creates a ReviewLock, and the app remembers the
reviewed content fingerprint. Repeat reports on unchanged locked content are
suppressed and counted. If the post or comment changes, ReviewLock breaks the
lock, returns reports to normal handling when Reddit allows it, and puts the
item back in the dashboard reopen queue.

ReviewLock does not change Reddit's reporting surface. It is an edit-aware
moderation ledger for reviewed content.

## App listing summary

Short description:

> Lock reviewed posts and comments until they change.

ReviewLock is built for moderator teams that need a safer reviewed-content
memory. It combines Devvit menu actions, forms, report/update triggers, Redis
persistence, and a dashboard custom post to answer one operational question:

> Has this exact content already been reviewed, and has it changed since then?

If the answer is yes and unchanged, ReviewLock suppresses repeat report churn
using Reddit moderation capabilities and records the time saved. If the answer
is no because the content changed or runtime state is uncertain, ReviewLock
fails open by reopening moderator attention instead of silently suppressing.

## Why moderators would use it

Native report tools can ignore reports, but they do not give a team a clear
reviewed-content ledger, suppressed-report metrics, or automatic reopening when
the content itself changes. ReviewLock keeps the moderator decision tied to the
thing that was actually reviewed.

The core loop is:

1. A moderator reviews a post or comment.
2. The moderator chooses `Lock review` and records a reason.
3. ReviewLock approves when supported, ignores repeat reports, stores a content
   fingerprint, and writes an audit entry.
4. Repeat reports against unchanged locked content are suppressed and counted
   as `Reports suppressed`.
5. If the content changes, ReviewLock reopens the lock, unignores reports when
   supported, and surfaces the item as `Reopened after edit`.

## Moderator workflow

- Use `Lock review` from a post or comment moderation menu.
- Use `Unlock review` when the team wants reports to surface normally again.
- Use `Open ReviewLock dashboard` from the subreddit menu to open the dashboard
  post for the community.
- Watch the first dashboard viewport for active locks, reports suppressed,
  reopened-after-edit items, and the latest edit-break event.
- Use demo mode for a labeled seeded walkthrough without mixing demo records
  into live subreddit data.

## Dashboard

The dashboard is built for repeated mod-tool use, not marketing. It includes:

- active locks with item context, review reason, and suppressed-report counts;
- reopened-after-edit queue with fingerprint deltas and runtime warnings;
- report churn metrics for reviewed content that keeps receiving reports;
- audit timeline for lock, unlock, suppress, reopen, dismiss, and runtime
  failure events;
- runtime proof/status panel so moderators can see what has been verified in
  the current Devvit environment.

## Current proof boundary

ReviewLock keeps verified behavior separate from implemented-but-unverified
behavior. For the current submission build, the live proof boundary is:

Verified in controlled `r/reviewlock_dev` playtest:

- dashboard custom post rendering inside Reddit;
- runtime `redis` and `redditContext` smoke checks from the embedded dashboard;
- post-target `approve()`, `ignoreReports()`, and `unignoreReports()`;
- repeat-report suppression on an unchanged locked post;
- post body edit reopening a locked post;
- comment body edit reopening a locked comment.

Implemented and locally tested, but still requiring live payload proof before
being claimed as verified:

- comment report trigger delivery;
- post NSFW update trigger delivery;
- post spoiler update trigger delivery;
- post flair update trigger delivery;
- repeated dashboard launch reuse in a controlled playtest.

## Data and privacy

ReviewLock stores only moderation workflow metadata needed for the product:
target id, target kind, subreddit, target author, permalink, reviewed content
hash, review reason, lock status, suppressed counts, reopen events, runtime
warnings, and audit events.

ReviewLock does not store reporter usernames. It does not build moderator
productivity analytics. It does not use AI or external services. It does not
remove content automatically when a lock reopens.

## Permissions

ReviewLock uses Devvit Reddit and Redis capabilities:

- Reddit access is used for moderation operations such as approve,
  ignoreReports, unignoreReports, target resolution, menu forms, triggers, and
  dashboard post creation.
- Redis is used for namespaced lock records, target indexes, reopen queues,
  audit logs, metrics, runtime proof, form tokens, and demo data.

## Terms of use summary

ReviewLock is a moderation workflow tool for Reddit communities. Moderators are
responsible for their moderation decisions and should test the app in a
controlled subreddit before production use.

ReviewLock does not change Reddit's reporting surface. It attempts to suppress
repeat reports on unchanged reviewed content using Reddit-provided moderation
capabilities. If content changes or ReviewLock cannot verify content state with
confidence, the app is designed to surface the item for moderator attention.

## App listing and validation

App listing:

```txt
https://developers.reddit.com/apps/reviewlock
```

Developer validation for this repository:

```bash
npm install
npm run type-check
npm run lint
npm run test
npm run build
```

Controlled Devvit playtest commands:

```bash
npx devvit whoami
npx devvit view --json
npm run dev -- reviewlock_dev
```

Do not claim additional live behavior unless it has been recorded in the runtime
proof log and reproduced in controlled playtest.

## Known limitations

- Some trigger variants are implemented and locally covered but not yet live
  verified.
- Runtime smoke endpoints require Reddit WebView authorization; direct terminal
  calls to the WebView API are expected to fail without Reddit-injected context.
- Reopen is non-destructive. A reopened item returns to moderator attention; it
  is not removed by default.
- Public App Directory listing approval is separate from having an uploaded app
  listing URL.

## Repository documentation map

These files are for source reviewers and maintainers. The product summary,
permissions, data use, safety boundary, and runtime proof boundary above are
intended to stand alone for App Directory and Devpost reviewers.

- Runtime proof: `docs/RUNTIME_PROOF.md`
- Known limitations: `docs/KNOWN_LIMITATIONS.md`
- Browser regression proof: `docs/BROWSER_REGRESSION.md`
- Data namespace audit: `docs/DATA_NAMESPACE_AUDIT.md`
- Safety/privacy audit: `docs/SAFETY_PRIVACY_AUDIT.md`
- Devpost copy: `docs/DEVPOST_SUBMISSION.md`
- App listing copy: `docs/APP_LISTING.md`
- Launch checklist: `docs/LAUNCH_CHECKLIST.md`
- Demo script: `docs/DEMO_SCRIPT.md`
- Claim check: `docs/CLAIM_CHECK.md`

## Changelog

### Current submission build

- Added edit-aware lock, suppress, reopen, dashboard, demo, and audit flows.
- Hardened Redis namespace isolation and mixed-case subreddit handling.
- Added retryable runtime-uncertain behavior for trigger refetch failures.
- Added inline dashboard confirmations for unlock and dismiss actions.
- Added local and controlled-playtest proof artifacts for the core loop.
