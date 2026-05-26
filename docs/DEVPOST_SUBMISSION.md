# Devpost Submission Draft

Last updated: 2026-05-26.

Submission target: Reddit Mod Tools and Migrated Apps Hackathon, Best New Mod
Tool category.

Source requirements checked:

- Devpost overview/rules require an app built on Reddit's Developer Platform, a
  text description, participant Reddit usernames, an app listing link, and
  project impact for 1-3 communities.
- Devpost rules say the optional demo video should be under one minute and show
  the project functioning on the platform for which it was built.
- Devpost rules also say judging/testing access should be provided with a link
  to a Reddit post running the app in a public subreddit with fewer than 200
  members.

Submission status:

- App listing URL exists: `https://developers.reddit.com/apps/reviewlock`
- `npm run deploy` on 2026-05-26 uploaded version `0.0.4`; `npx devvit view --json`
  showed `version.about` populated from the launch-grade README.
- Developer Portal app-level metadata still needs a final listing pass before
  submission if editable: `app.description`, `marketingInfo`, `privacyPolicy`,
  and `termsAndConditions` are still empty in the CLI response.
- The root README was hardened for App Directory `version.about` after upload
  `0.0.4`; run a final upload and `npx devvit view --json` before treating the
  uploaded listing copy as current.
- Public judging post still needs final confirmation after the final upload.

## Submission Fields

### Project name

ReviewLock

### Category

New App / Best New Mod Tool.

ReviewLock is not a Data API migration. Do not fill the ported-project bot
username or port-completion fields except with `N/A`.

### App listing

`https://developers.reddit.com/apps/reviewlock`

Before final submission, verify the listing after upload:

```bash
npx devvit view --json
```

The listing still needs a final Developer Portal metadata pass if editable, and
the post-`4a6a98a` self-contained README needs a final upload/view check before
submission.

### Reddit usernames

Primary participant:

- `u/BrightyBrainiac`

Add any other team participants before submission. Do not guess usernames.

### Tagline

Lock reviewed content until it changes.

### Elevator pitch

ReviewLock gives moderator teams a memory for content they have already
reviewed. A moderator locks a reviewed post or comment, ReviewLock stores a
content fingerprint, and repeat reports on that unchanged content are suppressed
and counted. If the author edits the content or a material post state changes,
ReviewLock breaks the lock, returns reports to normal handling when Reddit
allows it, and puts the item back in the reopen queue.

This is intentionally safer than an open-ended ignore-reports workflow: the
review state is tied to the exact content that was reviewed.

### Tool overview

ReviewLock is a Devvit-native moderation app for communities that repeatedly
re-review the same already-approved content after duplicate or weaponized
reports.

Moderator workflow:

1. A moderator reviews a post or comment.
2. From the Reddit moderation menu, the moderator chooses `Lock review`.
3. ReviewLock refetches the target, computes a material content fingerprint,
   approves when supported, calls `ignoreReports()` when supported, stores a
   lock record in Redis, and writes an audit event.
4. If another report arrives while the content is unchanged, ReviewLock
   suppresses the repeat report, increments `Reports suppressed`, and records
   the action in the audit log.
5. If the post or comment changes, ReviewLock breaks the lock, calls
   `unignoreReports()` when supported, and surfaces the item as `Reopened after edit`.
6. Moderators use the dashboard to inspect active locks, report churn, reopened
   items, runtime proof status, and audit history.

Capabilities:

- Post and comment menu actions for `Lock review`, `Unlock review`, and
  `Open ReviewLock`.
- Subreddit menu action for `Open ReviewLock dashboard`.
- Lock form with target summary, report count, edit state, reason presets, and
  custom notes.
- Report-trigger handling for locked unchanged content.
- Update-trigger handling for post/comment edits and material post state
  changes.
- Dashboard metrics for active locks, suppressed reports, reopened-after-edit
  items, and latest reopen events.
- Active-lock table, reopen queue, report churn view, runtime status panel, and
  audit timeline.
- Deterministic, visibly labeled demo mode.
- Redis-backed audit and runtime proof ledger.
- Failure behavior that avoids claiming success when Reddit or Redis operations
  cannot be verified.

Safety boundaries:

- ReviewLock does not make content unreportable.
- ReviewLock does not claim that users cannot submit reports.
- ReviewLock does not remove content automatically when a lock reopens.
- ReviewLock does not store reporter usernames.
- ReviewLock does not use AI or external services.
- ReviewLock stores only moderation workflow metadata needed for the lock,
  reopen, audit, metric, and runtime-proof flows.

### Project impact

ReviewLock is best suited for communities where already-reviewed content keeps
returning to the queue because of repeat reports. It is deliberately not pitched
as a universal modqueue replacement.

Communities that could benefit, listed as fit examples rather than endorsements
or confirmed installs:

1. `r/politics` or similar high-volume politics/local-news communities:
   controversial but rule-compliant posts can keep attracting reports after a mod
   team has already reviewed them. ReviewLock lets the team suppress only repeat
   reports on the unchanged reviewed version while reopening the item after an
   edit or material state change.
2. `r/AmItheAsshole` or similar advice/judgment communities: high-engagement
   posts and comment threads can continue receiving duplicate reports after a
   moderation decision. ReviewLock gives mods a shared reviewed-content ledger so
   another moderator does not have to rediscover the same decision from scratch.
3. `r/buildapcsales` or similar marketplace/deal communities: approved listing
   or deal threads can keep drawing reports after checks for title, link, flair,
   or rule compliance. ReviewLock reduces repeat queue churn while still treating
   edits and relevant post-state changes as reasons to reopen attention.

Time-savings model:

If a team gets 20 repeat reports per week on already-reviewed content and each
duplicate queue pass costs even 30 seconds to inspect, discuss, or clear,
ReviewLock can turn roughly 10 minutes per week of repeated review into one lock
plus exception-only reopen handling. On larger communities with recurring
controversial threads, the value scales with every duplicate report that no
longer requires another moderator to rediscover the same decision.

Use the conservative model in the submission. Do not claim measured production
time savings until a real mod team has installed the app.

### What makes it Devvit-native

ReviewLock is built around Devvit moderation primitives instead of an external
bot:

- Devvit menu actions start the moderator workflow from posts, comments, and
  subreddit context.
- Devvit forms collect lock reasons and confirmations.
- Devvit triggers process report and update events.
- Devvit Reddit capabilities perform approve, ignore, and unignore operations.
- Devvit Redis stores locks, target indexes, metrics, audit events, reopen
  events, runtime proof, form bindings, and demo state.
- The dashboard runs as a Devvit Web custom post.

### Runtime proof boundary

Use only these live-verified claims unless `docs/RUNTIME_PROOF.md` is updated by
a newer controlled proof pass:

- Dashboard custom post rendering inside Reddit is verified.
- Runtime `redis` and `redditContext` smoke checks from the embedded dashboard
  are verified.
- Post-target `approve()`, `ignoreReports()`, and `unignoreReports()` are
  verified on controlled post target `t3_1tm8nak`.
- Repeat-report suppression on an unchanged locked post is verified on
  controlled post target `t3_1tm8nak`.
- Post body edit reopening is verified on controlled post target `t3_1tnfgqf`.
- Comment body edit reopening is verified on controlled comment target
  `t1_ontlx1k`.

Keep these as implemented but not live-verified:

- Comment report trigger delivery.
- Post NSFW update trigger delivery.
- Post spoiler update trigger delivery.
- Post flair update trigger delivery.
- Comment-target moderation method proof beyond the observed comment lock and
  reopen flow.
- Repeated dashboard launch reuse.

### Challenges

The hardest part was keeping the product safe. Reddit already has native
ignore-reports behavior, so ReviewLock had to avoid becoming a thin wrapper over
that API. The implementation work focused on tying review state to content
integrity, failing open on uncertainty, making trigger delivery idempotent, and
keeping the dashboard honest about what has actually been proven in live Devvit
playtest.

Technical challenges included:

- Devvit WebView authorization: runtime smoke checks had to run from the
  embedded Reddit dashboard, not direct unauthenticated terminal calls.
- Trigger payload variation: report/update routes had to handle nested Devvit
  `TriggerEvent` wrapper shapes as well as local test shapes.
- Redis consistency: lock, suppress, reopen, dismiss, and metric writes needed
  rollback or retry behavior so moderation operations and the ReviewLock ledger
  do not silently diverge.
- Race conditions: report and update triggers can overlap, so the app uses
  target-scoped guards and idempotency checks.
- Claim discipline: docs, README, dashboard copy, and proof logs separate
  implemented behavior from verified runtime behavior.

### Accomplishments

- Built a complete Devvit Web moderation app with menus, forms, triggers,
  dashboard, Redis persistence, demo mode, metrics, and audit history.
- Proved the core loop in controlled playtest for a locked post: lock, suppress
  repeat report, edit, reopen.
- Proved comment edit reopening in controlled playtest.
- Hardened app behavior across Redis failures, runtime uncertainty, malformed
  records, duplicate trigger delivery, stale confirmations, cross-subreddit
  namespace risks, and demo/live data separation.
- Kept the product privacy posture narrow: no reporter usernames, no AI
  decisions, no external services, and no moderator productivity scoring.

### What is next

- Live-verify comment report trigger delivery.
- Live-verify NSFW, spoiler, and flair update trigger variants.
- Live-verify repeated dashboard launch reuse.
- Add a first-run setup surface for lock expiry defaults and reason presets.
- Recruit 1-3 moderator teams for real-world playtesting after the hackathon.

### Demo video script

Use `docs/DEMO_SCRIPT.md`.

### Screenshots

Required screenshot set:

1. Lock form on a reviewed post or comment.
2. Dashboard with active locks and `Reports suppressed`.
3. Reopen queue after an edit, showing `Reopened after edit`.
4. Runtime proof panel showing verified rows and clearly labeled unverified
   rows.
5. Demo mode banner with seeded data, if using demo screenshots.

### Testing instructions for judges

Use the final public Reddit post URL after upload and playtest confirmation:

```txt
FINAL_PUBLIC_REDDIT_POST_URL_REQUIRED
```

Suggested text:

1. Open the ReviewLock dashboard post.
2. Inspect demo mode for the full lock -> suppress -> edit -> reopen story.
3. Use the runtime panel to see which live capabilities were verified in the
   controlled Devvit environment.
4. Install the app in a test subreddit and use the `Lock review` menu action on
   a controlled post to test the live lock form.

Do not ask judges to perform destructive moderation on unrelated content.
