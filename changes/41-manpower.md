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

## 41d-2 — A10 page, charts and the suggested-group card

**What changed for a user:** the A10 Problem Analysis page is now computed whole and equals the frozen 11 November
key: the eight KPIs (breakdowns studied, top problem group, quick stops, repeat problems, then the "what if we cut a
problem?" figures — 242 hrs saved, 52 breakdowns avoided, plant availability 99.50% "was 99.46% (+0.04 points)", MTBF
459 hrs "was 440 hrs", from the top group at 50% against the production fleet's available hours from 1 January to the
run date), the six tables (groups, families, the 15 repeat offenders, the 31 unplaced entries with their suggested
group and Accept cell, the 14 words, and the group editor's own rendered cells) and the two charts (the 16-bar Pareto
with the platform's double-spaced labels and its bubble chart of every group). Every registered figure of owner 41 now
answers ready; A10 drills the 1,279 production non-PM tickets.

The unplaced card's suggestions are the platform's Naive Bayes, ported in problem-suggest.ts: word and bigram
features, the ML_STOP set, the platform's stemmer, multinomial Laplace (a = 0.5, V = vocabulary), log(n_label/N)
priors and a softmax, with ties kept in the plant's group order. It learns from the 1,248 entries the keyword rules or
a plant fix placed (a model is made only at 40 or more) and reproduces all 31 of the key's suggestions, labels and
rounded percentages. Its 5-fold accuracy (i % 5 folds) is 76%.

**Tests that prove it.** pnpm exec vitest run packages/domain/test/analytics-problems.test.ts (11 tests: the 7 41d-1
tests unchanged plus 4 page tests): (1) expect(computed.value).toEqual(A10) for the whole page, plus the key's own
counts (8 KPIs, 6 tables, 2 charts) restated; (2) the drill is the production non-PM tickets derived from ENGINE_DATA —
1,279, unique, sorted by the engine, every id a real ticket; (3) the classifier trains on the derived placed count
(1,248, never a literal) and cross-validates at 76%; (4) a mutation that drops the plant's manual fixes
(settings.problemFixes = {}) makes the page unequal to the key, grows the unplaced card by exactly the three fixed
entries and moves one entry out of each fixed group into Other / unclear — the fix path bites, and the key is never
weakened. Red first, before problem-suggest.ts existed: "FAIL packages/domain/test/analytics-problems.test.ts",
"Error: Cannot find module '../src/analytics/problem-suggest.js' imported from ...", "Test Files 1 failed (1)",
"Tests no tests". Green: the named file 11/11; then pnpm exec vitest run packages/domain/test — 29 files, 396 tests
(390 before: the 4 new page tests plus the two purity cases the two new source files add to analytics-engine.test.ts).
pnpm precheck: 13 checks passed.

**Files.** packages/domain/src/analytics/problem-suggest.ts (new, 222 lines), a10-problems.ts (new, 370 lines, under the
400 budget), the computers.ts entry (and the owner-41 comment now names all four figures),
packages/domain/test/analytics-problems.test.ts and this fragment. No new dependency; no other source touched.

**Deviations recorded.** (1) The key holds no description slot (page keys are page/title/kpis/tables/charts; tables
are title/header/rows/rowCount), so the model metadata the platform's card description prints — 1,248 training entries
and 76% accuracy — is computed and exported by problemTraining, while the page carries no prose; adding a description
would break the exact toEqual(A10) acceptance. This follows the R9 precedent (nothing fabricates text the key does not
hold) and was confirmed with the orchestrator; the 41e-2 screen will print no model-description prose, and the
orchestrator records the DEBT/ledger ruling after merge. (2) The what-if's available hours read the production fleet
(isProduction: CNC, not excluded) as the platform's nonRobotMachines does over its CNC state.machines;
EngineData.machines also carries the conventional, process, utility and DG registers, which the platform keeps in
separate lists and no availability sum reads. The key's 99.46% before / 99.50% after / 440 and 459 MTBF pin this. (3) A
softmax tie would keep the plant's group order (the plan's rule); the platform's label insertion order differs only on
an exact tie, and this key has none (31/31 suggestions and the 76% accuracy are identical under either).
