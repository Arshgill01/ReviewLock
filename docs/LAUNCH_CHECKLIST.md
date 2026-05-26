# Launch Checklist

Last updated: 2026-05-26.

This checklist is ordered for the final day. Do not skip the proof-boundary
checks: ReviewLock's strongest submission story depends on being honest about
what is verified.

## 1. Local Gate

- [ ] Confirm the worktree only contains intended submission changes.

```bash
git status --short
git diff --stat
```

- [ ] Run the required local gate.

```bash
npm run type-check
npm run lint
npm run test
npm run build
git diff --check
```

- [ ] Confirm there are no source TODO markers.

```bash
rg -n "TODO" src
```

- [ ] Confirm forbidden product copy is absent from production UI/code. Matches
      in guardrail docs, audits, and tests are acceptable only when they are
      explicitly discussing forbidden copy.

```bash
rg -n "not reportable|disable reports|reports disabled|blocked reports|users cannot report|cannot report locked content|Make posts not reportable|Hide all reports forever|AI decides whether reports matter|Automated removal after edit" src README.md docs
```

## 2. Proof Boundary

- [ ] Read `docs/RUNTIME_PROOF.md`.
- [ ] Read `docs/KNOWN_LIMITATIONS.md`.
- [ ] Read `docs/MODERATION_METHOD_PROOF.md`.
- [ ] Ensure README, Devpost copy, demo narration, and app listing copy claim
      only verified rows as verified.
- [ ] Keep these unverified unless a newer controlled proof pass updates
      `docs/RUNTIME_PROOF.md`:
  - comment report trigger delivery;
  - post NSFW update trigger delivery;
  - post spoiler update trigger delivery;
  - post flair update trigger delivery;
  - repeated dashboard launch reuse;
  - independent comment-target moderation method proof.

## 3. Browser And WebView Recheck

Run browser checks after UI changes, screenshot changes, or any dashboard copy
changes that affect first-viewport comprehension.

- [ ] Start playtest.

```bash
npm run dev -- reviewlock_dev
```

- [ ] Open the dashboard in Reddit WebView.
- [ ] Verify first viewport shows:
  - active locks;
  - reports suppressed;
  - reopened after edit;
  - latest edit-break/reopen event;
  - visible demo label when demo data is shown.
- [ ] Verify desktop screenshot.
- [ ] Verify mobile/narrow screenshot.
- [ ] Verify no audit timeline text collisions.
- [ ] Verify target links use safe Reddit permalinks only.
- [ ] Click `Verify runtime` from the embedded dashboard and confirm the
      runtime panel updates under `r/reviewlock_dev`.
- [ ] Record exact playtest version and screenshots in
      `docs/BROWSER_REGRESSION.md`.

If only markdown files changed, browser verification is optional. If any client
file under `src/client` changed, browser verification is required before final
submission.

## 4. Controlled Runtime Proof Recheck

Minimum proof before final submission:

- [ ] Post lock form opens on a controlled post.
- [ ] Post lock submission creates an active lock.
- [ ] Runtime panel shows post-target `approve()` verified.
- [ ] Runtime panel shows post-target `ignoreReports()` verified.
- [ ] Dashboard unlock verifies `unignoreReports()`.
- [ ] Controlled unchanged post report increments `Reports suppressed`.
- [ ] Controlled post body edit reopens the lock.
- [ ] Controlled comment body edit reopens the lock.

Optional but high value:

- [ ] Controlled comment report proof.
- [ ] Controlled NSFW update proof.
- [ ] Controlled spoiler update proof.
- [ ] Controlled flair update proof.
- [ ] Repeated dashboard launch reuse proof.

Do not perform destructive proof outside `r/reviewlock_dev` or another
controlled subreddit.

## 5. Upload, Publish Request, And Listing

- [ ] Confirm logged-in account.

```bash
npx devvit whoami
```

- [ ] Upload only after the local gate passes.

```bash
npx devvit upload
```

- [ ] Inspect listing metadata.

```bash
npx devvit view --json
```

- [ ] Confirm:
  - app slug is `reviewlock`;
  - owner is `BrightyBrainiac`;
  - uploaded version is newer than the previous stub build;
  - listing/about copy is not the old short README;
  - app listing URL is available.

- [ ] Decide whether to file an unlisted publish request or a public App
      Directory publish request. `npx devvit publish` creates a new app version,
      uploads source for review, and files a publish request; `--public` submits the
      app for public review. Do not run this until the final local gate, proof
      boundary, listing metadata, and judging post URL are ready.

```bash
npx devvit publish
# or, only if public App Directory review is the intended final action:
npx devvit publish --public
```

- [ ] After publish request submission, rerun:

```bash
npx devvit view --json
```

- [ ] Record the requested version, visibility, and any review/request status
      shown by the Developer Portal or CLI.

## 6. Judging Access

Devpost rules require access to a working project for judging/testing by
providing a link to a Reddit post running the app. The rules specify a public
subreddit with fewer than 200 members.

- [ ] Confirm the judging subreddit is public and has fewer than 200 members.
- [ ] Confirm the app is installed there or playtest access is otherwise valid
      for judges.
- [ ] Create or reuse the ReviewLock dashboard post.
- [ ] Add the final judging post URL to:
  - `docs/DEVPOST_SUBMISSION.md`;
  - Devpost submission field;
  - final handoff message.

## 7. Submission Assets

- [ ] Devpost copy: `docs/DEVPOST_SUBMISSION.md`.
- [ ] App listing copy: `docs/APP_LISTING.md`.
- [ ] Demo script: `docs/DEMO_SCRIPT.md`.
- [ ] Claim audit: `docs/CLAIM_CHECK.md`.
- [x] Screenshot set:
  - lock form;
  - dashboard active locks and reports suppressed;
  - reopened-after-edit queue;
  - runtime proof panel;
  - visible demo mode state.
  - Manifest: `docs/SCREENSHOTS.md`.
- [ ] Optional video under one minute, publicly visible on an allowed platform.

## 8. Final Reviewer Signoff

- [ ] No known high or critical reviewer finding remains unresolved.
- [ ] Medium findings are either fixed or explicitly accepted in
      `docs/KNOWN_LIMITATIONS.md`.
- [ ] Developer Portal listing is no longer stub-grade.
- [ ] README links point to files that exist.
- [ ] Proof docs do not cite stale app version counts as current.
- [ ] Final answer reports exact commands run and pass/fail status.
