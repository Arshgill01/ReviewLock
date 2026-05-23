# Wave 03 - Fingerprint Engine

## Goal

Implement deterministic content fingerprinting and edit-change classification. This is the product-critical engine that decides whether a reviewed lock still applies.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Wave 02 should be complete for shared types. If not, stop only for missing types that cannot be safely stubbed in this wave's files.

## Write ownership

This wave may create or edit:

- `src/server/services/fingerprint.ts`
- `src/server/services/fingerprint.test.ts`
- `src/server/services/contentChange.ts`
- `src/server/services/contentChange.test.ts`

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Implement `normalizeText(input: string | undefined): string`.
2. Implement `buildPostFingerprintInput(target)` using:
   - title
   - body/selftext
   - url
   - flair text/template id
   - nsfw flag
   - spoiler flag
3. Implement `buildCommentFingerprintInput(target)` using:
   - body
4. Implement `hashFingerprintInput(input)` using deterministic SHA-256.
5. Implement:
   - `fingerprintPost(target): ContentFingerprint`
   - `fingerprintComment(target): ContentFingerprint`
   - `fingerprintTarget(target): ContentFingerprint`
6. Implement `compareFingerprints(previous, current)` returning:
   - `changed`
   - `unchanged`
   - `uncertain`
7. Implement `classifyContentChange(previousTarget, currentTarget)` returning:
   - material changed or not
   - changed fields
   - reopen reason
8. Fail open:
   - missing current content must return `uncertain`, not `unchanged`.
   - unsupported target kind must return `uncertain`.
9. Tests must cover:
   - whitespace normalization
   - casing preserved for body/title
   - post body edit changes hash
   - post flair/nsfw/spoiler changes classify correctly
   - comment body edit changes hash
   - identical input stable hash
   - missing content returns uncertain

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/services/fingerprint.test.ts src/server/services/contentChange.test.ts
npm run lint
```

## Acceptance

- Fingerprints are deterministic.
- Tests prove edited content cannot remain silently locked.
- No Redis or Reddit API code is introduced in this wave.
- `TODO.md` marks Wave 03 complete.
- All changes are committed.

## Commit

```txt
feat: add content fingerprint engine
```

