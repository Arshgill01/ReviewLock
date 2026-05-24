# Fingerprint Stress

Last updated: 2026-05-24 16:35 IST.

ReviewLock fingerprints are the boundary between "reviewed content is still reviewed" and "this changed and must return to moderator attention." This stress pass verifies that non-material whitespace edits do not reopen locks while material content-integrity changes do.

## Normalization Rules Under Test

- Outer whitespace is trimmed.
- CRLF and CR line endings normalize to LF.
- Runs of spaces and tabs collapse to one space.
- Markdown line boundaries are preserved.
- Body and title casing is not lowercased.
- Post fingerprint fields include title, body, URL, flair text, flair template id, NSFW flag, and spoiler flag.
- Comment fingerprint fields include body only.
- Missing required current content remains uncertain and must fail open.

## Stress Matrix

| Case | Example | Expected result | Reason |
| --- | --- | --- | --- |
| Outer whitespace-only post edit | `Original body` to `\nOriginal body\t ` | unchanged | Same reviewed text after normalization. |
| Runs of spaces and tabs | `Original body with spacing` to `Original\t\tbody   with\tspacing` | unchanged | Reddit markdown text is semantically the same for ReviewLock's v1 purposes. |
| Markdown line break change | `First line\nSecond line` to `First line Second line` | changed | Line boundaries can alter markdown structure and meaning. |
| Post body cleared | `Original body` to empty string | changed | Reviewed body was removed. |
| Post body rewritten | `Original body` to `Completely rewritten body` | changed | Reviewed body no longer matches. |
| Comment whitespace-only edit | `Original comment with spacing` to `\nOriginal\tcomment   with spacing  ` | unchanged | Same reviewed comment after normalization. |
| Comment body cleared | `Original comment` to empty string | changed | Reviewed comment text was removed. |
| Comment body rewritten | `Original comment` to `Completely rewritten comment` | changed | Reviewed comment no longer matches. |
| Title change | `Original title` to `Changed title` | changed | Post title is part of reviewed content integrity. |
| URL change | empty URL to `https://example.com/changed` | changed | Link target changes the reviewed material. |
| Flair text change | `Discussion` to `News` | changed, `flair_changed` | Flair can materially change moderation context. |
| Flair template change | `flair-discussion` to `flair-news` | changed, `flair_changed` | Template id can change even when visible text is ambiguous. |
| NSFW toggle | `false` to `true` | changed, `nsfw_changed` | Safety label changed. |
| Spoiler toggle | `false` to `true` | changed, `spoiler_changed` | Content visibility label changed. |
| Missing current comment body | existing body to `undefined` | uncertain, `runtime_uncertain` | ReviewLock must fail open instead of suppressing. |

## Test Evidence

Commands:

- `npm run type-check`
- `npm run test -- --run src/server/services/fingerprint.test.ts src/server/services/contentChange.test.ts`

Targeted test result:

- 2 files passed.
- 25 tests passed.

Covered files:

- `src/server/services/fingerprint.test.ts`
- `src/server/services/contentChange.test.ts`

## Result

No fingerprint engine code changes were required in this pass. The existing engine already:

- avoids false reopen decisions for non-material whitespace-only edits;
- preserves markdown line break changes as material;
- detects body cleared and rewritten cases for posts and comments;
- detects title, URL, flair, NSFW, and spoiler material changes;
- keeps missing current content as uncertain so trigger logic fails open.
