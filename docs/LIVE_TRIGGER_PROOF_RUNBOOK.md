# Live Trigger Proof Runbook

Last updated: 2026-05-25 01:35 IST.

This runbook is for Wave 33 controlled report/edit trigger proof. It must be
executed only in `r/reviewlock_dev` unless a different moderated test subreddit
is explicitly selected.

## Current Status

- Controlled live scenario matrix: `docs/LIVE_SCENARIO_MATRIX.md`.
- Exact controlled content: `docs/LIVE_SCENARIO_CONTENT.md`.
- S01 is drafted in Zen but has not been posted.
- No live `PostReport`, `CommentReport`, `PostUpdate`, `CommentUpdate`,
  `PostNsfwUpdate`, `PostSpoilerUpdate`, or `PostFlairUpdate` trigger delivery
  has been proven yet.

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

1. Confirm the drafted S01 post in Zen is still:
   `[ReviewLock proof S01] Reviewed unchanged policy context`.
2. Click `Post` only after action-time confirmation.
3. Record the created Reddit permalink and thing id.
4. Start or refresh playtest:
   `npm run dev -- reviewlock_dev`.
5. Open the S01 post with `?playtest=reviewlock`.
6. Use the post menu action `Lock review`.
7. Submit the lock form with reason `reviewed_policy_compliant`.
8. Open the ReviewLock dashboard and verify S01 appears as an active lock.
9. Capture runtime status before reports.
10. Submit one controlled report against S01 only after action-time
    confirmation.
11. Capture Devvit logs and dashboard after the report.

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
