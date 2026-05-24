# TODO.md

## Planner-created implementation queue

- [x] Wave 01 - Scaffold and Build Baseline
- [x] Wave 02 - Source Truth and Fixtures
- [x] Wave 03 - Fingerprint Engine
- [x] Wave 04 - Redis Store and Indexes
- [x] Wave 05 - Reddit Adapter and Moderation Operations
- [x] Wave 06 - Lock and Unlock Menu Flows
- [x] Wave 07 - Report Trigger Suppression
- [x] Wave 08 - Edit-Aware Reopen Triggers
- [x] Wave 09 - Dashboard API and Aggregation
- [x] Wave 10 - Dashboard Client
- [x] Wave 11 - Demo Mode
- [x] Wave 12 - Integration Wiring
- [x] Wave 13 - Runtime Proof and Hardening
- [x] Wave 15 - End-to-End Trigger Proof
- [x] Wave 16 - Edit-Fingerprint Stress
- [ ] Wave 17 - Redis Failure and Race Conditions
- [ ] Wave 18 - UI and Dashboard Audit
- [ ] Wave 19 - Full Scenario Walkthrough
- [ ] Wave 20 - Hardening Pass 1
- [ ] Wave 21 - Devvit Config and Registration Hardening
- [ ] Wave 22 - API Contract and Client Integration Hardening
- [ ] Wave 23 - Trigger Idempotency Hardening
- [ ] Wave 24 - Data Namespace and Migration Hardening
- [ ] Wave 25 - Safety and Privacy Hardening
- [ ] Wave 26 - Performance and High-Volume Hardening
- [ ] Wave 27 - Claim and Copy Hardening
- [ ] Wave 28 - Browser Regression Hardening
- [ ] Wave 29 - Install/Deploy Rehearsal Hardening
- [ ] Wave 30 - Production Trust Audit
- [ ] Wave 14 - Submission Package and Final Audit

## Cross-wave reminders

- [x] Verify Devvit package version after scaffold.
- [x] Confirm trigger payload shapes in generated app typings.
- [ ] Confirm `ignoreReports()` and `unignoreReports()` work in playtest before claiming live support.
- [ ] Rerun dashboard `Verify runtime` in an isolated ReviewLock browser window and confirm proof writes under `reviewlock_dev`.
- [ ] Capture screenshots only after demo loop is integrated.
- [ ] Keep `decisions.md` updated for every scope or platform call.
- [ ] Do not treat Wave 14 as final until Waves 15-30 have run and committed.
