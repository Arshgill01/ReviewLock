# Wave 21 - Devvit Config and Registration Hardening

## Goal

Make the Devvit app registration/playtest path as reliable as ModMirror's known-good setup allows.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Waves 01 through 20 should be complete.

## Write ownership

This wave may create or edit:

- `docs/DEVVIT_REGISTRATION_PROOF.md`
- `devvit.json`
- `package.json`
- `package-lock.json`
- root build config files if needed for Devvit compatibility

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Compare ReviewLock against `/Users/arshdeepsingh/Developer/ModMirror`:
   - `devvit.json`
   - package scripts
   - dependencies.
   - build output.
2. Run `npx devvit whoami`, `npx devvit init --help`, `npx devvit upload --help`, and playtest commands.
3. If account state permits and it is safe, initialize/register ReviewLock for the logged-in dev account.
4. Run playtest repeatedly enough to catch config and build-loop failures.
5. Document exact commands, browser/dev console observations where available, and blockers.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
npm run dev -- reviewlock_dev
```

If playtest cannot proceed, record the exact error and why the next action requires user/browser/account intervention.

## Acceptance

- ReviewLock's Devvit config matches current schema expectations.
- Playtest either runs or has a precise account/platform blocker.
- No recursive build/playtest loop remains.
- `TODO.md` marks Wave 21 complete.
- All changes are committed.

## Commit

```txt
fix: harden devvit registration path
```
