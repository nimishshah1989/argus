# M4b-48 — shift-calendar KPIs (ticket 48)

Ticket 48, `docs/plan/MILESTONES.md:428-431`:

1. [Engine] MTBF, MTTR and availability on real working hours (standard profile) sit beside the legacy figures and
   never replace them; hand-computed fixtures agree.
2. [Browser] Pareto and heatmaps by machine, cell, code and shift, and the backlog, are on screen and drill to tickets.

This is the second figure family of ARCHITECTURE §6 (`docs/ARCHITECTURE.md:215`): "The `standard` profile holds improved
definitions and never replaces a legacy number silently." PARITY.md promised the same shape for the one screen it
touches — "A3 gains a shift-calendar basis as a second, labelled figure" (`docs/spec/PARITY.md:125`) — and lists the
hard-coded "20 hours by 300 days" among the constants carried into the backlog, not into the product
(`docs/spec/PARITY.md:147`). SPEC §1.5 names the family: "shift-calendar KPIs (MTBF, MTTR, availability on real working
hours, SMRP-aligned), backlog and schedule compliance, Pareto and heatmaps by machine, cell, code and shift"
(`docs/spec/SPEC.md:109`) — this ticket takes everything in that line except schedule compliance, which is ticket 50's
(`docs/plan/MILESTONES.md:616`, E10; and PM _compliance_ is 50's while PM _hours_ are this ticket's, R7).

**Blocked by 47.** 47's plan is on main (`docs/slices/47-coded-closes.md`, commit `9b5192f0`), so this plan reads it
rather than assuming it: every live close carries a `failure_component` mirrored into `maint_code` (47 R2/R3), the
analytics loader canonicalises the code through the `failure_code` list and aliases (47 R7, one line at
`apps/server/src/modules/analytics/load.ts:122`), and 47 R9 leaves the code-axis label decision to this ticket —
settled as R11 below. Nothing here needs 47b's unmerged code: the tables (`breakdown_report.failure_component`,
`failure_mode`, `failure_cause`, `failure_action`, `pm_report`; `packages/db/migrations/0015_m4b_schema.sql:35-39`) are
shipped, and every figure below reads `report.maintCode`, which 46b already fills and 47 keeps mirrored.

## What is true on main today (evidence, not assumption)

- **The profile is numbers, not definitions.** `AnalyticsProfile` is one row of the legacy platform's own constants
  (`packages/shared/src/analytics.ts:69-113`, `PROFILE_FIELDS`), read as `ComputeInput.profile`
  (`packages/domain/src/analytics/types.ts:256-260`). There is no second family: the engine runs one set of computers
  (`packages/domain/src/analytics/engine.ts:87-89`) and the store stamps every row `profile = 'legacy'`
  (`apps/server/src/modules/analytics/snapshot.ts:7`, "until a second profile exists").
- **The legacy MTBF/MTTR/availability formulas are frozen and proven.** `mttrOf`/`mtbfOf`
  (`packages/domain/src/analytics/a3-mttr-mtbf-context.ts:94-97`): MTTR = hours ÷ breakdowns, MTBF = (available hours −
  breakdown hours) ÷ breakdowns; hours are `effectiveHours` — the workbook's rounded `downHrs` where it exists, zero for
  a NO DT row (`rows.ts:38-41`, `:22`, `:25`). Available hours are the profile's `prodHrsPerDay × workDaysPerYear`
  spread month by month from 1 January, each machine from its purchase date (`availability.ts:33-72`,
  `hours.ts:50-52`). Availability on the platform's own page is `1 − BD % − PM %` with those same hours.
  `packages/domain/test/analytics-breakdown.test.ts:535,668` assert `value.pages` **equals** the answer key for A1 and
  A3, so any change to those pages is a parity break by construction.
- **The shift calendar exists as data, and nothing in the engine reads it.** `shift` holds `code`, `name`, `starts_at`,
  `ends_at`, `crosses_midnight`, and `active` since 0012 (`packages/db/migrations/0001_schema_v1.sql:180-191`,
  `packages/db/migrations/0012_m2_schema.sql:21`); the plant's own windows are in the workbook's `settings.shiftTimes`
  (`fixtures/answer-key/input.json`: `1` 08:00–18:30, `2` 18:29–05:00); Q8 records that the form lists three shifts but
  only two windows exist (`docs/spec/QUESTIONS.md:14`); DOMAIN §5 rules that shift 2 crosses midnight and that the
  one-minute 18:29/18:30 overlap belongs to the later shift (`docs/spec/DOMAIN.md:207`). Working time is already
  modelled twice: `business-hours.ts` (`ShiftWindow`/`BusinessCalendar` at `:14-24`, `businessMinutesBetween` at `:35`,
  `addBusinessMinutes` at `:49`) for SLA clocks, and `productionDateAt`
  (`apps/server/src/modules/plant/repo/reads.ts:110-125`) for the day a live stop is filed under. The engine's
  `EngineData` has no shift at all (`types.ts:222-240`), and the analytics loader never reads the table.
- **The real data says what the fixtures must prove.** `fixtures/answer-key/input.json` holds 1,343 history breakdown
  rows and 7 live ones (`otherBD`); 64 rows carry the `PM` code, 140 the `NO DT` code; 1,343 rows have one `maintCode`
  each; shift codes are `1` (835), `2` (472), `1ST` (25), `2ND` (9) and `3` (2) — **a third shift code with no window in
  Settings**. 649 of the 1,343 rows have `downHrs ≠ downMin ÷ 60` (2-dp rounding: 40 min is stored as `0.67`).
  `excludedMachines: ["BOXY"]` leaves 125 production machines of 126 CNC rows, the number A1 prints.
- **The face is a registry of figures, one tile each.** A screen's figures are rendered from
  `figures.data.figures.filter(figure => figure.screen === screen)` (`apps/web/src/screens/analytics/GroupPage.tsx:66`);
  the breakdowns group is the exception with its own menu and switch (`BreakdownsPage.tsx:23`, `:91-105`). Object
  values reach the face only through `figure-content.ts` (`contentKind` at `:162-166`, `PAGE_KEYS` at `:168-182`), and
  a key page is mapped by `pageContent()` (`page-content.ts:378-397`) out of `kpis`, `tables` and `charts`. Every
  registered figure must sit in exactly one menu group and carry a catalogue label in **both** catalogues
  (`groups.test.ts:20-25`), and every figure must be named exactly once by a Guide entry whose headings are the answer
  key's 36, verbatim (`guide-entries.test.ts:41-62`).
- **The budgets are the design constraint.** `page-content.ts` is **397 lines** against a hard 400 (`tools/check-size.ts`
  reads every non-test `.ts`/`.tsx` under `apps`, `packages`, `tools`, `scripts`); `analytics.en.ts` is **248** against
  the catalogue's own 250-line cap (`packages/shared/test/catalogue.test.ts`); `use-chart.ts` is **394**. So no new
  chart kind may go into `use-chart.ts`, no new label may go into `analytics.en.ts`, and no new chart id may go into
  `page-content.ts`'s `CHART_META` (R14).
- **Storage is ready.** `kpi_snapshot` is the one M4a table (D17): `(tenant_id, profile, key, subject_kind, subject_key,
period_start, period_end, as_of, run_id, value)` (`packages/db/migrations/0014_m4a_schema.sql:54-74`) and the store
  writes one plant row per ready figure per run (`snapshot.ts:14-40`). No new table, no migration, no column.
- **Two existing tests move, on purpose.** `packages/domain/test/analytics-engine.test.ts:68-69` bounds an owner at 45
  and `:87-92` asserts the owner set is exactly 38–45; ticket 48's figures belong to 48, so both become exactly
  38–45 and 48 (the same kind of explicit change 47a makes to the reply-contract count 137 → 140). Nothing else moves.
- **The drill cap is built.** `MAX_DRILL_IDS = 200` (`packages/shared/src/analytics.ts:205`) and the too-many rule has
  one home, `FigureDrill` (`apps/web/src/screens/analytics/KeyPage.tsx:51-73`): a figure with more ids than that opens
  the Breakdown log, whose filters are date, shift, machine and code (`BreakdownsPage.tsx:14`). The log fallback is
  therefore useful for three of this ticket's four dimensions.

## The standard definitions, exactly

The standard family is a **second definition of five measures**, carried by four figures and computed from the same
rows as the legacy one. `AnalyticsProfile` does not change: the working-hours basis needs the plant's shifts (new `EngineData.shifts`
in R1) and its `workDaysPerYear`, and deliberately does not use `prodHrsPerDay`.

| Measure                    | Platform basis (legacy, frozen)                                                                     | Working-hours basis (standard)                                                                                                                                                                                                      | What changed                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Working hours, per machine | 20 h/day × `workDaysPerYear`, spread month by month from 1 Jan, each machine from its purchase date | **the union of the plant's active shift windows** × `workDaysPerYear`, the same spread and the same purchase-date rule                                                                                                              | the denominator: 21.0 h/day (629 + 631 min) instead of the workbook constant 20                     |
| Failures                   | every non-PM history row, including `NO DT`                                                         | every non-PM breakdown report at or before `asOf`, history **and** live closes, a duplicate counted once, `NO DT` counted with zero hours, an open breakdown excluded                                                               | live closes enter; the overlap of the two logs cannot count twice                                   |
| MTTR                       | recorded breakdown hours ÷ failures (rounded `downHrs`)                                             | **exact minutes** ÷ failures (`downtimeMin ÷ 60`)                                                                                                                                                                                   | 4.89 h of total rounding on the fixture (0.004 h a failure); two decimals hide it                   |
| MTBF                       | (available − breakdown hours) ÷ failures                                                            | (working hours − breakdown hours) ÷ failures, exposure right-censored at `asOf`; **no failure prints nothing**, never the whole window                                                                                              | the denominator, and a machine with no failure no longer reports its own available hours as an MTBF |
| Availability               | `1 − BD % − PM %`                                                                                   | `1 − (BD + PM) ÷ working hours` — operational availability: planned and unplanned both removed                                                                                                                                      | the denominator only; the algebra is the platform's                                                 |
| BD % / PM %                | breakdown hours ÷ available hours; PM hours ÷ available hours                                       | the same quotient over **working hours**, exact minutes                                                                                                                                                                             | the denominator and the rounding                                                                    |
| Shift split                | the platform groups a Pareto by the recorded shift                                                  | breakdowns, hours, MTTR, MTBF and availability per recorded shift, on that shift's own working hours; a recorded code with no window keeps its row with blank hours; working minutes are split 629/631 so the rows sum to the plant | new: a per-shift MTBF needs per-shift working hours                                                 |
| Backlog                    | not defined (the platform has no word for it)                                                       | **breakdown** tickets (`kind === 'stopped'`, R4) still open at `asOf`, counted, with their age in **working hours** to the end of the as-of plant day, bucketed                                                                     | new                                                                                                 |

**The failure set, in one paragraph, because two figures depend on it.** A report is a failure when its ticket is a
breakdown (R4: the ticket is `kind === 'stopped'`, so a support ticket, a PM job and a general work request are out) and
its `maintCode` is not `PM`; `NO DT` is a failure with zero lost time (the plant attended it outside
production hours — `docs/spec/PARITY.md:123` keeps "NO DT stays its own case"); a report whose ticket closed after `asOf` is not in
the snapshot at all, because `dataAsOf` rewinds it to open and drops its report (`as-of.ts:8-40`), so an open
breakdown is never a failure — it is in the backlog. History and live closes are merged by the DATA-MAP rule "each is
matched to an imported ticket where machine, date, shift and downtime agree, and a matched pair counts once"
(`docs/DATA-MAP.md:114`); no cutover date is invented, because none is stored anywhere in the product.

**What is SMRP-aligned, said plainly so the reviewer can check it.** SMRP's MTBF is operating time ÷ failures and its
MTTR is maintenance time ÷ repairs; the working-hours basis computes exactly those two quotients, with the breakdown's
recorded downtime as the maintenance time (the plant records no separate wrench clock on history rows: `repairMin`
exists on 60 of 1,350 rows, and is _greater_ than the downtime on 4 of them — the repair clock keeps running after the
machine is back — so it is 42's manpower measure, not MTTR: R6). SMRP's availability is MTBF ÷ (MTBF + MTTR); that
identity holds here for the unplanned side only, and the figure prints operational availability, which also removes PM
(the difference is exactly PM % — 0.13 points on the fixture).

## The numbers, hand-computed from the real data at `2026-11-11`

Everything below is arithmetic over `fixtures/answer-key/input.json`; the three data facts used are 125 production
machines, 1,279 non-PM breakdown rows and two shift windows. `periodFraction` is the code on main
(`availability.ts:33-50`), so "each machine's share of the year" is not re-derived.

**The working hours.** Shift 1 is 08:00–18:30 and shift 2 is 18:29–05:00, and DOMAIN §5 gives the 18:29–18:30 overlap to
the later shift, so shift 1 works 08:00–18:29 = 629 minutes and shift 2 works 18:29–05:00 = 631 minutes;
629 + 631 = **1,260 minutes = 21.00 h of working time a day**, and 21.00 × 300 = **6,300 working hours a machine a
year** (the legacy basis is 20 × 300 = 6,000). Summed over the 125 production machines from each purchase date to
11 November: **5,93,977.10 hours** (legacy: 6,000 × the same fractions = 5,65,692.47, the number A1 prints).

**The comparison the figure prints** (table "The platform basis beside the working-hour basis"):

| Measure          | Platform basis | Working-hour basis | Arithmetic                                                                                                                      |
| ---------------- | -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| MTBF (hours)     | 439.9          | 462.0              | (5,93,977.10 − 3,055.2167) ÷ 1,279 = 5,90,921.8801 ÷ 1,279 = 462.0187; legacy (5,65,692.47 − 3,060.11) ÷ 1,279 = 439.9002       |
| MTTR (hours)     | 2.39           | 2.39               | 3,055.2167 ÷ 1,279 = 2.3888; legacy 3,060.11 ÷ 1,279 = 2.3926                                                                   |
| Availability (%) | 99.32          | 99.36              | 1 − (3,055.2167 + 759.2667) ÷ 5,93,977.10 = 1 − 0.0064220 = 0.9935781; legacy 1 − (3,060.11 + 759.27) ÷ 5,65,692.47 = 0.9932483 |
| Breakdown %      | 0.54           | 0.51               | 3,055.2167 ÷ 5,93,977.10 = 0.0051437; legacy 3,060.11 ÷ 5,65,692.47 = 0.0054095                                                 |
| PM %             | 0.13           | 0.13               | 759.2667 ÷ 5,93,977.10 = 0.0012783; legacy 759.27 ÷ 5,65,692.47 = 0.0013422                                                     |

Breakdown hours are the exact minutes: 1,279 rows summing 3,055.2167 h (183,313 minutes, the `NO DT` rows' 12,546 minutes not counted); the workbook's rounded hours
sum 3,060.11 for the same rows, which is the 4.89 h difference between the two MTTRs. PM is 64 rows, 759.2667 h
(legacy 759.27). The legacy column's five cells are **the answer key's own cells** — A3's PLANT TOTAL row prints
`2.39` and `439.9` (`fixtures/answer-key/a3-mttr-mtbf.json`, the `PLANT TOTALMTTR / MTBF · 1279 breakdowns` pair) and
A1 prints `0.54%`, `0.13%` and `99.32%` (`fixtures/answer-key/a1-bd-pm.json`, KPIs "Actual Breakdown", "PM Downtime",
"Fleet Availability") — which is how the test proves "never replaces them".

**The four KPI facts the figure also states:** 21.0 working hours a day; 5,93,977.10 working hours; 1,279 failures;
8 of the 125 production machines have no failure in the window and therefore no MTBF of their own (117 do).

**The shift split** (working minutes split 629/631, so the rows sum to the plant):

| Shift           | Breakdowns | BD hours | PM hours | Working hours | MTTR | MTBF  | Availability |
| --------------- | ---------- | -------- | -------- | ------------- | ---- | ----- | ------------ |
| 1 (08:00–18:29) | 821        | 2,021.10 | 571.28   | 2,96,517.14   | 2.46 | 358.7 | 99.13%       |
| 2 (18:29–05:00) | 456        | 1,031.12 | 187.98   | 2,97,459.96   | 2.26 | 650.1 | 99.59%       |
| 3 (no window)   | 2          | 3.00     | 0.00     | —             | —    | —     | —            |
| PLANT TOTAL     | 1,279      | 3,055.22 | 759.27   | 5,93,977.10   | 2.39 | 462.0 | 99.36%       |

`2,021.10 + 1,031.12 + 3.00 = 3,055.22` and `2,96,517.14 + 2,97,459.96 = 5,93,977.10`: the shift rows add to the plant
exactly (the rounded PM cells add to 759.26 against the plant's 759.27, so the test sums the unrounded values and only
the breakdown hours are asserted cell by cell at two decimals), and the third code (two real rows, `1ST`/`2ND` aliases normalised, `3` left as recorded) shows what the plant
recorded with no window to divide by. Shift 1's MTBF is 358.7 = (2,96,517.14 − 2,021.10) ÷ 821; shift 2's 650.1 =
(2,97,459.96 − 1,031.12) ÷ 456.

**The Pareto, four dimensions, by breakdown hours** (rank by hours, cumulative share, and the 50 % point):

| Dimension | Keys with hours | Hours    | The 50 % point                  | Worst first                                                       |
| --------- | --------------- | -------- | ------------------------------- | ----------------------------------------------------------------- |
| Machine   | 117             | 3,055.22 | 13 machines (10.4 % of the 125) | TMC-2 20 breakdowns 307.58 h; TC-5 17 / 175.08; VC-28 27 / 151.32 |
| Cell      | 9               | 3,055.22 | 3 cells                         | 7 (776.78); 2 (621.17); 6 (593.57)                                |
| Code      | 23              | 3,055.22 | 3 codes                         | E 314 / 687.60; M 215 / 666.65; HUM 59 / 440.98                   |
| Shift     | 3               | 3,055.22 | 1 shift (66.2 %)                | 1 (2,021.10, 66.2 %); 2 (1,031.12, 33.7 %); 3 (3.00, 0.1 %)       |

Cumulative checks the fixture pins: `687.60 + 666.65 = 1,354.25 → 44.3 %`, `+ 440.98 = 1,795.23 → 58.8 %`, so three
codes pass 50 %; `307.58 ÷ 3,055.2167 = 10.1 %` for TMC-2; `2,021.10 ÷ 3,055.22 = 66.2 %` for shift 1.

**The heat grids** are the same hours cut by month of the report's own date (Jan to Nov; December has not happened at
`asOf`). One cell per row pins each grid and one invariant cannot drift: the cells of a row add to that row's Pareto
hours. Shift 1 by month is `176.65, 170.92, 130.42, 338.12, 56.53, 458.65, 171.23, 163.13, 129.08, 191.17, 35.20` —
sum 2,021.10. Code `E` by month sums 687.60 (April 260.67, June 96.62). TMC-2 by month sums 307.58 (June 242.42).

**The backlog fixture** (the answer key holds no open ticket, so this one is built, and it says so). One production
machine, the Cosmos windows, `asOf` `2026-11-11`; age is working minutes from `reportedAt` to the start of 12 November:

- T1 reported 2026-11-10T17:00+05:30, `open`: 17:00–18:29 = 89 min + 18:29–24:00 = 331 min on the 10th, plus the whole
  of the 11th (08:00–24:00 = 960 min) → 1,380 min = **23.0 h** → "4 to 24 h".
- T2 reported 2026-11-11T09:00+05:30, `working`: 09:00–18:29 = 569 min + 331 = 900 min = **15.0 h** → "4 to 24 h".
- T3 reported 2026-11-09T20:00+05:30, `waiting`: 20:00–24:00 = 240 min, plus 960 + 960 on the 10th and 11th = 2,160 min
  = **36.0 h** → "24 to 72 h".
- Excluded by the definition: a `closed` live ticket, a `cancelled` one, a history row and a PM ticket.
  So count 3, oldest 36.0 h, buckets 0 / 2 / 1 / 0, and the drill names T3, T1, T2 in that order.

**The cutover fixture** (proves R3 and R4 exactly). One production machine, `asOf` `2026-12-31` so the year's share is
1 and the working hours are exactly 6,300 (legacy 6,000): a history row of 60 min on 2 March shift 1; a history row of
120 min on 6 April shift 2; a live close of 90 min on 2 November shift 1; **a live row that repeats the first history
row exactly** (2 March, shift 1, 60 min); a PM row of 240 min; and a `NO DT` live row of 30 min. Failures = 4 — the 60-minute history
row, the 120-minute history row, the 90-minute live close and the NO DT row — the duplicate dropped, PM excluded, and the NO DT row contributing no hours: breakdown hours 4.5, PM 4.0,
MTTR = 4.5 ÷ 4 = 1.13, MTBF = (6,300 − 4.5) ÷ 4 = 1,573.875 → 1,573.9, availability = 1 − 8.5 ÷ 6,300 = 99.87 %,
BD % = 0.07, PM % = 0.06. The same fixture's legacy column sees two failures and 3 h: MTTR 1.50, MTBF
(6,000 − 3) ÷ 2 = 2,998.5, availability 99.88 %, BD % 0.05, PM % 0.07 — the live closes are invisible to it, which is
the whole point of the second family.

## Rulings (each settled here; none left open)

**R1 — the working-hours basis is a second definition, not a second profile row; the plant's shifts enter the engine as
data.** `AnalyticsProfile` keeps its numbers and its setting row. `EngineData` gains
`shifts?: readonly ShiftRow[]` (`ShiftRow = {code, name, startMinute, endMinute, crossesMidnight, active}`), filled by a
new `shiftsForEngine(tx)` in `apps/server/src/modules/plant/repo/analytics.ts` beside `machinesForEngine`/`movesForEngine`
(`:8`, `:21`, `:31`) and read in one line of `load.ts`. The field is optional so every existing fixture and test that
builds `EngineData` keeps compiling; with it absent the working-hour column is null (R3). No ticket row changes: R4
needs only the `kind` the engine already has. Cost if wrong: a plant that wants to switch the whole face between two complete profiles needs one
setting and two runs — the definitions are already pure functions of `(data, asOf, profile)`, so that is one argument,
not a rewrite.

**R2 — working hours are the union of the plant's _active_ shift windows times its working-days setting.**
`workingMinutesPerDay` is the union of the active windows on the 0–1440 circle, with the 18:29–18:30 overlap given to
the later-starting window (DOMAIN §5): 629 + 631 = 1,260 minutes, 21.00 h a day. Standard annual hours are
`(minutesPerDay ÷ 60) × profile.workDaysPerYear` = 6,300, and the window is `availabilityWindow(asOf, asOf)` — 1 January
of the data year to `asOf` — with each machine counted from its purchase date by the existing `periodFraction` /
`availableHours` (`availability.ts:33`, `:52`). The production fleet is the same `isProduction` filter A3 uses
(`machine-facts.ts:5`), so both columns count the same 125 machines. `prodHrsPerDay` keeps its legacy meaning only.
Cost if wrong: switching a shift off in Settings moves the standard denominator (it should — a shift off is not worked
time), and a plant whose real pattern is not reflected in its `shift` rows gets a standard number built on the wrong
calendar; it fixes the shifts on the same settings screen the day report already uses. **Rejected:** deriving working
days from the records themselves (`repGaps` in the platform's own data-quality rule shows why: days with no entries are
a data question, and a denominator built from the numerator's data would flatter the plant), and a holiday calendar
(no table, and D17 spends none on this).

**R3 — a plant with no active shift window has no working-hours column, and says so.** The figure is still `ready`: the
platform column and a KPI ("No shift windows in Settings") print, and the working-hour column prints `—`. A plant with
no breakdown row at all returns `{value: null, drillIds: []}` like A3 (`a3-mttr-mtbf.ts:206`), which is what keeps
`analytics-engine.test.ts`'s "ready figures equal computed figures" true on its two-machine fixture. Cost if wrong: a
tenant that never entered shift times sees four honest dashes until the settings screen fills them (Cosmos's two
windows are already seeded); the alternative — silently falling back to 20 × 300 — would print a "standard" number that
is the legacy one.

**R4 — the failure set: non-PM reports of `kind === 'stopped'` tickets, at or before `asOf`, history _and_ live,
deduplicated by machine + plant date + shift + downtime; `NO DT` counts with zero hours; an open breakdown is not a
failure.** The kind alone is the breakdown test, and it is enough: a support ticket is `kind: 'support'`, and a PM job,
an inspection or a general work request is `kind: 'general'` (`apps/server/src/modules/tickets/planned.ts:40-42`, `:61`
— "a planned job is not a breakdown"), while a history row, a past breakdown and a live close are all
`kind: 'stopped'` (`apps/server/src/modules/tickets/past.ts:158`). So a support close with a report, a PM job's report
and a general work request are **not** failures, and the 1,279 history rows and the cutover fixture's two history rows
**are**: the platform's own log is history, so a predicate that dropped it would make the two columns incomparable.
`isBreakdownChannel` is deliberately **not** used here:
it excludes `import` and `backfill` (`packages/shared/src/channel.ts:7-13`), i.e. exactly the history rows this figure
must count. The dedupe key is
DATA-MAP §2's own ("where machine, date, shift and downtime agree"), applied to a live report whose four fields equal a
history report's; only the exact match drops, so "pairs that might match but are not certain" are left alone, as that
rule requires. Nothing invents a cutover date, because no product code stores one. Cost if wrong: after cutover a live
breakdown that exactly repeats a history row is counted once, which is the rule's intent but could hide a genuine
repeat of the same four values on the same day; 48a pins that boundary both ways (an exact repeat folds into one
failure, a same-day repeat whose downtime differs is two), and the legacy column still counts the history row, so the
comparison keeps the evidence.

**R5 — MTBF = (working hours − breakdown hours) ÷ failures, exposure right-censored at `asOf`, and no failure prints
nothing.** The exposure of a machine that failed is its whole working time minus its breakdown time, so the interval
since its last failure is failure-free time (the standard treatment, not an invented one); the exposure of a machine
that never failed is still in the denominator of every group it belongs to, but the machine's own MTBF is `null` and
the plant KPI counts it ("8 of 125 machines have no failure"). A3's convention — MTBF = available hours when the count
is 0 (`a3-mttr-mtbf-context.ts:96-97`) — stays exactly where it is, in the legacy figure. Cost if wrong: a machine with
no history reads "no failure in the window" instead of a large number that looks like a measurement; 67's Weibull fit
will read the same censored exposure and needs this convention anyway.

**R6 — MTTR = exact recorded minutes ÷ failures; the repair clock is not MTTR.** `downtimeMin ÷ 60`, never the
workbook's 2-dp `recordedHours` (649 rows disagree with their own minutes on the fixture) and never `repairMin`, which
measures the crew's wrench time and is greater than the downtime on 4 of the 60 rows that carry it (an entry can keep
the repair clock running after the machine is back) — 42's manpower figure already reports it. Cost if wrong: on the
fixture the two MTTRs agree to two decimals (2.3888 vs 2.3926) and the 4.89 h of accumulated rounding is visible only
at three; a plant that wants SMRP's "maintenance time excluding waiting" needs the repair clock on every close, which is
a floor-form change, not a figure.

**R7 — availability is operational availability, and BD %/PM % keep the platform's quotients.**
`1 − (BD + PM) ÷ working hours`, which equals `MTBF ÷ (MTBF + MTTR)` for the unplanned side alone (99.49 % without PM
on the fixture) — the printed 99.36 % removes PM too, exactly as the platform's `1 − BD % − PM %` does
(`docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html`, A1's own formula), because the plant loses the
machine either way. BD % = BD hours ÷ working hours; PM % = PM hours ÷ working hours. PM **compliance** ("was the PM
done on time") is ticket 50's and is not here (E10). Cost if wrong: a plant that wants a "production availability"
ignoring planned stops needs a second key; its formula is one line over the same totals.

**R8 — the shift a breakdown belongs to is the shift recorded on its report, never re-derived from a clock.**
History rows carry only a date and a shift code; a live close carries the code the floor picked (defaulted from the
clock by `currentShiftCode`, `apps/web/src/components/reportFields.ts:44-64`) and the production date the plant already
stamps for a stop after midnight inside a crossing shift (`reads.ts:110-125`, DOMAIN §5). So the split buckets by
`(report.shift normalised, report.date's month)` and nothing else; `1ST`/`2ND` are aliased to `1`/`2` as the answer-key
fixture already does (`packages/domain/test/answer-key/fixture.ts:47`). A code with no window (`3`, two real rows) keeps
its own row with `—` hours and is in the plant total. Cost if wrong: an operator who keys a 01:00 entry to the
following calendar day puts it in that day's shift-2 cell although the shift began the evening before; every shift
total over a period of a day or more is unaffected, and no figure ever moves a row between shifts.

**R9 — the day's working minutes are split 629/631, so the shift rows add to the plant exactly.** The overlap minute
belongs to the later shift (DOMAIN §5), which is also the rule the day report and the SLA calendar use. Cost if wrong:
giving the minute to shift 1 (or sharing it) moves 0.08 % of the hours between two rows and makes the two shifts' working
hours add to 1,261 minutes a day, one more than the plant has; the fixture asserts the sum.

**R10 — the live rows keep the code they are stored with; a blank code is its own bucket `—`.** 47 stores one code on
every live close (47 R3) and canonicalises legacy codes on load (47 R7), so the code axis counts one code per row.
Cost if wrong: a plant with a pre-47 client that stored a blank code sees a `—` row on the axis; nothing is dropped.

**R11 — the code axis is labelled from `maint_code`, not from the `failure_code` descriptions.** 47 R9 leaves this to 48. The Pareto prints the code as recorded (after 47's canonicalisation) and its label from the tenant's `maint_code`
list, because that is the list every other figure prints and the one 47 mirrors a picked code into; the `failure_code`
descriptions are the settings screen's copy. Cost if wrong: a code renamed only on the Failure codes screen keeps its
old label on the axis until it is renamed on the maintenance-code list too (one screen edit, no data change).

**R12 — where the standard figures live: one new `shift-kpis` screen in the Breakdowns group, four figure keys, and
every legacy figure untouched.** Keys, in registry order:
`shift-kpis.compare`, `shift-kpis.shift-split`, `shift-kpis.backlog`, `shift-kpis.breakdown-map`; all four drill
`ticket`. The comparison table prints the platform's column beside the working-hours column, and the legacy column is
computed with the legacy rules (`effectiveHours`, the flat annual hours) so that its five cells **equal the answer
key's own printed cells** (asserted against A3 and A1 in 48a's test). The three key-shaped breakdown figures keep
their values and their keys: `analytics-breakdown.test.ts:535,581,668` assert `value.pages` **equals** the answer key
for A1, A2 and A3, so a standard row added to any of them is a parity break by construction, and PARITY.md's promise is
a _second, labelled figure_, not a rewritten one. (The Dashboard is not in that set — its tiles are asserted one number
at a time against `dashboard.json` — so the guarantee this plan rests on is the three breakdown pages, not the
Dashboard.) Cost if
wrong: a reader on A3 does not see the working-hours number without one click into the Breakdowns menu; the alternative
is a changed platform page, which the parity tests forbid.

**R13 — every figure names its own tickets; above 200 ids the house fallback carries it, per row nothing is invented.**
`shift-kpis.compare` and `.shift-split` name all 1,279: at Cosmos's size the too-many rule prints the count and opens the
Breakdown log (`KeyPage.tsx:51-73`), whose filters are date, shift, machine and code — which is exactly how a Pareto row
is found. `shift-kpis.breakdown-map` names the same set. `shift-kpis.backlog` names its open tickets and is therefore
the figure that lists rows on the real plant. Per-bar drill (a bar's own tickets) is **not** in this ticket: the page
table renderer has no row link, and inventing one would touch the renderer for every page figure. Cost if wrong: a
reviewer who wants click-a-bar-to-its-tickets gets a follow-up on `PageTable` (one optional field and one renderer
branch), not a new figure.

**R14 — the new chrome lives where the budgets allow, and nowhere else.** The four Pareto chart ids and their titles go
into `apps/web/src/screens/analytics/screen-charts.ts` (115 lines; it gains a `mixed` kind — bars plus the cumulative
line — copied from `page-content.ts:340-372`, which already renders the annual report's Pareto this way at `:192`),
because `page-content.ts` is at 397 of 400 lines and must not gain a chart entry. Labels go into
`analytics-breakdowns.en.ts` (49 lines; its `.gu.ts` is `blank(...)`, so the keys exist in both catalogues, which
`groups.test.ts:39-49` requires), because `analytics.en.ts` is at 248 of the 250-line cap. The heat grids reach the face
through the existing page-table seam with one new `heat: true` flag on the engine's table and a `HeatTable` in
`parts.tsx` (113 lines), not through `use-chart.ts` (394 lines) and not as a new chart kind: a heat map is a matrix, and
`PageFigure` can draw it. `page-content.ts` gains at most two lines (the `heat` passthrough and its type field) and
leaves at ≤ 399: **if it cannot, `pageTable` moves to `page-parts.ts` in the same PR** (mechanical; the tests import
`contentOf`, not `pageTable`). Cost if wrong: a designer wanting ECharts colour scales on the heat grid gets a
follow-up; the numbers, the layout and the drill do not change.

**R15 — every stored row carries its own profile, and these figures' is `standard`.** `snapshot.ts:7`'s single
`PROFILE` constant becomes one exported helper `profileOfKey(key)` — `shift-kpis.*` and `pm-compliance` are `standard`,
everything else `legacy` — and the store writes **one row per figure with that row's profile** (the insert already
carries `profile` per row; whether it batches through `jsonb_to_recordset` or loops is the implementer's choice, but no
statement may use one constant for a mixed run). The unique key already includes `profile`, so the two families never
collide (`0014_m4a_schema.sql:54-74`). Ticket 50's `pm-compliance` uses the same helper — 50's plan states the
per-row store; this ruling is the one shared home. No new table (D17), no migration, no column, no reply-schema change.
Cost if wrong: a third family later needs the same one-line list; a `profile` field on `FigureDef` is the follow-up.

**R16 — English only, and the Guide keeps the answer key's 36 headings.** New copy goes into
`analytics-breakdowns.en.ts` (screen, four figure labels, four chart titles, four axis names) and
`analytics-guide.en.ts` (four `body3` keys, one per packet that has copy to add). The `available-hours` body carries
the **21-versus-20 rationale in the
plant's own words** — the two shift windows cover 21 hours, the workbook's 20 × 300 stays beside it because that is what
the platform printed, and both columns stay on screen — so the reader meets the one number this ticket changes where the
basis is explained, not only in the plan. The Guide test fixes the 36 headings verbatim (`guide-entries.test.ts:41-46`),
so the four figures are named by **existing** entries: `shift-kpis.compare` joins "Available hours" (the basis),
`shift-kpis.shift-split` and `shift-kpis.backlog` join "MTTR and MTBF" (the definitions and what an open breakdown is
not), `shift-kpis.breakdown-map` joins "Category and cell analysis" (where the hours come from). Cost if wrong: a
reader looking for "Pareto" in the Guide's contents finds it under the analysis entry that names the map; rewording a
heading would need a lock decision and an answer-key change.

## Frozen interface for 50, 53, 54 and 67

- `EngineData.shifts?: readonly ShiftRow[]` with `ShiftRow = {code: string; name: string; startMinute: number;
endMinute: number; crossesMidnight: boolean; active: boolean}` — the one new field on the engine's input.
- `packages/domain/src/analytics/working-hours.ts` exports `shiftCalendar(shifts, timeZone)` (a `BusinessCalendar` of
  the active windows, the overlap to the later shift), `workingMinutesPerDay(shifts)` (`{total, byShift}`),
  `workingHoursFor(machine, shifts, workDaysPerYear, window)` and `workingHoursPlant(data, profile, asOf)`.
- `packages/domain/src/analytics/standard-kpis.ts` exports `failureEvents(data)`, `standardTotals(data, profile, asOf)`,
  `legacyTotals(data, profile, asOf)` — each `{workingHours, breakdownHours, pmHours, failures, mttr, mtbf,
availability, bdPct, pmPct, machines, machinesWithoutFailure}` with `mttr/mtbf/availability` nullable.
- Every figure's value is `{screen, asOf, <block>, pages}`: the face reads `pages`, and `<block>` is the number a
  later ticket reads **beside** the printed strings, so nothing has to parse a formatted cell.
  - `shift-kpis.compare` → `basis: {legacy: <totals>, standard: <totals>, minutesPerDay, annualHours}`.
  - `shift-kpis.shift-split` → `shifts: [{code, breakdowns, breakdownHours, pmHours, workingHours, mttr, mtbf,
availability}]`, plant first-then-sums order as printed.
  - `shift-kpis.backlog` → `backlog: {count, oldestWorkingHours, under4, to24, to72, over72, tickets: [{id, ref,
machineCode, status, reportedAt, workingHours}]}`, oldest first.
  - `shift-kpis.breakdown-map` → `map: [{dimension: 'machine' | 'cell' | 'code' | 'shift', rows: [{key, breakdowns,
hours, cumulativePct}], fiftyPct: {count, of}}]`.
- 53 reads `value.basis.standard.*` and `value.backlog.count`; 54 reads nothing new; 67 reads `failureEvents` and the
  censored exposure, not the printed numbers.

## Packet 48a — the working-hours basis and the comparison (engine + its screen, one PR)

**Files (22: the seam, the first figure and the new screen's plumbing; the PR body carries one plain line,
`Large slice: the working-hours seam plus the first figure and screen of a new family`, because the counter's 400-line
warning is about code and this packet lands a new module, a new screen and its test together — the two later packets
add figures to a screen that already exists).**
`packages/domain/src/analytics/types.ts` (`ShiftRow`, `shifts?` on `EngineData` at `:222-240`),
`packages/domain/src/analytics/working-hours.ts` (new: the calendar, the minutes, the hours, the split),
`packages/domain/src/analytics/standard-kpis.ts` (new: `failureEvents`, `legacyTotals`, `standardTotals`, the compare
figure), `packages/domain/src/analytics/computers.ts` (one key), `packages/domain/src/analytics/registry.ts` (one figure,
owner 48, screen `shift-kpis`, drill `ticket`), `packages/domain/test/answer-key/fixture.ts` (the engine's data gains
`shifts` from the workbook's own `settings.shiftTimes`, the two windows the platform was configured with),
`packages/domain/test/shift-kpis.test.ts` (new), `packages/domain/test/shift-kpis-expected.ts`
(new: the hand-computed numbers with the arithmetic in comments — **not** under `fixtures/answer-key/`, which holds what
the platform itself showed), `packages/domain/test/analytics-engine.test.ts` (the owner bound and the owners list),
`apps/server/src/modules/plant/repo/analytics.ts` + `apps/server/src/modules/plant/index.ts` (`shiftsForEngine`),
`apps/server/src/modules/analytics/load.ts` (one field), `apps/server/src/modules/analytics/snapshot.ts` (the per-row
`profileOfKey` and its use), `apps/web/src/screens/analytics/groups.ts` (the screen label and the figure label in `SCREEN_LABELS`/`FIGURE_LABELS`,
the screen in the Breakdowns group at `:33-95`), `apps/web/src/screens/analytics/figure-content.ts` (`KIND` and
`PAGE_KEYS` for the one key), `apps/web/src/screens/analytics/BreakdownsPage.tsx` (the screen id at `:23` and its
branch at `:91-105`), `apps/web/src/screens/analytics/ShiftKpisPage.tsx` (new, ~50 lines: for each figure of the screen
in registry order, `PageFigure` + `FigureDrill` — the house pieces, no new renderer),
`apps/web/src/screens/analytics/guide-entries.ts` (the `available-hours` entry gains `shift-kpis.compare` in its
`figures` list, which is empty today, and a `body3` key — the one place the working-hours basis is explained),
`packages/shared/src/i18n/analytics-guide.en.ts` (`analytics.guide.available-hours.body3`, the sentence the plan's
rationale becomes on screen; `analytics-guide.gu.ts` is `blank(analyticsGuideEn)`, so the key exists in the Gujarati
catalogue the moment it exists in English and **no gu file is edited**), `packages/shared/src/i18n/analytics-breakdowns.en.ts`
(two keys), `docs/spec/parity.yaml` (one row, `in-progress`) and
`docs/spec/PARITY.md` (one line under §2).

**Red:** `pnpm exec vitest run packages/domain/test/shift-kpis.test.ts` — the test lands first and fails on the missing
module. **Green:** the same, then `pnpm exec vitest run packages/domain/test` (the engine test's owner change and every
frozen key stay green; `registry.test.ts` is untouched here because this packet adds only a **type** (`ShiftRow`, plus the optional
`EngineData.shifts` field) and the D2 pin reads `Object.keys` of the runtime exports, which do not move), `pnpm exec vitest run apps/server/test/analytics-engine.test.ts` (the loader fills `shifts` from
the fixture's one `DAY` shift row, 08:00–18:30, and the four standard rows are stored with `profile: 'standard'`), and
`pnpm exec vitest run apps/web/src/screens/analytics` — which runs `guide-entries.test.ts`, the test that fails on a
missing `body3` or an unnamed figure, `groups.test.ts` and `figure-content.test.ts` together.

**Acceptance.**

- Given the 11 November workbook and `asOf` 2026-11-11, when `shift-kpis.compare` is computed, then its legacy column is
  `439.9`, `2.39`, `99.32`, `0.54`, `0.13` — equal to A3's `PLANT TOTAL` cells and A1's three KPI cells, read from the
  answer-key files, not re-typed — and its working-hour column is `462.0`, `2.39`, `99.36`, `0.51`, `0.13`; the KPI row
  states 21.0 working hours a day, 5,93,977.10 working hours, 1,279 failures and 8 machines with no failure.
- Given the same, when the working hours are computed, then each machine's share is `periodFraction(purchase date or
1 January, 11 November)` of 6,300 h, and the plant total is 5,93,977.10 (the legacy total, 6,000-based, is
  5,65,692.47) — the two bases are asserted against each other so neither can drift silently.
- Given the cutover fixture, when the standard totals are computed, then four failures are counted (the duplicate live
  row dropped, PM excluded, NO DT counted with no hours), MTTR is 1.13, MTBF 1,573.9, availability 99.87 %, and the
  legacy column of the same data sees two failures and MTTR 1.50: a live close moves the standard figure and not the
  legacy one.
- Given the same fixture with one row added — a live close on the same machine, day and shift as the history row but
  with a different downtime — when the totals are computed, then **two** failures are counted: the dedupe key is the
  four fields together, so a same-day repeat that differs in its downtime is a real second failure.
- Given the same fixture with a support ticket closed with a report, a PM job's report and a general work request,
  when the totals are computed, then none of the three is a failure — they are `kind: 'support'` and `kind: 'general'`
  — while the fixture's **two history rows are** two of the four failures: history stays in, and R4 never leans on
  `isBreakdownChannel`, which would drop every imported row.
- Given a plant with no shift rows, when the figure is computed, then it is `ready`, the working-hour column is `—`, a
  KPI says "No shift windows in Settings", and nothing is fabricated; given a plant with no breakdown rows, then the
  value is `null` and the drill is empty.
- Given the plant's two seeded shifts (08:00–18:30, 18:29–05:00) and **a third shift row the test writes itself** (the
  seed has only the two), switched off, when the calendar is built, then it holds 1,260 minutes a day, split 629 and
  631, and the switched-off shift contributes nothing.
- Given plant B's rows, when plant A's figure runs, then nothing of B is read: the loader is inside the tenant's
  transaction and the engine's data is A's (`withTenant`, D24).

**Covering suite:** `pnpm exec vitest run packages/domain/test packages/shared/test`, plus
`pnpm exec vitest run apps/server/test/analytics-engine.test.ts apps/server/test/reply-contract.test.ts` (no route or
reply shape changes; the strict figure schema must still parse every figure), plus
`pnpm exec vitest run apps/web/src/screens/analytics`.

## Packet 48b — the shift split and the backlog (engine + their screen sections, one PR)

**Files (13).** `packages/domain/src/analytics/shift-split.ts` (new: the per-shift rows and hours),
`packages/domain/src/analytics/backlog.ts` (new: the queue and its working-hour age),
`packages/domain/src/business-hours.ts` (one exported helper, `plantDayStart(plantDate, timeZone)`, built on the
existing `localToUtc`/`formatter` at `:120-147` — the one zone-aware midnight in the codebase),
`packages/domain/src/analytics/computers.ts` (two keys), `packages/domain/src/analytics/registry.ts` (two figures),
`packages/domain/test/registry.test.ts` (the D2 public-API pin: the sorted root list gains one name, `plantDayStart`,
straight after `plantDay`; the six analytics helpers stay out of the root and are deep-imported by their tests), `packages/domain/test/shift-kpis-split.test.ts` +
`packages/domain/test/shift-kpis-backlog.test.ts` (new; the fixtures are the small purpose-built ones described above,
with the arithmetic in comments), `apps/web/src/screens/analytics/figure-content.ts`
(`KIND` + `PAGE_KEYS` for the two keys), `packages/shared/src/i18n/analytics-breakdowns.en.ts` (two labels),
`packages/shared/src/i18n/analytics-guide.en.ts` (two `body3` keys), `apps/web/src/screens/analytics/guide-entries.ts`
(the figure lists of "MTTR and MTBF"), `docs/spec/parity.yaml` (evidence line).

**Red:** `pnpm exec vitest run packages/domain/test/shift-kpis-split.test.ts
packages/domain/test/shift-kpis-backlog.test.ts`. **Green:** the same, then
`pnpm exec vitest run packages/domain/test/registry.test.ts` (the D2 pin with `plantDayStart` added), then the covering
suite below.

**Acceptance.**

- Given the 11 November workbook, when `shift-kpis.shift-split` is computed, then shift 1 is 821 breakdowns / 2,021.10 h
  / 2,96,517.14 working hours / MTTR 2.46 / MTBF 358.7 / 99.13 %, shift 2 is 456 / 1,031.12 / 2,97,459.96 / 2.26 /
  650.1 / 99.59 %, and shift 3 is 2 / 3.00 with `—` hours.
- Given the same, when the rows are added up, then **only the counts, the BD hours, the PM hours and the working hours
  sum** — 1,279 breakdowns, 3,055.22 h, 759.27 h and 5,93,977.10 h — and each of those is asserted cell by cell; the
  plant's MTTR, MTBF and availability are **recomputed from the summed totals**, never added or averaged from the shift
  rows: 3,055.2167 ÷ 1,279 = 2.39, (5,93,977.10 − 3,055.2167) ÷ 1,279 = 462.0, and 1 − 3,814.4834 ÷ 5,93,977.10 =
  99.36 %. The PM and working-hour cells are asserted on their unrounded values, because the printed 2-dp cells add to
  759.26 against the plant's 759.27 (a 0.01 h rounding difference, never a data difference); only the BD hours are asserted
  cell by cell at two decimals, since `2,021.10 + 1,031.12 + 3.00 = 3,055.22` exactly.
- Given a row recorded as `1ST` and one as `2ND`, when the split is computed, then they count in shifts 1 and 2 and no
  row is dropped; given a shift code the Settings have no window for, then its row prints with `—` hours and its
  breakdowns and hours are still in the plant total.
- Given a live close at 01:00 recorded under shift 2 with the production date of the evening before (DOMAIN §5), when
  the split and the heat grid are computed, then it counts in shift 2 on that production date's month, and no rule
  re-derives its shift from the clock.
- Given the backlog fixture, when `shift-kpis.backlog` is computed at `asOf` 2026-11-11, then the count is 3, the oldest
  is 36.0 working hours, the buckets are 0 / 2 / 1 / 0, the rows are T3, T1, T2 in that order, and the drill names
  those three tickets; a closed ticket, a cancelled ticket, a history row, a PM ticket, an **open support ticket** and
  an **open general work request** are not in it (the kind is R4's test, not `status !== 'closed'` alone).
- Given a ticket reported at 23:59 on the as-of day, when its age is computed, then it is under one working hour and
  never negative (the window ends at the start of the next plant day); given a Saturday and a Sunday, when ages are
  computed, then the plant's shift calendar covers them (the plant has no holiday calendar and this figure does not
  invent one).

**Covering suite:** `pnpm exec vitest run packages/domain/test packages/shared/test
apps/web/src/screens/analytics`, plus `pnpm exec vitest run packages/domain/test/sla.test.ts`
(the `business-hours` helper is shared with the SLA clocks and must not move them).

## Packet 48c — the Pareto and the heatmaps (engine + screen, one PR)

**Files (14).** `packages/domain/src/analytics/breakdown-map.ts` (new: the four dimensions, the cumulative shares, the
50 % point, the heat grids), `packages/domain/src/analytics/computers.ts` (one key),
`packages/domain/src/analytics/registry.ts` (one figure), `packages/domain/test/shift-kpis-map.test.ts` (new; it
deep-imports `breakdown-map.js` like the other figure tests import their modules, so the D2 root list does not move), `apps/web/src/screens/analytics/screen-charts.ts` (four chart ids,
the `mixed` kind, the titles/axes read from the catalogue), `apps/web/src/screens/analytics/parts.tsx` (`HeatTable`),
`apps/web/src/screens/analytics/PageFigure.tsx` (the heat branch), `apps/web/src/screens/analytics/page-content.ts`
(at most two lines: the `heat` passthrough and its field — R14), `apps/web/src/screens/analytics/figure-content.ts`
(`KIND` + `PAGE_KEYS`), `packages/shared/src/i18n/analytics-breakdowns.en.ts` (labels, four chart titles, four axis
names), `packages/shared/src/i18n/analytics-guide.en.ts` (one `body3`), `apps/web/src/screens/analytics/guide-entries.ts`
(the "Category and cell analysis" figure list), `apps/web/e2e/analytics-shift-kpis.spec.ts` (new),
`docs/spec/parity.yaml` (the row becomes `done` with all three evidence lines).

**Red:** `pnpm exec vitest run packages/domain/test/shift-kpis-map.test.ts` and
`pnpm exec playwright test apps/web/e2e/analytics-shift-kpis.spec.ts`. **Green:** the same, then
`pnpm exec playwright test apps/web/e2e/analytics-breakdowns.spec.ts` (A1/A2/A3 still render and drill), then the
covering suite.

**Acceptance.**

- Given the 11 November workbook, when `shift-kpis.breakdown-map` is computed, then each of the four dimensions ranks by
  hours with a cumulative share that ends at 100.00 %, the 50 % points are 13 of 125 machines, 3 of 9 cells, 3 of 23
  codes and 1 of 3 shifts, and the rows are worst first (TMC-2 307.58 h at 10.1 %; cell 7 776.78 h; code E 687.60 h;
  shift 1 2,021.10 h at 66.2 %).
- Given the same, when the heat grids are computed, then each grid's row sums equal that row's Pareto hours (asserted as
  an invariant over all four dimensions) and the month columns are the months of the as-of year that have happened
  (Jan to Nov at 2026-11-11, never a December column of zeroes); the machine grid names the machines it prints and says
  how many it left out.
- Given a loaded code, when the code axis is computed, then the label comes from `maint_code` (47's canonicalisation on
  load) and a code with no list row prints as recorded; PM rows are absent from every dimension and a `NO DT` row is in
  its code's row with zero hours.
- Given the four figures on the screen, when a head opens Breakdowns → Shift-calendar KPIs, then the comparison, the
  shift table, the backlog and the four Paretos with their heat grids are on one screen, each with an Open link; given a
  figure with more than 200 tickets, then the note names the count and links to the Breakdown log; given the backlog,
  then Open lists its tickets.
- Given an operator, when they open the screen, then the figures reply is refused (403) as for every analytics screen
  (`apps/server/test/analytics-engine.test.ts`, "shows every money figure only to heads and admin…"); given a
  supervisor, then the screen renders and no money figure appears (this ticket adds none).

**Covering suite:** `pnpm exec vitest run packages/domain/test packages/shared/test apps/web/src/screens/analytics`,
`pnpm exec vitest run apps/server/test/analytics-engine.test.ts apps/server/test/reply-contract.test.ts`,
`pnpm exec playwright test apps/web/e2e/analytics-breakdowns.spec.ts apps/web/e2e/analytics-shift-kpis.spec.ts`, and
`pnpm ui:check` after the screen lands.

## Rails

Red first in every packet (the named test is red before the source edit; a browser packet's red is the failing
journey); never delete, skip or weaken a test — the two owner assertions in `analytics-engine.test.ts:68-69,87-92`
change to say 38–45 **and** 48, which is stricter than before, and no other assertion moves. One writer per packet, one
PR, one `changes/48-shift-kpis.md` section per packet in packet order. The root export list is a pinned public API (`packages/domain/test/registry.test.ts`, D2): a new _function_ in
`business-hours.ts` or `analytics/index.ts` reaches it through `export *` and breaks the pin, so only `plantDayStart`
joins it (48b lists that test) and the six analytics helpers stay module-private, deep-imported by the tests the way
`analytics-breakdown.test.ts:17-30` already imports `availability.js` and `hours.js`. No new dependency (ECharts and
the design kit already draw bars, lines and mixed charts; no calendar library, because there is no calendar screen
here). No new table and no migration (D17; 46 owns M4b's and 48 stores only in `kpi_snapshot`, R15). Every new query names `tenant_id` and
runs inside the tenant transaction; `app_user` keeps its existing grants. Modules talk through their published
interfaces: `analytics` may call `plant` (it already does, `load.ts:20-24`), and the new `shiftsForEngine` is the plant
module's own read. File ≤ 400 lines, function ≤ 60, `pnpm format:check` on the plan and the fragment, `pnpm precheck`
before every push. The fragment rows for `docs/spec/parity.yaml` are added with the feature line in `PARITY.md`, and the
PR body carries a `Large PR: …` line when the changed lines pass the counter's 400-line warning.

## Where a reviewer should push

First, **R2's 21 hours**. It is the one number a reader will question: the plant says 20 production hours a day and its
two windows cover 21, so the working-hour basis is _more_ available time than the platform's and MTBF rises 5 % and
availability moves from 99.32 % to 99.36 % for that reason alone, not because the plant improved. The defence is that the 20 is a
workbook constant PARITY.md already lists as a thing not to carry (`PARITY.md:147`) and the shift rows are the plant's
own record; the reviewer should check the two windows are the _effective_ ones (629/631, not 630/631 or 630/630) and
that a switched-off shift really leaves the calendar. Second, **R4's dedupe**: it is a pure function over four fields
taken from DATA-MAP §2, and the reviewer should attack it with a live row that looks like a history row but is a
genuine repeat on the same day, and confirm nothing else drops. Third, **R5's null MTBF**: a machine with no failure
now prints nothing, and 53 will store that null; the reviewer should confirm the scorecard's frozen period can hold a
null metric rather than a zero. Fourth, **R14's budget arithmetic**: `page-content.ts` must be re-measured after the
heat flag (399 or fewer) and no chart entry may sneak into it; `analytics.en.ts` must not gain a line. Fifth, the
**legacy column's exactness** — it must be computed with `effectiveHours` and the flat annual hours, because that is the
only way its five cells equal A3's and A1's printed cells; a reviewer who finds it computed with minutes has found a
parity bug even though the numbers still round the same at two decimals.

## Not in this ticket

No schedule compliance and no PM compliance (ticket 50, E10). No per-technician figure, no ranking inputs (54). No
Weibull, Kaplan-Meier or Crow-AMSAA fits (67) — 48 gives 67 the censored exposure and the failure set, no distribution.
No forecast or `kpi_snapshot` period freezing (52, 53). No holiday calendar, no roster-driven working days, no new
setting. No chart kind or chart library change. No AI-suggested code, no change to the close form or the code list
(47). No history backfill and no re-coding of imported rows.
