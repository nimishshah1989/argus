# D18 — One build process: Athena v3

Date: 13 November 2026 · Status: superseded by D23

## Decision

Athena v3 (`.claude/harness/CLAUDE.md`, `docs/plan/ORCHESTRATOR.md`) is the only build process. The earlier route (a separate planner/reviewer harness directing a hosted coder, PR #73) is retired: `docs/orchestration.yaml` and `tools/check-orchestration.ts` are deleted, and `tools/check-docs.ts` fails CI when an instruction file names that route again.

## Why

BRIEF scope 1 asks for one process (Athena v3). ROADMAP finding 5 found two contradictory harnesses, and the last stretch went into model routing instead of product.

## Rejected

- Keeping both routes: agents follow whichever file they read first.
- Keeping `orchestration.yaml` as a record: git history keeps it.
- A check that only warns: a warning does not stop the drift.

Revisit only through a new decision and a harness change.
