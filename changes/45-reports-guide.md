# 45a — the report's shared rules and the monthly figure

**What changed for a user:** the engine now builds the Monthly Report. For the frozen 11 November plant it returns
the answer key whole: the `rep_month` page "Monthly Report", no KPI tiles, eight tables in the key's order and the
two charts `ch-rp-daily` and `ch-rp-12m`. The report is October 2026, the complete month before the as-of month,
compared with September 2026. The tables are the four "Where the time went" rankings (machine, cell, category,
code), the ten longest breakdowns, the maintenance team, the machines added and the blank commentary form. The
drill names all 196 October breakdown tickets, deduped; every one is a real ticket in the snapshot. A plant with no
production machine, or no breakdown in the month, gets `null` and no ids. The shared rules — the period and its
comparison, `fraction`, available hours, `reportStats`, grouping order, labels and the number/arrow text — are
published in `report-period.ts` for the annual report (45b).

**Acceptance, exactly as the plan states it.** `expect(computed.value).toEqual(MONTHLY)` with the key whole, no
tolerance and no re-rounding; `monthlyPeriod('2026-11-11')` is 2026-10-01..2026-10-31 against
2026-09-01..2026-09-30. The drill equals the October production, non-PM reports' ticket ids, deduped and sorted,
and every id is a real ticket.

**What the key pins.** Breakdowns are the production fleet's non-PM reports (NO DT counts, worth 0 hours); hours
are `recordedHours ?? downtimeMin / 60`, never rounded before a sum. Group keys are first-appearance ordered, then
sorted by hours descending and count descending. A cell is the one the machine was in on the breakdown's date (the
move log), a blank or unlisted cell folded into `—`/`No cell`. The machine label cuts a model longer than 16
characters to 15 plus `…`; a code prints its list label up to the em dash. The team list is Settings' own order,
attended descending then hours descending, a shared job counting for each person named; PM visits are the month's
PM rows with that person in Done By. Machines added count only a purchase _date_; a year-only machine joins no
fleet. The daily chart's comparison series stops at September's last day (`null`); the 12-month chart drops leading
months with no breakdown and no PM. Number text is 1 dp for hours, 2 dp for average repair, `▲`/`▼` with the
sign only on counts and team hours, `no change` at zero, and `—` for an absent comparison.

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-monthly-report.test.ts` — `Test Files 1
failed (1)`, `Tests no tests`, `Cannot find module '../src/analytics/monthly-report.js'` (the modules did not
exist). Green: the named file — 5 tests; `pnpm exec vitest run packages/domain/test` — 41 files, 461 tests;
`pnpm precheck` — to be recorded below.

**Files.** `packages/domain/src/analytics/report-period.ts` (new: months and `monthlyPeriod`, `fraction`, annual
and available hours, `reportStats`, `groupBy`/`sortGroups`, the machine/cell/code labels, the fleet purchase
helpers and the number/arrow text), `monthly-report.ts` (new: `monthlyReport`, `monthlyReportFigure`, the page, the
time-went tables, the longest breakdowns, the daily and 12-month charts), `monthly-report-tables.ts` (new: the
team and machines-added tables, split out for the line rail), `computers.ts` (the `'monthly-report'` entry), the
new test and this fragment. No dependency, no migration, no schema change.

**Deviations recorded.**

1. **The team and machines-added tables live in a third file.** The plan's Files line names two source files, but
   the whole page could not fit the hard 400-line rail in one: `monthly-report.ts` is 337 lines and
   `monthly-report-tables.ts` 193, each under the rail, and `report-period.ts` is 328. The split follows the same
   reason 44a used for its rule modules; the whole-key assertion is unchanged and still in one test.
2. **Category labels are whitespace-normalized.** The workbook stores `Cnc Sliding Head  Automatic Lathe` with two
   spaces; the key prints one. `normalizeLabel` (the repo's existing helper) collapses it, and was already the
   platform's effective text. No other label changed: the whole-key test proves every cell.
3. **`monthlyPeriod` and the fleet purchase helpers sit in `report-period.ts`.** They are period math and the
   purchase-date rule 45b's added table also needs; the monthly-only table construction stays in
   `monthly-report.ts`. `report-period.ts` builds no table or chart.
