# Wave 13 - Runtime Proof and Hardening

## Goal

Prove or honestly limit ReviewLock's Devvit runtime claims, then harden failure paths discovered during playtest.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 12 should be complete.

## Write ownership

This wave may create or edit:

- `docs/RUNTIME_PROOF.md`
- `docs/PLAYTEST_CHECKLIST.md`
- `docs/KNOWN_LIMITATIONS.md`
- `src/server/services/runtimeHardening.ts`
- `src/server/services/runtimeHardening.test.ts`
- narrowly scoped patches to files needed to fix runtime failures discovered in this wave

Append-only allowed:

- `RESEARCH.md`
- `decisions.md`
- `TODO.md`
- `log.md`

If patching files outside the list, record exact reason in `decisions.md`.

## Implementation

1. Create playtest checklist covering:
   - app upload/playtest
   - open dashboard menu
   - lock a test post
   - lock a test comment
   - repeated report trigger behavior
   - edit post and confirm reopen
   - edit comment and confirm reopen
   - unignore reports after reopen
   - demo reset
2. Run local verification first:
   - type-check
   - lint
   - tests
   - build
3. If logged in and a test subreddit is configured, run:
   - `npm run dev -- <test-subreddit>` or project-native playtest command
   - `devvit logs`
4. Record exact results in `docs/RUNTIME_PROOF.md`:
   - date/time
   - commands
   - subreddit used
   - pass/fail per capability
   - payload notes without private data
5. Implement hardening only for failures discovered:
   - safer error messages
   - runtime status downgrades
   - fallback to demo labels
   - idempotency fixes
6. Update `docs/KNOWN_LIMITATIONS.md` with any unverified or failed platform claim.
7. Tests must cover hardening patches.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

If playtest cannot run, record why with exact error. Do not mark live behavior verified.

## Acceptance

- Runtime proof docs distinguish implemented, verified, failed, and unverified.
- README/submission later can cite only verified behavior.
- Any runtime blockers have honest fallbacks.
- `TODO.md` marks Wave 13 complete.
- All changes are committed.

## Commit

```txt
test: document reviewlock runtime proof
```

