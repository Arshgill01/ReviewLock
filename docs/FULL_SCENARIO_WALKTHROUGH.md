# Full Scenario Walkthrough

Wave 19 proves the complete ReviewLock story with an integration harness that uses the real app routes, in-memory Redis adapter, fake Reddit adapter, and fixed test targets. This is not live Devvit proof; live report generation was not performed in Reddit in this wave.

## Verification Mode

- Mode: local integration harness.
- App entrypoint: `createApp()`.
- Storage: `InMemoryRedisStore`.
- Reddit operations: `FakeRedditAdapter`.
- Test file: `src/fullScenario.test.ts`.
- Test command:

```bash
npm run test -- --run src/fullScenario.test.ts src/server/services/reportTriggers.test.ts
```

Passing output:

```txt
Test Files  2 passed (2)
Tests  10 passed (10)
```

Current live status: this Wave 19 scenario remains a local integration harness, not live trigger proof. Later controlled playtest verified post-target `approve()`, `ignoreReports()`, and `unignoreReports()` on `t3_1tm8nak`; comment-target moderation methods and real Reddit report/update trigger delivery remain unverified. See `docs/RUNTIME_PROOF.md` for the current claim boundary.

## Route Payloads

### 1. Moderator Locks A Post

Route:

```txt
POST /internal/form/lock-review-submit
```

Payload:

```json
{
  "targetId": "t3_scenario_post",
  "actor": "mod_alex",
  "lockReason": "reviewed_policy_compliant"
}
```

Observed output:

```json
{
  "showToast": {
    "appearance": "success",
    "text": "ReviewLock locked this reviewed content until it changes."
  }
}
```

Redis-visible state after lock:

```json
{
  "status": "active",
  "targetId": "t3_scenario_post",
  "suppressedReportCount": 0
}
```

Reddit operations:

```txt
approve:t3_scenario_post
ignoreReports:t3_scenario_post
```

### 2. Repeat Reports Arrive And Are Suppressed

Route:

```txt
POST /internal/triggers/on-post-report
```

Payloads:

```json
{
  "targetId": "t3_scenario_post",
  "eventId": "evt-post-repeat-1",
  "reportCount": 3,
  "subreddit": "alpha"
}
```

```json
{
  "targetId": "t3_scenario_post",
  "eventId": "evt-post-repeat-2",
  "reportCount": 4,
  "subreddit": "alpha"
}
```

Observed outputs:

```json
{ "ok": true, "action": "suppress_unchanged" }
{ "ok": true, "action": "suppress_unchanged" }
```

Redis-visible lock state:

```json
{
  "status": "active",
  "suppressedReportCount": 2,
  "lastReportCount": 4
}
```

Redis-visible target metrics:

```json
{
  "locksCreated": 1,
  "reportsSuppressed": 2,
  "locksReopened": 0
}
```

Dashboard overview before edit:

```json
{
  "activeLockCount": 1,
  "reportsSuppressed": 2,
  "reopenedAfterEditCount": 0
}
```

### 3. Author Edits The Post And The Lock Reopens

Route:

```txt
POST /internal/triggers/on-post-update
```

Payload:

```json
{
  "targetId": "t3_scenario_post",
  "subreddit": "alpha"
}
```

Observed output:

```json
{ "ok": true, "action": "reopened" }
```

Redis-visible state:

```json
{
  "activeLock": null,
  "reopenQueue": [
    {
      "targetId": "t3_scenario_post",
      "reason": "content_changed"
    }
  ]
}
```

Reddit operation:

```txt
unignoreReports:t3_scenario_post
```

### 4. Same Loop For A Comment

Routes:

```txt
POST /internal/form/lock-review-submit
POST /internal/triggers/on-comment-report
POST /internal/triggers/on-comment-update
```

Payload highlights:

```json
{ "targetId": "t1_scenario_comment", "actor": "mod_alex", "lockReason": "reviewed_policy_compliant" }
{ "targetId": "t1_scenario_comment", "eventId": "evt-comment-repeat-1", "reportCount": 2, "subreddit": "alpha" }
{ "targetId": "t1_scenario_comment", "subreddit": "alpha" }
```

Observed trigger outputs:

```json
{ "ok": true, "action": "suppress_unchanged" }
{ "ok": true, "action": "reopened" }
```

## Final Scenario Output

Daily metrics:

```json
{
  "locksCreated": 2,
  "reportsSuppressed": 3,
  "locksReopened": 2
}
```

Dashboard overview:

```json
{
  "activeLockCount": 0,
  "reportsSuppressed": 3,
  "reopenedAfterEditCount": 2,
  "latestReopenEvent": {
    "targetId": "t1_scenario_comment"
  }
}
```

Dashboard list endpoints:

```json
{
  "locks": 0,
  "reopenQueue": 2,
  "audit": {
    "lock_created": 2,
    "report_suppressed": 3,
    "lock_reopened": 2
  }
}
```

Final Reddit operation log:

```txt
approve:t3_scenario_post
ignoreReports:t3_scenario_post
ignoreReports:t3_scenario_post
ignoreReports:t3_scenario_post
unignoreReports:t3_scenario_post
approve:t1_scenario_comment
ignoreReports:t1_scenario_comment
ignoreReports:t1_scenario_comment
unignoreReports:t1_scenario_comment
```

## Flow Break Found And Fixed

The first scenario test run found that two distinct repeat-report events on the same locked item at the same timestamp collapsed into one `report_suppressed` audit event. Metrics counted both reports, but the audit ledger only showed one event.

Fix:

- Report-trigger audit ids now include the event id when available.
- If no event id exists, the fallback still includes target and timestamp.
- The scenario now proves three suppressed reports produce three `report_suppressed` audit events.

## Demo Story Match

The implementation story now matches the required demo story:

1. A moderator reviews and locks content.
2. Repeat reports arrive and are suppressed while the fingerprint still matches.
3. The author edits the post or comment.
4. ReviewLock reopens the item, unignores reports, writes audit/metrics, and exposes the item in the reopen queue.
