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
    - Produce README, Devpost copy, screenshots checklist, video script, and final completion audit.

