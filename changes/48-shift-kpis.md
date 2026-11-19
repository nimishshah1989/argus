# 48 — shift-calendar KPIs

**What changed for a user:** the plant finally gets MTBF, MTTR and availability on the hours its machines really
work — its own two shift windows (08:00–18:30 and 18:29–05:00, the disputed minute to the later shift) times its
working-days setting, so 21.0 hours a day and 6,300 a machine a year instead of the workbook's flat 20 × 300 — and those
five numbers are shown **beside** the platform's own, never instead of them: on the 11 November workbook MTBF reads
462.0 hours on working hours against 439.9 on the platform's basis, MTTR 2.39 both ways, availability 99.36 % against
99.32 %, BD % 0.51 against 0.54 and PM % 0.13 both ways, with the platform's column computed by the platform's own
rules so its cells are the answer key's cells. The same screen holds the shift split (821 breakdowns and 2,021.10 hours
on shift 1, 456 and 1,031.12 on shift 2, and two rows under a third code the Settings have no window for), the backlog
(the live breakdowns the plant still owes an answer on, aged in working hours and bucketed), and four Paretos with
their heat grids — by machine, cell, code and shift — where 13 machines caused half the lost hours, 3 of the 23 codes
caused half, and shift 1 carried 66.2 % of them. Everything drills to its tickets; a figure with more than 200 tickets
opens the Breakdown log with the count named. The plan is `docs/slices/48-shift-kpis.md`: packet 48a is the
working-hours seam and the comparison, 48b is the shift split and the backlog, 48c is the Pareto and the heat grids.
No migration, no new table (the four rows live in `kpi_snapshot` under `profile = 'standard'`), no new dependency, and
no legacy figure changed — the platform's pages stay byte-for-byte what the answer key holds.

## 48a — the standard KPI column and its figure

- The plant's shift windows now reach the engine as data: `EngineData.shifts` (code, name, start and end minute,
  whether it crosses midnight, whether it is on), read by `shiftsForEngine` in the plant module and filled in one
  field of the analytics loader. The field is optional, so every existing fixture keeps compiling; with no window the
  standard column prints dashes and says so.
- `working-hours.ts` is the second basis: the union of the _active_ windows on the 24-hour circle, the 18:29-18:30
  overlap given to the later shift (DOMAIN section 5), so Cosmos's two windows are 629 + 631 = 1,260 minutes a day and
  6,300 hours a machine a year, spread month by month from each machine's purchase date by the same rule the legacy
  basis uses. A switched-off shift contributes nothing.
- `standard-kpis.ts` is the failure set and the two columns. Failures are non-PM reports of `kind: 'stopped'` tickets
  that are closed, history and live, on production machines; a live report whose machine, date, shift and downtime
  exactly repeat a history row counts once; a NO DT row counts with zero lost time; support tickets, PM jobs, general
  work requests and open breakdowns are not failures. MTTR uses exact minutes, MTBF divides the censored working
  exposure by the failures and prints nothing for a machine with no failure, availability is operational (1 - BD - PM
  over working hours), and BD %/PM % keep the platform's quotients over the new basis.
- `shift-kpis.compare` prints the platform's five cells beside the working-hour five, with the four KPI facts (21.0
  hours a day, 5,93,977.10 working hours, 1,279 failures, 8 machines with no failure). The platform column is computed
  with the legacy rules (`effectiveHours`, the flat annual hours), so its cells equal A3's PLANT TOTAL pair and A1's
  three KPI cells, read from the answer-key files in the test rather than retyped. The figure drills all 1,279
  tickets; above 200 the house rule opens the Breakdown log.
- A new Breakdowns screen, "Shift-calendar KPIs", draws the figure with the house key page and its drill. The Guide's
  "Available hours" entry names the figure and carries the 21-versus-20 sentence; the label copy lives in
  `analytics-breakdowns.en.ts` (its `.gu` is `blank(...)`, so both catalogues have the keys).
- The snapshot writer stamps each row with its own profile: `shift-kpis.*` (and ticket 50's `pm-compliance`) are
  `standard`, everything else `legacy`. One statement, one row per ready figure, never one constant for a mixed run;
  the table's unique key already includes `profile`.
- Tests: `shift-kpis.test.ts` holds the whole expected table (the platform cells from A1/A3, the standard cells from
  the hand-computed `shift-kpis-expected.ts`), each machine's share of 6,300 hours and the plant total, the
  support/PM/general exclusions, the cutover fixture (four standard failures against the platform's two), the
  same-day repeat both ways, the no-shift and no-failure cases, and the two-shift windows plus a third row the test
  writes itself. The server test reads the fixture's `DAY` shift through the loader and stores a mixed run under two
  profiles. The owner assertions in `analytics-engine.test.ts` become 38-45 and 48.

## 48b — the shift split and the backlog

- The shift split groups the failure set by the shift recorded on each report (`1ST`/`2ND` normalised to `1`/`2`),
  each shift dividing by its own share of the plant's working hours: 629 and 631 minutes of the 1,260-minute day, so
  the rows add to the plant exactly. A code the Settings have no window for keeps its row (2 breakdowns, 3.00 h for
  code `3` on the workbook) and prints dashes where a denominator is missing. On 11 November: shift 1 821
  breakdowns / 2,021.10 BD h / 571.28 PM h / 2,96,517.14 working h, MTTR 2.46, MTBF 358.7, availability 99.13 %;
  shift 2 456 / 1,031.12 / 187.98 / 2,97,459.96, MTTR 2.26, MTBF 650.1, availability 99.59 %; the plant row 1,279 /
  3,055.22 / 759.27 / 5,93,977.10, 2.39, 462.0, 99.36 %. Only the counts and the three hour cells add; the plant's
  MTTR, MTBF and availability are recomputed from the summed totals, never averaged from the rows.
- The backlog is every breakdown ticket (`kind: 'stopped'`) still open at the as-of plant date, aged in the plant's
  working hours to the start of the next plant day and bucketed under 4, 4 to 24, 24 to 72 and over 72 hours. On
  the purpose-built fixture (the answer key holds no open ticket) the three open tickets age 36.0, 23.0 and 15.0
  hours, the buckets are 0 / 2 / 1 / 0, the rows are T3, T1, T2 oldest first and the drill names those tickets. A
  closed live ticket, a cancelled one, a closed history row, a PM job, an open support ticket and an open general
  work request are not in it. The plant has no holiday calendar, so Saturday and Sunday count; a ticket reported at
  23:59 is one working minute old; a plant with no shift window prints dashes, not a zero.
- `plantDayStart(plantDate, timeZone)` joins `business-hours.ts`: local midnight of a plant date, the one zone-aware
  midnight, built on the same DST-safe step as the SLA windows. It adds one name to the public API, and the D2 pin
  gains `plantDayStart` after `plantDay`; the SLA clocks are untouched and their suite stays green.
- The screen's two new figures render through the house key page (one table each) and their drill; the Guide's
  "MTTR and MTBF" entry names both and carries two new paragraphs (the split and the backlog definitions). The two
  figure labels live in `analytics-breakdowns.en.ts`; the registry, `computers.ts` and `figure-content.ts` gain the
  keys. `parity.yaml` records both test lines. No new table, no migration, no dependency, no legacy figure moved.
- Tests: `shift-kpis-split.test.ts` (the whole printed table, the 629/631 shares, the unrounded sum invariant, the
  plant rates recomputed and proven different from the row average, the `1ST`/`2ND` aliases, the windowless row, the
  01:00 live close, the no-window dashes and the drill), `shift-kpis-backlog.test.ts` (the zone-aware midnight and
  its DST cases, the three ages and buckets, the exclusions, the 23:59 edge, the weekend, the no-window dashes and
  the empty queue) and the D2 pin.

## 48c — the Pareto and the heat grids

- `breakdown-map.ts` ranks the failure set's exact hours four ways — by machine, cell, maintenance code and shift —
  worst first, with each row's running share and the row that passes half the lost hours. On the 11 November
  workbook: TMC-2 20 failures 307.58 h (10.07 %), cell 7 283 failures 776.78 h, code E 314 failures 687.60 h and
  shift 1 821 failures 2,021.10 h (66.15 %); the 50 % points are 13 of 125 production machines, 3 of 9 cells, 3 of
  23 codes and 1 of 3 shifts. Every dimension sums to the same 3,055.2167 h and its cumulative share ends at
  100.00 %. The cell is the machine's registered cell (the plan's own grouping), the code prints the code as
  recorded with its `maint_code` label, PM is absent from every dimension and a NO DT row sits in its code's row at
  zero hours.
- The four heat grids cut those same rows by the months of the as-of year that have happened (Jan to Nov at
  2026-11-11, never a December column of zeroes). A row's cells always add to that row's Pareto hours; the test
  asserts the invariant over all four dimensions, and pins shift 1's January (176.65 h), code E's April (260.67 h)
  and TMC-2's June (242.42 h). The machine grid prints the Pareto's top fifteen and says how many it left out (102
  of the 117 machines with a failure); the cell, code and shift grids print every row.
- The face is the existing kit: `screen-charts.ts` gains the four chart ids and the annual report's `mixed` shape
  (hours bars plus the running-share line), and `parts.tsx` gains one `HeatTable` that `PageFigure` draws for a
  table the engine marks `heat`. `page-content.ts` gains the flag and stays at 399 lines; `use-chart.ts` and
  `analytics.en.ts` are untouched, and no new chart kind or dependency is added.
- The figure is `shift-kpis.breakdown-map` on the existing Shift-calendar KPIs screen; the Guide's "Category and
  cell analysis" entry names it and carries the map paragraph. `parity.yaml`'s row becomes `done` with the map test
  and the journey.
- Tests: `shift-kpis-map.test.ts` (the four rankings and their totals, the 50 % points, the worst rows, the grid
  invariant and the three pinned cells, the machine "left out" note, the four heat tables and mixed charts, the
  maintain-code label and the unlisted code, PM/NO DT, the empty plant and the no-window plant) and
  `apps/web/e2e/analytics-shift-kpis.spec.ts` (the menu journey, the compare row, a heat cell, the four ready
  charts and the drill, plus the operator's refusal).
