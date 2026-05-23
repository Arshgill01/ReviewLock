# Wave 06 - Lock and Unlock Menu Flows

## Goal

Implement moderator-facing lock/unlock menu and form flows for posts and comments.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 02, 03, 04, and 05 should be complete.

## Write ownership

This wave may create or edit:

- `src/routes/menu.ts`
- `src/routes/menu.test.ts`
- `src/routes/forms.ts`
- `src/routes/forms.test.ts`
- `src/server/services/lockFlow.ts`
- `src/server/services/lockFlow.test.ts`
- `src/server/services/unlockFlow.ts`
- `src/server/services/unlockFlow.test.ts`

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Replace Wave 01 placeholder menu routes for:
   - `/lock-post`
   - `/lock-comment`
   - `/unlock-post`
   - `/unlock-comment`
   - `/open-dashboard`
2. Lock menu route must:
   - parse `MenuItemRequest`
   - resolve target
   - show `lockReview` form with target id, target kind, author, report count, edited status, permalink, content preview, reason preset, custom note, expiry option
3. Unlock menu route must:
   - resolve current active lock
   - show `unlockReview` form
   - if no active lock, show neutral toast
4. Dashboard menu route must show `dashboardLaunch` form.
5. Form submit routes must:
   - `/lock-review-submit`: run lock orchestration
   - `/unlock-review-submit`: run unlock orchestration
   - `/dashboard-launch-submit`: create/open dashboard hook or return a safe response that Wave 12 can wire to dashboard creation
6. Lock orchestration must:
   - refetch target
   - fingerprint current content
   - call approve then ignore reports through moderation service
   - persist lock only after ignore succeeds
   - write audit event
   - handle partial failures with clear warnings
7. Unlock orchestration must:
   - call unignore reports
   - mark lock `unlocked`
   - remove active index
   - write audit event
8. Tests must cover:
   - form field construction
   - lock success
   - lock failure on target not found
   - approve succeeds/ignore fails
   - Redis failure rollback path if practical
   - unlock no active lock
   - unlock success

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/routes/menu.test.ts src/routes/forms.test.ts src/server/services/lockFlow.test.ts src/server/services/unlockFlow.test.ts
npm run lint
```

## Acceptance

- Lock flow is more than a one-click macro: it stores content fingerprint, reason, audit, and metrics context.
- UI copy does not say reports are disabled.
- No automatic removal exists.
- `TODO.md` marks Wave 06 complete.
- All changes are committed.

## Commit

```txt
feat: add review lock menu flows
```

