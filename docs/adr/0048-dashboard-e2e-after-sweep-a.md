# 0048 — Main red after sweep A (#781): the specs were wrong, not the Dashboard

**Date:** 2026-11-26 · **Status:** accepted · **By:** Plan (Opus 5.5), unattended

## Context

PR #781 (sweep A, ticket 750) merged with four browser shards red. The Dashboard specs (`v2-dashboard-live`,
`analytics-dashboard`, `analytics` "a head lands on Today") could not find the `Total machines` / `PM hours` regions,
and axe flagged colour contrast on `.v2-kpi-more` in the Total machines card. `who-is-acting` and `desk-lists` failed
too, but they are the known flakes (LESSONS) and passed on retry.

## Decision

The Dashboard markup follows ADR 0041 and stays as is; the specs change.

1. **Folds.** ADR 0041 puts the Dashboard's later groups inside one `ShowDetail`, and each group's `TileSet` folds
   its own tail inside that, so folds nest. The specs opened folds with a snapshot of `.all()` over
   `:not([open])`; each click re-indexes that list, so the specs skipped the outer fold or clicked hidden inner ones.
   `KpiCard` still names its region with the figure's label; nothing lost its accessible name. Fix: one helper,
   `apps/web/e2e/show-detail.ts` `openShowDetail`, waits for "What needs you now" (always in the drawn body), then
   clicks the first visible closed fold until none is left. All five copies use it (gallery included).
2. **All-zero groups.** ADR 0036 R10: a group whose figures are all 0 is one line naming each ("All 6 are zero: PM
   hours, …"), not cards. The e2e seed has no PM or event rows, so "Where the time goes" is that line. The spec now
   accepts a figure as shown when it has a card, or when its value is 0 and the zero line names it. No figure goes
   unchecked: anything else must still be a visible card.
3. **axe timing.** After the drill click the pointer rests on the card, so `.v2-kpi-more` is mid fade-in
   (opacity transition) when axe runs. The spec waits for running CSS transitions to end before axe. At rest the hint
   passes AA in light and dark (axe green after the wait, 2 × 2 runs per scheme).

## Not done (scope)

No product code changed, so no ticket. Nested "Show detail" (a fold inside a fold) is what ADR 0041 asked for; whether
the reader should get one fold per group instead is a product question for Nimish, not decided here.
