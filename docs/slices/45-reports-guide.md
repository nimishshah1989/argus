# M4a-45 — Reports, export and the Guide (ticket 45)

Ticket 45: [Engine] "Monthly and annual reports and their PDFs match; the whole data set exports as the platform's
workbook (writer library under an ADR)." [Browser] "The Guide explains every figure on screen, and each Guide entry
opens its figure." Blocked by 38, 41, 42 and 43, all merged. Parity rows: `m4a.monthly-report`,
`m4a.annual-report`, `m4a.workbook-export`, `m4a.guide` (`docs/spec/parity.yaml`, all `status: todo`).

## Authority

Four keys, **whole**, all frozen at `asOf: 2026-11-11`, no tolerance and no re-rounding:

- `fixtures/answer-key/monthly-report.json` — `screen monthly-report`, one page (`rep_month`, "Monthly Report",
  **0 KPIs, 8 tables, 2 charts** `ch-rp-daily` and `ch-rp-12m`). Table row counts in order: 5, 9, 5, 6, 10, 13, 15, 5.
  The 5/9/5/6 tables are the one section "Where the time went" (machine, cell, category, code); then "Longest
  breakdowns this period" (10), "Maintenance team" (13), "Machines added" (15), and the untitled
  commentary/actions table (title `""`, header Action/Owner/Due date, five rows of three empty strings).
- `fixtures/answer-key/annual-report.json` — `screen annual-report`, one page (`rep_year`, "Annual Report",
  **0 KPIs, 12 tables, 2 charts** `ch-ry-month` and `ch-ry-pareto`). Row counts: 11, 4, 10, 9, 8, 13, 5, 8, 11, 8, 15, 5.
- `fixtures/answer-key/workbook-export.json` — `screen workbook-export`, **18 sheets** with each sheet's column
  header row and data-row count (126, 16, 17, 3, 30, 1350, 15, 0, 35, 427, 2, 1, 2, 52, 9, 25, 159, 14).
- `fixtures/answer-key/guide.json` — `screen guide`, one page ("Guide", 0/0/0) and `extra`: **36 headings**, the
  platform's table of contents ("How this platform works", then "1. Ground rules used everywhere" to
  "35. AMC, extended warranty and legal compliance (per machine)").

**The period is a choice in the key, not a default.** `tools/answer-key/screens.ts` (lines 22–23) sets
`repSel.m={y:2026,mo:9}` and `repSel.y=2026` before it opens the pages: the monthly key is **October 2026**, the last
complete month, and the annual key is **2026 to 11 November** (November marked "(to date)"). This plan therefore fixes
the monthly figure to the calendar month **before** the `asOf` month and the annual figure to 1 January of the `asOf`
year through `asOf`. Month-to-date reports and a month/year picker are not in this ticket (open question 2); the routes
take an `asOf` so a later screen can offer them without a new figure.

The 11 Nov build at `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` is the rule source. Anchors:
report helpers `repEntriesAll` 4841, `periodFrac` 4847, `repStats` 4857, `codeDesc` 4884, `repGaps` 4886,
`repDelta` 4899, `repHead` 4915, `repNotesBlock` 4920, `repPrintBtn` 4931, `repDownloadPdf` 4932,
`repMachineLabel` 4978, `machDate` 4979, `repAdds` 4980, `repFleetTo` 4981, `repCats` 4982, `renderRepMonth`
5564–5717, `renderRepYear` 5721–5892; workbook `docHeaderRows` 10094, `exportToExcel` 10111–10284; Guide page
3849–4218 (sections 13 "Excel export and restore", 14 "Reports", 21 cells, 22 available hours, 26 sorting).
Earlier helpers: `machineAge` 1663, `computeAge` 722, `machineYear` 748, `machFrac` 843, `availSum` 847,
`cellAvail` 849, `getEffectiveCell` 794, `cellKey`/`cellName` 823–824, `isExcluded` 881, `nonRobotMachines` 883,
`isNoDT` 957, `sumHrs` 987, `sumSpareCost` 993, `nameInField` 1257, `aggBy` 4295, `fmtNum` 687, `fmtPct` 688.
**Reimplement from this plan; never copy the source.**

## The writer-library ADR (0008) — the question, the options, the recommendation

The milestone says the workbook ships "writer library under an ADR". The question is how the repo turns 17 sheets of
rows into an `.xlsx`: with a dependency or with our own writer. It is a **technical** fork, so per CLAUDE.md it is
settled by running the prototype, not by asking Nimish; the ADR is where the settlement is recorded.

| Option                              | What it is                                                                                                                                                                                                                   | Cost                                                                                                         | Risk                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **A. Our own writer** (recommended) | about 180 lines in `apps/server/src/modules/reports/xlsx.ts`: a zip (`node:zlib` deflate), `[Content_Types].xml`, `xl/workbook.xml` plus rels, one `sheetN.xml` per sheet, inline strings and numbers, no styles or formulas | none; `THIRD_PARTY.md` unchanged; no licence review                                                          | a file Excel refuses; needs one real open-in-Excel check                                                |
| B. SheetJS CE 0.20.x                | the import library the SPEC already names, installed from `cdn.sheetjs.com` (Apache-2.0, already listed in THIRD_PARTY)                                                                                                      | a URL-pinned install, a second xlsx implementation in the repo, `check-deps` and `check-licences` to satisfy | the npm `xlsx` is frozen at 0.18.5 with CVEs, so the CDN tarball must be pinned exactly; larger install |
| C. ExcelJS (MIT)                    | npm package, streams and styles                                                                                                                                                                                              | a heavier dependency chain; the SPEC already rejected it once                                                | older maintenance; a third xlsx dialect                                                                 |

**Recommendation: A, on ADR 0008.** Why: the repo already ships a dependency-free xlsx **reader** for the answer key
(`tools/answer-key/xlsx.ts`, 96 lines, no dependency), so the writer is its mirror and the round-trip test is the same
file; our workbook is data only (the key pins names, headers and row counts, not styling, widths or formulas); and
LEAN's ladder says never add a dependency for a few hundred lines. The fallback is B, and it is written into the ADR:
if the prototype's file does not open cleanly in desktop Excel and LibreOffice (the one check a human does once), 45c-1
switches to SheetJS CE, adds it to `THIRD_PARTY.md`, and the ADR records the switch. C stays rejected.

**Marked for Nimish (product, not technology):** whether the workbook must also be a **restorable backup** (Bhavin's
file is), and whether the sheets must carry his controlled-form `DOC. NO. CE-MTN-F-01/04` header line. Both change
what 45c-2 writes (open questions 4 and 5); neither blocks the ADR or the writer.

ADR 0008 records: context, decision A, the two rejected options and why, the prototype condition and the fallback, and
the consequences (the writer is ours to keep, the reader and writer are tested together, no new third-party entry).

## Shared rules (45a and 45b)

- **Fleet.** Production only: `segment === 'CNC'` and not `excludedFromProduction` (`machine-facts.ts`). A report row
  whose machine is not production never enters a report. The Robot is out; PM is never a breakdown; a NO DT row is a
  breakdown worth **0 hours**. Hours are `recordedHours ?? downtimeMin / 60`, never rounded before a sum or a
  comparison.
- **Dates and age.** `asOf` is a plant date. Ages are completed years from the purchase date to `asOf`; a machine with
  only a year uses `asOfYear − year` (never the wall clock); no date and no year → no age.
- **Available hours.** `annual = prodHrsPerDay × workDaysPerYear` (6000). `fraction(from, to)` adds, for every calendar
  month the span touches, `(daysCovered ÷ daysInMonth) ÷ 12`. A machine's available hours = `annual × fraction(max(from,
purchase), to)`, and **0** when its purchase date is after `to`; a machine with no purchase date counts from `from`.
  A period's available hours = the sum over production machines. `BD % = hours ÷ available`, `PM % = pmHours ÷
available`, `availability = 1 − BD % − PM %`. This is the same basis as tickets 38–43; nothing here recomputes it
  differently.
- **Number text.** `formatNumber(value, decimals)` (grouped, halves away from zero) for every number;
  `formatPercent` (2 dp) for BD % and availability; a **share** is `formatNumber(fraction × 100, 1) + '%'`;
  `formatNumber(value, 0) + '%'` for a percentage change; hours 1 dp unless a table below says 0 dp; MTTR and repair
  time 2 dp. `—` for a value that is absent or has no denominator. Dates `DD-MM-YYYY`. If a cell lands on an exact
  half and `formatPercent` differs from the platform's `toFixed(2)`, the key wins and the coder uses `toFixed(2)` for
  that cell and records it in the fragment.
- **Change arrows** (only the text is pinned; the colour rule is the platform's: hours up is bad, availability down is
  bad, a team's count up is workload and neutral). Hours: `|Δ| < 0.05` → `—`; else `▲ 18.0` / `▼ 8.6`, 1 dp, no sign.
  Counts (team, machines added): `0` → `no change`; else `▲ +21` / `▼ −13` (U+2212, no space). Team hours:
  `|Δ| < 0.05` → `no change`; else `▲ +50.4` / `▼ −4.8`. With no comparison period (`hasPrev` false) every comparison
  cell is `—` and the previous-period column is `—`.
- **Labels.** A machine cell is the id, a space, then the model cut to 15 characters plus `…` when the model is longer
  than 16 characters; no model → the id alone. A cell is `Cell <n>` or `No cell` (a blank or unlisted cell). A code
  cell is the code, a space, then the list item's label up to its em dash, trimmed; `—` prints `(none)` and its
  description is "no code recorded". Team names are the person's `displayName`.
- **Charts.** A figure chart is `{id, type, axes, tickLabels, labels, datasets}`, with `type: 'undefined'` and
  `axes {x:'',y:'',y1:''}`, `tickLabels {x:[],y:[],y1:[]}` where the platform had none (the A3/Dashboard precedent).
  Hours series round with `Math.round(v * 10) / 10`; a day with no counterpart in the comparison month is `null`.
- **Drill.** Both report rows are registered with drill `ticket` (already in `registry.ts`). A report figure drills
  the period's breakdown **ticket ids**, in the order the rows were read; the engine dedupes and sorts. The monthly
  key's 196 ids fit `MAX_DRILL_IDS` (200); the annual key's ~1,350 do not, so the face falls back to the Breakdown Log
  (`KeyPage`'s existing too-many branch). Never invent an id: every one is a `tickets` row.
- **Empty plant** → `value: null`, `drillIds: []`.
- **Determinism.** Aggregation is the platform's: group keys in first-appearance order, then a sort by hours descending
  and count descending; sums add in row order. No map iteration order leaks into a key.

## 45a — the report's shared rules and the monthly figure (one PR)

**Files.** `packages/domain/src/analytics/report-period.ts` (new: periods, `fraction`, available hours, `reportStats`,
grouping, labels and number text shared by 45a and 45b), `packages/domain/src/analytics/monthly-report.ts` (new),
`computers.ts` (one entry, `'monthly-report': monthlyReportFigure`),
`packages/domain/test/analytics-monthly-report.test.ts` (new), `changes/45-reports-guide.md` (new; every packet appends
its own section).

**Acceptance.** `expect(computed.value).toEqual(MONTHLY)` with the key whole; the drill is the October ticket ids,
deduped, every one a real ticket; a plant with no production machine or no breakdown in the month → `null` and no ids.

**The monthly report, table by table.** Period: the month before `asOf`'s month, used in full (`start`..`end`); the
comparison month is the month before that, in full; `hasPrev` = its breakdowns or PM entries are non-zero.

1. **Where the time went** — one section, four tables, each with `header [label, "Breakdowns", "Hours", "Prev. hrs",
"Change"]`, hours 1 dp and bold in the face, change by the hours arrow.
   - Machine: the month's breakdowns by machine, hours desc then count desc, **top 5**.
   - Cell: by the cell the machine was in on the breakdown's date (the move log; blank or unlisted → `—`), same sort,
     **top 9**.
   - Category: by the machine's current category (a row with no category is dropped), same sort, **top 5**.
   - Code: by the trimmed maintenance code (`—` when blank), same sort, **top 6**.
   - "Prev. hrs" is the comparison month's hours for the same key, `0.0` when it has no such row.
2. **Longest breakdowns this period** — header `["Date","Machine","Problem","Code","Done by","Hours"]`; all the
   month's breakdowns sorted by effective hours descending, the first 10 with hours > 0; Problem cut to 47 characters
   plus `…` when longer than 48; Code the raw trimmed code or `—`; Done by the names joined `, ` or `—`; Hours 1 dp.
3. **Maintenance team** — header `["Name","Breakdowns attended", <comparison month name>, "Change","Hours","Prev. hrs",
"Change","Avg repair (hrs)","Supported","PM visits","Share"]`. Rows are the Settings team list
   (`settings.teamCodes`, in its own order) that has an attended breakdown, a supported one or a PM visit this month or
   in the comparison month; sort attended descending then hours descending; a shared job counts for **each** person
   named, so shares can exceed 100%; Share is that person's attended count ÷ the month's breakdowns (1 dp %); Avg repair
   is hours ÷ attended (2 dp, `—` when 0); Supported and PM visits are row counts.
4. **Machines added** — header `["Category","Fleet at start","Added this period","Added <comparison month>","Change",
"Fleet at end"]`, one row per category that had a machine added in either period or has a non-zero fleet at the end
   (categories ordered by machine count descending), then a last `Total CNC machines` row. Only machines with a
   purchase **date** count (a year-only machine is never added and never in a fleet); fleet at start = machines bought
   before the first day of the month; fleet at end = bought on or before the last day; added = purchased inside the
   period; change by the count arrow.
5. **Commentary and actions** — `{title: '', header: ["Action","Owner","Due date"], rows: five rows of three empty
strings}`. The platform's typed commentary is never saved, so the figure keeps the blank form (open question 3).

**Charts.** `ch-rp-daily`: labels `1..max(days in the month, days in the comparison month)`; series
`["<Month> breakdowns"]` (the month's count per day, `null` past the last day), `["<Month> hrs"]` (the month's hours
per day, 1 dp), `["<Comparison month> breakdowns"]` (its counts per day, `null` past its last day). `ch-rp-12m`: the
12 months ending at the report month, leading months with no breakdown **and** no PM dropped while more than one
remains; labels `Mon YY` ("Jan 26"); series `Breakdowns` (counts) and `Downtime hrs` (1 dp).

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-monthly-report.test.ts` (the module does not
exist). Green: the named file, then `pnpm exec vitest run packages/domain/test`, then `pnpm precheck`.

**Size.** About 420 source lines across two files plus the test: it carries `size:large` and a `Large PR: <reason>`
line. Split the four "Where the time went" tables from the rest only if the orchestrator wants two PRs; keep the whole
`toEqual` assertion in one of them.

## 45b — the annual report figure (one PR)

**Files.** `packages/domain/src/analytics/annual-report.ts` (new), `computers.ts` (one entry,
`'annual-report': annualReportFigure`), `packages/domain/test/analytics-annual-report.test.ts` (new), the fragment
section. 45a's `report-period.ts` is not edited unless a rule is genuinely shared; a rule used once stays local.

**Acceptance.** `expect(computed.value).toEqual(ANNUAL)` whole; the drill is the year's ticket ids, deduped, all real;
no breakdowns in the year → `null`.

**Period.** `start` = 1 January of `asOf`'s year, `end` = `asOf`; a month is **partial** when its last day is after
`end` (November here). The comparison is the previous year from 1 January to the same month and day; `hasPrev` = its
breakdown count is non-zero (false here: 2025 has no data, so every comparison cell prints `—`).

**Tables, in the key's order.**

1. **Month by month** — header `["Month","Breakdowns","Downtime hrs","vs prior month","MTTR","BD %","PM hrs",
"Availability"]`; one row per month January..`asOf`'s month; full month name with ` (to date)` appended to a partial
   month; hours 1 dp; the month-over-month change is `(month − previous) ÷ previous` as `▲ 794%` / `▼ 28%` at 0 dp
   (`—` for January or when the previous month has no hours); MTTR 2 dp (`—` when the month has no breakdowns); BD %
   2 dp; PM hours 1 dp; availability 2 dp.
2. **Quarter by quarter** — header `["Quarter","Breakdowns","Downtime hrs","vs prior quarter","MTTR","BD %",
"Availability"]`; quarters whose first day is on or before `end`; `Q<n>` plus ` (to date)` when partial; hours 0 dp;
   the change against the previous quarter at 0 dp (`—` when there is none or its hours are 0); MTTR 2 dp; BD % and
   availability 2 dp.
3. **Where the downtime comes from** — header `["#","Machine","Category","Age","Cell","Breakdowns","Hours","Share",
"Cumulative","Months in top 5"]`; the year's machines by hours descending, the first 10; Age `<n>y` or `—`; Cell the
   machine's current cell (raw, `—` when blank); Hours 1 dp; Share = its hours ÷ the plant's (1 dp %); Cumulative = the
   running hours ÷ the plant's (1 dp %); Months in top 5 = how many of the year's months it was in that month's top 5
   by hours.
4. **By cell** — header `["Cell","Machines","Breakdowns","Hours","Hrs / machine","BD %"]`; cells with breakdowns, hours
   descending, `No cell` included; Machines = the count of production machines whose **current** cell is it; Hours
   0 dp; Hrs / machine = hours ÷ the cell's machine-equivalents (its available hours ÷ `annual × the period's
fraction`, so a machine counts only for the days it was in that cell and only from its purchase date); BD % =
   hours ÷ the cell's available hours (2 dp).
5. **By cause** — header `["Code","Breakdowns","Hours","Share"]`; the code groups by hours descending, the first 8;
   Hours 0 dp; Share 1 dp %.
6. **Machine categories — reliability** — header `["Category","Machines","Breakdowns","Hours","Hrs / machine","MTTR",
"MTBF"]`; every category with a breakdown, hours descending; Machines = the count of production machines in it;
   Hours 0 dp; Hrs / machine = hours ÷ that count; MTTR 2 dp; MTBF 0 dp = (the category's available hours − hours) ÷
   breakdowns, and the available hours when it has none.
7. **Machine age** — header `["Age band","Machines","Breakdowns","Hours","Hrs / machine"]`; the five bands
   `0-5 yrs`, `5-10 yrs`, `10-15 yrs`, `15-20 yrs`, `20+ yrs` (lower bound included, upper excluded); Machines by age
   at `asOf`; a machine with no age is in no band; Hours 0 dp; Hrs / machine = hours ÷ the band's machines.
8. **Maintenance team** — header `["Name","Breakdowns","Hours","Avg hrs","PM visits"]`; the Settings team with any of
   the year's attended breakdowns or PM visits, attended descending, the first 8; the Name cell is the name and its team
   type (the key prints "Person 11 Team"); Hours 0 dp; Avg hrs 2 dp (`—` when 0).
9. **Preventive maintenance and long breakdowns** — two tables under one title:
   - PM entries and hours by month: `["Month","PM entries","PM hours"]`, `Jan`.. months to date, hours 1 dp.
   - Breakdowns over the Why-Why threshold: `["Date","Machine","Hours","Problem"]`; the year's breakdowns whose
     **recorded** hours exceed `whyWhyThresholdHours`, recorded hours descending, the first 8; Hours 1 dp of the
     recorded figure; Problem the full text.
10. **Machines added month by month** — header `["Category","Start of <year>","Jan".."<asOf month>","Added","End"]`;
    one row per category with a start or an added machine, ordered by machine count descending; a zero month prints
    `·`; Start = machines bought before 1 January, Added the sum of the months, End = Start + Added; a last `Total` row
    with the column sums. Purchase date only, as in 45a.
11. **Commentary and actions** — the same blank table as the monthly report.

**Charts.** `ch-ry-month`: labels the month abbreviations, `*` appended to the partial month; series `Breakdowns` and
`Downtime hrs` (1 dp). `ch-ry-pareto`: labels the first 15 machines' ids by hours; series `Downtime hrs` (1 dp) and
`Cumulative %` (the running share × 100, 1 dp).

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-annual-report.test.ts`. Green: the named file,
`pnpm exec vitest run packages/domain/test`, `pnpm precheck`. Do not flip the parity rows here; the face packet does
(45e).

## 45c-1 — ADR 0008 and the xlsx writer (one PR)

**Files.** `docs/adr/0008-workbook-writer.md` (new, one page: context, decision A, B and C rejected, the prototype
condition, the consequences), `apps/server/src/modules/reports/xlsx.ts` (new: `writeXlsx(sheets: readonly Sheet[]):
Buffer`, with `Sheet = {name: string; rows: readonly (string | number | null)[][]}`),
`apps/server/test/xlsx-write.test.ts` (new), the fragment section.

**The format.** A zip written with `node:zlib` `deflateRawSync` (method 8; a stored entry is allowed but deflate is the
default), holding `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels` and one
`xl/worksheets/sheetN.xml` per sheet in order. A text cell is an inline string (`<c r="A1" t="inlineStr"><is><t>…`),
a number a bare `<v>`; `null` and `''` write no cell; a row is `<row r="n">` and the `r` attributes are written (our
own reader needs them). XML-escape `& < > " '` and strip control characters other than tab, newline and carriage
return. No shared strings, no styles, no formulas, no merged cells, no column widths, no frozen panes. A sheet name
keeps its text including `&` (escaped in `workbook.xml`); names are unique.

**Acceptance.** Write a two-sheet workbook (a Unicode string; a number; a blank; an empty sheet; an `&` in a sheet name)
and read it back with `tools/answer-key/xlsx.ts`: sheet names and order exact, the rows exact (numbers as numbers,
blanks as `null`), the Unicode string intact, and the bytes start `PK`. The prototype check (a one-off, recorded in the
ADR and the PR): open one written file in desktop Excel or LibreOffice and confirm the sheets and text.

**Red/green.** Red: `pnpm exec vitest run apps/server/test/xlsx-write.test.ts` (the module does not exist). Green: the
named file, `pnpm exec vitest run apps/server/test`, `pnpm precheck`. Do not add a dependency; if Excel refuses the
file, stop and take option B in the ADR (a second PR, not a rewrite of this one).

## 45c-2 — the 17 sheets (one PR)

**Files.** `packages/domain/src/exports/types.ts` (new: `ExportData`, `ExportSheet`, `ExportRow`),
`packages/domain/src/exports/workbook.ts` (new: `workbookSheets(data: ExportData): ExportSheet[]`),
`packages/domain/src/index.ts` (the export), `packages/domain/test/answer-key/workbook-export.ts` (new: the key plus
`EXPORT_DATA` mapped from `input.json`), `packages/domain/test/analytics-workbook.test.ts` (new), the fragment.

**The 17 sheets, in the key's order.** We write every sheet except `App Settings` (open question 4), so 17 of 18.

| Sheet                                                                               | Source                                                                      | Rows                     |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| CNC Machine Master / Conventional Machines / Process Machines / DG Sets / Utilities | the machine rows of that segment, in data order; "Sr." is 1..n              | 126/16/17/3/30           |
| Breakdown Log                                                                       | every report (all registers), date ascending then `srNo` then id            | 1,350                    |
| Cell Change Log                                                                     | the moves, date ascending                                                   | 15                       |
| Why-Why Analysis                                                                    | the saved Why-Why records (`data.whyWhy`); header only today                | 0                        |
| Settings                                                                            | the platform's sections, with the **team table last**                       | 35 after the team header |
| PM Plan                                                                             | `data.pmPlan` by plan date; header only until M4b 49                        | 427 on the fixture       |
| AMC & Warranty / Legal Compliance                                                   | `data.amc` / `data.legal` (ticket 44's types); header only until M4b 51     | 2 / 1                    |
| PM Reports                                                                          | `data.pmReports` by actual date; header only until M4b 49                   | 2                        |
| Analytics 1 - BD%                                                                   | the A1 figure's numbers for the `asOf` year, in the platform's sheet layout | 9                        |
| Analytics 2 - Category-Cell                                                         | the A2 figure                                                               | 25                       |
| Analytics 3 - MTTR-MTBF                                                             | the A3 figure                                                               | 159                      |
| Analytics 4 - Manpower                                                              | the A4 figure                                                               | 14                       |

**Register sheets.** Row 1 the tenant's name, row 2 the record title (`LIST OF CNC MACHINES`, `LIST OF CONVENTIONAL
MACHINES`, `LIST OF PROCESSING MACHINES`, `LIST OF DG SETS`, `LIST OF UTILITY EQUIPMENTS`), row 3 the key's header row,
then the rows. The CNC sheet has Segment, Controller, Ctrl Model, Ctrl Sr No, Asset Code, Conveyor and Efficiency
Factor; the Conventional, Process and Utility sheets drop the controller and asset columns; DG Sets have a DG ID and
Capacity(KVA) and no power, segment or efficiency column. Length and Width come from the machine metadata; Age is
completed years at `asOf` (date, else year, else blank); Efficiency is the machine's own override or blank. The
Breakdown Log uses `BREAKDOWN HISTORY` as its row 2. No `DOC. NO.` row (open question 5).

**Breakdown Log columns, in order** (the key's 30): Sr. = `srNo` else its position in the date order; Date; Month = the
platform's three-letter abbreviation; Shift; Problem; Observed By; Corrective Action; Done By and Supported By = the
people's `displayName`s joined `, `; Machine downtime (Min) = `downtimeMin`; Machine downtime (Hrs) = `recordedHours ??
downtimeMin / 60`, unrounded; Maint Code; E/M = `breakdownCategory`; PM(Hrs) = the recorded hours when the row's code
is PM, else blank; Spare 1..3 = the row's spare names; Cost 1..3 = the per-slot spare costs
(`data.reports[i].spareCosts`, a new optional field; the loader fills `[spare_cost, null, null]` today); Total Spare
Cost = their sum; Record ID = the report id; Response time (Min); Repair time (Min); Section = the machine's segment;
Ticket ID and Ticket No. = the ticket id (our schema has no separate ticket ref: both print it — a recorded
deviation); Source = the ticket's `history`/`live`; Follow-up (Min) = blank (no column in our schema).

**Settings sheet.** The platform's section order (parameters, then Segments, Categories, the three category lists,
Shifts, Locations, Cells, Breakdown Categories, Maintenance Codes) with the **team table last** — the key's count is
the rows after the team header, so nothing may follow it. The team row is `name, type, status, usual shift` with type
from `people.team` and status `Active`; a member's shift is blank (no column). The parameter rows are Production
Hrs/Day, Working Days/Year, Efficiency Factor (%), Why-Why Threshold (Hrs) and Excluded Machines, as `label, value`.

**Analytics sheets** reuse the domain's A1–A4 builders for the `asOf` year and the platform's own layout: a title row,
a blank, A1's eight summary rows and a blank before the header; A2 and A3 put a blank and a second header before each
additional block (categories, cells, age bands, machines); A4 is a title, a blank, the header and the rows. Their
values are already pinned by the A1–A4 keys; this packet adds no new number.

**Acceptance.** `expect(workbookSheets(EXPORT_DATA).map(({name}) => name)).toEqual(KEY.sheets.map(({name}) => name))`
(the 17 in the key's order, `App Settings` excluded); for each sheet the header row equals the key's `header` and the
count of rows after it equals the key's `dataRows`; `Settings`' team table is the last section with 35 rows; the four
Analytics sheets equal the A1–A4 key figures' rows; the Breakdown Log has 1,350 rows and its 30 header cells are the
key's.

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-workbook.test.ts`. Green: the named file,
`pnpm exec vitest run packages/domain/test`, `pnpm precheck`.

## 45d — the download endpoints (one PR, `size:large`)

**Files.** `apps/server/src/modules/reports/report-chart.ts` (new: a pure SVG bar/line chart from a key chart object),
`apps/server/src/modules/reports/report-pdf.ts` (new: the report HTML template and its two routes),
`apps/server/src/modules/reports/export-data.ts` (new: `ExportData` from `EngineData` plus the profile and the
tenant), `apps/server/src/modules/reports/workbook-route.ts` (new: the xlsx route),
`apps/server/src/modules/reports/routes.ts` (register all three), `apps/server/src/modules/analytics/index.ts` (publish
`loadEngineData`), `apps/server/src/modules/manifest.ts` (one CALLS line: `reports` may call `analytics`, the reports
module rendering the analytics reports), `apps/server/src/modules/analytics/load.ts` (read `spare_cost` into
`ReportRow.spareCosts`), `apps/server/src/modules/reports/pdf-send.ts` (a mime parameter on `sendBytes`, or a
sibling), `apps/server/test/report-pdf.test.ts` and `apps/server/test/report-export.test.ts` (new), the fragment.

**Routes** (all `canAnalytics`; a role outside it gets 403; `asOf` optional and a real plant date, else 422):
`GET /api/v1/reports/monthly.pdf`, `GET /api/v1/reports/annual.pdf`,
`GET /api/v1/reports/workbook.xlsx`. They sit in the reports module's own namespace beside
`/api/v1/reports/day.pdf`, and the module reaches the analytics loader through its published interface (the one CALLS
line above). The PDFs compute the figure on the loaded data (`monthlyReport`/`annualReport`, not a whole engine
run), render the HTML, and go through `renderOrBusy` + `renderPdf`; the download is streamed with
`content-disposition: inline` (the established seam: nothing is stored in `file`, no migration, no S3 write). The xlsx
is 45c-1's writer over 45c-2's sheets, sent as
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with `content-disposition: attachment` and the
file name `<tenant-slug>-workbook-<asOf>.xlsx`.

**The PDF.** A4, the tenant's name and the report's printed title ("Monthly Maintenance Report — October 2026",
"Annual Maintenance Report — 2026"), the period line, then every table in the figure's order with the figure's own
cells, and the two charts as inline SVG drawn from the figure's datasets (bars for a count series, a line for an hours
series, a second axis; the Pareto's bars plus its cumulative line). The commentary table prints as the blank
Action/Owner/Due date form. No page numbers or running footer: Chromium's print cannot number pages without a jsPDF
pass (open question 7). The template is a pure function of the figure value: no SQL, no clock, no re-rounding.

**Acceptance.** Each PDF response starts `%PDF-` and `pdfShows` finds the printed title, the period, and cells the key
pins: monthly "VC-16 CVM1160", "25.9", "Person 11", "Cell 2"; annual "TMC-2 SL30MC", "307.6", "November (to date)". The
xlsx response unzips and its sheet names, headers and row counts equal 45c-2's output. Both routes 401
unauthenticated and 403 for an operator. The SVG builder: given `ch-ry-pareto`, 15 bars, a 15-point line and the key's
labels as tick text.

**Red/green.** Red: `pnpm exec vitest run apps/server/test/report-pdf.test.ts apps/server/test/report-export.test.ts`
(the routes 404). Green: both named files, `pnpm exec vitest run apps/server/test`, `pnpm precheck`. Flip
`m4a.workbook-export` here, with the key and the export test as the evidence.

## 45e — the report screens (one PR)

**Files.** `apps/web/src/screens/analytics/ReportsPage.tsx` (new; the group's own page, like `ForecastPage`),
`apps/web/src/screens/analytics/report-view.ts` (new: the pure figure → view mapping, the two chart specs and the
period line), `apps/web/src/screens/analytics/report-view.test.ts` (new), `Analytics.tsx` (the `reports` branch),
`page-content.ts` (the four chart ids' chrome: `ch-rp-daily`, `ch-rp-12m`, `ch-ry-month`, `ch-ry-pareto`),
`packages/shared/src/i18n/analytics-report.en.ts` and `.gu.ts` (new namespace: the report nav, the download buttons,
the commentary caption, the period line, the four chart titles and axes; gu left blank like every other M4a
namespace), the catalogue registration, `apps/web/e2e/analytics-reports.spec.ts` (new), `docs/spec/parity.yaml` (the
`m4a.monthly-report` and `m4a.annual-report` rows: done, evidence the keys and the journey), the fragment.

**The screen.** The Reports group's route shows a Monthly | Annual switch (the Forecast group's pattern) and the chosen
report whole through the page renderer: its tables in the key's order and its two charts. Above them: the period line
("October 2026" / "2026 to 11 November", from the same period rule as the figure), a `Download PDF` link to the
matching PDF route, and an `Export the whole data set (Excel)` link to the xlsx route — the one place a person exports
the workbook. No KPI tiles, no insight lists and no commentary inputs: none is in the key (open question 1) and
nothing is invented. The report tables are **not sortable** (the platform excludes the reports; Guide §26). An
untitled table prints the catalogue caption "Management commentary and actions"; the figure's title stays `""`. A
ready figure the face cannot draw keeps the honest "Not computed yet" line; a `null` value prints the empty-report
line.

**Acceptance.** The mapping test pins every table cell, caption, row count, both chart series and the period line of
both reports against their keys, and asserts the screen adds no number that is not in the figure; the journey opens
`/analytics/reports`, switches to the annual report, reads the monthly key's first machine row and the annual key's
Months-in-top-5 row, and follows the PDF link (the route stubbed in-test, the established e2e seam).

**Red/green.** Red: `pnpm exec vitest run apps/web/src/screens/analytics/report-view.test.ts` and
`pnpm exec playwright test apps/web/e2e/analytics-reports.spec.ts` (no page). Green: both, then
`pnpm exec vitest run apps/web/src/screens/analytics` and `pnpm precheck`.

## 45f — the Guide (one PR)

**Files.** `apps/web/src/screens/analytics/guide-entries.ts` (new: the 36 entries — id, title key, body keys, the
figure keys each entry explains, and a `built: false` flag where the feature is not in this build),
`apps/web/src/screens/analytics/GuidePage.tsx` (rewritten: a table of contents and the entries, each with its figure
links), `guide-entries.test.ts` (new), `packages/shared/src/i18n/analytics-guide.en.ts` / `.gu.ts` (new namespace: 36
titles, the bodies, the formula lines, the "not in this build yet" line, the link label; gu blank), the catalogue
registration, `apps/web/e2e/analytics-guide.spec.ts` (new), `docs/spec/parity.yaml` (`m4a.guide`: done), the fragment.

**The content rule.** The key's `extra` is our table of contents, **verbatim and in order** (36 headings). Each heading
is one entry; the body is **our own plain-English statement of the rule**, written from this plan and the engine, never
copied from the platform's Guide page; the platform's sections are the checklist of what each entry must say. An entry
names the registered figures it explains and links each to its real route
(`/analytics/<group>?screen=<screen>`); an entry may name no figure when it states a shared rule (ground rules,
available hours, cells and the No cell row, sorting, the export), and the test only requires every figure to be
explained once, not every entry to carry one. Five entries describe a feature this build does not have and print the
"not in this build yet" line instead of a rule: "31. PM Calendar" (M4b 49/50), "32. OEM Analytics" (deferred, triage),
"33. Learning from your corrections" (not built), "34. Entries with no maintenance code" (M4b 47), "35. AMC, extended
warranty and legal compliance" (M4b 51). "13. Excel export and restore" explains the export we do have and says the
restore is the M5 importer.

**Acceptance.** `expect(GUIDE_ENTRIES.map((entry) => entry.titleKey)).toEqual(GUIDE.extra.map(keyOf))` — the 36
headings, in order, resolved through the en catalogue; every `FIGURE_KEYS` entry appears in exactly one entry's
`figures` (a test over the registry, so a new figure cannot ship unexplained); every figure in an entry links to a
route whose group actually holds its screen (`groupOfScreen`); every entry has at least one body paragraph; the five
unbuilt entries are the only ones with `built: false`. The journey opens `/analytics/guide`, reads the header for
"14. Reports (Monthly and Annual)" and follows its link to `/analytics/reports`, then follows a second entry's link to
the dashboard.

**Red/green.** Red: `pnpm exec vitest run apps/web/src/screens/analytics/guide-entries.test.ts` (the module does not
exist). Green: the named file, `pnpm exec vitest run apps/web/src/screens/analytics`,
`pnpm exec playwright test apps/web/e2e/analytics-guide.spec.ts`, `pnpm precheck`.

## Integration and rails

- **Merge order.** 45a → 45b → 45c-1 → 45c-2 → 45d → 45e → 45f. 45c-1 and 45c-2 touch different trees and may run in
  parallel once the ADR is merged. 45e may start once 45a and 45b are on `main` and finishes with 45d's routes. 45f is
  last because its export entry links the button 45e adds.
- **Parity flips.** `m4a.workbook-export` in 45d; `m4a.monthly-report` and `m4a.annual-report` in 45e; `m4a.guide` in
  45f. Each PR keeps the evidence line at the fixture and adds the test path in the fragment.
- **Rails.** One writer per packet; red first; never weaken a test; file ≤ 400 lines, function ≤ 60, screen ≤ 300; no
  new dependency except the ADR's decision; whole-key `toEqual` with no tolerance and no re-rounding; derived drill
  ids, every one a real row; each packet appends one section to `changes/45-reports-guide.md` and the orchestrator
  keeps all sections; no code copied from the discovery file.
- **Not in this ticket.** The monthly report's headline tiles, insight lists and recommended-focus prose; month-to-date
  and past-month pickers; a commentary that persists; a restorable backup workbook; the `DOC. NO.` header line; PDF
  page numbering; the cell-change-log export moving from CSV to xlsx (the ADR settles that xlsx is available; the
  switch is a follow-up PR on ticket 39's screen, not here).

## Open questions (each with its settlement point)

1. **The reports' headline tiles and insight sentences are not in either key.** The keys hold no KPI and no prose, so
   the figures and the screens ship without them rather than inventing numbers. Settled by: Nimish at the M4a gate
   (does the printed report need them?); a regenerated key that captures `.rp-tiles`, `.rp-headline` and the insight
   lists would let a later packet build them exactly. Cost if wrong: the printed report opens with its tables instead
   of eight headline numbers.
2. **Month-to-date and a month/year picker.** The platform defaults to the current, in-progress month; the key pins the
   last complete month. This ticket ships the complete month and the year to date, and the PDF/export routes take an
   `asOf`, so a picker adds `month=`/`year=` to those routes and a control to one screen. Settled by: N12 with Bhavin
   (does he ever print a partial month?).
3. **Management commentary and actions.** The platform lets a person type commentary and actions, prints them and never
   saves them; the key holds the blank five-row form. We print the blank form and offer no inputs rather than ship an
   input that loses data. Settled by: Nimish (should commentary persist with the month?). Cost if wrong: one input form
   and one saved record per report.
4. **The workbook's `App Settings` sheet is not written (17 of 18 sheets).** Our settings live in typed tables, not one
   JSON blob, and nothing in our product would read that sheet back; the platform's 52 rows are its own backup.
   Settled by: Nimish/N12 (must the export be a restorable backup?). If yes, that is the M5 importer, not this ticket.
5. **The controlled-form header has no `DOC. NO.` row.** The platform prints `DOC. NO.- CE-MTN-F-01` (lists) and
   `-F-04` (breakdown history) from Cosmos's own form numbering; we have no form-reference field and another plant's
   number would be wrong on our sheet. Our row 1 is the tenant's name and row 2 the record title. Settled by:
   Nimish/Bhavin at N12; adding a tenant profile field is a small settings ticket.
6. **The Breakdown Log's `Ticket No.` repeats `Ticket ID`.** Our schema has one ticket reference; the platform's
   separate ref has no column. Recorded in the fragment as a deviation; settled by M4b 47 when closes get refs, or a
   later schema ticket if Bhavin needs both printed.
7. **The PDF has no page numbers or running footer.** Chromium's `--print-to-pdf` cannot number pages, and the
   platform's footer comes from jsPDF. Settled by: a visual check at the M4a gate (Nimish); a small second pass over
   the rendered PDF is the follow-up if he wants them.
8. **The Guide's 36 entries are new user-facing copy.** The rules are the engine's and this plan's; the wording is ours
   and needs a read. Settled by: Nimish's copy read at the gate (the gu catalogue stays blank, like every other M4a
   namespace). Not a blocker: the coverage test, not the prose, is the acceptance.
