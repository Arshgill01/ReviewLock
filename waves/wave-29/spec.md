# Wave 29 - Install/Deploy Rehearsal Hardening

## Goal

Rehearse Devvit install, upload, playtest, and logs commands as far as the dev account permits.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Waves 01 through 28 should be complete.

## Write ownership

This wave may create or edit:

- `docs/INSTALL_DEPLOY_REHEARSAL.md`
- `devvit.json`
- package scripts/config if needed for verified rehearsal

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Run account/status commands.
2. Run schema/build/upload/playtest commands where safe.
3. Use browser/computer tooling for login or web flow if CLI requests it.
4. Do not publish publicly unless the user explicitly instructs.
5. Record every blocker and exact next action.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

Run Devvit commands and record exact results.

## Acceptance

- Install/deploy rehearsal doc is exact and honest.
- No production publish happened without explicit instruction.
- `TODO.md` marks Wave 29 complete.
- All changes are committed.

## Commit

```txt
docs: rehearse reviewlock devvit install
```
