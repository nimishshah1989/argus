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
