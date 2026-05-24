# Hardening Pass 01

Wave 20 audited the implementation, tests, docs, README, and root config for unfinished behavior, unsafe copy, brittle UI rendering, and stale runtime claims.

## Scope Read

- `src/**`
- `docs/**`
- `README.md`
- `package.json`
- `devvit.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`

## Mechanical Scans

Commands used during the audit:

```bash
rg -n "TODO|placeholder|stub|coming soon|not implemented|scaffold|hack|FIXME|XXX" src docs README.md package.json devvit.json tsconfig.json vite.config.ts eslint.config.js || true
rg -n "not reportable|disable reports|blocked reports|unreportable|ignore reports wrapper|AI decides|automatic removal|remove automatically|report disabling" src docs README.md || true
rg -n "catch \\{|catch \\([^)]*\\) \\{|as unknown| as any|throw new Error\\('TODO|return undefined|console\\.log|debugger" src || true
rg -n "\\.only\\(|describe\\.skip|it\\.skip|console\\.log|debugger| as any|eslint-disable|ts-ignore|ts-expect-error" src || true
```

Required final scan command:

```bash
rg -n "TODO|placeholder|stub|coming soon|not implemented" src docs README.md || true
```

Remaining hits are documentation/test-context only:

- `docs/OWNERSHIP.md` mentions `TODO.md` as an allowed append-only tracking file.
- `docs/HARDENING_PASS_01.md` includes the scan commands and this explanation, so it necessarily contains the searched terms.
- Product-forbidden phrases appear only in tests/checklists/docs that verify they do not appear in production UI.

## Fixes Made

### Reopen Dismiss Flow

Finding:

- `/internal/form/reopen-action-submit` returned a generic toast and did not update Redis.
- The dashboard could appear to dismiss a reopened item while the item stayed in the reopen queue after refresh.

Fix:

- The form route now validates `eventId`, `action`, and `subreddit`.
- It calls `dismissReopenEvent()`, removes the item from the open queue, preserves the event with dismissal metadata, and writes a `reopen_dismissed` audit event.
- The client now sends the active subreddit when dismissing reopened items.
- Added route tests for dismissal persistence and audit output.

### Demo Toggle

Finding:

- The client Demo toggle only flipped `demo=true` and refetched the current subreddit.
- It did not seed deterministic demo data or switch to the `reviewlock_demo` namespace.

Fix:

- Added client API methods for `/api/demo/enable` and `/api/demo/disable`.
- `ReviewLockStore.setDemo(true)` now seeds demo data and switches to the returned demo subreddit.
- `ReviewLockStore.setDemo(false)` returns to the remembered live subreddit.
- Added store tests for both transitions.

### Attribute Escaping

Finding:

- Client render helpers escaped text nodes but reused the same helper inside HTML attributes.
- Dynamic ids and permalinks could break attributes if they contained quotes.

Fix:

- Added attribute escaping helpers in lock table and reopen queue renderers.
- Added render coverage for quote-containing ids/permalinks to prevent attribute injection.

### Stale Runtime Claim References

Finding:

- Runtime proof docs still said live trigger proof was future Wave 15 work, but Wave 15 is complete and local-only.

Fix:

- Updated claim boundary language to say live trigger proof still requires a dedicated controlled playtest pass.

## Files Touched

- `src/routes/forms.ts`
- `src/routes/forms.test.ts`
- `src/client/state/api.ts`
- `src/client/state/store.ts`
- `src/client/state/store.test.ts`
- `src/client/main.ts`
- `src/client/components/LockTable.ts`
- `src/client/components/ReopenQueue.ts`
- `src/client/render.test.ts`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/RUNTIME_PROOF.md`
- `docs/HARDENING_PASS_01.md`

## Open Risks

- This pass did not perform live Reddit trigger generation or live moderation method verification.
- Browser automation remains limited to terminal/headless checks until a dedicated ReviewLock browser window can be safely targeted without disrupting other work.
