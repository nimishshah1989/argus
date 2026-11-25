# 0049 — Sweep C review fixes: a rest row on the costliest-problems bars, and a PageBody fold slot

**Date:** 2026-11-26 · **Status:** accepted · **By:** Plan (Opus 5.5), unattended · **Amends:** ADR 0043 §2 (one slot)

## Context

The reviewer failed PR #801 (ticket #752, sweep C) on three points:

1. Problem Analysis, "Which problems cost the most?": the engine draws only its 16 largest groups (`PARETO_SHOWN`,
   `a10-problems.ts`). `RankedBars` prints each row's share of the rows it is given, so on the 11 November plant the top
   group read 17% while the groups table says 15.85% of hours. Two numbers for one fact.
2. Problem Analysis: the what-if `ShowDetail` was drawn even with no what-if figures, and it was labelled with the
   generic "Show detail" while a panel inside repeated the what-if title.
3. MTTR/MTBF and Bottleneck: figures 5+ went through `PageBody`'s `after` slot, so they landed below every table,
   while Fix Finder and Problem Analysis fold them right under the tiles.

## Decision

1. **Rest row.** `costRows(spec, groups?, restLabel?)` adds one `RankedRow` `{ key: '__rest', label: restLabel,
rest: true }` holding all hours minus the hours drawn. All hours = the sum of the groups table's `Hours` column (the
   engine's own 1-decimal numbers, the same rounding as the bars). So `RankedBars`' share is each group's share of all
   hours, within 0.05 points of the table's "% of hours". Picked over keeping the engine's "(N%)" because `RankedBars`
   has no way to print a given share, and a rest row is the kit's own pattern (ADR 0036 R20). Label: new key
   `v2p.pa.rest` = "All other groups" (Gujarati blanks from English as the rest of that catalogue does).
2. **What-if.** Drawn only when `model.whatIf` is non-empty, as `<ShowDetail label={words.whatIf}>` around the row of
   tiles; the inner `Panel` goes, so the words are said once (ADR 0033).
3. **Fold slot.** `PageBody` gets one optional prop `fold?: ReactNode`, drawn directly after the figure row and before
   the charts. MTTR/MTBF and Bottleneck pass their figures-5+ `ShowDetail` there; Bottleneck's Download Excel stays in
   `after`. This is the one edit to `printed-page/` that ADR 0043 §2 allowed no batch: it is additive (absent = no
   change for every other PageBody page) and does not touch the Pareto charts that rule protects.

## Consequences

- The #751 follow-up (bd-pm, category-cell figures 5+ below their tables) can move to `fold` in its own ticket; not done
  here (scope).
- MTTR/MTBF's engine page prints no figures today, so its fold is exercised in tests with borrowed figures only.
- Tests: `problem-analysis/sweep.test.ts` (rest row, >16 groups), `problem-analysis/view.test.ts` (what-if fold, rest
  row drawn), `printed-page/fold.test.ts` (fold position on both pages); hidden edges in
  `problem-analysis/holdout/sweep-edges.test.ts`.
