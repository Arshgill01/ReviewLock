# Live Trigger Proof Runbook

Last updated: 2026-05-25 15:12 IST.

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
- Current playtest reached `v0.0.2.84`.
- Trigger routes now emit sanitized payload-shape logs from the live bootstrap
  path. These logs intentionally record only route name, target kind, and
  boolean/object-shape flags, not raw target ids, content text, reporter names,
  or report reason text.
- No live `PostReport`, `CommentReport`, `PostUpdate`, `CommentUpdate`,
  `PostNsfwUpdate`, `PostSpoilerUpdate`, or `PostFlairUpdate` trigger delivery
  has been proven yet.
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

## S01 Proof Sequence

S01 proves unchanged post report suppression.

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
9. Submit one controlled report against S01 only after action-time
    confirmation.
10. Capture Devvit logs and dashboard after the report.

Expected proof:

- `PostReport` delivery reaches `/internal/triggers/on-post-report`.
- Active lock is loaded for the S01 thing id.
- Fingerprint matches the stored lock fingerprint.
- `ignoreReports()` is called for the unchanged target.
- `suppressedReportCount` increments.
- Dashboard `Reports suppressed` increments.
- Audit timeline receives `report_suppressed`.
- Reopen queue remains unchanged.

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

Until the runbook is executed and evidence is captured:

- Do not claim live report suppression is verified.
- Do not claim live edit-trigger reopening is verified.
- Do not claim comment-target moderation methods are verified.
- Do not claim trigger payload logs have been captured.
