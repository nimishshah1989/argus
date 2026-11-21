# M4a-41 — Manpower, energy, root cause (ticket 41)

Ticket 41: [Engine] "A4 manpower, A5 energy heatmap, A6 Why-Why and A10 problem analysis match the answer key."
[Browser] "Their screens have sortable tables; a Why-Why record is saved in its home from 36 and prints as PDF."
Acceptance: `fixtures/answer-key/{a4-manpower,a5-energy,a6-why-why,a10-problems}.json` — **whole figure, no
tolerance, no re-rounding** — and every drill id a real row. Registry rows already exist (`analytics/registry.ts`
lines for owner 41). `parity.yaml` rows exist (`m4a.a4-manpower` … `m4a.a10-problems`). Write areas: engine packets
touch `packages/domain/src/analytics/*` + `packages/domain/test/*`; 41c-2 touches
`apps/server/src/modules/{tickets,reports,analytics}` + `apps/server/test/*` + `packages/shared/src/*`; the two
screen packets touch `apps/web/src/screens/analytics/*` + `apps/web/e2e/*` + `docs/spec/parity.yaml`.

## Authority, and the source the key actually came from (ruling R1)

The key's platform is **the 11 Nov build**, and it is tracked in this repo at
`docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` (3.7 MB, MD5 `896faf97429d976903f0645c8c6d3d74`;
the workbook is beside it, and `tools/answer-key/generate.ts` reads through `ROOT = 'docs/discovery/real-2026-11-13'`).
The staging checkout carries the same files. The committed
`docs/discovery/source/cosmos_platform.html` is a **different build**, and every rule below was checked against both.
Its two material divergences — which the key follows the 11 Nov build on — are called out in 41b (per-machine
efficiency) and 41d (the suggested-group card); the plan states both rules in full, so no packet needs the file. The
13 Nov export is left untouched.

Line anchors in the 11 Nov file: `fmtNum/fmtPct` 687–688, `availSum` 847, `filterBD` 964, `sumHrs` 987,
`nameInField` 1257, `effDefaultPct/machEffPct` 1272–1280, `calcEnergyHeatmap` 1291, `calcAnalytics4` 1315,
`let a4Year` 3534, `getWhyWhyCandidates` 3602, `renderA6` 3608, `renderA5` 3736, `PG_DEFAULT` 6318,
`probCompile/Classify` 6347–6352, `probEvents` 6359, `probCalc` 6373, `probWhatHtml` 6409,
`probPareto` 6421, `probScatter` 6435, `probWords` 6449, `renderProblems` 6466, `probEditHtml` 6530,
`ML_STOP/ml*` 7661–7694, `probClassifyB` 7695, `mlProblemModel` 7699, `probMlList/Card` 7712–7718,
`renderA4/A4Spec` 9955/10064.

## Shared rules (settled once in 41h, reused by every packet)

- **The production fleet is the CNC segment, excluding the plant's excluded machines** — ticket 40's `isProduction`
  (`machine-facts.ts`). A4, A6 and A10 read `sourcedReports` filtered to production and not PM: **1,279 reports,
  3,060.11 recorded hours** on this key. (The 7 live `otherBD` rows sit on non-CNC machines — PCM-01, COMP.-01,
  COMP.-05, ITL-01 — so the production filter and the history-only rule give the same 1,279.) **A5 is the exception**:
  it reads every CNC machine, **126, the excluded BOXY included** (key cell 1 lists BOXY), because the platform's
  energy page reads its machine list, not its production data.
- **Hours are recorded hours**, never `downMin/60`. Two selectors, and a figure must say which: the **effective**
  one is `hours.ts` `effectiveHours` (NO DT → 0; used by A4's and A10's totals), while **A6 reads the raw column**
  (`ReportRow.recordedHours`, falling back to `downtimeMin/60`) so a NO-DT row keeps its value — the key's sixth
  candidate (VC-23, 23-08-2026, `59.98`) is exactly such a row, and using the effective selector there gives 23
  candidates instead of 24 and a `0.00` cell. PM is excluded from every breakdown figure. Sums use the platform's own
  order (`evs`/`bdAll` order), because float addition order is visible in the key (A10 group hours).
- **Names are codes.** `ReportRow.doneBy`/`supportedBy` are person codes; `PersonRow.displayName` is the coded name
  the platform printed (`Person 11`, `Imptex Team`). A4 tracks the plant's **team list** — `EngineSettings.teamCodes`
  (settings order; the fixture reads `workbook.settings.team`, 14 members including the vendor and inactive ones,
  exactly as the platform keeps them "for historical completeness"). Absent, it falls back to every person whose
  `team` is `maintenance` or `vendor`. Type text: `Vendor` when `person.team === 'vendor'`, else `Team`.
- **Formatting** is the platform's own: grouped numbers via `formatInr` (the key's locale is `en-IN`; `3,060.1`),
  percentages via `formatPercent` (`15.40%`), A6 dates `DD-MM-YYYY`. A 0 prints `—` only where the platform
  printed `—` (the matrix cells below); never re-round a printed number.
- **Free-text cells are the platform's rendered text**: whitespace runs collapsed to one space and trimmed (the key
  generator normalises labels; the platform printed HTML). That applies to A6's `Problem`, A10's `Problem`/`Action
taken` (collapse **then** slice to 110 chars — verified on all 31 unplaced rows) and the words table's example
  problem. Everything else is already single-spaced.
- **A number the platform passed to a KPI unformatted prints bare** (`1279`, no grouping); a number it formatted
  prints through `formatInr`. The two are different and the key pins both (A4's `Total Breakdowns` is `1279`).
- **Every figure drills.** A4 → the 1,279 breakdown tickets. A5 → the 126 CNC machine ids. A6 → the candidate
  tickets. A10 → the 1,279 breakdown tickets. The engine sorts and dedupes the ids itself; a figure names its rows,
  never their order.
- **Empty plant → `null`** and the only honest placeholder is "Not computed yet"; never a fabricated number.

## 41h — the shared seam (one PR, first, one writer)

`EngineSettings` gains `teamCodes?: readonly string[]` (the Settings team list, in its order) and
`problemGroups?: readonly ProblemGroup[]` (the plant's edited list; absent = the platform default). `EngineData` gains
`whyWhy?: readonly WhyWhyRow[]` — `{ ticketId, whys: readonly [string,string,string,string,string], conclusion,
completedBy: string, completedDate: string }`, the ticket-36 home's payload (`ticket_event` type `why_why`) with the
author and plant date beside it. `problem-groups.ts` gains the platform's **family** per group and exports the
other/unclear name. The keywords and order already match the platform; the family is the only new field, exactly:
Crashes and setup (Machine accident / crash) · Other (PM logged as a breakdown, Installation / relocation / trial) ·
Tool changing (Tool-change arm stuck (ATC), Magazine / tool pot, Tool clamp / unclamp / drawbar, Tool-change error
(general)) · Rotary and 4th axis (4th axis / rotary / angular head) · Axis, drive and geometry (Axis motor / drive /
encoder / servo, Home position / geometry / backlash) · Fluids and chips (Coolant leakage, Coolant pressure / flow, Air
leakage / low air pressure, Conveyor / chip jam, Lubrication / low oil, Hydraulic pressure) · Spindle, turret and chuck
(Spindle motor / overload / noise, Turret clamp / indexing, Chuck / jaw / collet) · Electrical and controls (Door /
guard / limit switch / sensor, Push button / switch / cable / panel, Fan / filter / overheating, Alarm / PLC /
parameter / reset) · Mechanical wear (Belt / bearing / coupling / wear). The answer-key seam moves its typed readers into
`packages/domain/test/answer-key/keys.ts` (fixture.ts is at 374 lines of its 400 limit) and adds `A4`, `A5`, `A6`,
`A10` readers; `ENGINE_DATA` fills `teamCodes` from the workbook's settings team and `whyWhy: []`. New
`packages/domain/test/analytics-workers.test.ts` proves the seam itself: 14 team codes in settings order, 24 groups in
the platform's order with their families, the four keys load with their page/extra shapes, A5's `effFactorPct` is 20,
**and the R8 map is applied** — the nine `ENGINE_DATA` report/field slots carry their mention codes
(`person-26-mention` twice in Done By and three times in Supported By, `person-55-mention` once in each,
`person-79-mention` twice in Done By) and each mention `PersonRow` keeps its printed `displayName` (`Person 26`,
`Person 55`, `Person 79`), so a 41h that ships the file without applying it is red here, not late in 41a.
**The A4 mention repair (R8), also settled here.** The answer-key generator's pseudonymiser maps every way a name is
written (short form and full form, any case) to **one** `Person NN`, but the platform attributed a
breakdown only when the team member's **full** name appeared in `Done By`/`Supported By` — so nine mentions in the
coded `input.json` are attributed by an exact code match that the platform did not attribute. Proved against the real
workbook (`docs/discovery/real-2026-11-13/cosmos-export-2026-11-11.xlsx`: its `Breakdown Log` versus
its own `Analytics 4 - Manpower` sheet, 1,279 rows; the real name forms are not written here, per the repo's
no-real-personal-data rule — the ids and codes below carry the repair). Five `Done By` mentions:
bd_muxluadanmqar and bd_muxluadbqozpr (both `Person 26`), bd_muxluadbag3ia (`Person 55`), bd_live_mw300wjpi9l77 and
bd_live_mw5w6eqlouq32 (both `Person 79`); four `Supported By` mentions: bd_muxluada1zas4, bd_muxluadalbfgk and
bd_muxluadbtrxho (`Person 26`), bd_muxluadb1zmxt (`Person 55`). The repair is a **fixture-side** map, `fixtures/answer-key/person-mentions.json`: report id + field

- coded token → its own code (`person-26-mention`, `person-55-mention`, `person-79-mention`) whose `PersonRow` keeps
  the original `displayName` (the log still prints `Person 26`). The fixture applies it while building `ENGINE_DATA`
  and `fixtures/answer-key/README.md` records why. It changes no production rule (the live plant has full names), no key
  byte, and no other figure (only A4 reads names for attribution). The planner proved the whole A4 page then equals the
  key: KPIs, all five tables and the chart, with no tolerance.
  **Files:** `types.ts`, `problem-groups.ts`, `test/answer-key/keys.ts`, `test/answer-key/fixture.ts`,
  `fixtures/answer-key/person-mentions.json` (new), `fixtures/answer-key/README.md`, `test/analytics-workers.test.ts`,
  fragment. Red first:
  `pnpm exec vitest run packages/domain/test/analytics-workers.test.ts` fails on the missing readers and fields. Green:
  same command; `pnpm exec vitest run packages/domain/test`.

## 41a — A4 manpower (one PR)

`a4-manpower.ts` (new): the key's page whole — 3 KPIs (`Total Breakdowns` = the count printed **bare** as
`1279`; `Total BD Hours` = the recorded-hours sum printed 1 dp; `Team Members Tracked` = the team-list length), 5
tables and 1 chart. It reads the mention-repaired fixture from 41h (R8), which is what makes the key reproducible at
all.
Rules, all from `calcAnalytics4`/`renderA4`:

- Manpower Table: rows **sorted by `doneCount` desc** (stable); columns `# BD (Done By)`, `BD Hours (Done)` 2 dp,
  `Avg MTTR` = `doneHours/doneCount` 2 dp (0 when none), supported count, supported hours 2 dp, total
  involvement, `% of Total` = `doneCount/totalBD` via `formatPercent` (the total **derived**, never the
  literal 1,279). The 9 headers are the key's.
- PM Month-on-Month: PM rows are `isPM` only (NO-DT never), still production-filtered, filtered to the **year of
  `asOf`**; per member a **pair of rows** — the count row carries the name then Jan…Dec (`—` for 0) and its
  total; the hours row carries **no name cell at all** (the platform's rowspan drops it, so it is 13 cells: 12 months
  1 dp / `—` and the total) — sorted by the pair's **PM count total desc**, then the two `PLANT TOTAL` rows, the
  second of which is again 13 cells. Month columns Jan…Dec always printed.
- Specialization: 14 category columns = settings categories with `Robot` dropped (case-insensitive), header text
  **truncated to 11 characters + …** when longer; rows in **team-list order**; counts of non-PM production
  breakdowns per member per machine category. The code matrix is the same shape keyed by maintenance code
  (`codesUsed` = the distinct non-PM codes over **all** breakdowns, trimmed, sorted); only the category form is a key
  table, so the code form is the screen's extra tab, not a second key.
- Month-on-Month counts and hours: rows **team-list order**, `—` for 0 (count) / 0 (hours), `Total` column always
  printed.
- Chart `ch-a4-count`: bar, `labels`/`data` = the members with `doneCount > 0` in the table's sorted order, dataset
  label `# Breakdowns`, empty axes/tickLabels.
  **Files:** `a4-manpower.ts` (new), `computers.ts` spread, `test/analytics-manpower.test.ts`, fragment.
  **Acceptance:** `expect(figure.value).toEqual(A4)` — the whole key object, as every keyed figure's value is — the
  planner proved this
  equality holds under these rules with the R8 repair, so a failure here is a rule error, not a key defect; every drill
  id is a real ticket and its count is **derived**, not literal; a synthetic run with one excluded machine's row moves no
  A4 number (mutation proof that the production filter bites). Red: the named test. Green:
  `pnpm exec vitest run packages/domain/test`.

## 41b — A5 energy heatmap (one PR)

`a5-energy.ts` (new): the key's page shape (page `a5`, title `Energy Heatmap`, no kpis/tables/charts) plus
`extra: { byCell, byLocation, effFactorPct }`. **Per-machine efficiency is the 11 Nov rule the committed export
lacks**: `effPct(m)` = `clamp(0, 100, metadata.efficiency)` when the machine carries its own efficiency, else
`profile.efficiencyFactor`; `runningKva = Σ(power × effPct/100)` **per machine**, not `totalKva × eff` (the
key's `97.40000000000002` vs `97.4` is that difference and must be preserved); `avgRunningKva = runningKva/machines`;
`avgKva = totalKva/machines`; `effFactorPct = profile.efficiencyFactor`. `byCell` keys are the settings cells in
order, plus `—` **only when** a CNC machine has a blank or unknown cell (none on this key: the nine cells sum to
126). `byLocation` keys are the settings locations in order; a machine whose location is not listed belongs to no
bucket. `powerKw` missing/NaN → 0.
**Files:** `a5-energy.ts` (new), `computers.ts` spread, `test/analytics-energy.test.ts`, fragment.
**Acceptance:** `toEqual(A5)` on the **whole key including `extra`** (the raw floats); drill ids are the 126 CNC
machines. Red/green as 41a.

## 41c — A6 Why-Why figure (one PR)

`a6-why-why.ts` (new): page `a6`, title `Why-Why Analysis`, 1 table, no kpis/charts. Candidates = non-PM
production reports whose **raw** `recordedHours` (`recordedHours ?? downtimeMin/60`, NO DT **not** zeroed) is
**strictly greater than `profile.whyWhyThresholdHours`** (12 on this key → 24 rows, the sixth being the NO-DT
VC-23 of 23-08-2026 at `59.98`), **sorted by that raw value desc**; header `Machine`, `Date`, `Problem`,
`Down (Hrs)`, `Status`, `` (empty). Cells: machine code, `DD-MM-YYYY`, the problem text with whitespace runs
collapsed, the same raw value **2 dp**, `Not Started` or
`Completed`, and the action-cell text — `Start Why-Why` when not saved, `View / EditPDF` when saved (the
platform's two buttons concatenate, so the printed cell has no separator). A candidate is saved when
`EngineData.whyWhy` holds a row for its ticket; a later event wins over an earlier one.
**Files:** `a6-why-why.ts` (new), `computers.ts` spread, `test/analytics-whywhy.test.ts`, fragment.
**Acceptance:** `expect(figure.value).toEqual(A6)` — the whole key object, as every keyed figure's value is
(`{screen, asOf, pages}`); a second case adds a synthetic `whyWhy` row for the first candidate and the test asserts
only that row's status/action cells change (the completed-state rule); drill ids = the candidate tickets, all real.

## 41c-2 — the saved record and its PDF (one PR; server, R2)

The ticket-36 home is `ticket_event` type `why_why` (migration 0014, append-only; `m4a-schema.test.ts` pins it).
Payload keeps the home's shape and adds the author and plant date: `{ whys: [five strings], conclusion, completedBy:
person id, completedDate: plant date }` (ruling R2; a person is an id, never a name). New shared contract
`packages/shared/src/why-why.ts`: `whyWhyPayloadSchema` (conclusion 1–2,000 chars **required**, each why ≤ 2,000
and blank allowed, five entries, completedBy a uuid, completedDate a `calendarDay`). Routes, registered by the tickets
module: `GET /api/v1/tickets/:id/why-why` (latest record or `null`; 404 unknown or other tenant), `PUT
/api/v1/tickets/:id/why-why` (append; 201 with the saved record), `GET /api/v1/tickets/:id/why-why.pdf` (the
server-image PDF from `reports/pdf.ts` `renderPdf`, D25; filename `WhyWhy_<machine>_<date>.pdf`).
**Guard (ruling R3):** the read and the PDF need `canAnalytics`; the write needs `canAnalytics` too
(supervisor, head, plant_head, admin) — **technician, operator and board are refused with a named refusal**. The ticket
must exist in the tenant and be a **closed breakdown** ticket (else 409 `not-a-breakdown`) — the platform's
candidates are closed breakdowns. The author and date are derived from the actor and the plant clock, never taken from
the body. The analytics loader reads the latest `why_why` payload per ticket into `EngineData.whyWhy`, so the A6
figure shows `Completed` after a save.
**Files:** `packages/shared/src/why-why.ts` (new), its index export; `apps/server/src/modules/tickets/why-why.ts` +
`why-why-routes.ts` (new), tickets' register; `apps/server/src/modules/reports/why-why.ts` (new template) + its
route; `apps/server/src/modules/analytics/load.ts`; `apps/server/test/why-why-write.test.ts`,
`apps/server/test/why-why-pdf.test.ts`, `apps/server/test/why-why-figures.test.ts`, fragment.
**Acceptance:** a head saves a Why-Why on a closed breakdown and the figures reply marks that ticket `Completed`; the
PDF text layer carries machine, date, hours, the five whys, the conclusion, the author's coded name and the date; the
second tenant's token gets `not_found` for the same ticket; technician/operator/board get the named 403; a missing
conclusion is a 422. Red first: the routes do not exist. Green: `pnpm exec vitest run apps/server/test` (Docker).

## 41d-1 — A10 core: grouping, families, repeats, words (one PR)

`problem-analysis.ts` (new): the platform's event list and aggregation. Rules: **manual fix wins**
(`settings.problemFixes` by report id, a group name that exists), then the keywords of the group list in order over
the **problem text**, then over **problem + ' ' + corrective action**; unmatched → `Other / unclear`. Event key =
`machineId|normalise(problem)` (lowercase, non-alphanumerics stripped, first 30 chars), events sorted by key then
date; merge is **off** on the key. Per group: count, hours, distinct machines, quick = events with `h ≤ 0.5`,
machine pairs; groups sorted by hours desc; families carry the **encounter order** of their groups (a Set), families
sorted by hours desc. Repeats = machine × group with ≥ 4 events, sorted by hours desc (74 pairs; the page prints the
15 largest). Words = over the `Other / unclear` events, tokens of length ≥ 3 that are not numbers and not in the
**words table's** stop set (`PW_STOP`, below), split on non-alphanumerics of `problem + ' ' + action`, deduped per
event, sorted by count desc then hours desc, first 14. The two stop sets are different and both exact:
`PW_STOP` (the words table) = `the and for with from that this was were are not has had have its due got get ok okay
done machine mc problem issue issues check checked found now then again also new old set all one two change changed
changes replace replaced replacing get when while after before into onto out off over under per but can could would
will shall may must than too very just only some any other same such here there their them they you your our out
about above below between through during without within against along among since until upon whether which who whom
whose why how what where each every both either neither few more most less least many much own so these those been
being did does doing done had having were was is it in on at to of by as an a or if be no yes we he she him her his
hers ours ok normal working work run running start started starting stop stopped open opened close closed fix fixed fixing
repair repaired repairing clean cleaned cleaning remove removed removing put puted attach attached attaching tighten
tightened handover hand over ok`.
`ML_STOP` (41d-2's classifier) = `the a an and or of to in on at is was were are be been it its this that with for
from by as not no nil na ok done did do has had have after before then than but so if when while into out up down
again also now`.
**Files:** `problem-analysis.ts` (new), `computers.ts` spread, `test/analytics-problems.test.ts` (new), fragment.
**Acceptance:** the test compares key tables **0, 1, 2 and 4** exactly (24 groups with family/count/%/hours/hrs-each/
machines/quick; 9 families with the group order inside; the 15 repeat rows; the 14 words with their example problem);
table 3 (unplaced) and 5 (editor) come with 41d-2's whole-page check. It derives N and the total hours from
`input.json` rather than hard-coding them. Red first.

## 41d-2 — A10 page, charts and the suggested-group card (one PR)

`problem-suggest.ts` (new) is the platform's **Naive Bayes** classifier, which is what the frozen 13 Nov export
lacks and the key's "Entries the system could not place" card prints: features are the lowercased,
non-alphanumeric-split tokens of `problem + ' ' + action` with length ≥ 2, digits dropped, the stop-word set,
**stemmed** (strip `ing` when length > 5, `ed` when length > 4, a single trailing `s` when length > 3 and not `ss`),
plus every adjacent **bigram** `a_b`; training labels are the events already placed by keywords or manual fix
(1,248 here, and a model is only made when there are ≥ 40); multinomial Laplace with `a = 0.5`, `V` = vocabulary
size, prior `log(n_label/N)`, softmax over the log-likelihoods, best label wins, ties broken by group order. CV
accuracy = the platform's 5-fold (`mlCV`, folds by index `i % 5`) shown in the card's description (76% here).
`a10-problems.ts` (new) then assembles the key page whole: 8 KPIs (4 page KPIs, then the "what if we cut a problem"
KPIs — downtime saved, breakdowns avoided, plant availability before/after, MTBF before/after — from the top group at
**50%** and `availSum(nonRobotMachines, 1 Jan → asOf)`; formats: hours 0 dp, `+0.04 points`, `was 99.46%`), 6
tables and 2 charts. The unplaced card: rows sorted by the model's probability desc, date `DD-MM-YYYY`, machine,
problem, action **(collapsed then sliced to 110 chars — verified on all 31 rows)**, the group cell = the select's
text content
(`Suggested: <label> (<round(p×100)>%)` or `No suggestion`, then every group name concatenated with no separator),
then `Accept` when there is a suggestion and empty when not; the table title carries the count and share
(`31, 2.42% of all`). The editor table is the key's own cells: `↑ ↓`, empty name, empty family, the keywords
text, `×` (the platform prints input values not at all; this is a recorded print quirk, and the screen renders the
real editor from the plant's group list). Pareto: top 16 by hours, labels `<name>  (<round(100×share)>%)` with
the platform's **double space**, data rounded to 1 dp; bubble: every group in hours order, `x` = count, `y` =
average hours 2 dp, `r` = `max(5, min(26, sqrt(hours) × 1.3))`.
**Files:** `problem-suggest.ts` (new), `a10-problems.ts` (new), `computers.ts` spread,
`test/analytics-problems.test.ts`, fragment. Both engine files stay under the 400-line budget.
**Acceptance:** `expect(figure.value).toEqual(A10)` **whole** (8 KPIs, 6 tables, 2 charts), drill ids = the 1,279
tickets; a mutation that drops the manual fixes from classification makes the test fail (proof the fix path bites).
Red first.

## 41e-1 — the A4 and A5 screens (one PR)

A four-tab analytics group page: **A4** renders the key page through the existing `KeyPage`/`page-content` seam
(the three KPIs, the five tables, the chart), with a **sortable** table component (new
`apps/web/src/screens/analytics/sort-table.tsx`: client-side, stable, numeric-aware, keyboard-accessible) on the
Manpower table and both month matrices; the Specialization card keeps its category/code toggle. **A5** is its own
screen (`EnergyPage.tsx`): two heat grids (by cell, by location) and the per-machine average grid, tiles coloured by
the platform's green scale and labelled Connected/Running, a tile click filtering the drill reply's 126 machines by
cell or location. Figure-content mappings and catalogue keys for both, gu/en copy, one Playwright journey on the real
stack (`--project=chromium`; analytics is not a phone surface), `parity.yaml` evidence for both rows.
**Files:** the two screen modules, `sort-table.tsx`, `figure-content.ts`, `page-content.ts`, `groups.ts`
(nav entry), `analytics.en.ts`, `apps/web/e2e/analytics-manpower.spec.ts`, `parity.yaml`, fragment. Screen ≤ 300
lines each.
**Acceptance:** the mapping unit tests pin every A4 table cell and chart series and every A5 tile against the key
(`figure-content.test.ts`/`page-content.test.ts`); a sort click re-orders a table by a numeric column and back; the
journey opens both screens on the real stack and every tile/row opens its drill. Red:
`pnpm exec playwright test analytics-manpower --project=chromium` fails (the route is not registered); green: the
same command plus `pnpm exec vitest run apps/web/src/screens/analytics`.

## 41e-2 — the A6 and A10 screens (one PR)

**A6**: the candidate table (sortable), status badges, and the Why-Why form (five whys, a required conclusion, the
author shown as the signed-in person), saving through `PUT …/why-why`, then refetching the figure so the row reads
`Completed`; the PDF button opens `GET …/why-why.pdf`; a refusal line for a role that may not write. **A10**: the
4 page KPIs + the What-if KPIs, the two charts (reuse 38.5's bar/bubble kit), the groups, families, repeats, unplaced
and words tables (sortable), and the read-only group editor — see rulings R4 and R9. Both drill through the existing
drill seam. Mappings, catalogue keys, copy, one journey each, parity evidence.
**Acceptance:** the journey on the real stack opens A6, starts a Why-Why on the first candidate, saves it and sees the
row read `Completed`, then downloads the PDF and gets a file with the PDF magic; A10 shows the 8 KPIs, both charts and
the groups table, a sort click re-orders a table, and a row opens its drill. The mapping unit tests pin the A10 KPI
labels and the table headers. Red: `pnpm exec playwright test analytics-whywhy --project=chromium` fails; green: the
same plus `pnpm exec playwright test analytics-problems --project=chromium` and
`pnpm exec vitest run apps/web/src/screens/analytics`.
**Files:** `WhyWhyPage.tsx`, `ProblemsPage.tsx`, `figure-content.ts`, `page-content.ts`, `groups.ts`,
`analytics.en.ts`, `apps/web/e2e/analytics-whywhy.spec.ts`, `apps/web/e2e/analytics-problems.spec.ts`,
`parity.yaml`, fragment.

## Rulings recorded here

- **R1** — the key's authority is the 11 Nov platform build, tracked at
  `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html`;
  the rules above are the plan's own statement of it; the committed 13 Nov export is unchanged and its two divergences
  are named in 41b/41d.
- **R2** — a Why-Why is one append-only `ticket_event` of type `why_why`; payload `{whys[5], conclusion, completedBy,
completedDate}`; the latest event wins; nothing updates or deletes an event.
- **R3** — write guard = `canAnalytics` roles; technician/operator/board refused with a named refusal. Cost if wrong:
  one guard predicate and its test.
- **R4** — ticket 41's acceptance is the figures and the sortable screens. The A10 group editor and "add a word to a
  group" **actions** need a settings write + audit, so on these screens the editor and the word list are **read-only**
  in 41 (the figure still prints the key's exact cells); the write is recorded in `docs/plan/DEBT.md` as a
  follow-up.
- **R5** — A5's figure drill is the 126 CNC machines; per-tile drill is a screen-side filter, no new route.
- **R6** — `teamCodes` (the Settings team list) is what A4 tracks; a person merely named in a row (the workbook's
  `Maint. Team`) is not a team member.
- **R7** — the 24 problem groups with their families are the domain default; `EngineSettings.problemGroups` overrides
  them whole when the plant has edited the list.
- **R8** — the pseudonymiser's name-form collapse makes nine A4 mentions differ from the platform's attribution. The
  fix is a fixture-side map (`fixtures/answer-key/person-mentions.json`) that gives each mention its own code and keeps
  its printed name; no production rule and no key changes. Cost if wrong: one fixture file and its README note.
  Evidence: the real workbook's `Breakdown Log` against its `Analytics 4 - Manpower` sheet, both in the staging
  discovery pack; and the planner's independent whole-page A4 reproduction with the map applied.
- **R9** — the platform's "What stands out" card is prose computed from the figures, and the key does not hold it (no
  text field), so ticket 41's screens do not show it. It is recorded in `docs/plan/DEBT.md` as a follow-up with the
  platform's sentence rules; nothing in 41 fabricates it.

## Rails

Red first; never delete, skip or weaken a test; one writer per packet; file ≤ 400 lines, function ≤ 60, screen ≤ 300; no
new dependency; whole-figure equality (`toEqual`), no tolerance, no re-rounding; every figure drilled, every drill id
a real row; empty plant → `null`. Engine/screens are R1, 41c-2 is R2 (server behaviour + Docker suite, two tenants, each
role's refusal named) → one fresh reviewer per PR who did not write it, running the **covering suite**
(`pnpm exec vitest run packages/domain/test`, `pnpm exec vitest run apps/server/test`, the e2e spec on chromium).
Commit locally; no push. Report red output, green output and every deviation.

## Acceptance

The four figures equal their keys in every checkable dimension (A4/A5/A6/A10 whole page/value; A5 including its raw
floats); the four screens show them with sortable tables and real drills; a Why-Why saves to the ticket-36 home, shows
`Completed` in the figure and prints as the server PDF; each PR has a fresh PASS with the covering suite; CI green,
`pnpm precheck` first, `pnpm main:check` after each merge.

## Revision — the plan review of 18 Nov and what it changed

A fresh plan review (glm-5.3-flash, not the writer) recomputed all four figures from `input.json` and the 11 Nov
source and returned FAIL with two must-fix findings; both are settled above. (1) A4 could not reproduce its key: the
pseudonymiser maps every name form to one code, so nine mentions the platform left unattributed were attributed by an
exact code match. Proved against the real workbook and repaired fixture-side (R8): with the repair the planner's
independent A4 port equals the key's KPIs, all five tables (plant-total rows included) and its chart, byte for byte.
(2) Free-text cells are the platform's rendered text, so A6's problem and A10's problem/action/word cells carry
collapsed whitespace, and A10's action is collapsed **then** sliced to 110 chars (checked on all 31 rows). The review's
two should-fixes (no acceptance or red/green command for the screen packets; a "What stands out" card with no key and
no engine rule) and its note (a hard-coded 1,279 in A4) are fixed: the screen packets name their assertions and
commands, the card is deferred (R9), and every total is derived.

## Revision — the evidence behind every rule (verified 18 Nov, against the 11 Nov platform source and `input.json`)

- A4: the production filter gives 1,279 rows and 3,060.11 hours; the table's sorted counts (197, 149, 144, 133, 107,
  85, 71, 53, 43, 36, 10, 5, 4, 3) and MTTRs match the key; matrix rows follow the settings team order
  (Person 79, 49, 68…51) while the Manpower table is sorted.
- A5: a full port of the 11 Nov `calcEnergyHeatmap` reproduces **both** `extra.byCell` and `extra.byLocation`
  byte-for-byte (JSON equality), including `runningKva 97.40000000000002` and `effFactorPct 20`.
- A6: 24 candidates over the 12-hour threshold; the four largest recorded hours (238.58, 154.75, 97.75, 69.80) are the
  key's first four rows.
- A10: 1,279 events, 3,060.11 hours, 24 groups, 9 families, 74 repeat pairs (36.38% of hours), 40.89% quick stops,
  top group 484.9 h / 15.85%, and the Naive Bayes card reproduces **31 of 31** suggestions exactly (label and rounded
  percentage, 15%–99%), trained on 1,248 placed events, CV 76%. The three events that moved out of "Other" for the
  13 Nov build are the three manual fixes in `settings.problemFix`.
