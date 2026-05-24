# ReviewLock Plan

Each wave maps to one executor agent. The prompt for each executor is:

```txt
/goal Follow waves/wave-XX/spec.md exactly and execute completely.
```

## Waves

1. **Wave 01 - Scaffold and Build Baseline**
   - Create the Devvit Web TypeScript app, baseline scripts, config, shared route shells, and repository hygiene.

2. **Wave 02 - Source Truth and Fixtures**
   - Define shared schema/constants, demo fixtures, and golden scenario data.

3. **Wave 03 - Fingerprint Engine**
   - Implement deterministic content normalization, fingerprinting, and edit-change classification.

4. **Wave 04 - Redis Store and Indexes**
   - Implement namespaced Redis persistence for locks, reopen events, audit, metrics, and config.

5. **Wave 05 - Reddit Adapter and Moderation Operations**
   - Isolate target resolution and safe approve/ignore/unignore operations behind testable adapters.

6. **Wave 06 - Lock and Unlock Menu Flows**
   - Implement post/comment/subreddit menu forms and lock/unlock service orchestration.

7. **Wave 07 - Report Trigger Suppression**
   - Implement `PostReport` and `CommentReport` trigger decisions, suppression, metrics, and idempotency.

8. **Wave 08 - Edit-Aware Reopen Triggers**
   - Implement post/comment update, flair, NSFW, and spoiler trigger handling that breaks stale locks.

9. **Wave 09 - Dashboard API and Aggregation**
   - Implement server API responses for overview metrics, active locks, reopen queue, audit, and runtime status.

10. **Wave 10 - Dashboard Client**
    - Implement the operational dashboard UI with metrics, active locks, reopen queue, and audit views.

11. **Wave 11 - Demo Mode**
    - Implement deterministic demo mode, seeded dashboard states, and reset/enable flows.

12. **Wave 12 - Integration Wiring**
    - Wire all routes, forms, triggers, server exports, and client entry points into one coherent app.

13. **Wave 13 - Runtime Proof and Hardening**
    - Run Devvit verification, document blockers, harden failure paths, and prove claims.

14. **Wave 14 - Submission Package and Final Audit**
   - Held until after Waves 15-30. Produce README, Devpost copy, screenshots checklist, video script, and final completion audit only after hardening evidence exists.

15. **Wave 15 - End-to-End Trigger Proof**
   - Trace every report and update trigger path from payload through Redis, moderation adapter, metrics, and audit writes.

16. **Wave 16 - Edit-Fingerprint Stress**
   - Stress fingerprinting against whitespace, flair, NSFW, spoiler, cleared-body, rewritten-body, and mixed post/comment edits.

17. **Wave 17 - Redis Failure and Race Conditions**
   - Harden lock/report/reopen paths for Redis failures, duplicate delivery, and simultaneous report/update events.

18. **Wave 18 - UI and Dashboard Audit**
   - Audit every dashboard state, including empty, locked, reopened, demo, runtime failure, and high-volume states.

19. **Wave 19 - Full Scenario Walkthrough**
   - Simulate the real moderator loop end to end and document observable outputs, logs, and dashboard state.

20. **Wave 20 - Hardening Pass 1**
   - Read every written file, remove stubs/dead branches, fix embarrassing implementation or copy issues, and commit the cleanup.

21. **Wave 21 - Devvit Config and Registration Hardening**
   - Use ModMirror and Devvit schema evidence to harden app registration, playtest launch, and manifest compatibility.

22. **Wave 22 - API Contract and Client Integration Hardening**
   - Verify dashboard/client API contracts under success, failure, malformed response, and slow response cases.

23. **Wave 23 - Trigger Idempotency Hardening**
   - Re-run trigger paths for duplicate and out-of-order events, then harden any weak idempotency assumptions.

24. **Wave 24 - Data Namespace and Migration Hardening**
   - Audit Redis key namespacing, demo/live separation, missing-key behavior, and future migration safety.

25. **Wave 25 - Safety and Privacy Hardening**
   - Audit stored fields, logs, docs, UI, and tests for privacy, moderator safety, and product-scope drift.

26. **Wave 26 - Performance and High-Volume Hardening**
   - Stress dashboard aggregation and trigger services with high lock/report volumes and tighten inefficient paths.

27. **Wave 27 - Claim and Copy Hardening**
   - Recheck every product claim against runtime proof, forbid unsafe wording, and align submission copy with evidence.

28. **Wave 28 - Browser Regression Hardening**
   - Use a browser against the built app states and fix layout, blank-state, overflow, and interaction regressions.

29. **Wave 29 - Install/Deploy Rehearsal Hardening**
   - Rehearse upload/playtest/deploy-adjacent commands as far as the dev account permits and document exact blockers.

30. **Wave 30 - Production Trust Audit**
   - Run a final autonomous production-readiness pass before Wave 14, focusing on the weakest remaining area.
