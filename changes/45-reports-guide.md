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
`pnpm precheck` — 13 checks passed (prettier checked 6 files); the size report's warnings are the soft 250-line
ones only, no hard-rail failure.

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

# 45 — Reports, export and the Guide

## 45c-2 — the 17 sheets

**What changed for a user:** nothing on screen yet — the whole data set now has the platform's workbook shape in the
domain. `workbookSheets(EXPORT_DATA)` returns the key's 17 sheets (all but `App Settings`), each with the frozen key's
exact header row and data-row count, built from the plant rows and the A1-A4 figures rather than pasted literals.
45c-1's writer turns this into the `.xlsx`; 45d's route exposes the download.

**Acceptance, exactly as the plan states it.** The sheet names in order are the key's 17 (`App Settings` excluded);
for every sheet the row equal to the key's `header` is found and the rows after it equal the key's `dataRows`; the
four Analytics sheets equal the A1-A4 key figures' rows; the Breakdown Log carries 1,350 rows and its 30 header
cells are the key's. All 17 match: 126/16/17/3/30/1,350/15/0/35/427/2/1/2/9/25/159/14 data rows.

**Red first.** `pnpm exec vitest run packages/domain/test/analytics-workbook.test.ts` failed with
`Test Files 1 failed (1)`, `Tests 9 failed (9)`, `TypeError: workbookSheets is not a function` (the module did not
exist). **Green:** the named file 9/9, then `pnpm exec vitest run packages/domain/test` 41 files / 462 tests, and
`pnpm exec tsc --noEmit` clean.

**The one plan deviation — Settings.** The plan says the team table is last and "nothing may follow it", but the
frozen key's Settings header is the team header and its 35 data rows are the real workbook's rows after it:
14 team rows + one blank + the `Maintenance Codes` label + 19 code rows. A team table literally last can only carry
the 14 plant team members, so it would fail the key's `dataRows: 35`; inventing 21 members is out of the question.
The key is the authority (the plan says so for a cell-level conflict), so the platform's section order stays and the
test pins **both** the 35 rows after the team header and the 14 team rows. A deviation from the plan sentence, not
from the key.

**A structural note.** To keep every file under the 400-line rail, `exports/workbook.ts` is the public assembly
(`workbookSheets`, the five registers and the machine rows); the exact headers live in `exports/headers.ts`, the
plant sheets (Breakdown Log, cell log, Why-Why, Settings, PM registers) in `exports/plant-sheets.ts`, and the four
Analytics sheets in `exports/analytics-sheets.ts`. The behaviour the brief names is still one `workbookSheets(data)`
call.

**Other recorded deviations.** The Breakdown Log's `Ticket No.` repeats `Ticket ID` (plan open question 6, our schema
has one reference); `Source` prints the ticket's `history`/`live`; no `DOC. NO.` row (open question 5); `App Settings`
is not written (open question 4); the PM Reports' `Measurements` cells print `key value` pairs because the platform's
measurement labels are not ours to copy.

**Files.** `packages/domain/src/exports/types.ts` (new: `ExportData`, `ExportSheet`, `ExportRow`, the PM and Settings
inputs), `exports/workbook.ts` (new: `workbookSheets`), `exports/headers.ts`, `exports/plant-sheets.ts`,
`exports/analytics-sheets.ts` (new: the split needed by the 400-line rail), `packages/domain/src/index.ts` (publishes
the export), `packages/domain/test/answer-key/workbook-export.ts` (new: the key plus `EXPORT_DATA` mapped from
`input.json`), `packages/domain/test/analytics-workbook.test.ts` (new: nine acceptance tests), and
`packages/domain/test/registry.test.ts` (the one new public name, `workbookSheets`).
