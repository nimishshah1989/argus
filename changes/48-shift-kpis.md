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
