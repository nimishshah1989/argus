# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/screens-batch2

## State

- S22 Money Matters (#644) split by Plan: `plan/s22-model` puts the model types, register, gallery view, its own catalogue `analytics-v2-money` and the coverage table on main; adapter and View are skeletons the tickets fill.
- Screens batch 2 groundwork: ADR 0035 (one ticket per screen on disjoint files; no edits to `insight-coverage.test.ts` or shared catalogues) and five kit words `insight.yardstick.*`.
- Batch 2 seeding in flight (parallel Plan agents: 4 screen groups + S22 split); ticket numbers land in the next handoff.
- ADR 0034 (#652) merged: seeds t640, t641, t643 carry critical tests only.

## Next step

Coordinator: `loop build 640`, `641`, `643`. Batch 2 tickets build once their seeds are pushed.

## Blocked / open questions

- Nimish: yes/no on #651 (ADR 0032 §1); answer key's shift 3 vs the 2-shift decision.
- Not rechecked: #649 (#642) needs `loop build 642` rerun; #650 and #634 red.

## Don't repeat

- Batch 2 tickets must not edit `insight-coverage.test.ts` or shared i18n catalogues (ADR 0035); Plan sweeps NOT_YET after the batch merges.
- The main checkout is shared with other sessions: commit from a temp worktree; check the branch before every commit.
- ADR numbers: check every `origin/plan/*` branch before picking one.
