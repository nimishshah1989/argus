# Orchestrator ledger

One line per event, append-only: `dispatched NN → session`, `PR #n`, `merged`, `Ruling: what — why — cost if wrong`.

- 2026-11-13 · M0 orchestration started on `main` eb80a47; frontier = {01}.
- 2026-11-13 · Ruling: children append their line to this file in their own PR and the orchestrator rebases `claude/orchestrator-ledger` after each merge — the brief asks for both; append-only lines resolve trivially — cost if wrong: a rebase conflict per merge.
