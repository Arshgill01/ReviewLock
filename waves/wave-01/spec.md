# Wave 01 - Scaffold and Build Baseline

## Goal

Create a clean Devvit Web TypeScript baseline for ReviewLock with build, lint, test, config, and empty route shells. This wave owns shared scaffold files so later waves avoid config conflicts.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof` for Devvit version/API checks.

## Dependencies

None. This wave starts from the empty `ReviewLock` directory.

## Write ownership

Only this wave may create or edit:

- `package.json`
- `package-lock.json`
- `devvit.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`
- `.gitignore`
- `.prettierrc`
- `README.md`
- `src/index.ts`
- `src/routes/api.ts`
- `src/routes/menu.ts`
- `src/routes/forms.ts`
- `src/routes/triggers.ts`
- `src/client/index.html`
- `src/client/main.ts`
- `src/client/styles.css`
- `src/client/vite-env.d.ts`
- `src/shared/status.ts`
- `src/core/smoke.ts`

Append-only allowed:

- `RESEARCH.md`
- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Scaffold a Devvit Web app using current Devvit tooling or reproduce the current stable structure manually if the scaffold command is unavailable.
2. Use TypeScript, Vite, Hono, Vitest, ESLint, and Prettier.
3. Package scripts must include:
   - `build`: `vite build`
   - `dev`: `devvit playtest`
   - `type-check`: `tsc --build`
   - `lint`: `eslint 'src/**/*.{ts,tsx}'`
   - `test`: `vitest run --config vitest.config.ts`
   - `prettier`: `prettier --write .`
   - `deploy`: `npm run type-check && npm run lint && npm run test && devvit upload`
   - `launch`: `npm run deploy && devvit publish`
4. `devvit.json` must declare:
   - schema `https://developers.reddit.com/schema/config-file.v1.json`
   - name `reviewlock`
   - server dir `dist/server`, entry `index.cjs`
   - post dir `dist/client`, default entry `index.html`, height `tall`, inline `true`
   - menu items:
     - `Lock review` on `post`, moderator, endpoint `/internal/menu/lock-post`
     - `Lock review` on `comment`, moderator, endpoint `/internal/menu/lock-comment`
     - `Unlock review` on `post`, moderator, endpoint `/internal/menu/unlock-post`
     - `Unlock review` on `comment`, moderator, endpoint `/internal/menu/unlock-comment`
     - `Open ReviewLock dashboard` on `subreddit`, moderator, endpoint `/internal/menu/open-dashboard`
   - forms:
     - `lockReview`: `/internal/form/lock-review-submit`
     - `unlockReview`: `/internal/form/unlock-review-submit`
     - `dashboardLaunch`: `/internal/form/dashboard-launch-submit`
     - `reopenAction`: `/internal/form/reopen-action-submit`
   - triggers:
     - `onAppInstall`: `/internal/triggers/on-app-install`
     - `onAppUpgrade`: `/internal/triggers/on-app-upgrade`
     - `onPostReport`: `/internal/triggers/on-post-report`
     - `onCommentReport`: `/internal/triggers/on-comment-report`
     - `onPostUpdate`: `/internal/triggers/on-post-update`
     - `onCommentUpdate`: `/internal/triggers/on-comment-update`
     - `onPostNsfwUpdate`: `/internal/triggers/on-post-nsfw-update`
     - `onPostSpoilerUpdate`: `/internal/triggers/on-post-spoiler-update`
     - `onPostFlairUpdate`: `/internal/triggers/on-post-flair-update`
   - permissions:
     - `reddit: true`
     - `redis: true`
   - scripts build/dev matching package scripts.
5. `src/index.ts` must create a Hono app with route shells:
   - `/api`
   - `/internal/menu`
   - `/internal/form`
   - `/internal/triggers`
6. Route shell files must export Hono routers and return safe placeholder responses that compile. Placeholder route responses are allowed only in Wave 01 owned route shells; later waves must replace them.
7. Client entry must render a minimal "ReviewLock loading" dashboard shell without marketing copy.
8. `README.md` must identify this as a Devvit app and point executors to `AGENTS.md` and `plan.md`.

## Verification

Run:

```bash
npm install
npm run type-check
npm run lint
npm run test
npm run build
python3 /Users/arshdeepsingh/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/reviewlock-wave-execution
```

## Acceptance

- App scaffold builds.
- `devvit.json` includes every menu/form/trigger endpoint needed by later waves.
- No app feature is claimed as runtime-verified.
- `RESEARCH.md` records actual Devvit package versions installed.
- `TODO.md` marks Wave 01 complete.
- All changes are committed.

## Commit

Commit message:

```txt
chore: scaffold reviewlock devvit app
```

