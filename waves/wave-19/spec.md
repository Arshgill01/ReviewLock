# Wave 19 - Full Scenario Walkthrough

## Goal

Simulate the full moderator story and capture evidence for the four-beat loop: lock, repeat reports, edit, reopen.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-devvit-proof`.
- Use `$reviewlock-product-guardrails`.

## Dependencies

Waves 01 through 18 should be complete.

## Write ownership

This wave may create or edit:

- `docs/FULL_SCENARIO_WALKTHROUGH.md`
- integration or scenario tests under `src/**/*.test.ts`
- narrow fixes in services/routes required by the scenario

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Simulate or live-test:
   - moderator locks a post.
   - repeat reports arrive and are suppressed.
   - dashboard metrics update.
   - author edits post content.
   - lock reopens and appears in queue.
   - same flow for a comment where practical.
2. Prefer live Devvit playtest if available. If live reports cannot be generated safely, use an integration harness and clearly label it.
3. Capture exact commands, route payloads, logs, Redis-visible state, and dashboard output.
4. Fix any flow break discovered.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

## Acceptance

- Full scenario doc includes outputs, not just prose.
- The demo story and implementation story match.
- Any unverified live step is honestly labeled.
- `TODO.md` marks Wave 19 complete.
- All changes are committed.

## Commit

```txt
test: document full reviewlock scenario
```
