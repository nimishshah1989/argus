# M4a-43 — Compare, Team Focus, Money and Fix Finder (ticket 43)

Four figures, one ticket. Each is one packet and one PR; they are built in parallel on disjoint files and merged one at
a time. The answer key is the authority: `fixtures/answer-key/{compare,team-focus,money-matters,fix-finder}.json`,
whole objects, no tolerance. Registry rows and drills exist (`registry.ts`: compare machine, team-focus machine,
money-matters ticket, fix-finder ticket). Screens are a later face packet.

## Shared rules

- Fleet `isProduction`; effective hours (NO DT = 0); PM excluded; formatting is the platform's (`formatInr`,
  `formatPercent`, the `printed` shortest-decimal helper from 42a for 1-dp/2-dp hours); dates `DD-MM-YYYY`; the plan's
  page/drill shape as in 42. Sums use the platform's per-machine order.
- The platform source is authority for the rules: read the page's render/compute functions in
  `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` (grep the page id `cmp`, `tf`, `mm`, `ff` and the
  headings "Health score", "Team Focus", "Money Matters", "Fix Finder"; section 24/27/29/30 of its Guide). Reimplement;
  never copy code. If a rule cannot be derived from the key and the source, stop and report the exact cell.
- Each packet: NEW `<name>.ts` (<= 400 lines), its registration in `computers.ts`, a test comparing the whole key, a
  fragment section in `changes/43-compare.md`. Red first, then `pnpm exec vitest run packages/domain/test` and
  `pnpm precheck`. Commit locally, do not push.

## 43a — Compare machines (health score)

`compare.ts`: page `cmp`, "Compare Machines" — 0 KPIs, 6 tables (health scorecard 0–10 adjusted for age; health
checkup; specifications; two longest-breakdown tables; by shift) and 2 charts (`ch-cmp-code`, `ch-cmp-month`),
drilling machines. The health score is the platform's category-and-age expectation (Guide section 24): derive its
inputs from the key and the source; the scorecard's 7.0 baseline and each machine's score are pinned.
**Acceptance:** `expect(value).toEqual(Compare)`; drill machines.

## 43b — Team Focus

`team-focus.ts`: page `tf`, "Team Focus" — 3 KPIs, no tables/charts, drilling machines. It ranks the month's actions
(what to inspect, fix for good, decide on, stock) with the hours at stake. Status/owner/note persistence is a separate
server packet (setting rows per `focus:<period>|<action>`) and is out of this figure; the key pins the computed text.
**Acceptance:** `expect(value).toEqual(TeamFocus)`; drill machines; the key's 3 KPIs exact.

## 43c — Money Matters

`money-matters.ts`: page `mm`, "Money Matters" — 10 KPIs, 2 tables ("Where the money could have been more",
"Where the money was lost") and 1 chart (`ch-mm`), drilling tickets. Inputs: throughput per machine-hour
(`mmThroughput`, default 1,800) and turnover (`mmTurnover`); the platform's cost model is in Guide section 30 and the
source. This is a money page: the engine computes it; the screen gates heads/admin (later face packet).
**Acceptance:** `expect(value).toEqual(Money)`; drill tickets.

## 43d — Fix Finder

`fix-finder.ts`: page `ff`, "Fix Finder" — 4 KPIs, one table "Similar breakdowns across the plant" (15 rows), drilling
tickets. The ranking is the platform's similarity of a described problem to past breakdowns (Guide section 27); derive
the token/score rules from the source and the key. There is no input form in this figure — the engine ranks the plant's
own problems for the key.
**Acceptance:** `expect(value).toEqual(FixFinder)`; drill tickets; the 15 rows in the key's order.

## Integration

Each packet adds one import and one entry to `computers.ts` (in the owner-43 map); the orchestrator resolves the shared
file at merge and keeps every entry. `changes/43-compare.md` is shared — each packet appends its own section; the
orchestrator keeps all. No figure is registered as a half-page: each value is whole for its key.
