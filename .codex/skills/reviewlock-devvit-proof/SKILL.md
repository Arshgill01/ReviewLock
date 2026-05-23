---
name: reviewlock-devvit-proof
description: Verify ReviewLock Devvit APIs, triggers, Reddit moderation operations, Redis behavior, menu/forms, playtest behavior, and runtime claims. Use before changing Devvit primitives, before claiming live report suppression or reopening works, and during runtime proof waves.
---

# ReviewLock Devvit Proof

Use this skill for platform verification.

## Verification hierarchy

1. Generated project typings and installed package versions.
2. Official Reddit Developer docs.
3. Controlled playtest in a test subreddit.
4. Existing research notes.

Do not rely on memory for Devvit API names.

## Required checks

For API changes:

- Inspect installed package versions in `package.json`.
- Search typings with `rg` before coding against an API.
- Record source paths and relevant line numbers in `RESEARCH.md`.

For trigger behavior:

- Verify the trigger is listed in `devvit.json`.
- Verify the endpoint exists.
- Log received payload shape in playtest without leaking private user data.
- Handle duplicate deliveries idempotently.

For moderation methods:

- Test only on controlled content in a test subreddit.
- Verify `approve()`, `ignoreReports()`, and `unignoreReports()` separately.
- If a method fails, keep UI honest and log the blocker.

For Redis:

- Confirm all keys are namespaced.
- Validate hashes and sorted sets with unit tests.
- Test missing-key behavior.

## Claim language

- "Implemented" means code exists and local tests pass.
- "Verified" means the exact runtime command was run and passed.
- "Unverified" means no live claim in README, Devpost copy, or demo narration.

