You are Gemini 3.5 Flash running through Antigravity YOLO mode, helping with frontend/UI only for ReviewLock.

ReviewLock is a Reddit Devvit moderation app. Its product thesis is: "Lock reviewed content until it changes." The dashboard must make the edit-aware reopen loop and suppressed report metrics obvious to a working moderation team.

Work in:

`/Users/arshdeepsingh/Developer/ReviewLock`

Read first:

- `AGENTS.md`
- `docs/OWNERSHIP.md`
- `src/shared/schema.ts`
- all files under `src/client/**`
- the current client diff, especially confirmation-related changes in `LockTable.ts`, `ReopenQueue.ts`, `DashboardPage.ts`, `main.ts`, `state/store.ts`, and `styles.css`

You may edit only:

- `src/client/**`

You may update client-only tests only if they are under:

- `src/client/**/*.test.ts`

Do not edit:

- backend files
- `src/routes/**`
- `src/server/**`
- `src/shared/**`
- `devvit.json`
- `package.json`
- planning docs
- wave specs
- `.codex/**`
- `TODO.md`
- `log.md`
- `decisions.md`
- this prompt file

Do not commit.

Do not add dependencies.

Do not add external services, AI features, backend APIs, or product scope.

Do not remove or weaken existing behavior:

- dashboard data loading
- live/demo toggle
- runtime verification button
- inline confirmation flow for unlocking and dismissing reopened items
- API calls through `/api/locks/unlock` and `/api/reopen-queue/dismiss`
- safe escaping of dynamic content
- mobile responsiveness
- tests that enforce product-safe copy

Forbidden product/UI copy:

- "not reportable"
- "disable reports"
- "blocked reports"
- "reports disabled"
- "permanent"
- "forever"
- "AI decides"
- "automatic removal"

Required exact product language:

- "Lock reviewed content until it changes."
- "Reports suppressed"
- "Reopened after edit"

Design task:

The current dashboard is technically functional but visually weak. Redesign the client UI into a fresh, polished, production-grade operational mod tool. It should feel like a serious moderation ledger/workbench, not a marketing page and not a generic SaaS metric grid.

Primary design goals:

- First viewport immediately shows active locks, reports suppressed, reopened after edit, and the latest edit-break event.
- The edit-aware loop must be visually legible: reviewed -> locked -> repeat reports suppressed -> edited content reopens.
- The interface should feel dense, calm, trustworthy, and built for moderators who repeatedly scan report churn.
- Use a distinctive but restrained visual direction. Fresh and creative is wanted, but avoid decorative gimmicks.
- Prefer a ledger/workbench composition: rows, timelines, compact status bands, queue affordances, and clear action placement.
- Keep mobile polished, not just stacked afterthoughts.

Hard design constraints:

- No landing page.
- No hero marketing section.
- No decorative gradient/orb/bokeh/glassmorphism styling.
- No nested cards.
- No oversized rounded corners; keep radii 8px or less unless a component truly needs otherwise.
- No fake charts that imply data not present.
- No giant empty spacing.
- No generic purple/blue gradient dashboard.
- No dark blue/slate one-note palette.
- Text must fit its containers on mobile and desktop.
- Cards/panels are only for actual repeated items, modals, and functional tool surfaces.
- Use full-width bands or unframed layouts for page structure.
- Do not invent visible instructions explaining how to use the app.

Implementation expectations:

- Keep the app framework as-is: TypeScript render helpers returning HTML strings plus CSS.
- Improve component markup only as needed for the design.
- Keep accessibility basics: semantic regions, button labels, no color-only status meaning.
- Preserve test coverage and add/update client tests for meaningful UI states you change.
- Prefer CSS variables and a cohesive palette with more than one hue family.
- Keep output deterministic and simple enough for Devvit WebView.

After editing, run these checks if available:

```bash
npm run type-check
npm run test -- --run src/client/render.test.ts src/client/state/store.test.ts src/client/state/api.test.ts
npm run lint
npm run build
```

Return:

- files changed
- design direction chosen
- commands run
- pass/fail status
- risks or decisions Codex should review

Reminder: Codex will review your diff before integrating. Treat your work as a proposed frontend redesign, not final authority.
