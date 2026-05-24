# Trigger Proof

Last updated: 2026-05-25 01:38 IST.

This document traces every ReviewLock trigger path from incoming payload to target resolution, lock decision, moderation operation, Redis mutation, metrics, audit, and reopen queue effects.

## Payload Sources

Local route tests use payload fields accepted by ReviewLock trigger routes:

- Report triggers: `targetId`, `postId`, `commentId`, `eventId`, `reportedAt`, `reportCount`, `subreddit`.
- Update triggers: `targetId`, `postId`, `commentId`, `subreddit`.
- Devvit-shaped nested payloads: top-level `post`, `comment`, and
  `subreddit: { name }`, plus `postReport`, `commentReport`, `postUpdate`,
  `commentUpdate`, `postFlairUpdate`, `nsfwPostUpdate`, and
  `spoilerPostUpdate` wrappers.
- Bare Devvit ids are normalized at route boundaries when the endpoint target
  kind is known: post routes use `t3_*`; comment routes use `t1_*`.

Live Devvit payload comparison is not available yet. `devvit logs` connectivity was proven in Wave 13, but no live `PostReport`, `CommentReport`, or update payloads have been captured from Reddit runtime. Until those events are generated in `r/reviewlock_dev`, route payloads are representative local fixtures only.

## Report Trigger Paths

| Path                                          | Input                                                                         | Decision                                               | Moderation call                 | Redis lock state                                                                               | Metrics                                                     | Audit                                                            | Reopen queue                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| PostReport unchanged locked post              | `postId: t3_post`, active lock hash matches current post fingerprint          | `suppress_unchanged`                                   | `ignoreReports:t3_post` once    | Lock remains `active`; active target index remains present; `suppressedReportCount` increments | Daily `reportsSuppressed +1`; target `reportsSuppressed +1` | `report_suppressed` with unchanged-content message               | No event                                      |
| CommentReport unchanged locked comment        | `commentId: t1_comment`, active lock hash matches current comment fingerprint | `suppress_unchanged`                                   | `ignoreReports:t1_comment` once | Lock remains `active`; active target index remains present; `suppressedReportCount` increments | Daily `reportsSuppressed +1`; target `reportsSuppressed +1` | `report_suppressed` with `targetKind: comment`                   | No event                                      |
| Duplicate report delivery                     | Same event id after the first report path                                     | `duplicate`                                            | No second moderation call       | No second lock mutation                                                                        | No second metrics increment                                 | No second audit event                                            | No event                                      |
| Retry after runtime-uncertain report delivery | Same event id after target-resolution or `ignoreReports()` failure            | Reprocessed after the failure clears the dedupe marker | Depends on retry outcome        | Failed attempt leaves the active lock retryable                                                | Failed attempt writes no suppression metric                 | Failed attempt records `runtime_failure` when Redis is available | No event unless retry detects changed content |
| PostReport changed locked post                | `postId: t3_post`, current post fingerprint differs                           | `reopen_changed`                                       | `unignoreReports:t3_post`       | Lock becomes `reopened`; active target index removed; `reopenReason: content_changed`          | Daily `locksReopened +1`; target `locksReopened +1`         | `lock_reopened` with report-trigger message                      | Event with `reason: content_changed`          |
| CommentReport changed locked comment          | `commentId: t1_comment`, current comment fingerprint differs                  | `reopen_changed`                                       | `unignoreReports:t1_comment`    | Lock becomes `reopened`; active target index removed; `reopenReason: content_changed`          | Daily `locksReopened +1`; target `locksReopened +1`         | `lock_reopened` with `targetKind: comment`                       | Event with `reason: content_changed`          |
| Target cannot be loaded, no subreddit scope   | Payload identifies a target absent from Reddit adapter and no subreddit scope | `runtime_uncertain`                                    | None                            | Any active lock remains retryable because no namespace can be proven                           | No suppression metric                                       | `runtime_failure`                                                | No event                                      |
| Target cannot be loaded, known active lock    | Payload identifies a target absent from Reddit adapter with subreddit scope    | `runtime_uncertain`                                    | None                            | Known lock becomes `reopened`; active target index removed; `reopenReason: runtime_uncertain`  | No suppression metric                                       | `lock_reopened` with `unignoreReportsOk: false`                  | Event with `reason: runtime_uncertain`       |
| `ignoreReports()` fails                       | Active unchanged lock but moderation operation throws                         | `runtime_uncertain`                                    | Failed `ignoreReports` call     | Lock remains `active`; no suppression mutation                                                 | No suppression metric                                       | `runtime_failure`                                                | No event                                      |

## Update Trigger Paths

| Path                               | Input                                               | Decision    | Moderation call              | Redis lock state                                                                      | Metrics                                             | Audit                                      | Reopen queue                         |
| ---------------------------------- | --------------------------------------------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| PostUpdate unchanged post          | `postId: t3_post`, current fingerprint matches lock | `unchanged` | None                         | Lock remains `active`; active target index remains present                            | No metric                                           | No audit event                             | No event                             |
| PostUpdate changed post body       | `postId: t3_post`, body fingerprint differs         | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; active target index removed; `reopenReason: content_changed` | Daily `locksReopened +1`; target `locksReopened +1` | `lock_reopened`                            | Event with `reason: content_changed` |
| CommentUpdate changed comment body | `commentId: t1_comment`, body fingerprint differs   | `reopened`  | `unignoreReports:t1_comment` | Lock becomes `reopened`; active target index removed; `reopenReason: content_changed` | Daily `locksReopened +1`; target `locksReopened +1` | `lock_reopened` with `targetKind: comment` | Event with `reason: content_changed` |
| PostNsfwUpdate material change     | `postId: t3_post`, NSFW flag differs                | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; `reopenReason: nsfw_changed`                                 | Daily and target `locksReopened +1`                 | `lock_reopened`                            | Event with `reason: nsfw_changed`    |
| PostSpoilerUpdate material change  | `postId: t3_post`, spoiler flag differs             | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; `reopenReason: spoiler_changed`                              | Daily and target `locksReopened +1`                 | `lock_reopened`                            | Event with `reason: spoiler_changed` |
| PostFlairUpdate material change    | `postId: t3_post`, flair differs                    | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; `reopenReason: flair_changed`                                | Daily and target `locksReopened +1`                 | `lock_reopened`                            | Event with `reason: flair_changed`   |

## Fail-Open Rule

No trigger path suppresses reports when ReviewLock cannot prove the current content fingerprint matches the reviewed fingerprint.

- Missing target resolution records a runtime failure and leaves reports unsuppressed.
- Missing target resolution with a known active lock reopens that lock as
  `runtime_uncertain` so it cannot continue suppressing reports after content
  integrity becomes unknowable.
- `ignoreReports()` failure records a runtime failure and leaves the lock active without counting suppression.
- Redis failure after `ignoreReports()` attempts `unignoreReports()` rollback,
  records the moderation result in runtime proof, and writes a rollback
  `runtime_failure` audit event if rollback fails and Redis is still available.
- Changed or uncertain content reopens instead of suppressing.
- Runtime-uncertain report-trigger deliveries clear their dedupe marker so a
  Devvit retry with the same event id can reprocess the target.
- Successful report-trigger dedupe markers expire after seven days to avoid
  permanent key growth.

## Test Evidence

Commands:

- `npm run type-check`
- `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts src/server/adapters/redis.test.ts src/client/render.test.ts --reporter verbose`
- `npm run test -- src/server/services/targetResolver.test.ts src/routes/menu.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
- `npm run test`
- `npm run build`

Targeted test result:

- 4 files passed.
- Report trigger service coverage now includes 20 report-trigger tests, including
  dedupe TTL, retry after runtime-uncertain failures, and rollback failure
  evidence after Redis write failures.
- Trigger route coverage includes Devvit wrapper payloads and bare post/comment
  id normalization before target resolution.

Covered files:

- `src/server/services/reportTriggers.test.ts`
- `src/server/services/updateTriggers.test.ts`
- `src/server/services/targetResolver.test.ts`
- `src/routes/menu.test.ts`
- `src/routes/triggers.report.test.ts`
- `src/routes/triggers.update.test.ts`

## Remaining Runtime Work

- Generate live `PostReport` and `CommentReport` events in `r/reviewlock_dev`.
- Generate live post/comment update, NSFW, spoiler, and flair update events in `r/reviewlock_dev`.
- Capture sanitized `devvit logs` payload shape evidence and compare it with the local route fixtures above.
