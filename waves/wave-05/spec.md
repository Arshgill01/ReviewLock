# Wave 05 - Reddit Adapter and Moderation Operations

## Goal

Isolate Devvit Reddit API access behind safe adapters for target resolution, approval, ignore reports, and unignore reports.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Wave 02 and Wave 03 should be complete.

## Write ownership

This wave may create or edit:

- `src/server/adapters/reddit.ts`
- `src/server/adapters/reddit.test.ts`
- `src/server/adapters/clock.ts`
- `src/server/adapters/clock.test.ts`
- `src/server/services/targetResolver.ts`
- `src/server/services/targetResolver.test.ts`
- `src/server/services/moderation.ts`
- `src/server/services/moderation.test.ts`
- `src/server/services/runtimeProof.ts`
- `src/server/services/runtimeProof.test.ts`

Append-only allowed:

- `RESEARCH.md`
- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Define `RedditAdapter` interface:
   - `getPostById(id)`
   - `getCommentById(id)`
   - `approveTarget(target)`
   - `ignoreReports(target)`
   - `unignoreReports(target)`
   - optional `getCurrentUsername()` if available through context.
2. Implement a Devvit-backed adapter in a way that server routes can instantiate from `@devvit/web/server` context/reddit.
3. Implement a fake adapter for tests.
4. Implement target resolver:
   - infer target kind from `t3_` and `t1_`
   - refetch target
   - map Devvit Post/Comment into `ReviewLockTarget`
   - preserve permalink, author, report counts, edited flag
5. Implement moderation operations:
   - `approveForReviewLock`
   - `ignoreReportsForReviewLock`
   - `unignoreReportsForReviewLock`
   - structured result with `ok`, `operation`, `warnings`, `errorMessage`
6. Implement runtime proof status service:
   - record capability status
   - list capability matrix
   - statuses: `unverified`, `verified`, `failed`, `not_supported`
7. No destructive operation should throw past the orchestration layer without structured context.
8. Tests must cover:
   - post/comment ID inference
   - unknown target handling
   - adapter failure is converted to structured result
   - moderation sequence result shapes
   - runtime proof status transitions

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/server/adapters/reddit.test.ts src/server/adapters/clock.test.ts src/server/services/targetResolver.test.ts src/server/services/moderation.test.ts src/server/services/runtimeProof.test.ts
npm run lint
```

## Acceptance

- All Reddit API calls are isolated.
- No route directly calls `ignoreReports()` or `unignoreReports()`.
- Runtime-proof status exists before live claims.
- `TODO.md` marks Wave 05 complete.
- All changes are committed.

## Commit

```txt
feat: isolate reddit moderation adapter
```

