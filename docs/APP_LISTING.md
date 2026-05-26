# App Listing Copy

Last updated: 2026-05-26.

Target listing: `https://developers.reddit.com/apps/reviewlock`

Current listing state:

- `npm run deploy` on 2026-05-26 uploaded version `0.0.3`.
- `npx devvit view --json` after that upload returned `version.about` populated
  from the launch-grade README.
- App-level `description`, `marketingInfo`, `privacyPolicy`, and
  `termsAndConditions` are still empty in the CLI response.
- Treat this file as ready-to-use listing copy. It is not proof that the
  remaining Developer Portal listing fields have been updated.

## Short Description

Lock reviewed posts and comments until they change.

## Long Description

ReviewLock helps moderator teams reduce repeat report churn on content they have
already reviewed.

When a moderator locks a reviewed post or comment, ReviewLock stores a material
content fingerprint and records the review reason. Repeat reports on unchanged
locked content are suppressed and counted. If the content changes, ReviewLock
breaks the lock, returns reports to normal handling when Reddit allows it, and
surfaces the item in a reopen queue so moderators can review the new version.

ReviewLock is built for the safer version of ignore-reports workflows:

- reviewed state is tied to the content that was actually reviewed;
- edits and material post-state changes reopen moderator attention;
- repeat reports avoided are visible as `Reports suppressed`;
- every lock, unlock, suppress, reopen, dismiss, and runtime failure is audited;
- demo mode is visibly labeled and separated from live subreddit data.

ReviewLock does not make content unreportable, does not remove content
automatically, does not store reporter usernames, and does not use AI or
external services.

## Moderator Workflow

1. Review a post or comment.
2. Choose `Lock review` from the moderation menu.
3. Select a reason and submit the lock form.
4. ReviewLock stores the content fingerprint, approves when supported, and
   ignores repeat reports when supported.
5. Watch the dashboard for active locks, suppressed report counts, reopen queue
   items, runtime proof, and audit history.
6. If the author edits the content, ReviewLock reopens the item and surfaces it
   as `Reopened after edit`.

## Permissions Explanation

Reddit permission:

- Resolve posts/comments from menu and trigger context.
- Approve reviewed content when supported.
- Ignore repeat reports on unchanged locked content when supported.
- Unignore reports when locks are manually removed or reopened.
- Create/open the ReviewLock dashboard custom post.

Redis permission:

- Store subreddit-scoped lock records and target indexes.
- Store reopen queue records, audit events, daily metrics, runtime proof rows,
  config, form tokens, and demo data.

## Data Stored

ReviewLock stores moderation workflow metadata:

- subreddit namespace;
- target id and target kind;
- target author;
- permalink;
- title/content preview;
- content hash and fingerprint version;
- lock reason and optional moderator note;
- lock status and timestamps;
- suppressed report counts;
- reopen event summaries and runtime warnings;
- audit events for moderation traceability.

ReviewLock does not store reporter usernames and does not build user dossiers or
moderator productivity reports.

## Privacy Policy Draft

ReviewLock stores only the moderation workflow metadata needed to remember
reviewed content, suppress repeat reports on unchanged locked content, reopen
changed content, display dashboard metrics, and maintain an audit log.

Stored data may include subreddit name, target id, target kind, target author,
permalink, title/content preview, content fingerprint hash, moderator-provided
review reason, lock status, suppressed report counts, reopen events, runtime
warnings, and audit events. ReviewLock does not store reporter usernames, does
not use external services, and does not use AI to evaluate content or reports.

Data is stored in Devvit Redis for the installed subreddit and is used only to
operate ReviewLock moderation workflows.

## Terms Draft

ReviewLock is a moderation workflow tool for Reddit communities. Moderators are
responsible for their own moderation decisions and for using ReviewLock only on
content they are authorized to moderate.

ReviewLock does not guarantee that users cannot report content. ReviewLock
tracks reviewed content and attempts to suppress repeat reports on unchanged
locked content using Reddit-provided moderation capabilities. If content changes
or ReviewLock cannot verify content state with confidence, the app is designed
to surface the item for moderator attention rather than silently suppressing it.

ReviewLock is provided as a hackathon project and should be tested in a
controlled subreddit before production use.

## Categories And Tags

Suggested tags:

- moderation
- mod tools
- queue management
- audit
- reports
- Devvit

Suggested category framing:

- Moderation
- Utilities

## Listing Validation Checklist

- [ ] Run `npm run type-check`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `devvit upload` only after the local gate passes.
- [ ] Run `npx devvit view --json`.
- [ ] Confirm `version.about` contains the updated README/listing copy.
- [ ] Confirm `app.description` is no longer empty, or confirm the current
  Developer Portal workflow does not expose this field for manual editing before
  public submission.
- [ ] Confirm `marketingInfo`, privacy, and terms fields are either populated
  or intentionally left unavailable by the current Developer Portal workflow.
- [ ] Confirm the app listing URL opens: `https://developers.reddit.com/apps/reviewlock`.
- [ ] Confirm the public judging post URL works in a public subreddit with
  fewer than 200 members.
