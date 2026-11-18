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

# 45c-1 — ADR 0008 and the xlsx writer

**What changed for a user:** nothing visible yet: the reports and export screens arrive in 45d and 45e. This packet
settles how the workbook export is written and adds the writer the export route will call. A workbook of sheets now
round-trips through the same dependency-free reader the answer key uses — sheet names and their order exact, strings
(Unicode, `&`, `<`, quotes) intact, numbers as numbers, blanks `null` — and the bytes start `PK`.

**ADR 0008.** The decision is **A: our own writer**, `apps/server/src/modules/reports/xlsx.ts`, about 203 lines. It
builds a zip with `node:zlib` `deflateRawSync` (CRC32, local headers, central directory and end record, no data
descriptors) holding `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, its rels and one worksheet part per
sheet. Text is inline (`<c r="A1" t="inlineStr"><is><t>`), numbers are bare `<v>`, `null` and `''` write no cell,
rows carry `<row r="n">` and cells their `r`; XML is escaped and control characters other than tab, newline and CR
are stripped. No shared strings, styles, formulas, widths, merged cells or frozen panes. **B (SheetJS CE 0.20.x)** is
rejected as the default (a second xlsx implementation, a URL-pinned install and extra dependency/licence checks for
data we can write; the npm `xlsx` is frozen at 0.18.5 with CVEs) and kept as the recorded fallback. **C (ExcelJS)** is
rejected again (heavier chain, older maintenance, a third dialect; the SPEC already rejected it).

**Acceptance, exactly as the plan states it.** `apps/server/test/xlsx-write.test.ts` writes a two-sheet workbook (a
Unicode string, a number, a blank, an empty sheet, an `&` in a sheet name), asserts the result is a `Buffer` whose
first two bytes are `PK`, writes it to a temp file and reads it back with `tools/answer-key/xlsx.ts`. It asserts the
sheet names and their order exactly (`['Data & Notes', 'Empty']`), the rows exactly (the interior blank `null`, the
empty string at B2 never written and read as an interior `null`), a number as a number, the Unicode text intact, the
control character stripped and the empty sheet `[]`.

**Tests that prove it.** Red first with the module absent: `Test Files 1 failed (1)`, `Tests no tests`,
`Cannot find module '../src/modules/reports/xlsx.js'`. Green:
`pnpm exec vitest run apps/server/test/xlsx-write.test.ts` — 1/1. `pnpm exec vitest run apps/server/test` — 129 files, 1,523 tests passed.
`pnpm precheck` — 13 checks passed, 5 files checked by prettier. `pnpm exec tsc --noEmit` is clean.

**The prototype check.** The plan's one-off is a real open in desktop Excel or LibreOffice; this environment has
neither installed, so that visual check remains for the human at the PR and is recorded as such in ADR 0008. The
mechanical proof on a generated two-sheet file: `unzip -t` reports **"No errors detected in compressed data"**;
`unzip -l` lists the six parts (`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`,
`xl/_rels/workbook.xml.rels`, `xl/worksheets/sheet1.xml`, `xl/worksheets/sheet2.xml`, 2,465 bytes); `unzip -p` shows
the workbook with `Data &amp; Notes` and `Empty`, inline-string cells, `<v>42.5</v>` and `<v>-7</v>`, the omitted
blank cells and the empty sheet's `<sheetData></sheetData>`; and an independent openpyxl load returns
`['Data & Notes', 'Empty']` with the same values (`42.5` and `-7` as numbers, the blank as `None`). **If the desktop
open refuses the file, 45c-1 switches to B** (pin SheetJS CE, add it to `THIRD_PARTY.md`, amend ADR 0008); C stays
rejected.

**Files.** `docs/adr/0008-workbook-writer.md` (new: context, decision A, B and C rejected, the prototype condition
and the consequences), `apps/server/src/modules/reports/xlsx.ts` (new, 203 lines), `apps/server/test/xlsx-write.test.ts`
(new, 41 lines), `docs/adr/README.md` (one index line), and this fragment. No new dependency; no migration, schema,
route or parity change.

**Deviations recorded.**

1. The writer is 203 lines, a little above the plan's "about 180" because the zip headers and the XML helpers are
   separate small functions; it is well under the 400-line rail and every function is under 60.
2. `docs/adr/README.md` gains one line for 0008; the packet's file list names only the ADR, the writer, the test and
   the fragment.
3. The desktop Excel/LibreOffice open could not be run here; ADR 0008 records it as the plan's one-off human check,
   with the unzip/openpyxl/reader evidence above standing in mechanically until it is done.
4. A non-finite `number` (`NaN`, `Infinity`) is written as an inline string rather than an invalid `<v>` number; real
   numbers are always numeric cells. No fixture or caller sends one.

# 45c-2 — the 17 sheets

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

# 45b — the annual report figure

**What changed for a user:** the engine now builds the Annual Report. For the frozen 11 November plant it returns the
answer key whole: the `rep_year` page "Annual Report", no KPI tiles, twelve tables in the key's order and the two
charts `ch-ry-month` and `ch-ry-pareto`. The report is 1 January 2026 to 11 November 2026, so November is partial and
prints "November (to date)"; 2025 has no data, so every comparison cell is `—` (see deviation 2). The tables are the
month and quarter series; the ten costliest machines with their share, cumulative share and months in the top five;
the cell, cause, category-reliability, age and team tables; the PM/long-breakdown pair; the machines added month by
month with its `Total` row; and the blank commentary form. The drill names the year's 1,279 breakdown tickets,
deduped; every one is a real ticket in the snapshot. A plant with no production machine, or no breakdown in the year,
gets `null` and no ids.

**Acceptance, exactly as the plan states it.** `expect(computed.value).toEqual(ANNUAL)` with the key whole, no
tolerance and no re-rounding; `annualPeriod('2026-11-11')` is 2026-01-01..2026-11-11 with November as the last month.
The drill equals the year's production, non-PM reports' ticket ids, deduped and sorted, and every id is a real ticket;
the no-machine and no-breakdown plants are `null` with no ids.

**What the key pins.** Each month is its own window cut at the run date; a quarter runs to the run date when it is
still going. The month-over-month and quarter-over-quarter change is the unrounded hours' percent at 0 dp, `—` for the
first row or a zero denominator; MTTR is 2 dp and `—` when the window has no breakdown. `ch-ry-month` stars the
partial month; a chart series rounds with `Math.round(v*10)/10`, while the table text is the platform's own
`toLocaleString` (deviation 1). "Where the downtime comes from" is the year's machines by hours, months in top 5
counted from each month's own top five. By cell counts a machine at its current cell and divides hours by the cell's
machine-equivalents (its time-weighted available hours ÷ annual × the period's fraction, so a machine counts only for
the days it was in that cell and only from its purchase date). Categories divide by the machines currently in the
category; MTBF is (the category's available hours − its hours) ÷ its breakdowns. Age bands are 0-5/5-10/10-15/15-20/20+
with the lower bound in; the team is the Settings list with a job this year, attended descending, the first eight; long
breakdowns are the rows whose recorded hours exceed `whyWhyThresholdHours`, recorded hours descending, the first
eight. Added machines count a purchase date only, ordered by the fleet's category count, with `·` for a zero month and
a `Total` row.

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-annual-report.test.ts` — `Test Files 1 failed
(1)`, `Tests no tests`, `Error: Cannot find module '../src/analytics/annual-report.js'` (the module did not exist).
Green: the named file — 5 tests; `pnpm exec vitest run packages/domain/test` — 43 files, 477 tests passed;
`pnpm precheck` — 13 checks passed (prettier checked 5 files).

**Files.** `packages/domain/src/analytics/annual-report.ts` (new: the period, the month and quarter series, by cause,
age, PM and long-breakdown tables, the two charts, the page and `annualReport`), `annual-report-tables.ts` (new: the
number text and the fleet, cell, category, team and machines-added tables, split out for the line rail), `computers.ts`
(the one `'annual-report'` entry), the new test and this fragment. `report-period.ts` is untouched: no rule it holds
needed changing. No dependency, no migration, no schema change.

**Deviations recorded.**

1. **A local number formatter.** 45a's shared rule says `formatNumber` for every number, but this key's top-machine
   table prints TC-13 as `117.4` hours while the Pareto chart prints `117.5`. The platform's table text is
   `toLocaleString` over the summed double (117.44999999999998863, which prints down at 1 dp) and only the chart
   rounds with `Math.round`; `formatNumber`'s `Math.round(value * 10)` multiplies the near half back up and prints
   `117.5` in both, failing the key by one cell. The annual report therefore prints through `numberText` (an
   `Intl.NumberFormat`, the platform's own text) and `percentText` (`toFixed(2)`, the platform's `fmtPct`); every
   other cell is unchanged and the whole-key `toEqual` proves it.
2. **The prior-year comparison is not printed.** The plan defines 2025-01-01..2025-11-11 as the comparison (no data,
   so `—`). In the platform that comparison feeds only the headline tiles and takeaway sentences, which the key does
   not carry (0 KPIs); no table or chart in the annual key has a prior-year column. Computing it would add a field
   the key does not have and break the whole-figure `toEqual`, so the figure computes the report year and prints the
   within-year month and quarter comparisons. This is the one plan line with no printed cell, and the key is the
   arbiter.
3. **The team name's type word.** The platform prints the Settings team entry's type after the name, so a row
   reads `Person 11 Team`. Our person rows keep the operational role (`maintenance`/`vendor`), not the printed
   type, so the table prints `Vendor` for a vendor and the platform's `Team` word for every other member; the key's
   eight rows all print `Team`.
4. **Two source files.** The plan's Files line names one new module, but twelve tables and two charts do not fit the
   hard 400-line rail in one: `annual-report.ts` is 380 lines and `annual-report-tables.ts` 310, each under the rail,
   the same split 45a made for its team and machines-added tables.
5. **Category labels are whitespace-normalized.** The workbook's `Cnc Sliding Head  Automatic Lathe` prints one space
   in the key; `categoryName`/`categoryOf` (45a's helpers) collapse it. The whole-key test proves every cell.

# 45d — the download endpoints

**What changed for a user:** the reports can now be downloaded. `GET /api/v1/reports/monthly.pdf` prints the Monthly
report for the complete month before `asOf`, `GET /api/v1/reports/annual.pdf` prints the Annual report for the year to
`asOf`, and `GET /api/v1/reports/workbook.xlsx` downloads the whole data set as 45c-2's 17-sheet workbook. All three
are read-only and canAnalytics (supervisor, head, plant head, admin; operator and technician get 403); `asOf` is
optional (the plant's today) and a real plant date, else 422. The PDFs are `inline`, the workbook is an `attachment`
named `<tenant-slug>-workbook-<asOf>.xlsx`. Nothing is stored: each download is computed when it is asked for.

**The PDF.** A4, the tenant's name, the printed title ("Monthly Maintenance Report — October 2026" / "Annual
Maintenance Report — 2026"), the period line ("October 2026" / "2026 to 11 November"), every table in the figure's
order with the figure's own cells, and both charts as inline SVG. The template is a pure function of the figure
value: no SQL, no clock, no re-rounding, and the commentary table prints as the blank Action/Owner/Due date form. The
SVG builder draws a count series as bars, an hours series as the second-axis line, and a Pareto's hours as bars with
its cumulative share as the line; the Pareto gives 15 bars, a 15-point line and the key's labels as tick text.

**Acceptance, exactly as the plan states it.** Each PDF response starts `%PDF-` and carries the printed title, the
period and the key cells — monthly "VC-16 CVM1160", "25.9", "Cell 2"; annual "TMC-2 SL30MC", "307.6", "November (to
date)"; the person cell is the engine's coded name (deviation 1). The xlsx response unzips and its sheet names,
headers and rows equal `workbookSheets` over the same plant load (45c-2's output), with the frozen key's 17 sheet
names and header rows; the Breakdown Log carries the report and its spare cost. All three routes answer 401 without a
sign-in, 403 for an operator and a technician, and 422 for an `asOf` that is not a real date.

**Red/green, verbatim.** Red with the three routes unregistered:
`Test Files 2 failed (2)`, `Tests 12 failed | 1 passed (13)` — all twelve route assertions saw
`Route GET:/api/v1/reports/monthly.pdf?asOf=2026-11-11 not found` (404); the SVG builder test was the one pass.
Green: the two named files — `Test Files 2 passed (2)`, `Tests 13 passed (13)`; `pnpm exec vitest run apps/server/test`
— 131 files, 1,536 tests passed; `pnpm exec tsc --noEmit` clean; `pnpm precheck` — 13 checks passed.

**Deviations recorded.**

1. **A person prints by code, not by name.** The engine never holds a person's name (`loadEngineData` gives every
   person the pseudonym `P-<id8>`), so the PDF's team table prints that code; the key's "Person 11" is the frozen
   fixture's own pseudonym. The test pins the exact code (`P-<Person 11 id8>`) and reads the ASCII cells with
   `pdfText`; `pdfShows` can only prove non-ASCII glyphs, so it is used for the title's em dash.
2. **A live machine prints its code, not its row id.** `machineLabel` used the passed id as the label; in the key's
   fixture `MachineRow.id` is the code, but live it is a uuid (the PDF printed `90d87aba-… CVM1160`). It now prefers
   `machine.code` (the key is unchanged because the fixture sets code = id), and the Pareto chart labels machines by
   code too. A 45a/45b fix found by this packet, not a new number.
3. **The loader publishes the plant's cell list.** `loadEngineData` now sets `settings.cells` from the `cell`
   list items; without it every report cell folded to "No cell" on live data and "Cell 2" could not print. The
   activity is read in the same load, no extra query.
4. **The live workbook's PM, AMC and Legal sheets are header-only.** `EngineData` has no PM plan or PM report source
   until M4b 49/51, so the route's `ExportData` omits them and those sheets print their header row; the route equals
   45c-2's `workbookSheets` over the same load, while the frozen key's 427/2/2/1 row counts belong to 45c-2's
   fixture. `App Settings` is still not written (open question 4).
5. **Spare costs.** `ReportRow.spareCosts` is the new optional three-slot field; the loader fills
   `[spare_cost, null, null]` today (the stored row is one sum), and the workbook's Breakdown Log prints the slots.
6. **Two small seam changes.** `sendBytes` takes an optional type and disposition (the xlsx is an attachment), and
   `writeXlsx`'s `Sheet.rows` is readonly so 45c-2's `ExportSheet` feeds it directly. The three routes are registered
   as binary (`null`) reply schemas, which moves the reply-contract count from 134 to 137.

**Files.** `apps/server/src/modules/reports/report-chart.ts` (new: the SVG builder), `report-pdf.ts` (new: the
template and the two PDF routes), `export-data.ts` (new: `ExportData` from the load, the profile and the tenant),
`workbook-route.ts` (new: the xlsx route), `routes.ts` (registers all three), `apps/server/src/modules/analytics/index.ts`
(publishes `loadEngineData`), `analytics/load.ts` (spare costs and the cell list), `modules/manifest.ts` (the one
CALLS line: reports may call analytics), `reports/pdf-send.ts`, `reports/xlsx.ts` (the readonly rows),
`packages/domain/src/analytics/index.ts` (publishes `monthlyReport` and `annualReport`), `analytics/types.ts`
(`spareCosts`), `analytics/report-period.ts` and `analytics/annual-report.ts` (deviation 2),
`packages/shared/src/replies.ts` (the three binary routes), `packages/domain/test/registry.test.ts` (the two public
names), `apps/server/test/report-pdf.test.ts` and `apps/server/test/report-export.test.ts` (new),
`apps/server/test/reply-contract.test.ts` (the route count), `docs/spec/parity.yaml` and this fragment.

# 45e — the report screens

**What changed for a user:** the Reports group now has its own screen. `/analytics/reports` opens the Monthly Report
with a Monthly | Annual switch, the period line "October 2026", the monthly key's eight tables in its order (the four
"Where the time went" rankings, the longest breakdowns, the maintenance team, the machines added and the blank
commentary form), and its two charts `ch-rp-daily` and `ch-rp-12m`. Switching to Annual shows "2026 to 11 November",
the twelve annual tables in their order and `ch-ry-month` and `ch-ry-pareto`. Above the report are the two downloads:
`Download PDF` to `/api/v1/reports/monthly.pdf` (or `/annual.pdf`) and `Export the whole data set (Excel)` to
`/api/v1/reports/workbook.xlsx`. The report tables do not sort; the untitled table prints the caption "Management
commentary and actions" while the figure's title stays `""`; a `null` figure prints the empty-report line and a
figure the face cannot draw keeps "Not computed yet". No KPI tiles, no insight lists and no commentary inputs are
added: none is in either key. The figure's ticket drill is unchanged: the monthly report links its rows and the annual
report, naming more than 200 tickets, falls back to the Breakdown Log.

**Acceptance, as the plan states it.** `apps/web/src/screens/analytics/report-view.test.ts` pins every table cell,
caption and row count of both reports against the frozen keys (8 tables / 5,9,5,6,10,13,15,5 and 12 tables /
11,4,10,9,8,13,5,8,11,8,15,5 rows), both chart series of each report (the daily chart's three series with its final
`null` gap, the ten-month series, the starred November month, and the Pareto's bars plus cumulative line), the period
line of both, and that no rendered number is absent from the key (cells, chart categories and values, and the period
line are checked against the key's own JSON). It also pins the not-computed and empty states. The journey
`apps/web/e2e/analytics-reports.spec.ts` opens `/analytics/reports`, reads the monthly key's first machine row
("VC-16 CVM1160"), switches to the annual report, reads the key's Months-in-top-5 row ("3"), and follows the PDF link.

**Red/green, verbatim.** Red: `pnpm exec vitest run apps/web/src/screens/analytics/report-view.test.ts` —
`No test files found, exiting with code 0` (the module did not exist); `pnpm exec playwright test
apps/web/e2e/analytics-reports.spec.ts` — `Error: No tests found.` then `e2e: stack stopped`. Green: the mapping file
— `Test Files 1 passed (1)`, `Tests 14 passed (14)`; `pnpm exec vitest run apps/web/src/screens/analytics` — `Test
Files 12 passed (12)`, `Tests 121 passed (121)`; the journey — `2 passed (7.9s)` (`chromium` and `phone`); `pnpm
precheck` — `precheck: OK — 12 file(s) checked by prettier, 13 checks passed`.

**Files.** `apps/web/src/screens/analytics/ReportsPage.tsx` (new, 145 lines: the group's page, the switch, the period
line, both downloads and the report's states), `report-view.ts` (new: the figure → view mapping, the honest states
and the period line), `report-view.test.ts` (new: 14 acceptance tests), `Analytics.tsx` (the `reports` branch),
`page-content.ts` (the four report charts' chrome: `ch-rp-daily`, `ch-rp-12m`, `ch-ry-month`, `ch-ry-pareto`),
`packages/shared/src/i18n/analytics-report.en.ts` and `.gu.ts` (new namespace: the report nav, both download buttons,
the commentary caption, the period line and the four chart titles/axes; gu blank like every other M4a namespace) and
its registration in `i18n/index.ts`, `apps/web/e2e/analytics-reports.spec.ts` (new), `docs/spec/parity.yaml` (both
rows done, with the keys, the mapping test and the journey as evidence), and this fragment. No dependency, no
migration, no schema change.

**Deviations recorded.**

1. **The figure's drill is kept, and `KeyPage`'s drill block moved to `FigureDrill`.** The screen spec names only the
   tables, charts and downloads, but 45a/45b's shared rule says a report figure drills its period's tickets and the
   face falls back to the Breakdown Log when there are too many. `KeyPage` now exports `FigureDrill` (same behaviour
   for every existing key page) and `ReportsPage` renders it, so the monthly report links its 196 tickets and the
   annual report's 1,279 fall back to `/analytics/breakdowns?screen=breakdown-log`. That fallback now finds the group
   that owns `breakdown-log` (`groupOfScreen`) instead of assuming the current group, which is what the reports group
   needed; the breakdowns group's own pages are unchanged.
2. **The four chart specs come through the one page mapper.** `page-content.ts` holds the four ids' chrome, allows a
   line chart up to three series (the daily chart's counts, hours and comparison counts) and maps the Pareto's second
   dataset to its cumulative line (the kit's `mixed` spec); `report-view.ts` owns the figure → view mapping and the
   period line. The acceptance pins the resulting specs exactly.
3. **One key beyond the listed chrome.** `analytics.report.empty` carries the empty-report line a `null` figure
   prints; the plan's namespace list did not name it, and no existing key says it.
4. **The PDF route is stubbed in-test.** 45d is not on this branch, so the journey fulfils `**/api/v1/reports/*.pdf`
   with a one-line `%PDF-` response and follows the real anchor, asserting the download. On `main` the same link
   reaches 45d's route. The annual figure itself is served by the engine (45b is on `main`); the figures reply is
   stubbed in the journey with both frozen keys, the face's established seam.
5. **The period line reads the figure's own as-of.** When the value carries an `asOf` (the engine's report value
   does), the line is computed from it; the reply's `asOf` is the fallback. That keeps the printed period the one the
   figure was computed for even on a replayed snapshot.

# 45f — the Guide

**What changed for a user:** `/analytics/guide` is now the plant's Guide. Its contents list is the platform's own 36
headings, verbatim and in order, from "How this platform works" and "1. Ground rules used everywhere" to
"35. AMC, extended warranty and legal compliance (per machine)". Each heading opens an entry that states our rule in
plain English — the production fleet, hours, dates and ages, available hours, MTTR/MTBF, BD % and the PM split, cells
and the No cell row, sorting, the export, the reports and every analysis screen — and lists the figures it explains.
Each figure link opens its real route (`/analytics/<group>?screen=<screen>`). The five features this build does not
have (PM Calendar, OEM Analytics, learning from corrections, entries with no maintenance code, AMC/warranty/legal
compliance) print the "not in this build yet" line instead of a rule. "13. Excel export and restore" explains the
workbook we do export and says the restore is the M5 importer.

**Acceptance, exactly as the plan states it.** `GUIDE_ENTRIES.map((entry) => entry.titleKey)` equals the key's
`extra` headings resolved through the en catalogue, in order; every `FIGURE_KEYS` entry appears in exactly one
entry's `figures` (45 keys, each once); every figure link's group really holds its screen (`groupOfScreen`); every
entry has at least one body paragraph, and the five unbuilt entries are the only `built: false` and carry only the
not-built line.

**Red/green.** Red: `pnpm exec vitest run apps/web/src/screens/analytics/guide-entries.test.ts` — `Test Files 1
failed (1)`, `Tests no tests`, `Cannot find module './guide-entries.js'` (the module did not exist). Green: the
named file — 4 tests; `pnpm exec vitest run apps/web/src/screens/analytics` — 12 files, 111 tests;
`pnpm exec vitest run packages/shared/test/catalogue.test.ts` — 14 tests; `pnpm precheck` — 13 checks passed,
prettier checked 10 files.

**Files.** `apps/web/src/screens/analytics/guide-entries.ts` (new: the 36 entries, `NOT_BUILT`, `guideFigureLinks`),
`GuidePage.tsx` (rewritten: the contents and the entries with their figure links), `guide-entries.test.ts` (new),
`packages/shared/src/i18n/analytics-guide.en.ts` / `.gu.ts` (new namespace: the 36 titles, the bodies, five formula
lines, the not-built line and the link labels; gu blank), the catalogue registration, `apps/web/e2e/analytics-guide.spec.ts`
(new), `docs/spec/parity.yaml` (`m4a.guide`: done) and this fragment. No dependency, no migration, no schema change.

**Deviations recorded.**

1. **The e2e ran green on this branch, against the Reports group's generic page.** `pnpm exec playwright test
apps/web/e2e/analytics-guide.spec.ts --project=chromium` — 1 passed (8.2 s). `/analytics/reports` exists as the
   group page now, so the link lands; after packet 45e merges, the lead should rerun the same journey to prove the
   real Reports screen loads behind that URL. No fake reports screen was added.
2. **One namespace, one file.** The 36 headings and their bodies do not fit in the main analytics catalogue (already
   248 lines), so the Guide copy is its own namespace, registered like every other M4a area and left blank in gu.
3. **The old `analytics.guide.intro` line was updated.** It said the explanations "arrive with the Guide ticket";
   it now describes what the page is. The key and the namespace are untouched by that one-line change.
