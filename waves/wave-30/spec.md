# Wave 30 - Production Trust Audit

## Goal

Run one final autonomous hardening pass before Wave 14: find the weakest remaining area, improve it, and document whether a mod team could trust ReviewLock tomorrow.

## Must use

- Read root `AGENTS.md`.
- Use `$reviewlock-wave-execution`.
- Use `$reviewlock-product-guardrails`.
- Use `$reviewlock-devvit-proof` if runtime claims are touched.

## Dependencies

Waves 01 through 29 should be complete.

## Write ownership

This wave may create or edit:

- `docs/PRODUCTION_TRUST_AUDIT.md`
- any implementation/test/doc file needed for the selected weakest-area fix

Append-only allowed:

- `decisions.md`
- `TODO.md`
- `log.md`

## Implementation

1. Review all previous hardening docs and logs.
2. Identify the weakest remaining area.
3. Research a better local approach if needed.
4. Implement the improvement.
5. Answer explicitly in the audit: would a mod drowning in report churn trust this app in production tomorrow?
6. If the answer is not yes, propose Wave 31+ follow-up in `TODO.md` and keep the goal active.

## Verification

Run:

```bash
npm run type-check
npm run test
npm run lint
npm run build
```

## Acceptance

- Weakest-area improvement is real, not cosmetic.
- Production trust audit is specific and evidence-backed.
- `TODO.md` marks Wave 30 complete or adds Wave 31+ if needed.
- All changes are committed.

## Commit

```txt
chore: complete production trust hardening pass
```
