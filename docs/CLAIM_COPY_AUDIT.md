# Claim and Copy Audit

Wave 27 aligned ReviewLock copy with runtime proof and the product thesis.

Core phrases preserved:

- `Lock reviewed content until it changes.`
- `Reports suppressed`
- `Reopened after edit`

## Claim Status Matrix

| Claim                                                                                                           | Status                                     | Evidence                                                                                                                                                                                      | Safe wording                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ReviewLock is a Reddit Devvit moderation app.                                                                   | verified                                   | `npx devvit view --json` and repeated playtest uploads in `docs/DEVVIT_REGISTRATION_PROOF.md`.                                                                                                | "ReviewLock is a Reddit Devvit moderation app."                                                          |
| The Devvit app can be uploaded and playtested on `r/reviewlock_dev`.                                            | verified                                   | Wave 21 reached `Playtest ready` repeatedly and logged versions through `v0.0.1.30`.                                                                                                          | "Playtest boot has been verified on `r/reviewlock_dev`."                                                 |
| The dashboard custom post can launch.                                                                           | verified                                   | `docs/RUNTIME_PROOF.md` records a created dashboard custom post and valid menu response hardening.                                                                                            | "Dashboard launch has playtest proof."                                                                   |
| The dashboard client renders active locks, reports suppressed, reopened items, audit, runtime, and demo states. | verified locally                           | `docs/UI_AUDIT.md` and client render tests exercise the built client with mocked API responses.                                                                                               | "The built dashboard UI renders these states in local browser tests."                                    |
| Dashboard API and client response contracts are aligned.                                                        | verified locally                           | `docs/API_CLIENT_CONTRACT_PROOF.md` and route/client tests.                                                                                                                                   | "Local route and client tests verify the dashboard API contract."                                        |
| Lock creation approves, ignores reports, and persists a lock.                                                   | verified for controlled post target        | Local service/form tests cover the path; `docs/RUNTIME_PROOF.md` and `docs/MODERATION_METHOD_PROOF.md` record controlled post-target `approve()` and `ignoreReports()` proof on `t3_1tm8nak`. | "Controlled post-target lock creation proof is captured; comment-target proof is still pending."         |
| Repeat report triggers suppress reports on unchanged locked content.                                            | verified for controlled post target        | `docs/RUNTIME_PROOF.md` and `docs/TRIGGER_PROOF.md` record controlled `PostReport` proof for unchanged locked target `t3_1tm8nak`; comment report proof remains pending.                    | "Controlled post-report suppression proof is captured; comment-report proof is still pending."           |
| Edited content reopens locked items.                                                                            | verified for controlled post body edit     | Local report/update trigger tests cover reopen state, queue, audit, and metrics; `docs/RUNTIME_PROOF.md` and `docs/TRIGGER_PROOF.md` record controlled `PostUpdate` body-edit proof for locked target `t3_1tnfgqf`. Comment update, NSFW, spoiler, and flair proof remain pending. | "Controlled post body-edit reopening proof is captured; remaining update variants are still pending."    |
| Runtime smoke proof writes under the correct subreddit namespace.                                               | verified locally and in controlled WebView | Authorized Zen WebView smoke verified Reddit context and Redis under `r/reviewlock_dev`; route tests now reject mismatched client-supplied dashboard and smoke namespaces.                    | "Runtime smoke is verified for the controlled subreddit; cross-namespace requests are rejected locally." |
| Demo mode shows lock, repeated reports, edit, and reopen.                                                       | demo-only                                  | Seeded demo scenario and demo tests.                                                                                                                                                          | "Demo mode illustrates the ReviewLock loop with seeded data."                                            |
| ReviewLock makes content unreportable.                                                                          | cut                                        | Product guardrails prohibit this.                                                                                                                                                             | Do not say this.                                                                                         |
| ReviewLock disables reports forever or permanently.                                                             | cut                                        | Product guardrails prohibit this.                                                                                                                                                             | Say "Reports suppressed" only for unchanged reviewed content.                                            |
| AI decides report outcomes.                                                                                     | cut                                        | No AI/LLM feature exists in v1.                                                                                                                                                               | Do not say this.                                                                                         |
| ReviewLock automatically removes content after edit.                                                            | cut                                        | Reopen is non-destructive by default.                                                                                                                                                         | Say "Reopened after edit."                                                                               |

## Forbidden Framing Scan

Required scan:

```bash
rg -n "not reportable|disable reports|blocked reports|AI decides|automatic removal|permanent|forever" README.md docs src || true
```

Manual review result:

- `src/client/render.test.ts` contains forbidden-copy assertions.
- `docs/PLAYTEST_CHECKLIST.md`, `docs/UI_AUDIT.md`, `docs/API_CLIENT_CONTRACT_PROOF.md`, `docs/HARDENING_PASS_01.md`, and `docs/SAFETY_PRIVACY_AUDIT.md` contain guardrail or scan-command references.
- `docs/KNOWN_LIMITATIONS.md` contains negative claim boundaries.
- No production UI copy or README product claim uses forbidden framing.

## Production UI Copy Guard

`src/client/render.test.ts` rejects these phrases from rendered dashboard output:

- `not reportable`
- `disable reports`
- `blocked reports`
- `ai decides`
- `automatic removal`
- `permanent`
- `forever`

The same render tests assert the required ReviewLock phrases still appear in dashboard UI:

- `Lock reviewed content until it changes.`
- `Reports suppressed`
- `Reopened after edit`

## Copy Rules Going Forward

Allowed:

- "Lock reviewed content until it changes."
- "Reports suppressed"
- "Reopened after edit"
- "Implemented and locally tested"
- "Playtest boot verified"
- "Controlled post body-edit reopening proof is captured"
- "Controlled post-report suppression proof is captured"

Not allowed:

- "Not reportable"
- "Reports disabled"
- "Blocked reports"
- "Permanently ignored"
- "Forever suppressed"
- "AI decides"
- "Automatically removes after edit"

## Outcome

No inflated production-facing claim needed a copy rewrite in Wave 27. The audit records the current claim boundary, and render tests now cover the full forbidden phrase set from the wave spec.
