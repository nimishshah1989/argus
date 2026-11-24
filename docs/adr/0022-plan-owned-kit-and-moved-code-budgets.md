# 0022 — Plan-owned kit tweaks and budgets for moved code

**Date:** 2026-11-24 · **By:** Plan (Nimish away, ADR 0012)

## Decisions

1. **Kit: decision callbacks are optional.** `DecisionCallbacks` in `apps/web/src/ui/v2/domain/decision-row.tsx` became `Partial`, and `DecisionAction` renders nothing unless both `onDecide` and `onUndo` are given. Why: Team Focus (ticket 594) must hide "I'll take it" when it can't save, and the kit forced a dead button. The kit is protected, so Plan made the change on seed `plan/t594`. Every existing caller passes both callbacks and behaves the same.
2. **A move counts against the budget, so Plan budgets for it.** Ticket 584 had to move `compareFigure`'s body (~290 lines, verbatim, checked by the reviewer) into `compare-pair.ts` to keep `compare.ts` under the 400-line cap. Plan raised the budget to `files<=5 lines<=760` and the PR says `Large PR:`. This is not sprawl: about 110 net new lines.
3. **Wireframes S20–S26 drafted** (PR #596, per ADR 0016) as hand-drawn kit wireframes, not snapshots. They wait for Nimish's approval. Open questions for him are in that PR's body (Monthly/Annual tables plain vs searchable; Money Matters engine text "Set in Settings").

## Consequences

Kit changes stay Plan-only and must keep every caller unchanged. Ticket authors check `wc -l` before telling a builder to grow a file.
