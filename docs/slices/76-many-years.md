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
  the package's runtime exports. Two hand-built fixtures have **empty months inside the as-of year** and assert a
  full year's hours: `cutoverData` (`shift-kpis.test.ts:405-434`, rows in Jan, Mar–Jun and Nov, 6,300 working hours)
  and `aliasData` (`shift-kpis-split.test.ts:279-287`, rows in Jan and Mar, 6,300 × 629 / 1,260). So: those names
  keep their signatures, `ComputeInput` gains nothing, nothing new is exported at runtime, and **a run that names no
  span must see no gap month** (R2).

## Every figure, classified

| Class                                 | n   | Figures (cause, file:line)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (i) as-of or whole history, correct   | 16  | the six machine counts, `breakdown-free` (30-day look-back), `expansion-timeline`, `registers`, `cell-change-log`, `a7-footprint`, `a5-energy`, `action-center` (rolling windows from `asOf`), `shift-kpis.backlog`; `fix-finder` (searches every past case, `fix-finder.ts:7-17`) and `data-checklist` (checks the whole log and its gaps, `data-checklist.ts:208-215`) — both read history by design and are never cut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| (i) right sums, made right by the cut | 11  | `total-breakdowns`, `total-downtime-hours`, `pm-hours`, `no-downtime-hours`, `avg-bd-hours-per-machine`, `costliest-problems`, `bubble-chart`, `a8-age`, `breakdown-log`, `a2-category-cell`, `a6-why-why` — they read every year today; correct once their rows are the period's                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
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

**B — a missing year.** The same copy put in 2024, 2025 left empty: A9's availability KPI `99.47%` ("machine hours
up, 01 Jan 2025 to 07 Nov 2026") → `99.64%` ("… 01 Jan 2024 to 07 Nov 2026"); the forecast's "Past months averaged
268 hrs" → "169 hrs"; compare's availability cell `97.28%` → `98.23%`. The empty year counts as a year without a failure.

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
  noRecords?: readonly string[]; // 'YYYY-MM' inside [from, to]; empty unless the caller named a span (R2)
}
export const NO_RECORDS = 'no records';
export function yearToDate(asOf: string): Period; // 1 Jan of asOf's year .. asOf, no gap months
export function gapMonths(data: EngineData, asOf: string): string[]; // no report, no ticket, first record .. asOf
export function periodOf(data: EngineData, asOf: string): Period; // data.period ?? yearToDate(asOf)
export function historyOf(data: EngineData, asOf: string): Period; // 1 Jan of the first record's year .. asOf
export function calendarMonths(period: Period): PeriodMonth[]; // Jan of from-year .. Dec of to-year
export interface PeriodMonth {
  key: string; // 'YYYY-MM'
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
export function hoursIn(machine: MachineRow, annualHours: number, period: Period): number; // purchase + gaps
// types.ts:   EngineData.period?: Period; EngineData.gaps?: readonly string[];  EngineResult.period?: Period
// registry.ts: FigureDef.reads?: 'asOf' | 'history'   — absent: the figure reads the selected period
// engine.ts:  run(data, asOf, profile, span?: { from: string; to: string }); runWith's input gains span?
```

**R1 — one type.** `Period` replaces the three identical `{from, to}` shapes (`DateWindow` `hours.ts:12-15`, which
`HoursWindow` at `:18` extends; `ReportWindow` `report-period.ts:152-155`; `AvailabilityWindow`
`availability.ts:63-68`); the old names stay as aliases because tests import them. `availableHours` keeps its four
parameters for the tests; production code moves to `hoursIn`. Cost if wrong: three aliases to delete later.

**R2 — gaps exist only when the caller names a span.** With no span, every figure gets the as-of calendar year to
date and **no gap month at all**: exactly today's arithmetic and order, so the answer key, `cutoverData` and
`aliasData` are untouched. With a span, the engine computes the plant's gap list once (`gapMonths` over the as-of
data) and hands it to every figure: the span's own gaps in `data.period.noRecords`, the whole list in `data.gaps` for
history figures and reports. Ticket 75 always names a span (the default one included), so served figures always know
their gaps; the span-less call is the path the existing tests use. The resolved period is on `EngineResult.period`
only when a span was named, so today's result and reply are byte-identical. Cost if wrong: one branch in `engine.ts`.

**R3 — the engine cuts, the figures do not.** Every figure's data carries `data.period` (the selected span). For a
period figure the engine also hands over the as-of data with reports
outside `[from, to]` removed, machines bought and moves made after `to` removed, `data.period` set, and
`asOf = period.to`. Tickets are kept, so a breakdown dated 31 December and closed on 1 January counts in December,
and 2025 + 2026 equals the two-year total. A computer called directly (only tests do) sees no `data.period` and
falls back to R2's default. Cost if wrong: one function in `engine.ts`.

**R4 — every figure declares what it reads.** 24 read the selected period (no mark). 18 read `asOf` and are never
cut: the 14 as-of figures of class (i), `action-center.spares-spend`, the two reports (R9) and `machine-page` (R6).
9 read the whole history: `a9-bottleneck-forecast`, `forecast-lab`, `compare`, `compare.spares-cost`, `team-focus`,
`team-focus.cost`, `money-matters`, `fix-finder`, `data-checklist`. `reliability` reads the period; 92 moves it.

**R5 — "no records" is a month with no report and no ticket at all, plant-wide.** It prints `no records` in a table
cell, `null` in a chart series, adds no hours and no days, and drops out of a quarter's average. A month after `to`
keeps today's dash. A machine's empty month inside a recorded month is a real 0.

**R6 — denominators follow the period.** Available and working hours are `hoursIn(machine, annual, period)`.
Per-day averages divide by `observedDays` from the first to the last record in the span, gap days out. The machine
page reads `asOf` (uncut): its nameplate, age, area, kVA, completeness, moves and `breakdowns.lastOn`
(`machine-page.ts:152`) are as-of facts; only `breakdowns.{count, hours, mttr, mtbf, topProblem}`, `pm` and the
two ticket drills are filtered to `data.period`. Its MTBF keeps the platform's flat year, generalised: `annual ×
(12 × the span's calendar years from the purchase year on − gap months in them) ÷ 12` (one year: today's 6,000;
VC-2, bought in 2026, gets 6,000 over both years, not 11,500).

**R7 — month buckets carry their year.** Month tables, grids and series iterate `calendarMonths(period)` keyed
`YYYY-MM`; quarters are per year; a one-year span prints `Jan … Dec` and its title year exactly as today; a span
across years prints `Jan 25 … Dec 26` and `2025–2026`. The default stays one year of 12 columns (question 4).

**R8 — history figures leave gaps out.** They read `historyOf` to their own last record; every "days between"
becomes `observedDays` with `data.gaps`, and the Forecast Lab does not test a gap month. Which history they learn
from does not change (question 3).

**R9 — the reports stay as-of documents.** Monthly: the complete month before `asOf`; annual: `asOf`'s calendar year
to `asOf` (a 2024 report is a run as of 31 Dec 2024). With `data.gaps`, their month rows and the twelve-month chart
print `no records`; `reportStats` takes the window's gap months.

**R10 — inside `packages/domain` only.** No server, reply-contract or `kpi_snapshot` change; 75 names the span,
stores `EngineResult.period` and shows the gap months on screen (question 2's sentence travels that way).

**Rejected.** _Fourteen local patches_ — the same three idioms retyped per figure, and the next figure copies the
nearest wrong one. _A required `period` on `ComputeInput`_ — 16 direct test calls stop compiling (goal 3). _Gaps
computed on every run_ — breaks `cutoverData` (6,300 → 3,150 h) and `aliasData` (to 2/12). _Each figure cutting its
own rows_ — 24 patches instead of one cut. _A gap month as zero breakdowns_ — 2022 would read as a perfect February
and March. _Coverage declared by the loader_ — the rows already say it; 69 can add a list if N17 needs one. _Two
years side by side on A1_ — that is 90.

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
- **245 rows** (210 breakdowns, 7 `NO DT`, 28 PM), `DEFAULT_PROFILE` (6,000 h a year, 500 a month). Every run names
  a span. A packet that runs one computer (`runWith({key: COMPUTERS[key]}, …)`) uses `asOf` `2026-12-31`; a packet
  that runs the whole engine (76c, 76d) uses `2027-01-31`, because at `2026-12-31` every machine broke down on 20
  December and `breakdown-free` (`computers.ts:174`, `dashboard-flags.ts:15-40`) then throws in `engine.ts:46-48`.
  PR #413 fixes that separately; 76 does not depend on it.

**Where the expected values live.** `many-years/hand.ts` (76b) holds the shared types and the headline numbers
below; after 76b it is read-only. Each packet's figure-specific hand values live in its own test file, so no two
packets write one file. Every value is a literal with its sum beside it, made from the rule above, never by running
the engine; the reviewer recomputes three by hand (2025 MTBF, the two-year BD %, A1's January 2026 cell).

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
| VC-2 machine-page MTBF              | no failure: null           | (6,000 − 72) ÷ 37 = 160.2 | (6,000 − 72) ÷ 37 = 160.2       |
| Working hours (shift basis)         | 3 × 11/12 × 6,300 = 17,325 | 25,200                    | 42,525                          |

## Packets

One acceptance assertion each, whole-figure `toEqual` with no tolerance unless an exception is named, the 2026
answer-key files untouched. **Green always includes** `pnpm exec vitest run packages/domain` (the 52 files, the
answer-key suites, `shift-kpis.test.ts` and `shift-kpis-split.test.ts` among them), `pnpm typecheck`, `pnpm size`,
`pnpm boundaries`. Red: `pnpm exec vitest run packages/domain/test/<the packet's test>`.

| #   | Assertion (Given the fixture, When…, Then…)                                                                                                                                                                                                                                                                                          | Files                                                                                                          | ~Lines    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------- |
| 76a | When `periodFraction` and `hoursIn` read spans 2025 / 2026 / both, Then hours are 16,500 / 24,000 / 40,500, `gapMonths` is `['2025-07']`, and `yearToDate` has no gap month and returns the same doubles as today for the key's window                                                                                               | `availability.ts`, `period.test.ts`                                                                            | 130       |
| 76b | When the fixture is built, Then it has 245 rows, 28 PM, 7 `NO DT`, nothing in 2025-07, VC-2 only in 2026, two cells; `hand.ts` holds the table above                                                                                                                                                                                 | `many-years/fixture.ts`, `many-years/hand.ts`, `many-years-fixture.test.ts`                                    | 170       |
| 76c | When `calendarMonths`, the labels, `observedDays` and `historyOf` read the three spans, Then they equal `hand.ts` (12 / 12 / 24 months, July 2025 `no-records`, 319 / 350 / 684 days, `Jan 25`, `2025–2026`)                                                                                                                         | `availability.ts`, `hours.ts` (window carries `noRecords`), `period-months.test.ts`                            | 140       |
| 76d | When `run` is given each span at `2027-01-31`, Then the four additive tiles equal `hand.ts` (2025 + 2026 = both) and every as-of/history figure is identical across spans; and with no span there is no gap month — `cutoverData` and `aliasData`, unchanged, stay green                                                             | `engine.ts`, `types.ts`, `registry.ts`, `many-years-engine.test.ts` — **the seam: 4 files, the one exception** | 150       |
| 76e | Characterisation, no red: When the six figures the cut alone fixes run per span (`costliest-problems`, `bubble-chart`, `breakdown-log`, A2, A6, A8), Then each whole value equals the hand value; it pins the cut so a later change cannot undo it                                                                                   | `many-years-cut.test.ts` only                                                                                  | 170       |
| 76f | When run at `2027-01-31` per span, Then `plant-bd-pct`, `fleet-availability`, both per-day averages and `avg-bd-hours-per-machine` equal the table                                                                                                                                                                                   | `computers.ts`, test                                                                                           | 90        |
| 76g | Refactoring, no red: A1's month tables move to `a1-months.ts` unchanged (`a1-bd-pm.ts` is 395 lines); green is the A1 answer-key test, unchanged                                                                                                                                                                                     | `a1-bd-pm.ts`, `a1-months.ts` (new)                                                                            | 110 moved |
| 76h | When A1 runs on the 2025 span, Then the whole page equals the hand page (July `no records`, Q3 over two months, year `0.40%`)                                                                                                                                                                                                        | `a1-months.ts`, `a1-bd-pm.ts`, test                                                                            | 130       |
| 76i | When A1 runs across both years, Then the whole page equals the hand page (24 year-keyed months, 8 quarters, `Jan 25 0.40%`, title `2025–2026`)                                                                                                                                                                                       | `a1-months.ts`, `a1-bd-pm.ts`, test                                                                            | 150       |
| 76j | When A3 runs on the 2025 span, Then the whole page equals the hand page (MTBF 238.2, July `no records`)                                                                                                                                                                                                                              | `a3-mttr-mtbf-context.ts`, `a3-mttr-mtbf.ts`, test                                                             | 120       |
| 76k | When A3 runs across both years, Then the whole page equals the hand page (MTBF 185.0, 24 year-keyed months)                                                                                                                                                                                                                          | `a3-mttr-mtbf-context.ts`, `a3-mttr-mtbf.ts`, test                                                             | 140       |
| 76l | When the breakdown map and A4 run across both years, Then their whole values equal hand values with 24 year-keyed months and `no records` for July 2025                                                                                                                                                                              | `breakdown-map.ts`, `a4-manpower.ts`, test                                                                     | 150       |
| 76m | When the shift-calendar figures run per span, Then `shift-kpis.compare` and `.shift-split` equal hand values on both bases (working hours 42,525 across both years)                                                                                                                                                                  | `working-hours.ts`, `standard-kpis.ts`, test                                                                   | 140       |
| 76n | When `pm-compliance` and `reliability` run across both years, Then `pm-compliance` is `{from: '2025-01-01', to: '2026-12-31', pm: 28 of 28 on time, …}` whole, and reliability's `windowStart`, events and hours-to-date per machine equal hand values (exception: the fitted shape and scale are 67's, proven by its own reference) | `pm-compliance.ts`, `reliability.ts`, test                                                                     | 110       |
| 76o | When A10 and the machine page run across both years, Then A10's whole page and the four machines' records equal hand values (TC-1 MTBF 190.1, VC-2 160.2, `lastOn` from the uncut data)                                                                                                                                              | `a10-problems.ts`, `machine-page.ts`, test                                                                     | 130       |
| 76p | When the annual report runs at `2025-12-31` with a span, Then the whole page equals the hand page: July `no records`, the year's BD % `0.40%`                                                                                                                                                                                        | `annual-report.ts`, `report-period.ts`, test                                                                   | 130       |
| 76q | When the monthly report runs at `2026-02-15` with a span, Then the whole page equals the hand page and the twelve-month chart's `Jul 25` is `null`                                                                                                                                                                                   | `monthly-report.ts`, test                                                                                      | 110       |
| 76r | When the risk core reads the history, Then observed days are 688 for the three 2020 machines and 354 for VC-2, and A9's availability and "Past months averaged" rows equal hand values (exception: the seeded simulation rows stay pinned by the 2026 key)                                                                           | `a9-bottleneck.ts`, `a9-forecast.ts`, test                                                                     | 110       |
| 76s | When the Forecast Lab runs, Then July 2025 is not a tested month and its months table equals the hand month list                                                                                                                                                                                                                     | `forecast-lab.ts`, test                                                                                        | 70        |
| 76t | When Money Matters runs, Then its days, per-year and per-month rows equal hand values (688-day basis)                                                                                                                                                                                                                                | `money-matters.ts`, `money-health.ts`, test                                                                    | 90        |
| 76u | When Team Focus runs, Then its months and machine-years equal hand values                                                                                                                                                                                                                                                            | `team-focus.ts`, `team-focus-health.ts`, test                                                                  | 90        |
| 76v | When compare runs, Then each machine's days, availability and MTBF rows equal hand values with July 2025 left out                                                                                                                                                                                                                    | `compare-score.ts`, `compare.ts`, test                                                                         | 90        |

**Reds.** Measured on today's engine: 76f, 76h, 76i, 76j, 76k, 76m, 76o, 76q, 76r (the quotes above). Inferred from
the code, not yet run: 76l, 76n, 76p, 76s–76v. 76a–76d fail on the missing helpers; 76e and 76g have none, by kind.
**Goal 1's 100 %** is the 24 period figures across 76d–76f, 76h–76n and the machine page's period block in 76o.
**Goal 2's 0** is the closing check after the last packet: no production call of `availabilityWindow(` or
`monthlyWindow(` and no `slice(5, 7)` month bucket left in `packages/domain/src/analytics` (the two functions stay
for the answer-key tests that import them). Each PR appends its own section to `changes/76-many-years.md`, in packet
order, and carries `No parity: engine period seam, no platform screen changes`.

**Order, two backend builders at most.** 76a ∥ 76b → 76c → 76d → 76e. Then two lanes on disjoint files —
**lane 1:** 76f → 76g → 76h → 76i → 76j → 76k → 76l → 76o; **lane 2:** 76m → 76n → 76p → 76q → 76r → 76s → 76t →
76u → 76v. Inside a lane the order is strict where files repeat (A1 76g–76i, A3 76j–76k, `working-hours.ts` 76m → 76n,
`report-period.ts` 76p → 76q, `a9RiskCore` 76r → 76s–76u); elsewhere it is only queue order.

**Against 75 and 77.** 76 never edits `a9-forecast-sim.ts` or `forecast-lab-sim.ts`, so 75's forecast speed work may
run beside 76 there; anything 75 needs in `a9-bottleneck.ts`, `a9-forecast.ts` or `forecast-lab.ts` waits for 76r
and 76s. 77's exclusion of machines from BD %, MTTR, MTBF and availability goes after 76f, 76j–76k and 76m, unless it
stays inside `machine-facts.ts` (`isProduction`) and the loader, which 76 does not touch.

**Line budgets to watch.** `a9-bottleneck.ts` 398, `a1-bd-pm.ts` 395 (76g first), `compare-score.ts` 395,
`annual-report.ts` 384, `team-focus.ts` 374, `a10-problems.ts` 370 — 76r and 76v delete their local window functions
before adding (net negative); 76o and 76u must stay at or under 399 or move a helper out in the same packet.

**Size.** 76 alone is 22 changes and about 2,600 lines with tests. Stage E (tickets 75–79) was budgeted at 22
changes and 2,800 lines in all, so 76 uses nearly the whole stage: the estimate was too low, because 16 figures need
their own edit. If the timebox bites, the cut line is after 76q; 76r–76v are the gap fault on history figures, which
today touches two months of 2022.

**How 76 closes (rule 2, D34).** `validate:full` is ticket 79, which waits on 76. 76 closes on its hand fixtures,
the unchanged answer key and a green domain suite; 79 then validates on the whole database, and any difference
traced to a period rule reopens 76.

## Risks

1. **The key drifts by a rounding.** Cost: goal 3 fails. Guard: 76a asserts the span-less path returns the same
   doubles; every packet runs the whole domain suite.
2. **A test calls a computer directly with uncut multi-year data.** Cost: a false green. Guard: new tests go through
   `runWith` with a span; `types.ts` says so on `EngineData.period`.
3. **"No records" from rows misreads a genuinely empty plant month.** Cost: the words `no records` instead of `0`,
   never a wrong rate; at about 110 breakdowns a month it does not happen.
4. **A server call without a span knows no gaps.** Cost: history figures count Feb–Mar 2022 as observed until 75
   names the span; 75's frozen call is `run(data, asOf, profile, span)` always.
5. **`asOf = period.to` changes what a period figure calls "now"** (an age band ages to the span's end). Cost: a
   label on a past span; that is the honest reading.
6. **Retired machines have no end date** (`MachineRow` has `purchasedOn` only): a machine scrapped in 2023 adds
   hours to 2024–2026. Cost: understated history BD %. Not 76: N16 and 69.
7. **Two rounding paths disagree at a half:** on the fixture today A1 prints `98.17%` and the dashboard `98.18` for
   the same availability. Pre-existing; the hand values avoid the tie.

## For Nimish

Open questions, each with a recommendation:

1. When the year turns, should analytics open on **this calendar year so far** or **the last twelve months**? (Bhavin's
   platform had a year selector, `a4-manpower.ts:134`; its default is inferred.) **Recommend:** this calendar year so
   far — the 2026 answers stay exactly as they are; on 3 January it shows three days.
2. A month with no records (February–March 2022): should that year's breakdown % **leave the month out** rather than
   count it as a month without breakdowns? **Recommend:** leave it out, and say "February–March 2022: no records" on
   screen (75 carries the list there).
3. Should the health score, forecasts, Team Focus and Money Matters learn from **all five years** or only recent
   ones? **Recommend:** all years, as Bhavin's platform did, gaps left out; a recent-years window can follow if the
   2022 machines look unlike today's.
4. A1 and A3 over five years would print 60 month columns. **Recommend (planned):** one year of 12 columns by default,
   another year chosen with the period picker (83/86); a span across years is for the engine and for 90.

What he will see once history is loaded, before the period picker lands (83/86): the dashboard, A1–A10 and the
**Breakdown Log show this calendar year only**; earlier years are in the database and in `validate:full` (79), not
yet on screen.

## Not in this ticket

Storing and serving a chosen span, the gap sentence on screen and the period picker (75, 83, 86); year-on-year and
seasonality figures (90); the reliability fit on the whole history (92); the load (69, N17); `validate:full` (79);
machines out of production data (77); retirement dates (N16); the `breakdown-free` crash (PR #413).
