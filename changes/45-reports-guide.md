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
