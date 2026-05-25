# Live Scenario Matrix

Last updated: 2026-05-25 01:24 IST.

This file defines how ReviewLock should gather real runtime proof without
confusing seeded demo data with live evidence.

Exact controlled post and comment copy lives in
`docs/LIVE_SCENARIO_CONTENT.md`.
The live trigger execution runbook lives in
`docs/LIVE_TRIGGER_PROOF_RUNBOOK.md`.

## Feasibility Verdict

ReviewLock cannot gather real moderation data from arbitrary subreddits.

Devvit apps run inside subreddits where they are installed or playtested. The
official playtest flow targets a named test subreddit, and `devvit install`
installs an app into a subreddit the developer moderates. Therefore, the live
proof path must use controlled subreddits where the app is installed and the
tester has moderator authority.

Allowed live proof sources:

- `r/reviewlock_dev`, the current controlled proof subreddit.
- Additional controlled test subreddits moderated by the dev account, if the app
  is installed or playtested there.
- Real posts and comments created specifically for ReviewLock proof.

Disallowed proof sources:

- Arbitrary public subreddits where ReviewLock is not installed.
- Scraped Reddit data.
- Imported third-party moderation data.
- Seeded demo fixtures presented as live trigger evidence.

## Demo And Live Separation

Demo data and live proof do not collide.

- Demo mode uses the deterministic `reviewlock_demo` namespace and must be
  requested with demo mode enabled.
- Live mode uses the runtime subreddit namespace, currently `reviewlock_dev`.
- Demo rows are visibly labeled and read-only.
- Demo runtime status warns that seeded records are not runtime proof.

The seeded demo exists to show a full, polished moderation ledger. The live
scenario matrix exists to prove Devvit runtime behavior on controlled content.

## Controlled Live Corpus

Use clear post titles so the audit log, dashboard, and Reddit UI can be matched
without storing private user data.

| Scenario | Target  | Content setup                                                                 | Expected ReviewLock proof                                                                          |
| -------- | ------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| S01      | Post    | `[ReviewLock proof S01] Reviewed unchanged policy context` with a normal body | Lock succeeds; repeated report on unchanged content suppresses and increments metrics.             |
| S02      | Post    | `[ReviewLock proof S02] Body edit reopen`                                     | Lock succeeds; body rewrite changes fingerprint; update or later report reopens.                   |
| S03      | Post    | `[ReviewLock proof S03] Flair edit reopen`                                    | Lock succeeds; flair change changes fingerprint; lock reopens with `flair_changed`.                |
| S04      | Post    | `[ReviewLock proof S04] NSFW toggle reopen`                                   | Lock succeeds; NSFW toggle changes fingerprint; lock reopens with `nsfw_changed`.                  |
| S05      | Post    | `[ReviewLock proof S05] Spoiler toggle reopen`                                | Lock succeeds; spoiler toggle changes fingerprint; lock reopens with `spoiler_changed`.            |
| S06      | Post    | `[ReviewLock proof S06] Whitespace-only edit`                                 | Lock succeeds; whitespace-only body edit should not reopen if normalized fingerprint is unchanged. |
| S07      | Comment | Comment on S01: `Reviewed unchanged comment context.`                         | Comment lock succeeds if the comment menu is available; repeated report suppresses.                |
| S08      | Comment | Comment on S02: `Comment body edit proof.`                                    | Comment lock succeeds; body rewrite reopens.                                                       |
| S09      | Post    | `[ReviewLock proof S09] High churn unchanged post`                            | Multiple repeat reports on unchanged content suppress without duplicate active locks.              |
| S10      | Post    | `[ReviewLock proof S10] Relock after missed edit`                             | If old lock exists and content changed, relock reopens stale lock before creating a replacement.   |

## Proof Steps Per Scenario

For each scenario:

1. Create or identify the controlled target in `r/reviewlock_dev`.
2. Start playtest with `npm run dev -- reviewlock_dev`.
3. Lock the target through the ReviewLock menu/form.
4. Capture the dashboard state before the event.
5. Perform the controlled report, edit, flair, NSFW, or spoiler action.
6. Capture sanitized `devvit logs` evidence for trigger delivery when available.
7. Refresh the dashboard and record:
   - active lock state,
   - suppressed report count,
   - reopen queue state,
   - audit event,
   - runtime proof status.
8. Update `docs/RUNTIME_PROOF.md`, `docs/PLAYTEST_CHECKLIST.md`, and `log.md`
   with exact commands and observed results.

## Action Confirmation Boundary

Real Reddit actions are not simulated by this document.

Before performing any live Reddit report submission, post edit, comment edit,
flair change, NSFW toggle, spoiler toggle, unlock, dismiss, remove, or approve
action, get action-time confirmation unless the user has explicitly approved
that exact action in the current live pass.

## Current Blockers

- Live `PostReport` trigger delivery is proven for unchanged controlled post
  target `t3_1tm8nak`; `CommentReport` trigger delivery is not yet proven.
- Live post/comment update trigger delivery is not yet proven.
- Comment menu proof is still pending because comment menu availability needs a
  controlled browser pass.
- A second account or a clearly safe reporting workflow may be needed if Reddit
  does not reliably trigger reports submitted by the same moderator account.
