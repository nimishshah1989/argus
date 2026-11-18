# 41h — the shared seam for ticket 41

**What changed for a user:** nothing visible yet. This is the seam that lets A4 (manpower), A5 (energy), A6 (Why-Why)
and A10 (problem analysis) reproduce their frozen answer keys exactly: the Settings team list reaches the engine
(`teamCodes`), the plant's problem groups and their nine families are typed and overridable (`problemGroups`), the
ticket-36 Why-Why record reaches the engine (`whyWhy`), and the four keys have typed readers. `problemGroupOf` behaves
exactly as before.

**The one assumption worth a reviewer's time (R8).** The answer-key pseudonymiser maps every written form of a name
(short and full) to one `Person NN`, but the platform attributed a breakdown only when the team member's full name
appeared. Nine mentions are therefore over-attributed by an exact code match. The repair is fixture-side:
`fixtures/answer-key/person-mentions.json` gives each mention its own code and keeps its printed name, so no production
rule changes (the live plant has full names) and no key byte changes. Evidence: the staging discovery pack's workbook,
its `Breakdown Log` sheet against its own `Analytics 4 - Manpower` sheet over 1,279 rows. The seam test asserts the map
is **applied**, so shipping the file without applying it is red here rather than late in A4.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-workers.test.ts` (12 new tests: 14 team
codes in settings order, 24 groups with their nine families in the platform's order, the four keys' shapes, A5's 20%
factor, the nine mention slots and their printed names, every report name resolving to a person row, an empty Why-Why
seam). Red first: 11 of 12 failed before the source edit (missing fields and readers). Green:
`pnpm exec vitest run packages/domain/test` — 25 files, 364 tests (352 before). `pnpm precheck`: 13 checks pass.

**No parity:** fixture-side R8 repair; no parity row changes (parity reports 119 rows, 0 problems). The parity tool
gains the same data-file exemption `input.json` already had, for `person-mentions.json`.

**Deviations recorded.** (1) `keys.ts` also holds the three key-shape types, because `KeyFigurePage`/`FigureKey` are
typed in terms of them and leaving them behind would make a module cycle; `fixture.ts` re-exports them, so no import
changed. (2) The parity tool's data-file exemption (above). (3) The R8 file and README describe the name forms in
words, not as examples, because the repo forbids real personal data in the repo and `pnpm pii:scan` enforces it; the
nine ids, fields, tokens and codes are exact.

## 41a — A4 manpower

**What changed for a user:** the A4 Manpower Efficiency page is now computed — the three KPIs (1,279 breakdowns
printed bare, 3,060.1 BD hours, 14 team members), the Manpower table, the PM month-on-month pair rows with their two
PLANT TOTAL rows, Specialization, the two month-on-month matrices and the bar chart. It drills to the production
non-PM breakdown tickets.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-manpower.test.ts` (5 new tests): the
whole page is `toEqual(A4)`; the drill count is derived from `ENGINE_DATA` and every id is a real ticket; a fresh
copy of a real breakdown on an excluded machine leaves the whole page and the drill byte-identical (the production
filter bites); reversing `settings.teamCodes` reverses Specialization and both BD month matrices while the Manpower
table stays sorted by done count; an empty plant (no production breakdown or no team) prints `null`. Red first,
before the computer was registered: four failed with status `not_computed`, and the settings-order test threw
`the A4 page holds no table titled ...` because the value was null. Green: the named file (5/5), then
`pnpm exec vitest run packages/domain/test` — 26 files, 370 tests.
The suite grows by six, not five: the new source file also adds one case to
`analytics-engine.test.ts`'s purity list; the pre-existing 364 all stay green.

**Deviations recorded.** (1) The Specialization columns come from the production fleet's distinct
`MachineRow.category` values in data order (Robot dropped, case-insensitive), because the 41h `EngineSettings`
seam carries no category list. This is a KNOWN PLATFORM DIVERGENCE: the platform prints every
`settings.categories` entry except Robot — including a category with no machines, as an all-dash column — while
this figure would omit that column until the plant category list reaches the engine. On this key the derived list
is exactly the workbook's 14 `settings.categories` without Robot, in order, so the key is unaffected (14 columns
identical). The divergence is recorded in `docs/plan/DEBT.md` and the ledger by the orchestrator. (2) A column label
is shortened only when it is longer than 12 characters (`slice(0, 11) + '…'`), not when it is longer than 11: the
key prints `WaterJet CNC` (12) whole, and the committed
platform source uses the same `>12` test. (3) "No drill id is a report id" cannot hold literally: the history
workbook uses one id for both a report and its ticket (1,283 of 1,350 rows). The test asserts no drill id is a
report-only id (one of the 67 live rows whose report id differs from its ticket id), while every drill id is a real
ticket. (4) The two BD month matrices read the year of `asOf` (the platform's `calcAnalytics4(year)` passes it to
`filterBD` for `momCount`/`momHours`); every fixture row is 2026, so the key is identical either way, and the
Manpower table, Specialization and chart still read the whole log as the platform does. (5) The PM PLANT TOTAL hours
are the sum over the Settings **team order**: the platform reduces its `momPMHours` rows in team order, and this
code does the same. The key's May cell (48.0) and its PLANT TOTAL total (1,511.2) both match.

## 41h-2 — the plant lists on the seam (closes the A4 category divergence)

**What changed for a user:** nothing visible yet on this packet alone — but the shared engine seam now carries the
plant's three Settings lists in their own order: `EngineSettings.categories` (all 15, Robot included), `cells`
(`1`…`9`) and `locations` (`434`, `435/4`, `445`, `486`, `841-A`, `841-B`, `381`). A4's Specialization now
reads the category list, so a category the plant configured but no machine carries prints its all-dash column, as
the platform does; the fleet's first-appearance order is only the fallback when the list is absent. The A4 key page
is byte-identical (the plant list minus Robot is exactly the 14 key columns, in order), so nothing on screen moves
today. **This closes the A4 category divergence recorded in `docs/plan/DEBT.md`;** the orchestrator removes the row.

**Tests that prove it.** The 41h seam test file gains one test: `ENGINE_DATA.settings` carries the three lists in
workbook order — 15 categories starting `Turning Center` and containing `Robot`, the nine cells and the seven
locations exactly. Red first: that test failed with `expected undefined to deeply equal [...]` before the seam
edit (1 failed / 12 passed). `analytics-manpower.test.ts` gains one closure test: a synthetic run whose
`settings.categories` appends `5-Axis Router` (no machine carries it) prints that all-dash column last, and the
rest of the page equals the key whole. The fleet-derived list could not produce that column, so the test is red
against the old rule by construction. Green: `pnpm exec vitest run
packages/domain/test/analytics-workers.test.ts` (13/13) and `pnpm exec vitest run packages/domain/test` — 26
files, 372 tests (370 before plus the two new ones).

**Files.** `packages/domain/src/analytics/types.ts` (three additive optional fields), `test/answer-key/fixture.ts`
(fills them from `workbook.settings`), `test/answer-key/workbook.ts` (the workbook's settings type gains the three
lists it already held), `src/analytics/a4-manpower.ts` (settings categories, fleet fallback),
`test/analytics-workers.test.ts` and `test/analytics-manpower.test.ts` (the two tests).

**Deviation recorded.** `test/answer-key/workbook.ts` is touched (not named in the packet) because it is the typed
shape of `input.json`: the fixture cannot read `workbook.settings.categories` without it. It is a test-only source
type, and the JSON already carried the three lists.

## 41b — A5 energy heatmap

**What changed for a user:** the A5 Energy Heatmap figure is now computed — the empty page, the two heat grids (by
cell and by location) and the plant's efficiency factor (20%), exactly as the 11 November key has them, raw floats
included. This is the one analytics fleet that counts every CNC machine rather than the production fleet: the
excluded BOXY is in cell 1 of the key, so 126 machines drill.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-energy.test.ts` (5 new tests): the
whole value is `toEqual(A5)` including `extra`; the computer names all 126 CNC ids in data order and the engine's
reply is that set sorted (the engine sorts every drill); giving one CNC machine `metadata.efficiency = 50` leaves
its cell's connected load unchanged while running load rises by exactly `power × (0.5 − 0.2)` (the 11 Nov rule the
committed workbook lacks); blanking one machine's cell adds a last `—` bucket with that machine while it keeps its
location bucket; a plant with no CNC machine prints `null`. Red first: 5 failed as `not_computed`, because the
computer was not registered. Green: the named file 5/5, then `pnpm exec vitest run packages/domain/test` — 27
files, 378 tests (373 before, plus the 5 new tests).

**Files.** `packages/domain/src/analytics/a5-energy.ts` (new, 117 lines), its `computers.ts` entry,
`packages/domain/test/analytics-energy.test.ts` and this fragment.

**Notes recorded.** (1) The plan says the 11 Nov discovery file is not committed; it is tracked here
(`docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html`, 3,776,090 bytes, added in #75). It was read as
reference only to confirm two behaviours the plan leaves implicit: a Settings cell or location with no machine still
prints a zero bucket, and a machine cell outside the Settings list groups under `—` last. Both follow from the
plan's rules; no code was copied. (2) When `settings.cells` is absent no cell is known, so every CNC machine falls
in the `—` bucket; when `settings.locations` is absent there are no location buckets. That is the literal reading
of the stated rules (and the platform's `groupBy`); the key always carries both lists.

## 41c — A6 Why-Why figure

**What changed for a user:** the A6 Why-Why Analysis page is now computed — one table, "Why-Why (Root Cause)
Analysis", of the 24 production breakdowns whose recorded hours pass the plant's 12-hour threshold, worst first,
with the machine code, the plant date, the problem text, the hours to 2 dp, the status and the platform's action
button. The hours are the raw recorded column, so the NO-DT row VC-23 (23-08-2026, 59.98) is the sixth candidate
rather than a zero. Every row starts "Not Started" / "Start Why-Why"; a saved Why-Why record for a ticket turns
exactly that row "Completed" / "View / EditPDF". The figure drills to the candidate tickets.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-whywhy.test.ts` (3 new tests): the
whole value is `toEqual(A6)`; the drill ids equal the candidate tickets derived from `ENGINE_DATA` (24, unique,
sorted, every one a real ticket, the sixth a NO-DT row at 59.98); adding one synthetic `whyWhy` row for the first
candidate turns only that row's Status and action cells to "Completed" / "View / EditPDF", leaves every other cell
and the header untouched, and leaves the drill unchanged. Red first, before the file existed: 3 failed (1 file, 3
failed / 0 passed) — `expected 'not_computed' to be 'ready'`, `expected [] to deeply equal [ 'bd_muxluada16moi',
…(23) ]`, and `TypeError: Cannot read properties of null (reading 'pages')` because the value was null. Green:
the named file 1 file, 3 tests passed; then `pnpm exec vitest run packages/domain/test` — 28 files, 382 tests.
The suite grows by four, not three: the new source file also adds one case to `analytics-engine.test.ts`'s purity
list; the pre-existing 378 all stay green. `pnpm precheck`: all checks pass.

**Files.** `packages/domain/src/analytics/a6-why-why.ts` (new, 92 lines), its `computers.ts` entry (and the
owner-41 comment now says A10 lands in 41d), `packages/domain/test/analytics-whywhy.test.ts` and this fragment.

**Deviations recorded.** None. The candidate rule (production, non-PM, raw hours strictly over the threshold,
stable worst-first sort), the completed rule (any saved record for the ticket; the latest by completed date when
several exist — which cannot change this page, because only the record's presence moves a cell) and the empty-plant
rule (no candidate prints `null`) follow the slice plan verbatim.

## 41c-2 — the saved record and its PDF

**What changed for a user:** a supervisor, head, plant head or admin can now save the Why-Why of a closed breakdown
(five whys and a required conclusion) and open it again later; the save is one append-only `why_why` line in the
ticket's history, so the ticket home keeps every draft and the latest one is what the screen reads. The A6 figure now
marks that ticket `Completed` / `View / EditPDF`, and the sheet prints as a PDF named
`WhyWhy_<machine>_<date>.pdf` with the machine, breakdown date, down hours, the five whys, the conclusion and the
author's coded name and completion date. Technician, operator and board logins are refused by name; another plant's
ticket is `not_found`; a ticket that is not a closed breakdown is `409 not-a-breakdown`.

**The contract.** `packages/shared/src/why-why.ts`: `whyWhyPayloadSchema` (five whys of at most 2,000 characters
each, blank allowed; a required 1–2,000 character conclusion; `completedBy` a uuid; `completedDate` a
`calendarDay`) and `whyWhyWriteSchema`, the save body without the author and date. The server derives both from the
session and the plant clock, so a body that tries to set either is a 422 naming that field.

**Guard (R2/R3).** Read, write and PDF all use `canAnalytics` (supervisor, head, plant_head, admin). The write also
needs the acting person; a session with none is `choose_acting_person`. The append's own `WHERE kind = 'stopped' AND
status = 'closed'` is the race-safe half of the guard: an event is only written for a closed breakdown, and the
update of the ticket's event counter is the lock that gives each event its `seq`.

**Tests that prove it.** `pnpm exec vitest run apps/server/test/why-why-write.test.ts
apps/server/test/why-why-figures.test.ts apps/server/test/why-why-pdf.test.ts` (15 tests): null then the saved
record, two saves appending and the latest answering; the author and date coming from the session (a body field is a
422); missing/blank/over-long conclusions and the wrong number of whys refused; the four analytics roles saved and
technician/operator/board refused by exact message; open and support tickets 409; unknown and other-tenant tickets
404; the figures reply turning the candidate `Not Started` into `Completed` and the loader holding one row per
ticket with the latest conclusion and a `P-` person code; the PDF's decoded text layer carrying machine, date,
`13.00` hours, the five whys, conclusion, coded author and completion date. Red first: the routes did not exist
(`GET/PUT …/why-why` answered 404, and `EngineData.whyWhy` was `undefined`); the PDF case could not even save
before the routes. Green: the three named files, 15/15; with `reply-contract` (the three new routes take its pinned
count from 128 to 131), 4 files, 23/23; and the whole server suite `pnpm exec vitest run apps/server/test` — 127
files, 1,510 tests passed. `pnpm precheck`: 13 checks passed (the web warnings are pre-existing).

**Files.** `packages/shared/src/why-why.ts` (new), its `index.ts` export, the reply schemas in
`packages/shared/src/replies.ts`; `apps/server/src/modules/tickets/why-why.ts` and `why-why-routes.ts` (new), the
`repo/events.ts` queries, the tickets register and index; `apps/server/src/modules/reports/why-why.ts` (new
template and PDF route) registered by the reports module; `apps/server/src/modules/analytics/load.ts`; the
`personCode` helper moved to `identity/repo.ts` (its old home was the analytics loader) so the loader and the PDF
print the same code; `apps/server/test/pdf-text.ts` gains `pdfText` (the ordered text layer the PDF test reads);
`apps/server/test/reply-contract.test.ts` (the route count); the three new test files and this fragment.

**Deviations recorded.** (1) The PDF route is registered by the **reports** module, not by the tickets module: the
module manifest lets reports call tickets but not the reverse, and reports already owns every PDF route. The read and
the write stay in `tickets/why-why-routes.ts` as the plan asks. (2) The 409 refusal is `apiError('conflict',
'not-a-breakdown')`: the shared error code stays `conflict` and `not-a-breakdown` is the stable message, because
the plan names that string and adding an error code would change the whole reply contract. (3) A PDF is also 409 when
the ticket has no saved record (`This ticket has no saved Why-Why`); the plan is silent, and the platform's PDF button
only appears on a saved row. (4) When a closed breakdown has no report, the sheet falls back to the ticket's own
plant date and recorded minutes; the plan's candidates always have a report, so this only keeps the guard's promise
that any closed breakdown can be saved and printed. (5) `personCode` moved to identity (one definition, no
duplicated formula); it changes no behaviour and no caller outside the server.

## 41d-1 — A10 core: grouping, families, repeats, words

**What changed for a user:** nothing visible yet. This is the Problem Analysis core the A10 page will print: every
production, non-PM breakdown becomes one event (grouped by the plant's manual fix, else the group list's keywords over
the problem text, then problem + corrective action, else `Other / unclear`), and four aggregations are computed — the
24 groups (count, hours, machines, quick stops, hours each), the nine families with their groups in encounter order,
the 74 machine-and-group repeats of four or more, and the 14 words the unplaced entries share. No figure is registered
and `computers.ts` is untouched: 41d-2's `a10-problems.ts` assembles and registers the page from this result.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-problems.test.ts` (7 new tests): key
tables 0, 1, 2 and 4 compared row for row — the 24 groups with family/count/%/hours/hrs-each/machines/quick, the nine
families with the group order inside, the 15 printed repeat rows, and the 14 words with their example problem; the
repeat list's length (74) derived from the events' machine-and-group pairs; events one per breakdown ticket, sorted by
key then date, with repeated keys kept (merging off); the three plant fixes move exactly three entries out of
`Other / unclear` when removed; a plant-edited group list is read, and a fix naming a removed group no longer applies.
N (1,279) and the total hours (3,060.11) are derived from `ENGINE_DATA`, never literals. Red first, before the module
existed: `Test Files 1 failed (1)`, `Tests no tests`, `Error: Cannot find module
'../src/analytics/problem-analysis.js'` (0 passed). Green: the named file 7/7; then
`pnpm exec vitest run packages/domain/test` — 29 files, 390 tests (382 before: the 7 new tests plus the purity case
the new source file adds to `analytics-engine.test.ts`). `pnpm precheck`: all checks pass.

**Files.** `packages/domain/src/analytics/problem-analysis.ts` (new, 353 lines), a third optional parameter on
`problemGroupOf` in `problem-groups.ts`, `packages/domain/test/analytics-problems.test.ts` and this fragment.

**Deviations recorded.** (1) `problem-groups.ts` is touched (not in the packet's file list): `problemGroupOf` gains an
optional `groups` list so the plant's edited list is classified by its own names and keywords (R7) and a fix naming a
removed group is ignored, as the platform's editor does. The default is `PROBLEM_GROUPS`, so `dashboard-flags.ts` is
unchanged and no existing caller or number moves. (2) The analysis takes `EngineData` only, not a profile: nothing A10
prints reads a profile field (`AnalyticsProfile` holds none for ticket 41's problem page), so 41d-2's page computer
receives the profile as every computer does and passes only the data here. (3) The module exports the platform's
aggregation (events and the four stats), not printed table rows: 41d-2 owns the page's cells and titles, and the test
formats the four tables with the platform's own `formatPercent`/`formatNumber` to prove they equal the key. (4) The
`Other / unclear` pseudo-group is not in `PROBLEM_GROUPS`, so its family `Other` is set in `problem-analysis.ts`;
the platform's own classifier returns `f:'Other'` for it. (5) A repeat row prints the machine **code**, as A6 does; the
fixture's machine id and code are equal, so the key is unaffected. (6) An empty group list in Settings is treated as
"not edited" (the platform default), as `probGroups()` does; the plant's editor never saves an empty list.
