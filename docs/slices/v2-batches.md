# v2 batches: who builds what (each follows `docs/slices/v2-build.md`)

Three builders at a time at most, each in its own worktree and branch (`claude/v2-<name>`), one PR of five screens (four if a
screen's inventory is large). Merges one at a time after CI is green on the current head.

## Foundation (done before any batch starts)

Plumbing and CI speed (screens register themselves, 4 gallery shards, `pnpm pr:body`), the coverage gate (Q16), then the kit part below.

## F1. Rows-behind panel (kit, one PR, before the batches that need it)

Every figure, chart bar, Pareto bar and target bar opens the tickets or machines behind it (parity: every number drills to its tickets).
A generic kit part `ui/v2/domain/rows-behind.tsx` (a drawer view: the rows, 10 a page, search, sort, each row a chip or opens its
machine or ticket) fed by the drill endpoints v1 already uses (see `screens/analytics/DrillTable.tsx` and the figures drill route).
Wire it into the Dashboard's key figures first as the worked example. A screen declares `drill: { figure, params }` in its model.

## Batch 2 (Machines section)

Machines register, OEM, Age, Footprint, Cell change log. Footprint: read what v1 and the spec say first; if there is no v1 screen it is
new, and the assumed meaning ("20% of machines cause most hours" plus a cell map) is marked as an assumption for Nimish in the PR.

## Batch 3 (Problems section)

Breakdown Log (server-paged: it can pass 1,000 rows, never paint them all), General Work, PM Calendar (keep keyboard Move to date),
Fix Finder, Problem Analysis.

## Batch 4 (Reliability)

BD% and PM split, Category and Cell, MTTR and MTBF, Manpower, Why-Why.

## Batch 5 (Reliability, forecast)

Energy heat map, Bottleneck, Shift-calendar KPIs, Forecast Lab, Reliability scorecard.

## Batch 6 (Money, reports, settings)

Money Matters (rupees: head, plant head, admin only), Monthly, Annual, Guide, Settings.

## Batch 7 (floor and desk)

Floor phone (new look; Bhavin's step order, button order and words unchanged), desk, ticket, TV board, login (desk, ticket and TV flows may change).

## Batch 1B (coverage debt: the six merged screens)

Clear `docs/design/v2/scope/batch1.md`: rebuild each merged screen adapter-first and restore every MISSING item, then add the cheap
intelligence wins listed there. Order by daily use: Dashboard, Action Center, Machine page, then Data Checklist, Compare, Team Focus.
The gate report `docs/plan/gates/M-v2-1.md` follows, then Nimish's go. v1 is not deleted until a screen's table is clean.

## Intelligence tickets (engine work, backend lane, small and separate)

Each is a pure function with tests in `packages/domain`, served by an existing route, printed by a screen: health score in words
("loses 2.6x what a machine its age loses"), "failing faster" early warning from the reliability trend, next month's forecast with
its track record, a data-confidence line from the checklist counts, "came back after it was fixed" with the fix that worked on other
machines, a value per decision (hours or rupees won back; money role-gated), daily snapshots of board counts so "vs last week" is
real. Order by what the head reads daily; Nimish picks the first.
