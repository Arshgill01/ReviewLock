---
name: reviewlock-product-guardrails
description: Protect ReviewLock's product thesis while planning, implementing, reviewing, or writing copy. Use when work affects feature scope, dashboard UX, demo story, README, submission framing, report handling, lock behavior, reopen behavior, metrics, or moderator safety.
---

# ReviewLock Product Guardrails

Use this skill whenever a change could alter what ReviewLock is.

## Core thesis

ReviewLock locks reviewed content until it changes. If content changes, the lock breaks and moderators see it again.

## Must preserve

- The app is not an ignore-reports wrapper.
- The edit-aware reopen loop is the first-class feature.
- Metrics make suppressed report churn visible.
- Reopen is non-destructive by default.
- Human moderators remain in control.
- Demo mode shows lock, repeated reports, edit, reopen.

## Forbidden framing

Do not say:

- "Make posts not reportable"
- "Disable reports"
- "Hide all reports forever"
- "AI decides whether reports matter"
- "Automated removal after edit" as default behavior

Prefer:

- "Lock reviewed content until it changes"
- "Suppress repeat reports on unchanged reviewed content"
- "Reopened after edit"
- "Reports suppressed"
- "Review state tied to content integrity"

## Cut conditions

Cut any feature that:

- duplicates Flag App report filtering as the main value;
- turns into a generic modqueue dashboard;
- requires external services;
- tracks moderator productivity;
- stores reporter identities;
- makes claims that cannot be runtime-proven.

## UX check

Before finishing product-facing work, verify the first viewport answers:

1. How many reviewed items are locked?
2. How many repeat reports were suppressed?
3. Which items reopened because content changed?
4. Why is this more than native ignore reports?

