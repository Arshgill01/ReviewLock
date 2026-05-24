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
- [x] Wave 17 - Redis Failure and Race Conditions
- [x] Wave 18 - UI and Dashboard Audit
- [x] Wave 19 - Full Scenario Walkthrough
- [x] Wave 20 - Hardening Pass 1
- [x] Wave 21 - Devvit Config and Registration Hardening
- [x] Wave 22 - API Contract and Client Integration Hardening
- [x] Wave 23 - Trigger Idempotency Hardening
- [x] Wave 24 - Data Namespace and Migration Hardening
- [x] Wave 25 - Safety and Privacy Hardening
- [x] Wave 26 - Performance and High-Volume Hardening
- [x] Wave 27 - Claim and Copy Hardening
- [x] Wave 28 - Browser Regression Hardening
- [x] Wave 29 - Install/Deploy Rehearsal Hardening
- [x] Wave 30 - Production Trust Audit
- [x] Wave 31 - Isolated Live WebView Runtime Smoke Proof
- [x] Wave 32 - Controlled Moderation Method Proof
- [ ] Wave 33 - Controlled Report and Edit Trigger Proof
- [ ] Wave 34 - Claim Boundary Cleanup After Live Proof
- [ ] Wave 14 - Submission Package and Final Audit

## Cross-wave reminders

- [x] Verify Devvit package version after scaffold.
- [x] Confirm trigger payload shapes in generated app typings.
- [x] Confirm controlled post-target `ignoreReports()` and `unignoreReports()` work in playtest before claiming live support for that target class.
- [x] Rerun dashboard `Verify runtime` in an isolated ReviewLock browser window and confirm proof writes under `reviewlock_dev`.
- [ ] Capture screenshots only after demo loop is integrated.
- [ ] Keep `decisions.md` updated for every scope or platform call.
- [ ] Do not treat Wave 14 as final until Waves 15-30 have run and committed.

## Current Wave 32 proof state

- [x] Live-verify dashboard unlock writes `unignoreReports verified` for controlled target `t3_1tm8nak`.
- [x] Document controlled browser automation misclick and restoration.
- [x] Add runtime proof ledger writes for moderation method results.
- [x] Replace Devvit WebView `window.confirm()` destructive confirmations with inline dashboard controls.
- [x] Live-verify `approve()` through a successful controlled ReviewLock lock submission.
- [x] Live-verify `ignoreReports()` through a successful controlled ReviewLock lock submission.
- [ ] Repeat moderation method proof on a controlled comment target if Devvit exposes the comment menu reliably.

## Current Wave 33 prep state

- [x] Review live reviewer findings before trigger proof work.
- [x] Harden lock creation rollback when `ignoreReports()` succeeds, Redis persistence fails, and `unignoreReports()` rollback also fails.
- [x] Harden report trigger dedupe so runtime-uncertain deliveries can retry and successful markers expire.
- [x] Align Devvit Redis `zRange` adapter options with installed runtime typings.
- [x] Escape Redis-backed runtime proof text before dashboard rendering.
- [x] Surface message-only non-200 dashboard action errors in the client.
- [x] Enforce current Devvit runtime subreddit on lock/unlock form submit callbacks.
- [x] Validate runtime proof Redis shape before returning it to the dashboard.
- [x] Compensate reopen status-write failures so queued reopen events cannot keep suppressing reports.
- [x] Bootstrap `demo=true` dashboard URLs into the deterministic demo namespace.
- [x] Validate Redis-backed dashboard ledger records before exposing them to renderers.
- [x] Make lock creation idempotent for already-active targets.
- [x] Reopen known active locks when report-trigger target resolution is uncertain.
- [x] Compare current fingerprints before treating active lock submissions as duplicates.
- [x] Keep seeded demo dashboard actions read-only.
- [x] Unignore stale locks before attempting replacement relock writes.
- [x] Reconcile proof-boundary docs after controlled post-target moderation proof.
- [x] Remove controlled test subreddit fallbacks from runtime subreddit normalization and dashboard launch writes.
- [x] Send explicit dashboard subreddit scope with inline unlock actions.
- [x] Re-run live WebView runtime smoke after runtime fallback and scoped-unlock hardening.
- [x] Harden Reddit adapter mapping for installed Devvit `PostV2` and `CommentV2` field names.
- [x] Harden trigger routes for installed Devvit `TriggerEvent` wrapper payloads.
- [x] Re-run live WebView runtime and demo smoke after trigger-wrapper hardening.
- [x] Remove the remaining controlled test subreddit fallback from runtime smoke routes.
- [x] Review and harden the Antigravity dashboard UI refresh before integration.
- [x] Re-run live WebView runtime and demo smoke after dashboard UI polish.
- [x] Expand seeded demo data to 18 records with richer churn and reopen reasons.
- [x] Re-run live WebView demo smoke after seeded demo data expansion.
- [x] Add controlled live scenario matrix separating demo quality from runtime proof.
- [x] Add live trigger proof runbook for S01/S02 controlled execution.
- [x] Record report-trigger moderation rollback failures in runtime proof and audit.
- [x] Normalize bare Devvit menu/report/update target ids before refetch.
- [x] Record S01 live post permalink and thing id in proof docs.
- [ ] Generate controlled live report trigger events in `r/reviewlock_dev`.
- [ ] Generate controlled live edit/update trigger events in `r/reviewlock_dev`.
- [ ] Capture sanitized `devvit logs` payload evidence for live report/update triggers.
