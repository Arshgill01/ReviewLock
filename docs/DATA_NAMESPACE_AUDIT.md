# Data Namespace Audit

Wave 24 verified that ReviewLock's Redis persistence is namespaced, demo writes cannot target live subreddit data, and malformed persisted records fail closed to defaults or empty lists.

## Namespace Rule

All persistent Redis keys use this helper:

```ts
reviewlock:{subreddit}:{suffix}
```

Evidence:

- `src/server/services/keys.ts` defines `key(subreddit, suffix)` as the single prefix helper.
- `src/server/services/keys.test.ts` enumerates every declared key helper and asserts each generated key starts with `reviewlock:alpha:`.
- Runtime-facing subreddit inputs are validated and canonicalized to lowercase
  before scope comparison or key construction in forms, dashboard APIs, runtime
  smoke, dashboard launch, and trigger fallback paths.
- `rg -n "reviewlock:" src --glob '!**/*.test.ts'` returns only the helper definition in `src/server/services/keys.ts`.
- `rg -n "redis\\.(get|set|del|exists|expire|hget|hset|hgetall|hdel|hincrby|zAdd|zRange|zRem|zRemRangeByScore|zIncrBy|setIfNotExists)\\(" src --glob '!**/*.test.ts'` shows service and route Redis calls using `keys.*` or `key(...)`.

Dynamic keys not represented as top-level helpers still use `key(...)`:

- Trigger dedupe keys in `src/server/services/reportTriggers.ts`.
- Trigger mutex keys in `src/server/services/triggerMutex.ts`.
- Runtime smoke keys in `src/routes/api.ts`.

Dashboard launch persistence is also namespaced:

- `keys.dashboardPost(subreddit)` stores the canonical dashboard custom-post
  permalink for reuse.
- `keys.dashboardPostCreation(subreddit)` is a short Redis creation lease that
  prevents duplicate first-launch posts.
- `src/routes/forms.test.ts` covers reuse, malformed dashboard records,
  external cached permalinks, cross-subreddit cached permalinks, mixed-case
  subreddit permalinks, and unsafe newly created post permalinks.

## Demo and Live Separation

Demo writes are restricted to `reviewlock_demo`.

Enforcement:

- `seedDemoData()` rejects any scenario whose `subreddit` is not `DEMO_SUBREDDIT`.
- `disableDemoMode()` rejects attempts to write demo-disable state for a live subreddit.
- `getDemoModeStatus()` may read any namespace for dashboard status, but malformed markers degrade to disabled demo status.

Coverage:

- `src/server/services/demoMode.test.ts` proves a live-subreddit demo scenario cannot seed locks, audit events, or config.
- `src/server/services/demoMode.test.ts` proves disabling demo mode for `alpha` is rejected and does not mutate live config.
- `src/server/services/demoMode.test.ts` proves a malformed demo marker returns disabled status instead of throwing.

## Malformed Record Behavior

Malformed JSON in persisted records must not blank the dashboard or crash trigger/dashboard reads. Wave 24 changed persistence readers to return `undefined`, default config/runtime state, or filtered lists when a stored record cannot be parsed.

Covered readers:

- Locks: `getLock()`, `getActiveLockByTarget()`, `listActiveLocks()`, and `updateLockStatus()` skip or return `undefined` for malformed lock records.
- Config: `loadConfig()` returns `defaultConfig()` for a malformed config record.
- Demo mode: `getDemoModeStatus()` returns disabled demo status for a malformed marker.
- Audit: direct and list reads skip malformed audit event records.
- Reopen queue: direct and list reads skip malformed reopen event records.
- Metrics: direct and list reads skip malformed daily and target metric records.
- Runtime proof: `loadRuntimeProofStatus()` returns the unverified default matrix for malformed runtime proof records.
- Dashboard launch: malformed, external, or cross-subreddit cached dashboard
  post records are ignored and replaced before navigation.
- Trigger fallback scoping: malformed fallback subreddit payload values are
  ignored on target-refetch failure paths instead of creating arbitrary Redis
  namespaces.
- Report trigger refetch scoping: successful target refetches still use the
  canonical selected subreddit namespace for lock lookup and metrics, so
  `unknown` or mixed-case target subreddit fields do not split Redis state.

## Schema and Migration Note

Current v1 persisted records are intentionally simple JSON objects and most do not carry an explicit schema version. The lock fingerprint has `fingerprintVersion`, which protects the content-integrity comparison path.

No data migration is required for Wave 24 because the persisted shapes did not change. Before an incompatible persisted-record change ships, add:

- `schemaVersion` to the affected persisted record type.
- A read-time migration or compatibility fallback for existing unversioned records.
- Regression tests for old-record reads and new-record writes.
- A `decisions.md` entry documenting the migration behavior.

## Verification

Commands run for this audit:

- `npm run test -- --run src/server/services/keys.test.ts src/server/adapters/redis.test.ts src/server/services/demoMode.test.ts src/server/services/locks.test.ts`
- `npm run test -- src/routes/forms.test.ts src/routes/menu.test.ts src/server/services/keys.test.ts --reporter verbose`
- `npm run test -- src/server/services/reportTriggers.test.ts src/server/services/reopenFlow.test.ts src/routes/forms.test.ts src/routes/api.contract.test.ts src/routes/api.dashboard.test.ts src/server/services/runtimeHardening.test.ts src/client/state/runtimeContext.test.ts --reporter verbose`
- `rg -n "reviewlock:" src --glob '!**/*.test.ts'`
- `rg -n "redis\\.(get|set|del|exists|expire|hget|hset|hgetall|hdel|hincrby|zAdd|zRange|zRem|zRemRangeByScore|zIncrBy|setIfNotExists)\\(" src --glob '!**/*.test.ts'`
