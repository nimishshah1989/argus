# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Everything moves to v2, v1 is deleted, the 97 MISSING coverage items get built. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise (building) · **Branch:** plan/local-checks-portable · **PR:** this one

## State

- `loop build <N>` (builder as its own session) works unattended: #551 built by Haiku and committed. Its local
  `loop finish` failed only on Mac-only checks; this PR fixes them (pii scan skips sparse-checkout holdout files;
  `dump.sh` test skips on macOS, CI Linux still runs it). Remaining local fast-suite failures (6) are #551's case clash.

- ADR 0013 (this PR): Compare keeps its health score/scorecard/tables in v2; M2 before M3. PROJECT.md §6 updated.
- M1 tickets (seed branches pushed, not built): #551 G1.1 case-clash guard + renames (`plan/t551`, small);
  #552 G1.3 cell-log CSV no ids (`plan/t552`, small); #553 G1.2b PM Reports Data codes not UUIDs (`plan/t553`, small).
- #556 (plan PR): G1.5 fix, escalation test dates the roster at the breach moment; 49/49 at 17:59:30 UTC. Needs CI and
  merge (may conflict on HANDOFF.md; keep this file).
- G1.4: #554 Dashboard (`plan/t554`, small) and #555 Problem Analysis (`plan/t555`, small), one `numbers` prop each.
  G1.6: plan PR #557 (tests only; no route leaks today); server tests unproven locally (no Docker), CI api shards decide.
- Open (Plan may decide): Compare's non-money figure shows two "Spares cost" rows always `₹ 0` to every role
  (`packages/domain/src/analytics/compare.ts` L98–99); move under `compare.spares-cost` or drop.

## Next step

1. Fix builder permissions (below), then `loop prep 551/552/553` → builder-small → `loop finish` → CI → reviewer → merge.
2. Ticket PRs need the Argus PR body (3 sections + Q1–Q16 + "Reasons"): `gh pr edit <pr> --body-file` after
   `loop finish`; copy #550's body. Every PR must change HANDOFF.md (loop-guard).

## Blocked / open questions

- **G1.2a needs Nimish:** the duplicate ticket column is in the Excel Breakdown Log sheet
  (`packages/domain/src/exports/plant-sheets.ts` ~L105, `Ticket ID` + `Ticket No.`), which the frozen answer key
  `fixtures/answer-key/workbook-export.json` requires (30 columns). The v2 screen export already has one column.
- G1.4 for Shift KPIs and Energy: no wireframe yet; Plan writes them, Nimish approves.
- Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- Hidden tests go in a `holdout/` folder under `tools/`, `apps/web/src/` or `apps/server/test/`; `tests/holdout/` never runs.
- Bash with `>` redirects or a long inline `gh pr create --body` is denied; use Write + `--body-file`.
- Re-snapshotting wireframes changes the hash and voids approval.
