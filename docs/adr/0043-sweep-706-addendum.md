# 0043 — Sweep #706 addendum: machine out of batch A, ranked bars mapped, the quadrant swap gated

Date: 2026-11-25 · Decided by: the coordinator (1–3, 25 Nov); details by Plan (unattended) · Amends ADR 0041

(Numbered 0043 because 0042 is already taken by an unmerged ADR on `plan/adr-0041`.)

1. **The machine page leaves batch A.** #643 / PR #707 is stuck: its builder ended BLOCKED on a protected e2e conflict,
   and the stop rule allows no more attempts. Batch A = dashboard, action-center, data-checklist, team-focus,
   machines-register, with **no Blocked-by #707**. The machine page gets its kit pieces (TileSet, `readable` in
   `format.ts`) in a later ticket after #707 resolves.
2. **#694 `RankedBars` (KIT-11, merged in #741) goes where ADR 0036 R20 puts it, inside the same batches:**

| Page             | Batch | What becomes `RankedBars`                                                               |
| ---------------- | ----- | --------------------------------------------------------------------------------------- |
| dashboard        | A     | "Problems costing the most downtime" (the costliest table): problem, hours, share       |
| problem-analysis | C     | the engine bar "Which problems cost the most?" (ECharts → `RankedBars`, one chart less) |
| shift-kpis       | D     | every engine `kind: 'pareto'` chart on the page (bars kept, running-total line dropped) |

Not in a batch: the Pareto charts drawn by `printed-page/PageBody` (bd-pm, category-cell, mttr-mtbf): no batch may edit
`printed-page/`, so they wait for a PageBody ticket. The kit `Pareto` component itself was redrawn by #695.
Values: `value` is the engine's number, `valueText` is `exact(value)` (or the engine's printed text where the page has
one); `countText`/`moneyText` only where the page already has them.

3. **The dashboard bubble → Quadrant swap is gated.** It goes in batch A as its own last commit, separable from the
   rest. The coordinator merges A only with Nimish's written yes (asked 25 Nov). If he says no, the builder drops that
   commit and keeps the bubble; nothing else in A depends on it. The Quadrant card keeps the bubble card's title, so the
   e2e specs hold either way; its sub and aria are `v2d.quad.sub` / `v2d.quad.aria`.

## Details (Plan, unattended)

- Strip words: `v2d.strip.*` in `analytics-v2-today.en.ts` (high → `high`, medium → `medium`, Team Focus open
  actions → `low`). Quadrant names: `insight.quad.*`; on the dashboard x is hours (long), y is breakdowns (often); on
  problem-analysis x is the count (often), y the average hours (long).
- Seeds are light (ADR 0034): a pure `sweep.ts` per page where a figure is involved, with visible and holdout tests;
  e2e specs that assert folded tiles open "Show detail" first (a no-op on main, so the specs pass before and after).
