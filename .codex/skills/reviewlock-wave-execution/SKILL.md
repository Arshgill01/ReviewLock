---
name: reviewlock-wave-execution
description: Execute ReviewLock implementation waves from waves/wave-XX/spec.md. Use when Codex is asked to follow a ReviewLock wave spec, build a wave, validate a wave, commit a completed wave, or recover from a blocked ReviewLock wave.
---

# ReviewLock Wave Execution

Use this skill before executing any `waves/wave-XX/spec.md` file.

## Required workflow

1. Read root `AGENTS.md`.
2. Read `docs/OWNERSHIP.md`.
3. Read the assigned wave `spec.md` completely.
4. Inspect current files before editing.
5. Respect the wave's write ownership exactly.
6. If the spec is ambiguous, choose the stronger moderator-useful behavior and append the decision to `decisions.md`.
7. Keep code production grade. Do not leave placeholder functions or `TODO` comments in owned files.
8. Run the wave's required commands.
9. Append wave results to `log.md` and update `TODO.md`.
10. Stage all wave changes and commit with the message specified by the wave.

## Conflict rules

- Do not edit shared wiring files unless the wave explicitly owns them.
- Do not revert unrelated work.
- If another wave already created a compatible file in your ownership area, extend it rather than replacing it.
- If a central import is needed but this wave does not own the central file, export the module and leave final wiring to Wave 12.

## Blocking rules

If a Devvit API or runtime behavior is blocked:

1. Record exact command, error, and source file in `log.md`.
2. Add a decision or risk to `decisions.md`.
3. Complete all non-blocked work in the wave.
4. Commit the completed work unless the repository cannot build because of the blocker.

## Final report

End with:

- What changed
- Commands run
- Pass/fail status
- Commit hash
- Open risks

