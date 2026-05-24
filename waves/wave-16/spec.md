# Wave 16 - Edit-Fingerprint Stress

## Goal

Prove the fingerprint engine catches material content-integrity changes while avoiding false reopen decisions for non-material whitespace-only edits.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 15 should be complete.

## Write ownership

This wave may create or edit:

- `docs/FINGERPRINT_STRESS.md`
- `src/server/services/fingerprint*.test.ts`
- `src/server/services/contentChange*.test.ts`
- narrow fixes in `src/server/services/fingerprint.ts` or `src/server/services/contentChange.ts`

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Add stress cases for:
   - outer whitespace-only edits.
   - runs of spaces and tabs.
   - markdown line break changes.
   - post body cleared.
   - post body rewritten.
   - comment body cleared.
   - comment body rewritten.
   - title changes.
   - URL changes.
   - flair text and template changes.
   - NSFW and spoiler toggles.
2. Classify expected behavior in `docs/FINGERPRINT_STRESS.md`.
3. Fix any false negative where material edits do not change the hash.
4. Fix any false positive where normalization says a non-material whitespace-only edit changed reviewed content.

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/fingerprint.test.ts src/server/services/contentChange.test.ts
npm run lint
npm run build
```

## Acceptance

- Stress doc records every edge case and result.
- Tests cover every required edge case.
- Fingerprint uncertainty still fails open.
- `TODO.md` marks Wave 16 complete.
- All changes are committed.

## Commit

```txt
test: stress reviewlock fingerprints
```
