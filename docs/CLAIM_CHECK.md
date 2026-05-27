# Claim Check

Last updated: 2026-05-27.

Purpose: keep README, Devpost, app listing, screenshots, and demo narration
aligned with runtime proof. If a claim is not listed as approved here or in a
newer `docs/RUNTIME_PROOF.md`, phrase it as implemented or planned, not
verified.

## Approved Core Claims

- ReviewLock locks reviewed content until it changes.
- ReviewLock is a Reddit Devvit moderation app.
- ReviewLock uses post/comment menu actions, forms, triggers, Devvit Reddit
  capabilities, Devvit Redis, and a Devvit Web custom post dashboard.
- ReviewLock stores a content fingerprint for reviewed posts and comments.
- ReviewLock suppresses repeat reports on unchanged locked content when the
  report trigger can resolve the target and the fingerprint still matches.
- ReviewLock reopens locked content when the material fingerprint changes.
- Reopen is non-destructive by default.
- ReviewLock records lock, unlock, suppress, reopen, dismiss, and runtime
  failure audit events.
- ReviewLock has visibly labeled demo mode.
- ReviewLock does not store reporter usernames.
- ReviewLock does not use AI or external services.

## Approved Verified Claims

Use `verified` only for these rows unless `docs/RUNTIME_PROOF.md` is updated:

- Dashboard custom post rendering inside Reddit is verified.
- Runtime `redis` smoke from the embedded dashboard is verified.
- Runtime `redditContext` smoke from the embedded dashboard is verified.
- Post-target `approve()` is verified on controlled post target `t3_1tm8nak`.
- Post-target `ignoreReports()` is verified on controlled post target
  `t3_1tm8nak`.
- Post-target `unignoreReports()` is verified through dashboard unlock on
  controlled post target `t3_1tm8nak`.
- Post report trigger delivery is verified for controlled unchanged locked post
  target `t3_1tm8nak`.
- Post body edit reopening is verified on controlled post target `t3_1tnfgqf`.
- Comment body edit reopening is verified on controlled comment target
  `t1_ontlx1k`.
- Devvit logs captured sanitized payload-shape evidence for `on-post-report`,
  `on-post-update`, and `on-comment-update`.
- Repeated dashboard launch reuse is verified on public `r/reviewlock_judges`;
  the subreddit menu action reopened existing dashboard post `1tp3jxl`.

## Implemented But Not Yet Verified

These may be described as implemented and locally tested, but not as live
verified:

- Comment report trigger delivery.
- Post NSFW update trigger delivery.
- Post spoiler update trigger delivery.
- Post flair update trigger delivery.
- Independent comment-target moderation method proof for approve, ignore, and
  unignore operations.

## Forbidden Or Risky Claims

Do not use:

- "Make posts not reportable."
- "Users cannot report locked content."
- "Reports are disabled."
- "Disable reports forever."
- "Blocked reports."
- "AI decides whether reports matter."
- "Automatic removal after edit."
- "Verified at scale."
- "Production proven."
- "Works for all subreddits."
- "Universal modqueue replacement."

Preferred replacements:

- "Lock reviewed content until it changes."
- "Suppress repeat reports on unchanged reviewed content."
- "Reports suppressed."
- "Reopened after edit."
- "Review state tied to content integrity."
- "Implemented and locally tested; live proof pending."
- "Controlled playtest verified."

## Submission Copy Audit Checklist

- [x] Headline says `Lock reviewed content until it changes.`
- [x] First paragraph explains the edit-aware reopen loop.
- [x] Copy does not frame ReviewLock as an ignore-reports wrapper.
- [x] Copy does not imply users are prevented from reporting.
- [x] Copy explains why this is safer than open-ended ignore behavior.
- [x] Copy names the proof boundary.
- [x] Copy names remaining proof gaps without burying them.
- [x] Copy includes 1-3 realistic community types.
- [x] Copy includes a conservative time-savings model.
- [x] Copy explains Devvit-native integration.
- [x] Copy avoids unsupported production-scale claims.
- [x] App listing status is verified after upload with `npx devvit view --json`.

## Current Submission Risk Register

| Risk | Severity | Status | Required action |
| --- | --- | --- | --- |
| Developer Portal app-level metadata | high | resolved | Developer Portal fields were exposed and populated on 2026-05-27; `npx devvit view --json` now reports app description, privacy URL, and terms URL. |
| Public judging post URL not yet recorded | high | resolved | Public judging dashboard URL recorded: `https://www.reddit.com/r/reviewlock_judges/comments/1tp3jxl/reviewlock_dashboard/`. |
| Comment report live proof missing | medium | open | Keep unverified, or run controlled proof. |
| NSFW/spoiler/flair live proof missing | medium | open | Keep unverified, or run controlled proof. |
| Repeated dashboard launch reuse live proof missing | low | resolved | Verified on public `r/reviewlock_judges`; repeated menu launch reopened existing dashboard post `1tp3jxl`. |
| Browser screenshot fixture used from `/tmp` | low | accepted | Screenshot manifest labels local/browser artifacts by source and does not present them as live Reddit proof. |
