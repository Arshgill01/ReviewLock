# Wave 10 - Dashboard Client

## Goal

Build the operational dashboard UI that makes ReviewLock feel like a complete mod tool rather than a moderation macro.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Wave 02 should be complete for shared types. Wave 09 should be complete for live API shape; if not, use typed mock fetch adapters under this wave's ownership.

## Write ownership

This wave may create or edit:

- `src/client/main.ts`
- `src/client/styles.css`
- `src/client/components/MetricStrip.ts`
- `src/client/components/LockTable.ts`
- `src/client/components/ReopenQueue.ts`
- `src/client/components/AuditTimeline.ts`
- `src/client/components/RuntimeBanner.ts`
- `src/client/components/DemoBanner.ts`
- `src/client/pages/DashboardPage.ts`
- `src/client/state/api.ts`
- `src/client/state/store.ts`
- `src/client/state/store.test.ts`
- `src/client/render.test.ts`

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

Do not edit `src/client/index.html` unless it is impossible to mount the app.

## Implementation

1. First viewport must include:
   - metric: active locks
   - metric: reports suppressed
   - metric: reopened after edit
   - latest reopen event
2. Dashboard sections:
   - Active locks
   - Reopened after edit
   - Report churn
   - Audit timeline
   - Runtime proof/status
3. Use precise copy:
   - "Lock reviewed content until it changes."
   - "Reports suppressed"
   - "Reopened after edit"
4. Avoid forbidden copy:
   - "not reportable"
   - "disable reports"
   - "blocked reports"
5. Build an API client with typed fetch helpers and loading/error states.
6. The UI must work with:
   - empty state
   - live API data
   - demo API data
   - runtime warning state
7. Style requirements:
   - compact mod-tool dashboard
   - no landing page
   - no nested cards
   - no one-note purple/slate/beige palette
   - stable table/list dimensions
   - mobile responsive
8. Tests must cover:
   - store transitions
   - render helper output for empty/demo/reopen states
   - no forbidden copy in rendered strings if practical

## Verification

Run:

```bash
npm run type-check
npm run test -- --run src/client/state/store.test.ts src/client/render.test.ts
npm run lint
npm run build
```

If a dev server is available after integration, capture screenshots in Wave 13 or 14, not here.

## Acceptance

- UI leads with edit-aware value and suppressed metrics.
- Demo banner is visually unavoidable when demo data is active.
- No marketing hero replaces the tool.
- `TODO.md` marks Wave 10 complete.
- All changes are committed.

## Commit

```txt
feat: build reviewlock dashboard ui
```

