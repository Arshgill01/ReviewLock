# Live Trigger Proof Runbook

Last updated: 2026-05-25 22:56 IST.

This runbook is for Wave 33 controlled report/edit trigger proof. It must be
executed only in `r/reviewlock_dev` unless a different moderated test subreddit
is explicitly selected.

## Current Status

- Controlled live scenario matrix: `docs/LIVE_SCENARIO_MATRIX.md`.
- Exact controlled content: `docs/LIVE_SCENARIO_CONTENT.md`.
- S01 has been posted in `r/reviewlock_dev`:
  `/r/reviewlock_dev/comments/1tmmeo6/reviewlock_proof_s01_reviewed_unchanged_policy/`
  (`t3_1tmmeo6`, author `u/BrightyBrainiac`).
- S01 was verified in the live dashboard as an active lock on playtest
  `v0.0.2.84`, with target `post:1tmmeo6`, author `u/BrightyBrainiac`,
  reason `reviewed policy compliant`, and `0` reports suppressed before any
  controlled report event.
- The current playtest continued hot reloading after update-trigger
  runtime-proof and dashboard warning hardening; the code hardening was first
  observed at `v0.0.2.89`.
- Trigger routes now emit sanitized payload-shape logs from the live bootstrap
  path. These logs intentionally record only route name, target kind, and
  boolean/object-shape flags, not raw target ids, content text, reporter names,
  or report reason text.
- Controlled live `PostReport` delivery is verified for unchanged locked post
  `t3_1tm8nak` on playtest `v0.0.2.87`.
- Controlled live `PostUpdate` body-edit delivery is verified for locked proof
  post `t3_1tnfgqf` on playtest `v0.0.2.107`.
- Comment report/update, post NSFW/spoiler, and post flair update trigger
  deliveries remain unverified.
- S01 is authored by the currently logged-in dev account, so Reddit does not
  expose a `Report` action for S01 from this session. The first unchanged-report
  proof candidate is the already locked dashboard post `t3_1tm8nak`, authored
  by `u/reviewlock`, because the logged-in dev account can open its Report
  modal.

## Terminal Setup

Start playtest from the repo root:

```bash
npm run dev -- reviewlock_dev
```

Expected ready output:

```txt
Playtest ready
URL: https://www.reddit.com/r/reviewlock_dev/?playtest=reviewlock
Version: v0.0.2.x
```

Capture logs in a separate terminal when needed:

```bash
npx devvit logs reviewlock_dev reviewlock --since 10m --show-timestamps --log-runtime
```

If logs report `listen EADDRINUSE: address already in use :::5678` while
playtest is running, record the warning, stop playtest after the browser action,
and retry log capture immediately.

## S01 Active Lock Baseline

S01 proves the live lock baseline for a controlled post authored by the logged-in
developer account. It cannot prove report delivery from the same session because
Reddit does not expose a `Report` action to the author.

1. Confirm the posted S01 post in Zen is still:
   `[ReviewLock proof S01] Reviewed unchanged policy context`.
2. Confirm the S01 permalink and thing id:
   `/r/reviewlock_dev/comments/1tmmeo6/reviewlock_proof_s01_reviewed_unchanged_policy/`
   and `t3_1tmmeo6`.
3. Start or refresh playtest:
   `npm run dev -- reviewlock_dev`.
4. Open the S01 post with `?playtest=reviewlock`.
5. Use the post menu action `Lock review`.
6. Submit the lock form with reason `reviewed_policy_compliant` only after
   action-time confirmation because it approves where supported, calls
   `ignoreReports()`, and writes ReviewLock state.
7. Open the ReviewLock dashboard and verify S01 appears as an active lock.
8. Capture runtime status before reports.
9. Do not attempt same-account report proof against S01. Use a second
   account/session or the dashboard-post candidate below.

Expected proof:

- S01 appears as an active lock in the dashboard.
- Runtime panel keeps report and update triggers unverified until a report/edit
  event is generated and observed.

## Dashboard Post Report Candidate

The already locked dashboard post `t3_1tm8nak` is the current executable
unchanged-report proof candidate from this logged-in session.

1. Confirm the ReviewLock dashboard post is active in the dashboard:
   `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`.
2. Confirm the target is `t3_1tm8nak`, authored by `u/reviewlock`, with
   suppressed count recorded before the report.
3. Submit one controlled report against `t3_1tm8nak` only after action-time
   confirmation.
4. Capture Devvit logs and dashboard after the report.

Expected proof:

- `PostReport` delivery reaches `/internal/triggers/on-post-report`.
- Active lock is loaded for target `t3_1tm8nak`.
- Fingerprint matches the stored lock fingerprint.
- `ignoreReports()` is called for the unchanged target.
- `suppressedReportCount` increments.
- Dashboard `Reports suppressed` increments.
- Audit timeline receives `report_suppressed`.
- Reopen queue remains unchanged.

Observed proof on 2026-05-25:

- Reddit report flow submitted against `t3_1tm8nak` from `u/BrightyBrainiac`
  using category `Spam`, subtype `Other`, and blank optional additional
  context.
- `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`
  emitted sanitized payload-shape evidence for `on-post-report`.
- Payload shape proved a nested `post` object with `post.id`,
  `post.subredditId`, and `post.numReports`; direct top-level `targetId`,
  `postId`, and `eventId` were absent.
- Reddit native post status showed `Reports ignored 1`.
- ReviewLock dashboard showed `Reports suppressed = 1`, active lock row
  `post:1tm8nak` suppressed count `1`, report churn `post:1tm8nak` count `1`,
  and audit `Report Suppressed 5/25/2026, 3:29:43 PM`.

## S02 Proof Sequence

S02 proves body edit reopen.

1. Create S02 from `docs/LIVE_SCENARIO_CONTENT.md` after confirmation.
2. Lock S02 through ReviewLock.
3. Confirm S02 appears as an active lock.
4. Edit the post body to the S02 edited body after action-time confirmation.
5. Capture logs and dashboard.
6. If no update trigger arrives, submit one controlled report after
   confirmation to force a refetch path.

Expected proof:

- Update trigger or report-trigger refetch sees a changed fingerprint.
- Lock status becomes `reopened`.
- `unignoreReports()` is called when supported.
- Reopen queue receives an event with `content_changed`.
- Dashboard `Reopened after edit` increments.

Observed proof on 2026-05-25:

- S02 was posted at
  `/r/reviewlock_dev/comments/1tnfgqf/reviewlock_proof_s02_body_edit_reopen/`
  with thing id `t3_1tnfgqf`.
- `Lock review` created lock `lock-t3_1tnfgqf-1779729393648` at
  `5/25/2026, 10:46:33 PM`.
- Editing the body emitted sanitized `reviewlock.trigger.payload_shape` for
  `on-post-update` from
  `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`.
- The dashboard showed active locks `3 -> 2`, `Reopened after edit = 1`,
  latest reopen `post:1tnfgqf` with reason `content changed`, reopen queue
  fingerprint delta `c322d267` to `fc05f41b`, audit `Lock Reopened
  5/25/2026, 10:53:00 PM`, and runtime proof `postUpdateTrigger verified`.

## Evidence To Record

For each live scenario, update:

- `docs/RUNTIME_PROOF.md`
- `docs/PLAYTEST_CHECKLIST.md`
- `docs/LIVE_WEBVIEW_RUNTIME_SMOKE.md` when dashboard/WebView behavior changes
- `log.md`
- `TODO.md`

Record:

- Playtest version.
- Reddit permalink and thing id.
- Exact browser actions performed.
- Exact commands run.
- Sanitized relevant log lines.
- Dashboard counts before and after.
- Whether the result is verified, partial, blocked, or failed.

## Do Not Claim Yet

Until the remaining runbook sections are executed and evidence is captured:

- Do not claim live comment report suppression is verified.
- Do not claim live comment edit-trigger reopening is verified.
- Do not claim live post NSFW/spoiler/flair-trigger reopening is verified.
- Do not claim comment-target moderation methods are verified.
- Do not claim trigger payload logs have been captured for untested trigger
  variants.
