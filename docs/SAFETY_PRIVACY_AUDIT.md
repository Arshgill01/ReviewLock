# Safety and Privacy Audit

Wave 25 audited ReviewLock for privacy, moderator safety, and product-scope drift.

## Scope

Reviewed:

- `src/shared/schema.ts`
- `src/server/adapters/reddit.ts`
- `src/server/services/reportTriggers.ts`
- `src/server/services/reopenFlow.ts`
- `src/server/services/updateTriggers.ts`
- `src/server/services/metrics.ts`
- `src/server/services/dashboard.ts`
- `src/routes/forms.ts`
- `src/client/**`
- `README.md`
- `docs/**`
- `package.json`
- `devvit.json`

Primary searches:

- `rg -n "reporter|reporters|userReportReasons|modReportReasons|authorName|lockedBy|actor|moderator|productivity|surveillance|AI decides|AI|automatic removal|remove automatically|external service|webhook|fetch\\(|axios|openai|llm|not reportable|disable reports|blocked reports|unreportable" src docs README.md package.json devvit.json || true`
- `rg -n "reporter|AI decides|automatic removal|productivity|surveillance|external service" src docs README.md || true`
- `rg -n "not reportable|disable reports|blocked reports|unreportable|report disabling|ignore reports wrapper|remove automatically|automated removal|AI judgment|LLM|OpenAI|external" src docs README.md package.json || true`
- `find . -maxdepth 3 -type f \\( -name '*.env*' -o -name '*secret*' -o -name '*token*' \\) -print`
- `rg -n "process\\.env|SECRET|TOKEN|API_KEY|fetch\\(|https?://|webhook|discord|slack|openai|anthropic|gemini|llm|ai" src docs README.md package.json devvit.json || true`
- `rg -n "remove|delete|ban|spam|distinguish|unignoreReports|approve\\(" src/server src/routes src/shared src/client | head -n 260`

## Reporter Privacy

Result: no reporter usernames are stored.

Evidence:

- `ReviewLockTarget` stores `reportCount`, not reporter names.
- `ReviewLockRecord` stores target author, lock actor, content fingerprint, report counters, and moderation metadata; it does not store reporter names.
- `AuditEvent.data` is used for counts, operation status, error summaries, and reasons. Report-trigger audit data stores `reportCount`, not reporter identity.
- `src/server/adapters/reddit.ts` accepts Devvit model fields such as report reason arrays but maps the persisted target shape to `reportCount` only.
- Existing tests include `src/server/services/dashboard.test.ts`, which asserts dashboard JSON does not contain `reporter`.
- Existing schema tests reject `reporter_saved` as an audit event kind.

Allowed personal data:

- Target author is stored because moderators need item context.
- Moderator actor names are stored for audit traceability on lock, unlock, and dismiss actions.
- No reporter identity is part of any ReviewLock domain type.

## Moderator Safety

Result: no moderator productivity surveillance is present.

Evidence:

- Metrics are aggregated by day and target, not by moderator.
- `DailyMetrics` includes only lock count, suppressed report count, and reopened count.
- `TargetMetrics` includes target id/kind and aggregate counts, not moderator names.
- `lockedBy`, `actor`, and `dismissedBy` appear only in audit/traceability surfaces.
- There is no leaderboard, per-moderator ranking, response-time metric, or productivity score.

Boundary:

- Audit actors remain visible because moderator teams need accountability for state-changing actions.
- ReviewLock must not add moderator performance analytics without a separate product and privacy review.

## AI and External Services

Result: no AI judging or external service dependency was introduced.

Evidence:

- `package.json` dependencies are Devvit, Hono, TypeScript/build/test tooling, and audited transitive overrides.
- No OpenAI, Anthropic, Gemini, vector database, webhook, Discord, Slack, or hosted API dependency appears in `package.json`.
- No `.env`, secret, or token files were found by the scoped file search.
- Server-side network behavior is limited to Reddit/Devvit platform APIs through the Reddit adapter.
- Client `fetch()` calls are same-origin calls to ReviewLock API routes.
- `devvit.json` requests only Reddit and Redis permissions.

## Non-Destructive Reopen

Result: reopen remains non-destructive.

Evidence:

- Report-trigger and update-trigger reopen paths call `unignoreReports()` when supported.
- Reopen paths update lock status, enqueue a reopen event, write audit, and increment metrics.
- No service calls Reddit remove, spam, delete, ban, or distinguish APIs.
- Unlock removes the ReviewLock lock and returns reports to normal handling; it does not remove content.

Runtime boundary:

- Live `unignoreReports()` behavior remains unverified until controlled playtest proof is captured.
- The implemented behavior is non-destructive in local tests and adapter calls.

## Product Copy Review

Result: production copy stays within the product thesis.

Evidence:

- UI tests explicitly reject forbidden copy: `not reportable`, `disable reports`, and `blocked reports`.
- Search hits for forbidden terms are guardrail docs, scan commands, or tests, not production UI claims.
- README says runtime behavior is not claimed as verified until `docs/RUNTIME_PROOF.md` documents it.
- `docs/KNOWN_LIMITATIONS.md` explicitly says ReviewLock must not claim to make content unreportable or disable user reporting.

Preferred product language remains:

- `Lock reviewed content until it changes.`
- `Reports suppressed`
- `Reopened after edit`

## Manual Hit Review

The required Wave 25 search hits were reviewed manually:

- `src/shared/schema.test.ts` contains a negative test rejecting `reporter_saved`.
- `src/server/services/dashboard.test.ts` contains a negative test proving dashboard data does not expose reporter identities.
- `docs/HARDENING_PASS_01.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/API_CLIENT_CONTRACT_PROOF.md`, `docs/UI_AUDIT.md`, and `docs/PLAYTEST_CHECKLIST.md` contain guardrail or limitation text, not unsafe product claims.
- `src/client/render.test.ts` contains forbidden-copy assertions.

## Outcome

No unsafe data handling or product drift required a code fix in Wave 25. The audit documents the current privacy boundary and keeps future changes constrained to ReviewLock's thesis: lock reviewed content until it changes.
