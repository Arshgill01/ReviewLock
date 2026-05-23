# OWNERSHIP.md

This file prevents parallel wave conflicts.

## Shared ownership

Only Wave 01 may create baseline shared config. Only Wave 12 may perform final central route and client wiring after feature modules exist.

## Wave ownership map

| Wave | Primary write ownership |
| --- | --- |
| 01 | root config, scaffold, empty route shells, base README |
| 02 | `src/shared/*`, `src/server/fixtures/*` |
| 03 | `src/server/services/fingerprint*` |
| 04 | `src/server/adapters/redis*`, persistence parts of `locks`, `audit`, `metrics`, `reopenQueue` |
| 05 | `src/server/adapters/reddit*`, `targetResolver`, `moderation` |
| 06 | `src/routes/menu*`, `src/routes/forms*`, lock orchestration |
| 07 | report trigger decision modules |
| 08 | update/reopen trigger decision modules |
| 09 | dashboard aggregation and API module files |
| 10 | client UI files under `src/client` |
| 11 | demo services and demo API modules |
| 12 | central wiring files and integration tests |
| 13 | runtime proof docs, hardening patches only where needed |
| 14 | submission docs and final audit |

## Always allowed append-only files

- `decisions.md`
- `TODO.md`
- `log.md`

Agents may append to these files when required. They must not rewrite unrelated entries.

