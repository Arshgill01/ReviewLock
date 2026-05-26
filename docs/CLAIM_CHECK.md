# Claim Check

Last updated: 2026-05-26.

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

## Implemented But Not Yet Verified

These may be described as implemented and locally tested, but not as live
verified:

- Comment report trigger delivery.
- Post NSFW update trigger delivery.
- Post spoiler update trigger delivery.
- Post flair update trigger delivery.
- Repeated dashboard launch reuse.
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

- [ ] Headline says `Lock reviewed content until it changes.`
- [ ] First paragraph explains the edit-aware reopen loop.
- [ ] Copy does not frame ReviewLock as an ignore-reports wrapper.
- [ ] Copy does not imply users are prevented from reporting.
- [ ] Copy explains why this is safer than open-ended ignore behavior.
- [ ] Copy names the proof boundary.
- [ ] Copy names remaining proof gaps without burying them.
- [ ] Copy includes 1-3 realistic community types.
- [ ] Copy includes a conservative time-savings model.
- [ ] Copy explains Devvit-native integration.
- [ ] Copy avoids unsupported production-scale claims.
- [ ] App listing status is verified after upload with `npx devvit view --json`.

## Current Submission Risk Register

| Risk | Severity | Status | Required action |
| --- | --- | --- | --- |
| Developer Portal listing still has stub metadata | high | open | Upload final build/listing and verify with `npx devvit view --json`. |
| Public judging post URL not yet recorded | high | open | Add URL in a public subreddit with fewer than 200 members. |
| Comment report live proof missing | medium | open | Keep unverified, or run controlled proof. |
| NSFW/spoiler/flair live proof missing | medium | open | Keep unverified, or run controlled proof. |
| Repeated dashboard launch reuse live proof missing | low | open | Keep unverified until controlled browser proof. |
| Browser screenshot fixture used from `/tmp` | low | open | Move fixture into repo or mark artifact-only proof. |
