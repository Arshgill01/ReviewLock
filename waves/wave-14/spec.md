# Wave 14 - Submission Package and Final Audit

## Goal

Prepare the hackathon-facing materials and audit the repository against the original product thesis.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use `$reviewlock-devvit-proof` for claim safety.

## Dependencies

Waves 01 through 13 should be complete.

## Write ownership

This wave may create or edit:

- `README.md`
- `docs/DEVPOST.md`
- `docs/DEMO_SCRIPT.md`
- `docs/SCREENSHOT_PLAN.md`
- `docs/FINAL_AUDIT.md`
- `docs/CLAIM_CHECK.md`
- `TODO.md`
- `log.md`

Append-only allowed:

- `decisions.md`

Only edit code if the final audit finds a blocker that is safer to fix than document. If code is changed, run full verification again and log why.

## Implementation

1. README must include:
   - one-sentence thesis
   - why native ignore reports is not enough
   - core feature loop
   - setup commands
   - validation commands
   - runtime proof status
   - known limitations
2. Devpost copy must include:
   - problem
   - what it does
   - how it uses Devvit
   - what is technically novel
   - impact for mod teams
   - limitations and honesty notes
3. Demo script must show:
   - reviewed item locked
   - repeat reports suppressed
   - metrics update
   - content edit
   - lock breaks and item appears in reopen queue
4. Screenshot plan must list:
   - dashboard first viewport
   - active lock details
   - suppressed report metric
   - reopen queue after edit
   - demo banner
   - runtime proof/limitations
5. Claim check must mark each claim:
   - verified
   - implemented but not runtime verified
   - demo-only
   - cut
6. Final audit must verify:
   - no forbidden copy such as "disable reports"
   - no AI/mod-surveillance drift
   - no external service dependency
   - all wave TODOs closed or documented
   - full command suite passes or failures are documented

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
rg -n "not reportable|disable reports|blocked reports|AI decides|automatic removal" README.md docs src || true
```

Review any `rg` hits manually. The command returning hits is not automatically failure if hits are in forbidden-copy audit context.

## Acceptance

- Submission materials sell the edit-aware reopen loop, not ignore reports.
- Claim safety matches `docs/RUNTIME_PROOF.md`.
- Final audit is specific and evidence-backed.
- `TODO.md` marks all completed waves or explicitly documents missing ones.
- All changes are committed.

## Commit

```txt
docs: prepare reviewlock submission package
```

