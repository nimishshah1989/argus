## 43b — Team Focus

**What changed for a user:** the Team Focus page now computes its whole frozen 11 November key: the three KPI tiles —
**Actions 31** ("31 not started, 0 in progress"), **Done 0** ("0 marked not needed") and **Progress 0%** ("of actions
done or not needed") — and the month's **31 ranked actions**, in the platform's six lanes and order. The page has no
tables and no charts. The drill names the 14 machines the actions themselves name; spare and record actions name no
machine and drill nowhere.

**The rules the key pins.** The period is the same one the bottleneck page uses (1 January of the earliest breakdown
year to the latest breakdown date), and months = period days / 30.44. The fleet is `isProduction`, hours are
`effectiveHours` (NO DT = 0) and PM is never a breakdown. The lanes are:

- **A, before next month:** the forecast's Hot or Likely machines (or a rising Watch), top 8 by expected hours;
  stake is the expected hours; key `fc|<machine>|<YYYY-MM>`, title "inspect before <month>".
- **B, fix for good:** repeat machine-and-group pairs with three or more separate occurrences (entries more than
  three days apart), top 6 by hours, then the top 3 problem groups by hours; stake is hours / months.
- **C, overhaul or replace:** machines rated Poor or Critical by the age-adjusted health score that lost more than
  their expected hours, ranked by the excess per month, top 5.
- **F, Why-Why due:** long breakdowns over the Why-Why threshold in the last `longDays` with no saved record, newest
  first, top 5; title ends "— Why-Why not done".
- **D, spares to keep ready:** part keys used three or more times on two or more machines, top 5 by uses; the printed
  name is the commonest raw spelling with sizes and stop words removed.
- **E, fix the record:** the two gaps this log has — 21 machine-and-problem pairs logged four or more times, and
  spare cost blank on 175 breakdowns that named a part — both with zero hours at stake.

The saved status, owner and note are not this figure's: it prints the platform's defaults (open, no owner, no note).
Their persistence is the ticket's later server packet (`focus:<period>|<action>` rows).

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-team-focus.test.ts` (3 new tests):
(1) `figure.value` is `toEqual` the whole `team-focus.json` — page, KPIs and every action with its key, lane,
machine, title, stake and default state; (2) the drill is derived from the key's own action machines, every id is a
real machine, and the engine's sorted ids match; (3) the three KPIs are pinned exactly and the page has no tables or
charts. Red first, before the computer was registered: all 3 failed with `expected 'not_computed' to be 'ready'`,
"the engine knows no figure team-focus" and a null value. Green: the named file 3/3; `pnpm exec vitest run
packages/domain/test` — 35 files, 424 tests passed. `pnpm precheck`: all checks pass.

**Files.** `packages/domain/src/analytics/team-focus.ts` (new, 377 lines), `team-focus-health.ts` (new, 328
lines) for the age-adjusted health score behind lane C, `team-focus-spares.ts` (new, 119 lines) for lane D's part
keys and legacy spare columns, the `team-focus` entry in `computers.ts`'s owner-43 map, the new test and this
fragment. No new dependency, no table, schema, migration or settings seam.

**Deviations and notes recorded.**

1. **The health and spare rules sit in two helper files by subject.** The ticket's 400-line file budget is hard, and
   the platform keeps the health score and the spares lane as separate subjects; `team-focus.ts` is the page and
   the other five lanes. The packet is still one computation, registered once.
2. **The legacy spare columns are a test seam, not a shared type change.** The live engine's report row carries one
   spare; the legacy workbook kept three spare names and three cost columns, and the second and third change lane D's
   counts. The figure reads them as optional legacy columns, falls back to the one live field, and the test supplies
   them from the same `input.json` the answer-key fixture reads. No fixture, type or server file changed.
3. **Health's spares component is implemented but absent on this key.** It reads the legacy spare cost as the
   platform does; every cost is zero in the workbook, so the component is omitted and the remaining weights
   renormalise, exactly as the platform's own `cy > 0 && cpb > 0` guard does. The key's C top five (TMC-2 18.25,
   VC-28 12.71, TC-5 11.81, VC-22 8.87, TC-13 7.96) match.
4. **Status, owner and note are the defaults only.** The engine is pure and has no persistence; the key's own values
   happen to be the defaults. The server packet that stores them is out of this figure.
