# M4a-38 — Dashboard, Today and the data checklist: the first real figures

Milestone M4a, ticket 38. The machinery is merged (#289 engine + snapshot + drill, #290 face, Guide, profile
screen): `COMPUTERS` in `packages/domain/src/analytics/computers.ts` is **empty**, so all 43 figures answer
`not_computed`. This ticket gives owner-38 figures their computations and the Dashboard/Today screens.

**Read first:** `packages/domain/src/analytics/{types.ts,engine.ts,registry.ts}`, `packages/domain/test/` (the
existing pure tests' style), `fixtures/answer-key/README.md`, `fixtures/answer-key/input.json`,
`fixtures/answer-key/dashboard.json`, `docs/plan/m4a-triage.md` rows for `dashboard` and `data-checklist`, and the
approved design `docs/design/slices/slice-9-analytics-1-dashboard-today.html` + `docs/design/LOCK.md` § "Analytics
face".

**Out of scope:** every other screen family (39–45); the breakdown-log load (37c); the `today` **home** routing for
operators/technicians (their homes are the floor/desk screens — 38.3 only adds the head's Today dashboard).

## The test seam (the whole ticket hangs off this)

`fixtures/answer-key/input.json` is the workbook-shaped data every figure is computed from, and
`fixtures/answer-key/dashboard.json` holds what the platform showed for it on 2026-11-11 (KPI labels + values, the
chart series, the tables, the checklist). The engine is pure, so the proof is a **domain test with no database**:
map `input.json` into `EngineData` once, run `runWith(dashboardComputers, { data, asOf: '2026-11-11', profile })`,
and compare each owner-38 figure to the answer key. This adapter is the packet's first deliverable and the model for
tickets 39–45.

## Packet 38.0 — the answer-key fixture adapter and the six machine counts (one PR)

- `packages/domain/test/answer-key/fixture.ts` (new, test-only): read `input.json` (Node `fs` + `JSON.parse`; it is
  repo data, already pseudonymised) and map it to `EngineData`: machines (id = the workbook's machine id, code,
  segment, category, cell, location, make, model, controller, year, `purchasedOn`, `powerKw`, `capacityKva`,
  `assetCode`, `status: 'active'`, `criticality: null`, `metadata` carrying length/width/conveyor where the workbook
  has them); moves empty; tickets/tasks from the workbook's breakdown rows with the same `TicketRow` shape (use the
  workbook's ids so drills resolve); reports from the same rows' report fields; people from the coded names;
  `lists` empty unless the rows need a code; `timeZone: 'Asia/Kolkata'`. Also export the parsed
  `dashboard.json` and one helper that finds a KPI by its label. No production code reads a fixture.
- `packages/domain/src/analytics/computers.ts`: add the six machine-count computers —
  `dashboard.total-machines`, `dashboard.utilities`, `dashboard.dg-sets`, `dashboard.cnc-machines`,
  `dashboard.conventional-machines`, `dashboard.process-machines` — each naming the machine ids it counted
  (`drillIds`, machine type). Counts exclude a scrapped machine; utility/DG/process are segment-driven exactly as the
  answer key's sub-labels say (read `m4a-triage.md` and the key; if a rule is genuinely ambiguous, **stop and ask**,
  do not guess — a wrong definition poisons every later ticket).
- Test `packages/domain/test/analytics-dashboard.test.ts` (new): the six figures equal the answer key's numbers for
  `input.json` at 2026-11-11, each figure is `ready`, and its drill ids are machine ids of the data. Add one negative
  control: a machine added to the data changes `total-machines` and the figure re-drills (proves the computers read
  the data, not a constant).

**Green:** `pnpm exec vitest run packages/domain/test/analytics-dashboard.test.ts` and
`pnpm exec vitest run packages/domain/test/registry.test.ts` (the public export list may gain the computers map — add
it deliberately if exported), `pnpm lint && pnpm typecheck && pnpm precheck`.

## Packet 38.1 — the rest of the dashboard KPIs and the derived numbers (one PR)

Add the remaining owner-38 dashboard computers, each with its drill ids and each matched to the answer key:
`total-breakdowns`, `total-downtime-hours` (NO-DT rows excluded from downtime, as the key's sub-label says),
`pm-hours`, `no-downtime-hours`, `fleet-availability`, `plant-bd-pct`, `avg-complaints-per-day`,
`avg-bd-hours-per-day`, `avg-bd-hours-per-machine`. Use the profile's `prodHrsPerDay`/`workDaysPerYear` where the
answer key does (the key's "over 311 days of records" is derived from the data, not the profile — check which before
coding), keep every rounding exactly as the key rounds, and extend `analytics-dashboard.test.ts` to compare the full
KPI set. A rounding difference is a FAIL, not a tolerance: if the platform rounds half-up, we round half-up.

## Packet 38.2 — the charts and the data checklist (one PR)

`dashboard.bubble-chart` and `dashboard.expansion-timeline` return the structured series the answer key's `charts`
hold (drill ids = the machines/series rows behind them); `data-checklist` returns the checklist the key's `tables`
hold (open items with their machine/ticket drills). Compare structurally in the same domain test. If a chart's exact
shape is unclear from the key, **stop and ask** rather than inventing a shape the screen then has to paper over.

## Packet 38.3 — the Dashboard screen and the head's Today (one PR)

- The face's Today group renders the Dashboard: the KPI tiles in the platform's order, the bubble chart and the
  expansion timeline through the kit's chart pattern (`useChart`, ECharts lazy under D27), the data checklist on its
  own screen, every number a drill link. Money stays heads/admin only (the server already hides it).
- The head's and plant head's **home** opens on the Today dashboard (open items + breached clocks): reuse the existing
  board/desk data (`/state`, `sla`) for the open items and clocks — do not invent a new endpoint; the dashboard's
  figures come from `/analytics/figures`.
- A Playwright journey: a head signs in, lands on Today, sees the KPI tiles from the live API (the e2e tenant has
  small data, so assert structure and one known value, not the Cosmos numbers), opens the data checklist and one
  drill; an operator's home is unchanged. The answer-key comparison stays the domain test's job.

## Rails

Red test first; never delete, skip or weaken a test; one writer per packet; file ≤ 400 lines, function ≤ 60; no new
dependency without an ADR; every string a catalogue key in both languages; money only for heads/admin; no real names
or phones (the fixtures are pseudonymised — never copy a name into a test name or a fixture copy). Commit locally,
do not push; report red, green and any deviation.

## Revision 2 — after the fresh plan review (binding; supersedes the sections above where they differ)

The review proved five gaps in the first draft. These are the rulings; a builder follows these, not the earlier text.

**R1. The checklist's source is `fixtures/answer-key/data-checklist.json`**, not `dashboard.json` (`tables` is empty).
Its items live under `extra.items` (keys like `bd_code|bd_live_…`) with counts under `extra.counts`; the triage row
says 245 open items. The packet reads that file through the same test-only fixture module.

**R2. `data-checklist` drills to tickets, not machines.** It is registered drill `'machine'` today, and the engine
throws on a drill id that is not a row of its type, while every checklist item is a breakdown/ticket. Change the
registry entry to drill `'ticket'` (one line in `registry.ts`; the drill page already renders ticket rows) and keep
the item's machine code inside the figure's value for display. Record the change in the PR.

**R3. Two dashboard cards have no registered figure** — "Breakdown-Free Machines" (53 of 125; machines excluded in
Settings left out) and "Problems costing the most downtime". They are **in scope as two new registered figures**
(`dashboard.breakdown-free`, `dashboard.costliest-problems`, owner 38, drills machine/ticket), with their labels and
values taken from the key. Adding a figure is additive; the face renders it with the rest.

**R4. The history/live split is an observed rule of the key — encode it exactly, per figure.** The key's own numbers
show: `Total Breakdowns` = the history `breakdowns` rows **minus the 64 PM rows**, and it **excludes** the 7 live
`otherBD` rows (all-rows would be 1286); `NO-DT` excludes the live NO-DT row (140 entries / 209.1 h; all-rows
141/210.6); `Total Downtime` **includes** the live rows (3060.1; history-only would be 3055.2). So the adapter must
carry `source: 'history' | 'live'` on every ticket/report row, and the computers follow the selectors as observed.
This asymmetry is recorded as a **product question for Nimish** in the PR (should live-app tickets count as
breakdowns?), because production must mirror the platform until he rules otherwise.

**R5. The columns are fixed by the key:** `Total Downtime` = Σ `downMin`/60 (not Σ `downHrs` = 3065.0); `PM Hours` =
Σ `downMin`/60 over rows with `maintCode == 'PM'` (64 rows; not Σ `pmHrs` = 84.5); `NO-DT` selector = rows with
`maintCode == 'NO DT'`. Nothing else selects those rows.

**R6. The adapter's deterministic choices are part of the seam** (tickets 39–45 inherit this fixture): segment is
synthesised from list membership (`cncMachines`, `convMachines`, `procMachines`, `utilMachines`, `dgMachines`) because
those rows carry no segment; `DG` rows take segment `'DG'` (the settings list has no DG entry) and stay out of the
production counts as the key's sub-label says; breakdown dates are `DD-MM-YYYY`; `TicketRow.reportedAt` is that date at
the shift's start from `settings.shiftTimes` (shift 2 ends 05:00 the next day) and `closedAt` = `reportedAt +
downMin`, so the as-of cut is deterministic.

**R7. The counts are list-driven, not segment-driven:** 159 = 126 + 16 + 17 from the three production lists, utilities
30 and DG 3 by list length; the excluded machine (`BOXY`) stays **inside** the 126 (the "1 not counted" is
production-only: the breakdown-free card divides by 125, the average per machine by 126). `input.json` has no status
field, so the draft's "exclude a scrapped machine" sentence is dropped — there is nothing to test.

**R8. "Over 311 days of records" is not derivable from `input.json`** (the span is 315 days, distinct breakdown dates 256) and nothing in the repo defines it. **Stop and ask**; do not invent a definition, and do not fudge the divisor to
make the number land.

**R9. Charts are compared by exact value, not shape:** `dashboard.json`'s `charts` hold exact floats (e.g. MTTR
2.1971111111111106, bubble `r` 10.803643149088568). The bubble radius formula and the `ch-dash-timeline` grouping
(12 datasets, `type: undefined`) are documented nowhere: **stop and ask** for those two; everything else is exact
equality.

**R10. Operator and technician homes are in the row-38 goal and already exist** (`My complaints`, `Mine`); packet 38.3
therefore _verifies_ their routing stays as it is and adds the new **head/plant-head Today** dashboard — no rewrite of
the floor/desk homes.

**Nice-to-haves folded in:** the negative control must assert the added machine's id appears in `drillIds`; the key's
"Live machine status" KPI is the dropped live card (triage), so the KPI-by-label helper must not hunt a figure for it;
and 38.3 names the exact interfaces it uses (`GET /api/v1/analytics/figures` with the server's money filtering, the
chart kit at `apps/web/src/ui/chart/use-chart.ts`).

## Revision 3 — the 38.0 findings (binding for 38.1 onward)

**R11. The dashboard computers join `COMPUTERS` in the packet that finishes the Dashboard (38.1).** 38.0 keeps them in
a named map (`dashboardComputers`) because `analytics-engine.test.ts` asserts that a bare `run()` reports every figure
`not_computed`; 38.1 must spread them into `COMPUTERS` **and** update that shell test in the same PR (the test's
intent — "an unimplemented figure is honest" — survives; the assertion becomes "a figure with no computer is
`not_computed`", driven by the registry instead of the implementation).

**R12. The plant's own seed differs from the platform's machine list, and that is a data question, not a figure bug.**
`apps/server/src/seed/generated/cosmos-machines.json` files BOXY under segment `Robot` (CNC 125, total 158), while the
answer key counts it in CNC (126/159: "1 not counted in production data"). The engine is right against the key (the
answer-key test proves it on the workbook fixture); the live dashboard will show our seed's classification until
Bhavin's real machine list is reconciled. Record it for Nimish/Bhavin at the gate; do not bend a computer to hide it.

**R13. `ReportRow` carries no `source`; the source is the linked ticket's.** 38.1 reads `source` through
`report.ticketId` → ticket. Do not add a field to `types.ts` unless a figure genuinely cannot resolve it.

## Packet 38.1 — final scope after checking the key's arithmetic (binding)

Five of the remaining KPIs are unambiguous from `dashboard.json` and the workbook; **four are not**, and are held for
Nimish rather than guessed (recorded at the end). Build the five, join the map, update the shell test.

1. `dashboard.total-breakdowns` = count of the history `breakdowns` rows whose `maintCode !== 'PM'`, **excluding**
   live `otherBD` rows → **1279** (R4). Drill ids: those tickets.
2. `dashboard.total-downtime-hours` = Σ `downMin`/60 over the history rows whose `maintCode` is neither `PM` nor
   `NO DT`, **plus** the live rows **except any live NO-DT row** → **3060.1** (R4, R5; the key's sub-label says NO-DT rows are excluded from downtime
   totals — dropping that exclusion gives 3270.7, which the builder proved before implementing the key's rule).
3. `dashboard.pm-hours` = Σ `downMin`/60 where `maintCode === 'PM'` → **759.3** (R5; not Σ `pmHrs`).
4. `dashboard.no-downtime-hours` = Σ `downMin`/60 where `maintCode === 'NO DT'` (history only) → **209.1** (R4, R5).
5. `dashboard.avg-bd-hours-per-machine` = total downtime ÷ **126** ("Total downtime ÷ CNC machines" in the key) →
   **24.29**.

Each is `ready`, names its ticket drill ids, and is compared **exactly** to the key in
`packages/domain/test/analytics-dashboard.test.ts`; round to the key's own decimals (2 for the hours, 2 for the
average) and prove that with the test.

**Join (R11):** `dashboardComputers` spread into `COMPUTERS` in `computers.ts`, and
`apps/server/test/analytics-engine.test.ts`'s shell assertion updated in the same PR: it must fail on a figure that has
**no** computer (drive it from `FIGURE_KEYS` minus the implemented keys) instead of asserting every figure is
`not_computed`. No test is weakened: the "honest not_computed" intent moves to "every figure either has a computer or
is listed as not implemented yet".

**Held for Nimish (do not implement, do not guess):**

- `dashboard.fleet-availability` (key 99.32%, "average · hours to 11 Nov"): no formula in the repo produces it —
  downtime/(126×20×311) = 99.61%, /(126×24×311) = 99.67%; the denominator needs ~141 days for 159 machines at 20 h.
  His answer must fix the machine-hours denominator and whether availability averages per machine.
- `dashboard.plant-bd-pct` (0.54%, "of hours to 11 Nov"): the same denominator question.
- `dashboard.avg-complaints-per-day` (4.11) and `dashboard.avg-bd-hours-per-day` (9.84), both "over 311 days of
  records": the workbook spans 315 days and has 256 distinct breakdown dates; 311 is not derivable (R8).

## Revision 4 — the platform's own Guide answers the four held figures (17 Nov, from discovery)

`docs/discovery/source/cosmos_platform.html` (and Nimish's newer copy) contains the platform's **Guide**, which states
every formula, and the platform's JavaScript that implements them. My earlier "stop-and-ask" was wrong: the answers
were in discovery. These are the rules to port (re-implement, never copy code):

- **Available hours per machine** = `prodHrsPerDay × workDaysPerYear` (= 20 × 300 = 6000, from the profile).
  Basis **"days so far" (default)**: counted from 1 January to the last data date (or today if later), **month by
  month** — a full month is `annual/12`, a partial month is `annual/12 × (days covered ÷ days in that month)`. Each
  machine counts **from its purchase date** (`purchasedOn`), and a machine with no purchase date counts from the
  period start. `"Full year"` counts the whole 6000.
- **Production machines** = CNC machines **not excluded from production data** (the Robot is excluded; excluded
  machines stay in the fleet totals and the timeline but never in breakdown hours, MTTR/MTBF, BD %, availability,
  footprint or reports).
- **Plant BD %** = breakdown hours ÷ Σ available hours of the production machines.
- **PM %** = PM hours ÷ the same denominator. **Fleet Availability** = 1 − Plant BD % − PM %.
- **Days in the record** = earliest to latest breakdown date in the log, both included (this is the 311).
  **Avg Complaints / Day** = Total Breakdowns ÷ days in the record; **Avg BD Hours / Day** = Total Downtime ÷ days in
  the record.
- Breakdown selection follows the guide: CNC breakdown entries only, **PM excluded from breakdowns/downtime**,
  **NO DT entries count as a breakdown but add 0 hours** (their recorded hours show separately as NO-DT hours),
  live `otherBD` entries are a separate log and are not in the workbook's breakdown list.
- **Breakdown-Free Machines** (new figure): CNC production machines whose last breakdown was ≥ 30 days ago (or none),
  out of the production machines in service that day (a machine joins on its purchase date); excluded machines and
  robots are left out. The key shows 53 of 125.
- **Problems costing the most downtime** (new figure): breakdown problems ranked by downtime hours.
- **Bubble chart**: one bubble per CNC production machine with ≥1 breakdown; height = breakdown count, x = machine BD
  hours, size = its MTTR (BD hours ÷ breakdowns).
- **Machine Expansion Timeline**: cumulative machine count by purchase year; a year lists the machines bought that
  year.

**Acceptance for packet 38.4:** implement Plant BD %, Fleet Availability, Avg Complaints/Day and Avg BD Hours/Day and
reproduce the key **exactly** — 0.54 %, 99.32 %, 4.11, 9.84 — then join and extend the pure test. If a number does not
reproduce, the delta names the missing rule: STOP and report it; never tune the formula to fit. The platform JavaScript
to read (not copy) is in `docs/discovery/source/cosmos_platform.html`: functions `annualHoursPerMachine`, `availWin`,
`availSum`, `periodFrac`, `dayDiff`, `isExcluded`, `nonRobotMachines`, `filterBD`, `sumHrs`, `calcAnalytics1` and the
Dashboard renderer.

## Follow-ups filed after packet 38.4's review

- **S2 — Total Breakdowns' production filter.** `dashboard.total-breakdowns` counts every history breakdown (PM
  excluded) while `dashboard.avg-complaints-per-day` divides the **production-filtered** count. The platform's Guide
  filters Total Breakdowns by production too (`bdIsCountable`), but the answer key cannot arbitrate (1279 either way —
  BOXY has no rows). Align both in ticket 40 (breakdown analyses), where the log itself is computed, and say it in that
  PR; do not retune here.
- **Recorded hours vs minutes.** The Guide divides recorded **hours**; the repo stores **minutes**, which reproduces the
  key exactly today (3060.1333 h). If a later ticket needs the recorded-hours column (`downHrs`), it is an additive
  column in that ticket's migration, not a formula change.

**Proven (17 Nov).** The four reproduce the key exactly through the code above: Plant BD % **0.54**, Fleet Availability
**99.32**, Avg Complaints/Day **4.11** (1279 ÷ 311), Avg BD Hours/Day **9.84** (3060.1333 ÷ 311), with the pure test
comparing the key's own printed text and no tolerance.
