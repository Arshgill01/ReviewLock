# Live Scenario Content

Last updated: 2026-05-25 01:39 IST.

This file contains the exact controlled content to create in
`r/reviewlock_dev` for live ReviewLock proof. These are not demo fixtures and
must not be treated as live evidence until they are posted, locked, acted on,
and observed in Devvit logs/dashboard output.

## Posting Rules

- Create content only in `r/reviewlock_dev` unless a separate moderated test
  subreddit is explicitly selected.
- Keep every title prefixed with `[ReviewLock proof SXX]`.
- Use policy-compliant, non-personal, synthetic text.
- Do not include reporter names, private user details, or external links.
- Capture the Reddit permalink and thing id after each successful post.
- Do not perform reports, edits, flair changes, NSFW toggles, spoiler toggles,
  unlocks, dismissals, removals, or approvals without action-time confirmation.

## S01 - Reviewed Unchanged Policy Context

Live record:

- Status: posted, not yet locked.
- Permalink:
  `/r/reviewlock_dev/comments/1tmmeo6/reviewlock_proof_s01_reviewed_unchanged_policy/`
- Thing id: `t3_1tmmeo6`
- Author: `u/BrightyBrainiac`

Title:

```txt
[ReviewLock proof S01] Reviewed unchanged policy context
```

Body:

```txt
Controlled ReviewLock proof target S01.

This post is intentionally policy-compliant and unchanged. It exists only in r/reviewlock_dev so ReviewLock can prove: lock review -> repeat report on unchanged content -> reports suppressed -> audit and metrics updated.

Expected behavior: after the lock is created, a repeated report should not reopen the item because the content fingerprint remains unchanged.
```

Initial action:

- Lock review with reason `reviewed_policy_compliant`.

Proof action:

- Submit a controlled repeat report against unchanged content.

Expected result:

- `PostReport` reaches ReviewLock.
- Active lock is found.
- Fingerprint matches.
- Report is suppressed.
- Suppressed count and audit event increase.

## S02 - Body Edit Reopen

Title:

```txt
[ReviewLock proof S02] Body edit reopen
```

Initial body:

```txt
Controlled ReviewLock proof target S02.

This is the original reviewed body. It should be locked after moderator review, then materially rewritten to prove the edit-aware reopen loop.
```

Edited body:

```txt
Controlled ReviewLock proof target S02.

This body was materially rewritten after review. ReviewLock should break the prior lock and return this item to moderator attention.
```

Expected result:

- Post update delivery reaches ReviewLock, or the next report forces a refetch.
- New fingerprint differs from the stored fingerprint.
- Lock moves to `reopened`.
- Reopen event reason is `content_changed`.

## S03 - Flair Edit Reopen

Title:

```txt
[ReviewLock proof S03] Flair edit reopen
```

Body:

```txt
Controlled ReviewLock proof target S03.

The body stays unchanged. The proof action changes only the post flair so ReviewLock can verify flair-sensitive fingerprints.
```

Expected result:

- Flair update delivery reaches ReviewLock, or the next report forces a refetch.
- Lock moves to `reopened`.
- Reopen event reason is `flair_changed`.

## S04 - NSFW Toggle Reopen

Title:

```txt
[ReviewLock proof S04] NSFW toggle reopen
```

Body:

```txt
Controlled ReviewLock proof target S04.

The text stays unchanged. The proof action toggles NSFW status so ReviewLock can verify that moderation-sensitive flags are part of the reviewed content fingerprint.
```

Expected result:

- NSFW update delivery reaches ReviewLock, or the next report forces a refetch.
- Lock moves to `reopened`.
- Reopen event reason is `nsfw_changed`.

## S05 - Spoiler Toggle Reopen

Title:

```txt
[ReviewLock proof S05] Spoiler toggle reopen
```

Body:

```txt
Controlled ReviewLock proof target S05.

The text stays unchanged. The proof action toggles spoiler status so ReviewLock can verify that spoiler state is part of the reviewed content fingerprint.
```

Expected result:

- Spoiler update delivery reaches ReviewLock, or the next report forces a
  refetch.
- Lock moves to `reopened`.
- Reopen event reason is `spoiler_changed`.

## S06 - Whitespace-Only Edit

Title:

```txt
[ReviewLock proof S06] Whitespace-only edit
```

Initial body:

```txt
Controlled ReviewLock proof target S06.

This body should remain semantically the same after a whitespace-only edit.
```

Whitespace-only edited body:

```txt
Controlled ReviewLock proof target S06.

This body should remain semantically the same after a whitespace-only edit.
```

Expected result:

- Whitespace-only formatting differences normalize to the same fingerprint.
- Lock remains active.
- No reopen event is created for unchanged normalized content.

## S07 - Reviewed Unchanged Comment Context

Parent:

- Use S01 after it is posted.

Comment:

```txt
Reviewed unchanged comment context for ReviewLock proof S07. This comment should stay unchanged while repeat reports prove comment report suppression.
```

Expected result:

- Comment lock succeeds if Reddit exposes the comment menu flow reliably.
- Repeat comment report reaches ReviewLock.
- Fingerprint matches and the report is suppressed.

## S08 - Comment Body Edit Reopen

Parent:

- Use S02 after it is posted.

Initial comment:

```txt
Comment body edit proof S08. This is the original reviewed comment.
```

Edited comment:

```txt
Comment body edit proof S08. This comment was materially edited after review and should reopen.
```

Expected result:

- Comment update delivery reaches ReviewLock, or the next report forces a
  refetch.
- Lock moves to `reopened`.
- Reopen event reason is `content_changed`.

## S09 - High Churn Unchanged Post

Title:

```txt
[ReviewLock proof S09] High churn unchanged post
```

Body:

```txt
Controlled ReviewLock proof target S09.

This post represents repeated stale report churn on unchanged reviewed content. The body should not change during the high-churn proof pass.
```

Expected result:

- Multiple controlled repeat reports do not create duplicate active locks.
- Suppressed metrics increase idempotently.
- Dashboard report churn surfaces this target clearly.

## S10 - Relock After Missed Edit

Title:

```txt
[ReviewLock proof S10] Relock after missed edit
```

Initial body:

```txt
Controlled ReviewLock proof target S10.

This is the originally reviewed body for a stale-lock relock proof.
```

Edited body:

```txt
Controlled ReviewLock proof target S10.

This body changed before a second Lock review submission. ReviewLock should reopen the stale lock before creating a replacement lock.
```

Expected result:

- A second Lock review on changed content does not silently return the old lock.
- Stale lock moves to `reopened`.
- Replacement lock is created only after the new content is reviewed and
  `ignoreReports()` succeeds.

## Current Manual Preflight

- S01 title and body were filled in Zen on the Reddit submit form.
- The `Post` button was not clicked.
- Playtest reached `v0.0.2.70` and was stopped cleanly.
- The next action is to confirm and submit S01, then restart playtest for the
  lock/report proof pass.
