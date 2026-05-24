# Controlled Moderation Method Proof

Date: 2026-05-24.

Controlled subreddit: `r/reviewlock_dev`.

Controlled target:

- `t3_1tm8nak`
- `/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/`
- Title: `ReviewLock dashboard`
- Author: `reviewlock`

## Proof Status

| Method              | Status   | Evidence                                                                                                                            | Notes                                                                                                               |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `approve()`         | verified | ReviewLock `Lock review` on controlled target `t3_1tm8nak` created a lock, added audit, and runtime status showed `approve verified`. | Verified for a controlled post target. Comment target still needs separate proof if comment menu testing is reliable. |
| `ignoreReports()`   | verified | ReviewLock `Lock review` on controlled target `t3_1tm8nak` created a lock and runtime status showed `ignoreReports verified`.        | Verified for a controlled post target. Comment target still needs separate proof if comment menu testing is reliable. |
| `unignoreReports()` | verified | Dashboard `Unlock` removed the active lock, wrote audit, and runtime status showed `unignoreReports verified` on the controlled target. | This proves the dashboard API -> unlock flow -> Reddit adapter -> runtime proof write path for `unignoreReports()`. |

## Live Observations

- `npm run dev -- reviewlock_dev` served the ReviewLock playtest for the controlled subreddit.
- The embedded dashboard rendered in Zen under `r/reviewlock_dev`.
- A live active lock created earlier on `t3_1tm8nak` was unlocked through the dashboard after replacing unreliable `window.confirm()` calls with inline dashboard confirmation controls.
- After dashboard unlock, the dashboard showed `0 Active locks`, the audit timeline showed `ReviewLock lock manually unlocked`, and the runtime panel showed `unignoreReports verified`.
- The dashboard action originally attempted to call `/internal/form/unlock-review-submit` from the WebView and returned 404. The dashboard now uses `/api/locks/unlock`.
- After the runtime proof recorder was added, `Lock review` on `t3_1tm8nak` created an active lock and the runtime panel showed `approve verified`, `ignoreReports verified`, and `unignoreReports verified`.

## Browser Automation Incident

During the controlled live pass, a coordinate-based browser action clicked Reddit's native `Remove` action on the controlled ReviewLock dashboard post.

Impact:

- Only the controlled test post `t3_1tm8nak` in `r/reviewlock_dev` was affected.
- The post was immediately restored through Reddit's native `Approve` action.
- No unrelated content was touched.

Decision:

- Avoid coordinate clicks around Reddit's native moderation menu when accessibility targets are ambiguous.
- Prefer accessibility element selection. If the menu cannot be operated reliably, log the blocker instead of probing near destructive controls.

## Current Blockers

- Direct terminal calls to the Devvit WebView/API are not valid proof because Reddit WebView authorization headers are required.
- Direct localhost playtest HTTP calls returned `426 Upgrade Required`; the playtest endpoint is not a normal unauthenticated local HTTP API.
- Devvit hot reload can briefly show stale or empty dashboard state. The final observed playtest version for this pass was `v0.0.2.39`.

## Next Proof Steps

1. Repeat the same proof on a controlled comment if Reddit exposes the comment menu flow reliably.
2. Move to controlled report/edit trigger proof.
3. Keep public claims limited to controlled post-target proof until comment and trigger proof are complete.
