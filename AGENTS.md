# AGENTS.md - ReviewLock Project Bible

This file is the single source of truth for agents building ReviewLock. Follow it over any generic habit. If a wave spec conflicts with this file, make the safer, more complete product call, update `decisions.md`, and finish the wave.

## Mission

ReviewLock is a Reddit Devvit moderation app for teams drowning in repeat report churn on content they already reviewed.

Core line:

> Lock reviewed content until it changes.

Core promise:

> Reviewed content stays reviewed. If the post or comment changes, the lock breaks automatically and it returns to moderator attention.

The product is not an "ignore reports" wrapper. Native Reddit already has ignore reports. ReviewLock exists because native ignore reports is memoryless: it does not give a team a reviewed-content ledger, suppressed-report metrics, or automatic reopening when content integrity changes.

## Winning Thesis

The May 9, 2026 r/ModSupport anchor thread asks for a way to mark approved content as not reportable after mod review. The strongest comments immediately raise the edit-abuse edge case: approval should hold only while content has not been edited. ReviewLock is the closed loop those comments describe:

1. A moderator reviews content.
2. ReviewLock approves or records approval, ignores further reports, and stores a content fingerprint.
3. Repeat reports against unchanged locked content are suppressed and counted.
4. Any material content change breaks the lock and reopens the item.
5. The team sees exactly how much report churn was avoided and which locks reopened.

Judges must see the edit-break loop first. If the demo looks like "click button, ignore reports", the app fails.

## Non-negotiable Product Decisions

1. Product name: ReviewLock.
2. Directory name: `ReviewLock`.
3. Category: Best New Mod Tool.
4. Primary user: subreddit moderators and mod teams.
5. Primary pain: repeated reports on already-reviewed content, especially when reports are weaponized or team members forget to ignore reports after approval.
6. Differentiator: review state is tied to content integrity, and edits automatically break the lock.
7. No permanent "unreportable" content claim.
8. No claim that Reddit users cannot report locked content.
9. No LLM/AI judging in v1.
10. No external services in v1.
11. No scraping or Discord-token workflows in the app or build.
12. No automatic removals as the default. Reopening means unignore reports and surface in ReviewLock, not destructive enforcement.
13. Human confirmation is required for lock, unlock, dismiss reopen, and optional manual remove actions.
14. Store only moderation workflow metadata needed for product value.
15. Demo mode is mandatory and must be visibly labeled.
16. Runtime claims must be proven by Devvit playtest or clearly labeled unverified.

## Product Scope

### Must ship

- Post and comment menu actions:
  - `Lock review`
  - `Unlock review`
  - `Open ReviewLock`
- Subreddit menu action:
  - `Open ReviewLock dashboard`
- Lock review flow:
  - Resolve target.
  - Show current content summary, report count, edit status, and lock options.
  - Require reason.
  - Approve target when supported.
  - Ignore reports when supported.
  - Store lock record with content hash and metadata.
- Report trigger flow:
  - Receive `PostReport` and `CommentReport`.
  - If target has an active lock and fingerprint still matches, call `ignoreReports()` and increment suppressed metrics.
  - If target changed, break the lock, call `unignoreReports()` when supported, and record a reopen event.
  - If no lock exists, do nothing.
- Update trigger flow:
  - Receive `PostUpdate`, `CommentUpdate`, `PostNsfwUpdate`, `PostSpoilerUpdate`, and `PostFlairUpdate` where applicable.
  - If target has an active lock and material fingerprint changed, break the lock.
- Dashboard:
  - Hero dashboard state must show locked reviewed items, suppressed reports, reopened items, and latest edit-break events.
  - The first viewport must make "locked until edited" obvious.
  - Include item-level lists for active locks, reopen queue, and report churn.
- Demo mode:
  - Seeded content showing before/after report churn and an edit-triggered reopen.
  - Demo banner always visible when using seeded data.
- Audit log:
  - Lock, unlock, suppress, reopen, dismiss reopen, runtime failure events.
- Tests:
  - Pure service tests for fingerprinting, lock state transitions, Redis key construction, metrics aggregation, trigger decisions, and demo data.
  - Client tests for state/render helpers where practical.
- Runtime proof artifacts:
  - A playtest checklist and result log.
  - Exact commands run.
  - Known blockers separated from verified behavior.

### Should ship if time allows

- Lock expiry settings.
- Per-lock reason presets and custom notes.
- Reopen queue filters.
- CSV or JSON export of metrics.
- Safe fallback when ignore/unignore fails.

### Out of scope

- AI report classification.
- Full modqueue replacement.
- Ban appeal workflows.
- Modmail triage.
- Cross-subreddit user intelligence.
- Moderator performance surveillance.
- Public user reporting UI.
- Permanent report disabling.
- External databases, hosted APIs, or paid services.

## Evidence

Use `RESEARCH.md` for links and evidence notes. The core evidence:

- r/ModSupport anchor thread, posted May 9, 2026, 90 upvotes when checked: `https://www.reddit.com/r/ModSupport/comments/1tc7fzt/suggestion_allow_mods_to_mark_posts_as_not/`
- Native ignore reports exists, but the OP says forgetting and tracking are the problem.
- Top replies raise the edit-after-approval abuse case and condition support on content not being edited.
- Flag App collision risk: `https://developers.reddit.com/apps/flag-app` has report filtering features, so ReviewLock must stay in the reviewed-content-integrity lane.

## Devvit API Primitives

Target Devvit package family: use the latest available stable Devvit Web scaffold at build time. The ModMirror workspace currently verifies `devvit`, `@devvit/web`, and `@devvit/start` at `0.12.24`; executor must re-verify in the ReviewLock project after scaffold.

Verified primitives from official docs and local typings:

- `devvit.json` schema v1 supports:
  - `server.dir` and `server.entry`
  - `post.dir` and `post.entrypoints`
  - `menu.items`
  - `forms`
  - `triggers`
  - `scheduler.tasks`
  - `permissions.redis`
  - `permissions.reddit`
- Menu locations:
  - `post`
  - `comment`
  - `subreddit`
- Menu user type:
  - `moderator`
- Trigger endpoints:
  - `onPostReport`
  - `onCommentReport`
  - `onPostUpdate`
  - `onCommentUpdate`
  - `onPostNsfwUpdate`
  - `onPostSpoilerUpdate`
  - `onPostFlairUpdate`
  - `onAppInstall`
  - `onAppUpgrade`
- Post methods:
  - `approve(): Promise<void>`
  - `ignoreReports(): Promise<void>`
  - `unignoreReports(): Promise<void>`
  - `snoozeReports(reason: string): Promise<void>` for free-form report reasons only
  - `unsnoozeReports(reason: string): Promise<void>` for free-form report reasons only
  - getters/properties include `id`, `title`, `body`, `edited`, `ignoringReports`, `numberOfReports`, `userReportReasons`, `modReportReasons`, `permalink`, `subredditName`, `authorName`
- Comment methods:
  - `approve(): Promise<void>`
  - `ignoreReports(): Promise<void>`
  - `unignoreReports(): Promise<void>`
  - `snoozeReports(reason: string): Promise<void>` for free-form report reasons only
  - `unsnoozeReports(reason: string): Promise<void>` for free-form report reasons only
  - getters/properties include `id`, `body`, `edited`, `ignoringReports`, `numReports`, `userReportReasons`, `modReportReasons`, `permalink`, `postId`, `parentId`, `subredditName`, `authorName`
- Redis commands:
  - `get`, `set`, `del`, `exists`, `expire`
  - `hget`, `hset`, `hgetall`, `hdel`, `hincrby`
  - `zAdd`, `zRange`, `zRem`, `zRemRangeByScore`, `zIncrBy`
  - transactions via `watch` and `multi` where needed
- Devvit Web server pattern:
  - Hono server via `@devvit/web/server`
  - Public API under `/api`
  - Devvit internal menu/form/trigger endpoints under `/internal`

Executor must verify API names in the generated project before implementation. Do not hallucinate API fields. If an event payload does not contain enough content to hash, refetch the target through Reddit API before making a lock/reopen decision.

## Architecture

Use TypeScript. Keep logic pure where possible and isolate Reddit/Redis effects.

Expected structure:

```txt
src/
  client/
    index.html
    main.ts
    styles.css
    components/
    pages/
    state/
  core/
    smoke.ts
  routes/
    api.ts
    forms.ts
    menu.ts
    triggers.ts
  server/
    adapters/
      reddit.ts
      redis.ts
      clock.ts
    services/
      audit.ts
      dashboard.ts
      demoData.ts
      fingerprint.ts
      locks.ts
      metrics.ts
      moderation.ts
      reopenQueue.ts
      targetResolver.ts
      triggerDecisions.ts
      runtimeProof.ts
    fixtures/
  shared/
    constants.ts
    schema.ts
    status.ts
```

Shared route wiring is owned by integration waves only. Feature waves export functions and routers from their own files rather than editing central imports unless their spec explicitly owns that file.

## Data Model

All Redis keys must be namespaced by installation/subreddit. Use a single helper:

```ts
reviewlock:{subredditIdOrName}:{suffix}
```

Core keys:

```txt
reviewlock:{subreddit}:config
reviewlock:{subreddit}:locks:active
reviewlock:{subreddit}:locks:activeByTarget
reviewlock:{subreddit}:lock:{lockId}
reviewlock:{subreddit}:target:{thingId}:lock
reviewlock:{subreddit}:reopen:queue
reviewlock:{subreddit}:reopen:{eventId}
reviewlock:{subreddit}:audit
reviewlock:{subreddit}:audit:{eventId}
reviewlock:{subreddit}:metrics:daily
reviewlock:{subreddit}:metrics:target:{thingId}
reviewlock:{subreddit}:runtime
reviewlock:{subreddit}:demo
```

Required types:

```ts
type TargetKind = 'post' | 'comment';
type LockStatus = 'active' | 'reopened' | 'unlocked' | 'expired' | 'failed';
type ReopenReason = 'content_changed' | 'flair_changed' | 'nsfw_changed' | 'spoiler_changed' | 'manual_unlock' | 'expiry' | 'runtime_uncertain';
type AuditEventKind = 'lock_created' | 'lock_unlocked' | 'report_suppressed' | 'lock_reopened' | 'reopen_dismissed' | 'runtime_failure' | 'demo_reset';
```

Lock record fields:

- `id`
- `subreddit`
- `targetId`
- `targetKind`
- `targetAuthor`
- `permalink`
- `title`
- `contentPreview`
- `contentHash`
- `fingerprintVersion`
- `lockedBy`
- `lockedAt`
- `lockReason`
- `customNote`
- `expiresAt`
- `status`
- `lastKnownEdited`
- `lastReportCount`
- `suppressedReportCount`
- `lastSuppressedAt`
- `reopenedAt`
- `reopenReason`
- `reopenEventId`
- `runtimeWarnings`

Reopen event fields:

- `id`
- `lockId`
- `subreddit`
- `targetId`
- `targetKind`
- `oldContentHash`
- `newContentHash`
- `reason`
- `createdAt`
- `dismissedAt`
- `dismissedBy`
- `summary`
- `runtimeWarnings`

Audit event fields:

- `id`
- `kind`
- `subreddit`
- `targetId`
- `targetKind`
- `lockId`
- `actor`
- `createdAt`
- `message`
- `data`

## Fingerprinting Rules

Fingerprinting decides whether reviewed content is still the same reviewed content.

Post material fingerprint input:

- normalized title
- normalized body/selftext
- url for link posts when available
- link flair text/template id if present
- nsfw flag
- spoiler flag

Comment material fingerprint input:

- normalized body

Normalization:

- trim outer whitespace
- normalize CRLF to LF
- collapse runs of spaces/tabs outside newlines
- preserve markdown line breaks enough that semantic body edits change hash
- lowercase only fields where Reddit treats casing as non-semantic; do not lowercase body/title by default

Use deterministic hashing from Node `crypto` when available. If runtime bundling disallows Node `crypto`, use Web Crypto or a small deterministic SHA-256 implementation already available in the toolchain. Do not add a large dependency just for hashing.

Any fingerprint uncertainty must fail open: reopen or mark runtime uncertain rather than suppressing reports.

## Runtime Behavior

### Lock creation

1. Resolve target from menu request.
2. Refetch target through Reddit API before write.
3. Compute fingerprint.
4. Call `approve()` when target is not already approved and API supports it.
5. Call `ignoreReports()`.
6. Persist lock record and indexes.
7. Write audit event.
8. Show success toast/form response with clear text.

If `approve()` succeeds but `ignoreReports()` fails, store lock as `failed`, log runtime failure, and tell the moderator reports were not locked.

If `ignoreReports()` succeeds but Redis write fails, attempt `unignoreReports()` and show failure. If rollback fails, log prominently in runtime proof and dashboard.

### Repeat report

1. Load active lock by target.
2. Refetch target when event payload cannot prove fingerprint.
3. Compare current fingerprint to lock fingerprint.
4. If unchanged:
   - call `ignoreReports()`
   - increment suppressed counters
   - write audit event
5. If changed:
   - break lock
   - call `unignoreReports()`
   - enqueue reopen event
   - write audit event

Report triggers may fire multiple times. Operations must be idempotent.

### Content update

1. Load active lock by target.
2. Compute current fingerprint from event payload or refetched target.
3. If changed, break lock and enqueue reopen.
4. If unchanged, update last-seen metadata only.

### Reopen

Reopen does not remove content automatically. It means:

- lock status becomes `reopened`
- target is unignored for reports when possible
- item appears in dashboard reopen queue
- audit event is written

Optional manual remove may be added later but is not part of default reopen.

## UI Requirements

ReviewLock is an operational mod tool, not a marketing page.

Visual priorities:

- First viewport must show:
  - active locks
  - reports suppressed
  - reopened after edit
  - recent edit-break event
- Use compact, scan-friendly dashboard layout.
- Avoid oversized hero marketing.
- Keep cards to individual repeated items and metrics.
- No nested cards.
- No decorative gradient orbs, bokeh, or vague illustrations.
- Use restrained colors with more than one hue family.
- Text must fit on mobile and desktop.
- All demo data must be visibly labeled.

Important microcopy:

- Use "Lock reviewed content until it changes."
- Use "Reports suppressed" for metrics.
- Use "Reopened after edit" for edit breaks.
- Do not say "not reportable" or "reports disabled".

## Safety and Privacy

- Store target author because mods need context; do not build user dossiers.
- Do not store reporter usernames.
- Do not expose per-moderator productivity analytics.
- Audit actor names only for moderation traceability.
- Do not publish secrets.
- Do not use external network services.
- Do not scrape Discord or Reddit from the app.
- Do not run destructive moderation proof outside a controlled test subreddit.

## Demo Story

The demo must be a four-beat loop:

1. A post is reviewed and locked.
2. Repeat reports arrive and are suppressed.
3. The author edits the post.
4. ReviewLock breaks the lock and puts the item back in the reopen queue.

Seeded demo must include:

- 12 to 20 lock records.
- At least 5 repeat-report suppressions.
- At least 3 edit-break reopen events.
- One failure/warning example.
- Post and comment examples.
- Clear before/after metrics.

## Validation Standards

Every wave must end with:

1. Files changed.
2. Exact commands run.
3. Pass/fail status.
4. Open risks.
5. Commit hash or explicit reason no commit was possible.

Required commands before final app handoff:

```bash
npm run type-check
npm run lint
npm run test
npm run build
```

Runtime proof commands, when logged in and test subreddit is available:

```bash
npm run dev -- <test-subreddit>
devvit logs
```

Do not claim live behavior unless it was playtested.

## Wave Execution Rules

- Each wave equals one executor agent.
- The prompt for an executor is only `/goal Follow waves/wave-XX/spec.md exactly and execute completely.`
- Each wave spec is authoritative for that wave.
- A wave may use parallel sub-agents only if it assigns disjoint file/module ownership.
- Every wave must commit after completion.
- No placeholder functions in wave-complete code.
- No `TODO` comments left in files the wave owns.
- If blocked by platform behavior, log the exact blocker and continue with non-blocked work.
- If a spec is ambiguous, choose the stronger moderator-useful behavior and log it in `decisions.md`.
- Never revert unrelated work by another wave.
- Do not edit files outside the wave's ownership list except `decisions.md`, `TODO.md`, and `log.md` for required reporting.

## File Ownership Strategy

Shared files with high conflict risk:

- `package.json`
- `devvit.json`
- `src/index.ts`
- `src/routes/api.ts`
- `src/routes/menu.ts`
- `src/routes/forms.ts`
- `src/routes/triggers.ts`
- `src/client/main.ts`
- `src/client/styles.css`
- `src/shared/schema.ts`
- `src/shared/constants.ts`

Only the wave that explicitly owns a shared file may edit it. Feature waves must export modules without central wiring unless their spec owns the central file.

## Product Kill Switches

Cut or reframe any feature that:

- makes the app look like a generic modqueue dashboard;
- hides the edit-aware reopen loop;
- requires an external service;
- turns into moderator surveillance;
- claims to block users from reporting;
- depends on AI judgment;
- duplicates Flag App report filtering as the main value.

