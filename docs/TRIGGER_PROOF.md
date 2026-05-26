# Trigger Proof

Last updated: 2026-05-26 13:25 IST.

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
- Target extraction is endpoint-kind-aware. Comment report/update routes prefer
  `commentId` and `comment.id` over sibling parent `post.id` fields so comment
  locks cannot accidentally resolve against the parent post.

Live `PostReport` payload comparison is now available for a controlled
unchanged locked post in `r/reviewlock_dev`. Live `PostUpdate` and
`CommentUpdate` payload comparison is now available for controlled locked body
edits in `r/reviewlock_dev`. Comment report, NSFW, spoiler, and flair update
payloads have not been captured from Reddit runtime yet, so those route
payloads remain representative local fixtures only.

The live bootstrap now passes `console` into the trigger router so playtest logs
include `reviewlock.trigger.payload_shape` entries for report and update
callbacks. Those entries record only route names, target kind, and
boolean/object-shape flags such as whether `post.id`, `comment.id`,
`subreddit.name`, and report counters were present. They intentionally do not
record raw thing ids, subreddit names, author names, content/body text, reporter
names, or report reason text.

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
| Target cannot be loaded, known active lock    | Payload identifies a target absent from Reddit adapter with subreddit scope    | `runtime_uncertain`                                    | None                            | Known lock remains `active` with `target_resolution_failed` warning so `unignoreReports()` can be retried later | No suppression metric                                       | `runtime_failure` with `recovery: active_lock_retry_required`     | No event                                      |
| `ignoreReports()` fails                       | Active unchanged lock but moderation operation throws                         | `runtime_uncertain`                                    | Failed `ignoreReports` call     | Lock remains `active`; no suppression mutation                                                 | No suppression metric                                       | `runtime_failure`                                                | No event                                      |

### Controlled Live PostReport Evidence

Verified on 2026-05-25 in `r/reviewlock_dev` against locked dashboard post
`t3_1tm8nak` on playtest `v0.0.2.87`.

- Browser action: Reddit report flow submitted from `u/BrightyBrainiac` with
  category `Spam`, subtype `Other`, and blank optional additional context.
- Log command:
  `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`.
- Sanitized log event: `reviewlock.trigger.payload_shape` for
  `route: 'on-post-report'`, `targetKind: 'post'`.
- Observed shape: direct top-level target/event ids absent; nested `post`
  object present with `post.id`, `post.subredditId`, and `post.numReports`.
- Dashboard after refresh: `Reports suppressed = 1`, active row
  `post:1tm8nak` suppressed count `1`, report churn `post:1tm8nak` count `1`,
  and audit `Report Suppressed 5/25/2026, 3:29:43 PM`.
- Reddit native status: `Reports ignored 1`.

## Update Trigger Paths

| Path                               | Input                                               | Decision    | Moderation call              | Redis lock state                                                                      | Metrics                                             | Audit                                      | Reopen queue                         |
| ---------------------------------- | --------------------------------------------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| PostUpdate unchanged post          | `postId: t3_post`, current fingerprint matches lock | `unchanged` | None                         | Lock remains `active`; active target index remains present                            | No metric                                           | No audit event                             | No event                             |
| PostUpdate changed post body       | `postId: t3_post`, body fingerprint differs         | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; active target index removed; `reopenReason: content_changed` | Daily `locksReopened +1`; target `locksReopened +1` | `lock_reopened`                            | Event with `reason: content_changed` |
| CommentUpdate changed comment body | `commentId: t1_comment`, body fingerprint differs   | `reopened`  | `unignoreReports:t1_comment` | Lock becomes `reopened`; active target index removed; `reopenReason: content_changed` | Daily `locksReopened +1`; target `locksReopened +1` | `lock_reopened` with `targetKind: comment` | Event with `reason: content_changed` |
| PostNsfwUpdate material change     | `postId: t3_post`, NSFW flag differs                | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; `reopenReason: nsfw_changed`                                 | Daily and target `locksReopened +1`                 | `lock_reopened`                            | Event with `reason: nsfw_changed`    |
| PostSpoilerUpdate material change  | `postId: t3_post`, spoiler flag differs             | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; `reopenReason: spoiler_changed`                              | Daily and target `locksReopened +1`                 | `lock_reopened`                            | Event with `reason: spoiler_changed` |
| PostFlairUpdate material change    | `postId: t3_post`, flair differs                    | `reopened`  | `unignoreReports:t3_post`    | Lock becomes `reopened`; `reopenReason: flair_changed`                                | Daily and target `locksReopened +1`                 | `lock_reopened`                            | Event with `reason: flair_changed`   |
| Target cannot be loaded, known active lock | Payload identifies an active lock but current content cannot be refetched | `runtime_uncertain` | None | Lock remains `active` with `target_resolution_failed` warning | No metric | `runtime_failure` with `recovery: active_lock_retry_required` | No event |

### Controlled Live PostUpdate Evidence

Verified on 2026-05-25 in `r/reviewlock_dev` against locked proof post
`t3_1tnfgqf` on playtest `v0.0.2.107`.

- Browser action: edited the S02 post body from the original reviewed body to
  the material rewrite documented in `docs/LIVE_SCENARIO_CONTENT.md`.
- Log command:
  `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`.
- Sanitized log event: `reviewlock.trigger.payload_shape` for
  `route: 'on-post-update'`, `targetKind: 'post'`.
- Observed shape: direct top-level target/event ids absent; nested `post`
  object present with `post.id`, `post.subredditId`, and `post.numReports`.
  `subreddit` arrived as an object, not a raw logged subreddit string.
- Dashboard after refresh: active locks decreased from `3` to `2`, `Reopened
  after edit` increased to `1`, latest reopen event was `post:1tnfgqf` with
  reason `content changed`, reopen queue included fingerprint delta
  `c322d267` to `fc05f41b`, audit recorded `Lock Reopened 5/25/2026,
  10:53:00 PM`, and runtime proof showed `postUpdateTrigger verified`.

### Controlled Live CommentUpdate Evidence

Verified on 2026-05-25 in `r/reviewlock_dev` against locked proof comment
`t1_ontlx1k` on playtest `v0.0.2.109`.

- Browser action: created S08 under S02, locked the comment with reason
  `reviewed_policy_compliant`, then edited the comment body from the original
  reviewed text to the material rewrite documented in
  `docs/LIVE_SCENARIO_CONTENT.md`.
- Log command:
  `npx devvit logs reviewlock_dev reviewlock --connect --since 15m --show-timestamps --log-runtime`.
- Sanitized log event: `reviewlock.trigger.payload_shape` for
  `route: 'on-comment-update'`, `targetKind: 'comment'`.
- Observed shape: direct top-level target/event ids absent; nested `post` and
  `comment` objects were present. Both nested objects exposed `id`,
  `subredditId`, and `numReports`; `subreddit` arrived as an object, not a raw
  logged subreddit string.
- Dashboard after refresh: active locks decreased from `3` to `2`, `Reopened
  after edit` increased from `1` to `2`, latest reopen event was
  `comment:ontlx1k` with reason `content changed`, reopen queue included
  fingerprint delta `9da841c1` to `20abf990`, audit recorded `Lock Reopened
  5/25/2026, 11:05:07 PM`, and runtime proof showed
  `commentUpdateTrigger verified`.

## Fail-Open Rule

No trigger path suppresses reports when ReviewLock cannot prove the current content fingerprint matches the reviewed fingerprint.

- Missing target resolution records a runtime failure and leaves reports unsuppressed.
- Missing target resolution with a known active lock keeps that lock active,
  adds `target_resolution_failed`, and writes a runtime-failure audit. ReviewLock
  does not queue a `runtime_uncertain` reopen until it can refetch the target and
  safely attempt `unignoreReports()`.
- `ignoreReports()` failure records a runtime failure and leaves the lock active without counting suppression.
- Redis failure after `ignoreReports()` attempts `unignoreReports()` rollback,
  records the moderation result in runtime proof, and writes a rollback
  `runtime_failure` audit event if rollback fails and Redis is still available.
- Changed content reopens instead of suppressing. Uncertain target refetch keeps
  known locks retryable rather than claiming a reopen without report-restoration
  proof.
- Runtime-uncertain report-trigger deliveries clear their dedupe marker so a
  Devvit retry with the same event id can reprocess the target.
- Successful report-trigger dedupe markers expire after seven days to avoid
  permanent key growth.

## Test Evidence

Commands:

- `npm run type-check`
- `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/lockFlow.test.ts src/server/adapters/redis.test.ts src/client/render.test.ts --reporter verbose`
- `npm run test -- src/server/services/targetResolver.test.ts src/routes/menu.test.ts src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
- `npm run test -- src/routes/triggers.report.test.ts src/routes/triggers.update.test.ts --reporter verbose`
- `npm run test`
- `npm run build`

Targeted test result:

- 4 files passed.
- Report trigger service coverage now includes 34 report-trigger tests, including
  dedupe TTL, retry after runtime-uncertain failures, retry after runtime-failure
  audit persistence failure, and rollback failure evidence after Redis write
  failures.
- Trigger route coverage includes Devvit wrapper payloads, bare post/comment id
  normalization before target resolution, and sanitized payload-shape logging
  that rejects raw ids, content, subreddit names, and report reason text.
- Comment report/update route coverage includes payloads with both sibling
  `post.id` and `comment.id`, proving comment routes choose the comment target.

Covered files:

- `src/server/services/reportTriggers.test.ts`
- `src/server/services/updateTriggers.test.ts`
- `src/server/services/targetResolver.test.ts`
- `src/routes/menu.test.ts`
- `src/routes/triggers.report.test.ts`
- `src/routes/triggers.update.test.ts`

## Remaining Runtime Work

- Generate live `CommentReport` events in `r/reviewlock_dev`.
- Generate live NSFW, spoiler, and flair update events in `r/reviewlock_dev`.
- Capture sanitized `devvit logs` payload shape evidence for the remaining
  trigger variants and compare it with the local route fixtures above.
