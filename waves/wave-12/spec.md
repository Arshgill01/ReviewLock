# Wave 12 - Integration Wiring

## Goal

Wire independently built modules into one coherent app. This wave owns central imports and conflict-prone route files.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use `$reviewlock-devvit-proof`.

## Dependencies

Waves 01 through 11 should be complete. If a prior wave is missing, wire what exists and log the missing module explicitly.

## Write ownership

This wave may create or edit:

- `src/index.ts`
- `src/routes/api.ts`
- `src/routes/menu.ts`
- `src/routes/forms.ts`
- `src/routes/triggers.ts`
- `src/client/main.ts`
- `src/shared/status.ts`
- `src/integration.test.ts`
- `devvit.json` only if endpoint names drifted from Wave 01 and must be corrected

Append-only allowed:

- `RESEARCH.md`
- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Mount all API route modules:
   - dashboard routes
   - demo routes
   - health/smoke routes
2. Mount menu and form routes from Wave 06.
3. Mount trigger route modules:
   - report trigger routes from Wave 07
   - update trigger routes from Wave 08
   - app install/upgrade runtime routes
4. Ensure `devvit.json` endpoint paths exactly match mounted route paths.
5. Ensure client entry calls real dashboard API paths.
6. Remove Wave 01 placeholder responses where real implementations exist.
7. Add integration tests for:
   - route exists for every `devvit.json` endpoint
   - no duplicate route paths
   - dashboard API returns overview with empty state
   - demo enable then overview returns demo data
   - trigger endpoint accepts representative payload and returns success without throwing
8. Keep errors structured. Internal routes should return Devvit-compatible UI/trigger responses.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

## Acceptance

- `devvit.json` and Hono routes agree.
- App builds as one integrated system.
- No Wave 01 placeholders remain on core paths.
- Missing prior wave modules are logged if any.
- `TODO.md` marks Wave 12 complete.
- All changes are committed.

## Commit

```txt
feat: wire reviewlock app integration
```

