# Demo Script

Last updated: 2026-05-26.

Target length: 55 seconds. Devpost rules say judges are not required to watch
beyond one minute.

Demo principle: show the edit-break loop first. Do not spend the opening on
setup, architecture, or a generic dashboard tour.

## One-Minute Script

### 0:00-0:05 - Problem

Visual: Reddit post/comment moderation menu or ReviewLock dashboard first
viewport.

Narration:

> Mods often review the same already-approved content again and again because
> repeat reports keep resurfacing it.

### 0:05-0:15 - Lock Reviewed Content

Visual: `Lock review` menu and lock form with target summary and reason.

Narration:

> ReviewLock lets a moderator lock a reviewed post or comment. It stores a
> content fingerprint and records why the team reviewed it.

### 0:15-0:27 - Suppress Repeat Reports

Visual: Dashboard active lock row. `Reports suppressed` metric increments.

Narration:

> When the same unchanged content gets reported again, ReviewLock suppresses the
> repeat report, counts the saved churn, and writes an audit entry.

### 0:27-0:42 - Edit Breaks The Lock

Visual: edit the controlled post/comment, then dashboard reopen queue.

Narration:

> The lock only holds while the reviewed content stays the same. If the author
> edits the post or comment, ReviewLock breaks the lock and brings it back to
> moderator attention.

### 0:42-0:52 - Dashboard Proof

Visual: first dashboard viewport, reopen queue, runtime proof panel.

Narration:

> The dashboard shows active locks, reports suppressed, reopened-after-edit
> items, audit history, and the runtime proof boundary for what has been
> verified in Devvit playtest.

### 0:52-0:58 - Safety Close

Visual: dashboard with runtime status or privacy/safety copy.

Narration:

> It is not open-ended, not AI, and not automatic removal. It is a safer
> reviewed content ledger: quiet while unchanged, visible when changed.

## Capture Checklist

- [ ] Use a controlled subreddit and controlled content.
- [ ] Show the app running inside Reddit, not only local browser fixtures.
- [ ] Keep the video under one minute.
- [ ] Show the product name `ReviewLock`.
- [ ] Show `Lock review`.
- [ ] Show `Reports suppressed`.
- [ ] Show `Reopened after edit`.
- [ ] Show demo label if seeded demo data appears.
- [ ] Avoid native destructive moderation menus unless required and controlled.
- [ ] Do not show private reporter data.
- [ ] Do not show secrets, tokens, terminal credentials, or private account
  settings.

## Do Not Say

- "Users cannot report this."
- "Reports are disabled."
- "This makes posts not reportable."
- "AI decides which reports matter."
- "ReviewLock removes edited content automatically."
- "This is verified" for any row still listed as unverified in
  `docs/RUNTIME_PROOF.md`.

## Optional Longer Walkthrough

If Devpost allows more media elsewhere, use this order:

1. Install/open app listing.
2. Open dashboard custom post.
3. Lock a controlled post.
4. Submit a controlled repeat report.
5. Show suppressed report metric and audit.
6. Edit the controlled post.
7. Show reopen queue.
8. Show runtime proof and known limitations.
