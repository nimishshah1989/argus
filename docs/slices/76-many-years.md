# E-76 — the engine reads many years (ticket 76)

Ticket 76, `docs/plan/MILESTONES.md:629-635`:

1. [Engine] Every figure takes an explicit period. On a hand-computed two-year fixture (at least 200 rows, one month
   with no records) 100 % of the period figures equal the hand values.
2. [Engine] 0 figures bucket by month number alone or divide many years' downtime by one year's hours. A month with
   no records prints "no records", never 0.
3. [Engine] The 2026 answer key stays whole: parity 119 rows, 0 problems, no test edited.

**Blocked by 74.** This is a plan only. Every line below was read on `main` at `58161f2`; every fault marked
"proven" was reproduced by a throwaway test against the real engine (not committed). Baseline:
`pnpm exec vitest run packages/domain` — 52 files, 614 tests, green. 76 changes `packages/domain` only: no server,
web, schema, migration, job or dependency.

## What is true on main today

- **One engine, one date.** `run(data, asOf, profile)` (`packages/domain/src/analytics/engine.ts:87-89`) cuts the
  plant at `asOf` with `dataAsOf` (`as-of.ts:18-43`: reports by date, tickets by plant day, machines by purchase) and
  hands every computer `{data, asOf, profile}` (`types.ts:318-322`). There is no period anywhere in the input.
- **51 figures** (`registry.ts:73-143`), 48 computed (`computers.ts:257-270`); `compare.spares-cost`,
  `team-focus.cost` and `action-center.spares-spend` answer `not_computed`.
- **Three time idioms carry every fault.** (a) `availabilityWindow(asOf, …)` (`availability.ts:75-83`) is always 1
  January to `asOf` of _one_ year; (b) `Number(date.slice(5, 7))` is a month number with no year; (c) "1 January of
  the first record's year to the last record" counts every day in between as observed. `periodFraction` and
  `availableHours` (`availability.ts:33-61`) already sum across years correctly — the faults are in which window the
  figures hand them.
- **The 2026 key is one year.** `fixtures/answer-key/input.json` holds 1,350 rows, all dated 2026, Jan–Nov all
  recorded. So every one-year assumption is invisible to the 614 tests.
- **What "no test edited" pins.** Tests import `availabilityWindow`, `monthlyWindow`, `annualPeriod`,
  `monthlyPeriod`, `workingHoursPlant`, `legacyTotals`, `standardTotals`, `workingHoursFor` and the type
  `DateWindow`; 16 call sites invoke a computer directly with `{data, asOf, profile}`; `registry.test.ts:61-66` pins
  the package's runtime exports. So: those names keep their signatures (new parameters optional), `ComputeInput`
  gains nothing required, and nothing new is exported from `src/index.ts` at runtime.

## Every figure, classified

| Class                                 | n   | Figures (cause, file:line)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (i) as-of, no period needed           | 14  | the six machine counts, `breakdown-free` (30-day look-back), `expansion-timeline`, `registers`, `cell-change-log`, `a7-footprint`, `a5-energy`, `action-center` (rolling windows from `asOf`), `shift-kpis.backlog`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| (i) right sums, but over every year   | 13  | `total-breakdowns`, `total-downtime-hours`, `pm-hours`, `no-downtime-hours`, `avg-bd-hours-per-machine`, `costliest-problems`, `bubble-chart`, `data-checklist`, `a8-age`, `breakdown-log`, `a2-category-cell`, `a6-why-why`, `fix-finder` — correct once their rows are the period's                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| (ii) silently the as-of year          | 5   | `annual-report` (`annual-report.ts:81-83`), `shift-kpis.breakdown-map` (`breakdown-map.ts:110-118`), `pm-compliance` (`pm-compliance.ts:216`), `reliability` (`reliability.ts:115`), `a4-manpower` (matrices year-cut at `a4-manpower.ts:113,123,136`; its table reads every year)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| (iii) wrong when the data spans years | 16  | **one year's hours under many years' downtime:** `plant-bd-pct`, `fleet-availability` (`computers.ts:88-104`), `a1-bd-pm` (`a1-bd-pm.ts:153`), `a3-mttr-mtbf` (`a3-mttr-mtbf-context.ts:228`), `a10-problems` what-if (`a10-problems.ts:36-50`), `machine-page` MTBF (`machine-page.ts:151`), `shift-kpis.compare` and `.shift-split` (`standard-kpis.ts:128`, `working-hours.ts:114`); **month number without year:** A1 (`a1-bd-pm.ts:90,122,234`), A3 (`a3-mttr-mtbf-context.ts:128,248`) with `hours.ts:42-47`; **gap read as failure-free:** `a9-bottleneck-forecast` (`a9-bottleneck.ts:113-128`, `a9-forecast.ts:264`), `forecast-lab` (`forecast-lab.ts:213-214`), `money-matters` (`money-matters.ts:107`, `money-health.ts:80-94`), `team-focus` (`team-focus.ts:340`, `team-focus-health.ts:121-141`), `compare` (`compare-score.ts:56-63,113-114`); **per-day average across empty months:** `avg-complaints-per-day`, `avg-bd-hours-per-day` (`computers.ts:80-85`); **an empty month prints 0:** `monthly-report` (`monthly-report.ts:202` drops only leading empty months); **hard-coded year in a title:** A1 (`a1-bd-pm.ts:290,298,314,327`), A3 (`a3-mttr-mtbf.ts:185,191`) |
| not computed                          | 3   | the three money tiles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**The ledger's 14 leads, checked.** Confirmed as written (12): `availability.ts:79`, `a1-bd-pm.ts:90` and `:122`,
`a3-mttr-mtbf-context.ts:128`, `hours.ts:42`, `reliability.ts:115`, `breakdown-map.ts:112`, `pm-compliance.ts:216`,
`annual-report.ts:82`, `a4-manpower.ts:113`, `a9-bottleneck.ts:118`, `compare-score.ts:60`. **Corrected (1):**
`computers.ts:68` is the hours-rounding helper; the per-day averages are `recordDays` at `computers.ts:80-85`, read at
`:162` and `:168`. **Dropped (1):** `report-period.ts:97` — `monthlyPeriod` wraps January to the previous December and
`reportStats` filters on whole dates, so earlier years are read correctly; the monthly report's real fault is the
empty month printed as 0 (`monthly-report.ts:202`). **Missed by the ledger (7):** `computers.ts:88-104`,
`a10-problems.ts:36-50`, `machine-page.ts:151`, `standard-kpis.ts:128`, `working-hours.ts:114`, the titles at
`a1-bd-pm.ts:290-327` and `a3-mttr-mtbf.ts:185,191`, and the gap fault's spread into `forecast-lab`, `money-matters`
and `team-focus` through `a9RiskCore`.

## Proven faults (today's engine, outputs quoted)

**A — two identical years.** The 2026 key's rows copied to 2025 (same month and day; rows on machines bought later
not copied: 1,279 → 2,381 breakdowns), run at `2026-11-11`. Two identical years must give the same rates; they do not:

- `dashboard.plant-bd-pct` `0.54` → `1.03`; `dashboard.fleet-availability` `99.32` → `98.7`.
- A1 "Month-on-Month — BD % and PM % (2026)", PLANT TOTAL, January `0.49%` → `0.95%`; the BD Hrs chart's January
  `248.95` → `479.48` (January 2025 merged into January 2026).
- A3 PLANT TOTAL MTBF `439.9` → `235.1` (January `449.1` → `232.9`); `shift-kpis.compare` legacy MTBF `439.90` →
  `235.13`; machine page TC-3 MTBF `131.1` → `64.5`; A10 what-if "was 99.46%" → "was 98.97%", "was 440 hrs" → "was
  235 hrs".

**B — a missing year.** The same copy put in 2024, 2025 left empty: A9's availability KPI `99.47%` ("machine hours up, 01 Jan 2025 to
07 Nov 2026") → `99.64%` ("… 01 Jan 2024 to 07 Nov 2026"); the forecast's "Past months averaged 268 hrs" → "169 hrs";
compare's availability cell `97.28%` → `98.23%`. The empty year is counted as a year without a failure.

**C — no records prints 0.** Data A, monthly report: the twelve-month chart prints `Dec 25` as `0` breakdowns and
`0` hours; December 2025 has no rows at all.

**D — the hand fixture below, today's engine.** At `2025-12-31` (2025 only): A1's PLANT TOTAL July, a month with no
records, prints `0.00%`, Q3 `0.27%`, the year `0.37%` (66 / 18,000) against the hand `0.40%` (66 / 16,500); breakdowns
a day `0.2` against `0.22`. At `2026-12-31` (both years): BD % `1.48` against `0.87` (both years) or `1.20` (2026); A3
MTBF `109.0` against `185.0` or `160.2`; A1 January `1.50%` against `1.20%`; TC-1's machine-page MTBF `98.4` against
`190.1` or `160.2`.

## Design: one period, cut once by the engine

**The data shape.** A figure is a function of rows inside a span of plant dates, divided by the hours of that span.
So the period is a span plus the months inside it the plant never recorded, and it travels with the rows.

```ts
// availability.ts — the period seam (today's window helpers already live here)
export interface Period {
  from: string;
  to: string;
  noRecords?: readonly string[];
} // 'YYYY-MM', inside [from, to]
export const NO_RECORDS = 'no records';
export function yearToDate(asOf: string): Period; // 1 Jan of asOf's year .. asOf
export function resolvePeriod(data: EngineData, span: Period): Period; // fills noRecords
export function periodOf(data: EngineData, asOf: string): Period; // data.period ?? resolve(yearToDate)
export function historyOf(data: EngineData, asOf: string): Period; // 1 Jan of the first recorded year .. asOf
export function calendarMonths(period: Period): PeriodMonth[]; // Jan of from-year .. Dec of to-year
export interface PeriodMonth {
  key: string;
  year: number;
  month: number;
  from: string;
  to: string;
  state: 'recorded' | 'no-records' | 'outside';
}
export function monthLabel(month: PeriodMonth, period: Period): string; // 'Jan', or 'Jan 25' across years
export function yearLabel(period: Period): string; // '2026', or '2025–2026'
export function observedDays(
  from: string,
  to: string,
  period: Period,
  purchasedOn?: string | null,
): number;
export function periodFraction(from: string, to: string, noRecords?: readonly string[]): number; // skips gaps
// a machine's hours in a span, purchase-date rule and gaps applied; `availableHours` (4 params) stays for tests
export function hoursIn(machine: MachineRow, annualHours: number, period: Period): number;
// types.ts:  EngineData.period?: Period    — set by the engine on a period figure's slice, absent on whole data
// registry.ts: FigureDef.reads?: 'asOf' | 'history'   — absent: the figure reads the selected period
// engine.ts: run(data, asOf, profile, span?: Period); runWith's input gains span?
```

**R1 — one type.** `Period` replaces the three identical `{from, to}` shapes (`DateWindow` `hours.ts:12-15`, which
`HoursWindow` at `:18` extends; `ReportWindow` `report-period.ts:152-155`; `AvailabilityWindow`
`availability.ts:63-68`); the old names stay as aliases because tests import them. Cost if wrong: three aliases to delete later.

**R2 — the default span is the as-of calendar year to date.** The 2026 key is exactly that span with no gap month,
so every default run is the same arithmetic in the same order: `periodFraction` skips a gap month with `continue` and
otherwise adds the same terms. The server keeps calling `run` with three arguments. Cost if wrong: see question 1.

**R3 — the engine cuts, the figures do not.** For a period figure the engine hands over the as-of data with reports
outside `[from, to]` removed, machines bought and moves made after `to` removed, `data.period` set, and
`asOf = period.to`. Tickets are kept, so a breakdown dated 31 December and closed on 1 January counts in December,
and 2025 + 2026 equals the two-year total. This makes the 13 "every year" sums right with no edit, and every "to the
run date" window ends at the period's end. A computer called directly (only tests do) sees no `data.period` and falls
back to R2. Cost if wrong: one function in `engine.ts`.

**R4 — every figure declares what it reads.** 25 read the selected period (no mark). 17 read `asOf` and are never
cut: the 14 of class (i) as-of, `action-center.spares-spend`, and the two reports (R9). 9 read the whole history:
`a9-bottleneck-forecast`, `forecast-lab`, `compare`, `compare.spares-cost`, `team-focus`, `team-focus.cost`,
`money-matters`, `fix-finder`, `data-checklist`. `reliability` reads the period here; ticket 92 moves it to history.

**R5 — "no records" is a month with no report and no ticket at all.** Plant-wide, inside the span. It prints
`no records` in a table cell, `null` in a chart series, adds no available hours and no days, and drops out of a
quarter's average. A month after `to` keeps today's dash. A machine's empty month inside a recorded month is a real 0.

**R6 — denominators follow the period.** Available and working hours are `hoursIn(machine, annual, period)` over
`[from, to]`. Per-day averages divide by `observedDays` from the first to the last record in the span, gap days out.
The machine page keeps the platform's flat annual rule, generalised: `annual × (12 × calendar years in the span −
gap months) ÷ 12` (one year with no gap is today's 6,000).

**R7 — month buckets carry their year.** Month tables, grids and series iterate `calendarMonths(period)` keyed
`YYYY-MM`; quarters are per year; a one-year span prints `Jan … Dec` and its title year exactly as today; a span
across years prints `Jan 25 … Dec 26` and `2025–2026`.

**R8 — history figures leave gaps out.** They read `historyOf` (1 January of the first recorded year, as today) to
their own last record; every "days between" becomes `observedDays`, and the Forecast Lab does not test a month with
no records. The rules for which history they learn from do not change (question 3).

**R9 — the reports stay as-of documents.** Monthly: the complete month before `asOf`; annual: `asOf`'s calendar year
to `asOf` (a 2024 report is a run as of 31 Dec 2024). Their month rows and the twelve-month chart print `no records`
for a gap; `reportStats` takes the gap months.

**R10 — inside `packages/domain` only.** `EngineResult`, the reply contract and `kpi_snapshot` are unchanged; ticket
75 stores and serves a chosen span.

**Rejected.** _Fourteen local patches_ — the same three idioms retyped per figure, and the next figure copies the
nearest wrong one. _A required `period` on `ComputeInput`_ — 16 direct test calls stop compiling (goal 3). _Each
figure cutting its own rows_ — 25 patches instead of one cut. _A gap month as zero breakdowns_ — 2022 would read as a
perfect February and March and its BD % would be understated by a sixth. _Coverage months declared by the loader_ —
the rows already say it; 69 can add a declared list if N17 shows a recorded month with no breakdowns. _The resolved
period on `EngineResult`_ — that is the stored run's shape, 75's. _Two years side by side on A1_ — that is 90.

## The hand-computed two-year fixture

`packages/domain/test/many-years/fixture.ts`, built by a 20-line rule, no real data, coded names only:

- **Machines** (CNC, production): TC-1 and VC-1 in cell 1, TC-2 and VC-2 in cell 2; Turning Center and Vertical
  Machining Center; TC-1, TC-2, VC-1 bought 2020-01-01; **VC-2 bought 2026-01-01** (exists in 2026 only). Two shift
  windows, 08:00–18:29 and 18:29–05:00 (21 h a day); people `P-1`, `P-2` (`Person 1`, `Person 2`).
- **2025, every month but July** (**July 2025 has no records**), each of TC-1, TC-2, VC-1: `AX` "Axis jam" on day 5
  shift 1 and `EL` "Panel trip" on day 20 shift 2, 60 min each; `NO DT` 30 min on 8 January; `PM` 180 min on day 15 of
  March, June, September, December.
- **2026, every month**, each of the four: `AX` on days 5 and 12, `EL` on day 20, 120 min each; `NO DT` on 8 January;
  `PM` as above. Every row is a closed history ticket; PM tickets carry `raisedChannel: 'pm'` and `scheduledOn`.
- **245 rows** (210 breakdowns, 7 `NO DT`, 28 PM). Runs use `DEFAULT_PROFILE` (6,000 h a year, 500 a month) and
  `asOf` `2026-12-31`, or `2027-01-31` where the whole engine runs (see risk 6).

**How the expected values are made.** By arithmetic from the rule above, never by running the engine: each value is
a literal in `many-years/hand.ts` with its sum written beside it, and the reviewer recomputes three by hand (2025
MTBF, the two-year BD %, A1's January 2026 cell). The headline numbers, already summed:

| Span                                | 2025                       | 2026                      | 2025–2026                       |
| ----------------------------------- | -------------------------- | ------------------------- | ------------------------------- |
| No-records months                   | 2025-07                    | —                         | 2025-07                         |
| Production machines at the span end | 3                          | 4                         | 4                               |
| Failures (non-PM, `NO DT` included) | 66 + 3 = 69                | 144 + 4 = 148             | 217                             |
| Breakdown / PM hours                | 66.0 / 36.0                | 288.0 / 48.0              | 354.0 / 84.0                    |
| Available hours                     | 3 × 11 × 500 = 16,500      | 4 × 12 × 500 = 24,000     | 40,500                          |
| BD % / PM % / availability          | 0.40 / 0.22 / 99.38        | 1.20 / 0.20 / 98.60       | 0.87 / 0.21 / 98.92             |
| MTTR / MTBF                         | 0.96 / 16,434 ÷ 69 = 238.2 | 1.95 / 160.2              | 1.63 / 40,146 ÷ 217 = 185.0     |
| Days first-to-last record, gaps out | 350 − 31 = 319             | 350                       | 715 − 31 = 684                  |
| Breakdowns a day / BD hours a day   | 0.22 / 0.21                | 0.42 / 0.82               | 0.32 / 0.52                     |
| BD hours per CNC machine            | 22                         | 72                        | 88.5                            |
| A1 PLANT TOTAL BD %, Jan / Jul      | 0.40% / no records         | 1.20% / 1.20%             | Jan 25 0.40%, Jul 25 no records |
| TC-1 machine-page MTBF              | (5,500 − 22) ÷ 23 = 238.2  | (6,000 − 72) ÷ 37 = 160.2 | (11,500 − 94) ÷ 60 = 190.1      |
| Working hours (shift basis)         | 3 × 11/12 × 6,300 = 17,325 | 25,200                    | 42,525                          |

## Packets

Every packet: one acceptance assertion, whole-figure `toEqual` with no tolerance unless named, the 2026 answer-key
files untouched. **Green always includes** `pnpm exec vitest run packages/domain` (all 52 + new files, the answer-key
suites among them), `pnpm typecheck`, `pnpm size` and `pnpm boundaries`. Tests live flat in `packages/domain/test/`
as `many-years-<area>.test.ts`; hand pages sit in the test file beside their arithmetic.

| #   | Assertion (Given the fixture, When…, Then…)                                                                                                                                                                                                                                                                                            | Files (src + test)                                                                                             | Lines |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- |
| 76a | When the period helpers read spans 2025, 2026 and both, Then months, gap months, hours (16,500 / 24,000 / 40,500), observed days and labels equal `hand.ts`; and with no gap `periodFraction` returns the same double as today for the key's window                                                                                    | `availability.ts`, `hours.ts` (window carries `noRecords`), `period.test.ts`                                   | ~140  |
| 76b | When the fixture is built, Then it has 245 rows, 28 PM, 7 `NO DT`, nothing in 2025-07, VC-2 only in 2026, two cells                                                                                                                                                                                                                    | `many-years/fixture.ts`, `many-years/hand.ts`, `many-years-fixture.test.ts`                                    | ~170  |
| 76c | When `run` is given each span at `2027-01-31`, Then the four additive dashboard tiles equal `hand.ts` (and 2025 + 2026 = both), every `asOf`/`history` figure is identical across spans, and a span past `asOf` or reversed is a `RangeError`                                                                                          | `engine.ts`, `types.ts`, `registry.ts`, `many-years-engine.test.ts` — **the seam: 4 files, the one exception** | ~150  |
| 76d | When run at `2026-12-31` per span, Then `plant-bd-pct`, `fleet-availability`, both per-day averages and `avg-bd-hours-per-machine` equal the table                                                                                                                                                                                     | `computers.ts`, test                                                                                           | ~90   |
| 76e | When A1 runs on 2025 and on both years, Then the whole page equals the hand page (Jan 25 `0.40%`, Jul 25 `no records`, title `2025–2026`)                                                                                                                                                                                              | `a1-bd-pm.ts`, `a1-months.ts` (new: the month tables move out; 395 lines today), test                          | ~150  |
| 76f | When A3 runs on 2025 and on both years, Then the whole page equals the hand page (MTBF 238.2 / 185.0, July 25 `no records`)                                                                                                                                                                                                            | `a3-mttr-mtbf-context.ts`, `a3-mttr-mtbf.ts`, test                                                             | ~140  |
| 76g | When A10 and the machine page run on both years, Then A10's whole page and TC-1…VC-2's breakdown blocks equal hand values (TC-1 MTBF 190.1)                                                                                                                                                                                            | `a10-problems.ts`, `machine-page.ts`, test                                                                     | ~120  |
| 76h | When the shift-calendar figures run per span, Then `shift-kpis.compare` and `.shift-split` equal hand values on both bases (working hours 42,525 on both years)                                                                                                                                                                        | `working-hours.ts`, `standard-kpis.ts`, test                                                                   | ~140  |
| 76i | When the breakdown map and A4 run on both years, Then their whole values equal hand values with 24 year-keyed months and `no records` for July 2025                                                                                                                                                                                    | `breakdown-map.ts`, `a4-manpower.ts`, test                                                                     | ~150  |
| 76j | When the annual report runs at `2025-12-31`, Then the whole page equals the hand page: July `no records`, the year's BD % `0.40%`                                                                                                                                                                                                      | `annual-report.ts`, `report-period.ts`, test                                                                   | ~130  |
| 76k | When the monthly report runs at `2026-02-15`, Then the whole page equals the hand page and the twelve-month chart's `Jul 25` is `null`                                                                                                                                                                                                 | `monthly-report.ts`, test                                                                                      | ~110  |
| 76l | When `pm-compliance` and `reliability` run on both years, Then `pm-compliance` is `{from: '2025-01-01', to: '2026-12-31', pm: 28 of 28 on time, …}` whole, and reliability's `windowStart`, events and hours-to-date per machine equal hand values (named exception: the fitted shape and scale are 67's, proven by its own reference) | `pm-compliance.ts`, `reliability.ts`, test                                                                     | ~110  |
| 76m | When the risk core reads the history, Then observed days are 688 for the three 2020 machines and 354 for VC-2, A9's "machine hours up" and "Past months averaged" rows equal hand values (named exception: the seeded simulation rows stay pinned by the 2026 key)                                                                     | `a9-bottleneck.ts`, `a9-forecast.ts`, test                                                                     | ~110  |
| 76n | When the Forecast Lab runs, Then July 2025 is not a tested month and its months table equals the hand month list                                                                                                                                                                                                                       | `forecast-lab.ts`, test                                                                                        | ~70   |
| 76o | When Money Matters runs, Then its days, per-year and per-month rows equal hand values (688-day basis)                                                                                                                                                                                                                                  | `money-matters.ts`, `money-health.ts`, test                                                                    | ~90   |
| 76p | When Team Focus runs, Then its months and machine-years equal hand values                                                                                                                                                                                                                                                              | `team-focus.ts`, `team-focus-health.ts`, test                                                                  | ~90   |
| 76q | When compare runs, Then each machine's days, availability and MTBF rows equal hand values with July 2025 left out                                                                                                                                                                                                                      | `compare-score.ts`, `compare.ts`, test                                                                         | ~90   |
| 76r | When the six figures the cut alone fixes run per span (`costliest-problems`, `bubble-chart`, `breakdown-log`, A2, A6, A8), Then each whole value equals the hand value; the log's expected rows are written from the fixture's rule, not read back from the engine                                                                     | `many-years-cut.test.ts` only (no source change)                                                               | ~170  |

**Red** for each: `pnpm exec vitest run packages/domain/test/<its test file>` fails on the fault or on the missing
module (76a–76c). The quoted outputs above are measured reds for 76d, 76e, 76f, 76g, 76h, 76k and 76m; the reds of
76i, 76j, 76l and 76n–76r are inferred from the code read, not yet run. **Green**: the same file, then the green list
above. **Goal 1's 100 %** is the 25 period figures across 76c–76l and 76r. **Goal 2's 0** is the closing check after
the last packet: no production call of `availabilityWindow(` or `monthlyWindow(` and no `slice(5, 7)` month bucket
left in `packages/domain/src/analytics` (the two functions stay, for the answer-key tests that import them). Every packet's PR carries the `changes/76-many-years.md` fragment (one shared fragment, merge-train line),
a `No parity: engine period seam, no platform screen changes` line, and Nimish-facing text: "with history loaded,
the dashboard and A1–A10 show this year by default and a chosen span exactly; an empty month says _no records_".

**Order.** 76a and 76b in parallel → 76c → then any three at once of 76d, 76e, 76f, 76g, 76h, 76i, 76j, 76m, 76q and
76r (disjoint files) → 76k after 76j (`report-period.ts`), 76l after 76h (`working-hours.ts`), 76n, 76o, 76p after 76m
(`a9RiskCore`). Line budgets to watch: `a1-bd-pm.ts` 395, `a9-bottleneck.ts` 398, `compare-score.ts` 395,
`annual-report.ts` 384 — 76m and 76q delete their local window functions first (net negative); 76e moves A1's month
tables to `a1-months.ts`. Estimate: 18 changes, about 2,200 lines with tests — above stage E's share for 76; the cut
line, if the timebox bites, is after 76l (76m–76q are the gap fault on history figures: two months of 2022 today).

## Risks

1. **The key drifts by a rounding.** Cost: goal 3 fails. Guard: 76a asserts the default path returns the same
   doubles; every packet runs the whole domain suite.
2. **A figure reads its rows directly in a test and sees uncut multi-year data.** Cost: a false green. Guard: new tests
   go through `runWith` with a span; `types.ts` says so on `EngineData.period`.
3. **"No records" from rows misreads a genuinely empty plant month.** Cost: the word `no records` instead of `0`, never
   a wrong rate; at about 110 breakdowns a month it does not happen.
4. **`asOf = period.to` changes what a period figure calls "now"** (an age band ages to the period's end). Cost: a
   label on a past span; that is the honest reading.
5. **Retired machines have no end date** (`MachineRow` has `purchasedOn` only). A machine scrapped in 2023 adds hours
   to 2024–2026. Cost: understated history BD %. Not 76: N16 and 69.
6. **Found here, not 76's:** `breakdown-free` (`dashboard-flags.ts:15-40`) returns `{runningClean: 0, …}` with no
   drill ids when every in-service machine broke down in the last 30 days, and `engine.ts:46-48` then throws, so the
   whole run fails. The fixture's whole-engine runs use `2027-01-31` to stay clear; it needs its own fix.
7. **Two rounding paths disagree at a half:** on the fixture today A1 prints `98.17%` and the dashboard `98.18` for
   the same availability. Pre-existing; the hand values avoid the tie.

## Questions for Nimish (product only)

1. When the year turns, should the dashboard open on **this calendar year so far** (Bhavin's platform had a year
   selector, `a4-manpower.ts:134`; its default is inferred, not seen; on 3 January this shows three days) or on
   **the last twelve months**? Planned: this calendar year so far.
2. A month with no records (February–March 2022): should a year's breakdown % **leave that month out** (2022 reads as
   ten months) rather than count it as a month with no breakdowns? Planned: leave it out, and say so on screen.
3. Should the health score, forecasts, Team Focus and Money Matters learn from **all five years** or only recent
   ones? Planned: all years, as Bhavin's platform did, gaps left out.

## Not in this ticket

Storing and serving a chosen span, and the period picker (75, 83, 86); year-on-year and seasonality figures (90);
the reliability fit on the whole history (92); the load and its declared gaps (69, N17); `validate:full` (79);
machines out of production data (77); retirement dates (N16); the `breakdown-free` crash (its own task).
