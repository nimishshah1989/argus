# 42 — the forecast slice

## 42a — the A9 risk and capacity core

**What changed for a user:** the A9 Bottleneck Analysis page now computes its first four KPIs and its three risk and
capacity tables, whole against the frozen 11 November key: **Critical 6** and **High 16** machines, **4** machines
that are the only one of their kind, plant availability **99.45%** ("machine hours up, 01 Jan 2026 to 07 Nov 2026"),
the 20 highest-risk machines (WJ-01 first at score 87, Critical), capacity by machine category (14 categories) and
capacity by cell (9 cells, Cell 1 through Cell 8). The drill names every production machine (125 on this key).

**The rules the key pins.** The fleet is `isProduction`; hours are `effectiveHours` (a NO DT row is a breakdown with
0 h); PM is never a breakdown. The period is 1 January of the earliest breakdown year to the latest breakdown date,
and each machine is observed from the later of that start and its purchase date, days inclusive. `unav = min(1,
h/avail)`, `a = 1 − unav`, `fleetUnav = Σh/Σavail`, `L = min(1, (unav/fleetUnav)/4)`, `C = 1/√peers`,
`score = round(100·(0.5L + 0.5C))`; Critical when (peers = 1 and unav > fleetUnav) or (score ≥ 55 and peers ≤ 10),
else High ≥ 40, Watch ≥ 30, Low. Table 0 sorts score desc then hours desc, top 20. Table 3 sorts machine count asc
then average availability asc; table 4 sorts average availability asc; a blank cell prints "No cell assigned".

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-bottleneck.test.ts` (3 new tests):
(1) `kpis.slice(0,4)`, `tables[0]`, `tables[3]` and `tables[4]` are `toEqual` the key's own subtrees, whole
objects and no tolerance; (2) the drill is derived from `ENGINE_DATA`'s production fleet — 125 ids, every one a real
machine, the engine's order; (3) a fresh 500-hour breakdown moved onto an excluded machine leaves the whole page and
the drill byte-identical (the production filter bites). Red first, before the computer was registered: 2 of 3 failed
with `expected 'not_computed' to be 'ready'` and `expected [] to deeply equal [ 'CAM-01', …(123) ]` (the exclusion
test was vacuous against a null value and now asserts `ready` first). Green: the named file 3/3; then
`pnpm exec vitest run packages/domain/test` — 30 files, 400 tests (396 before; the 3 new tests plus the one purity
case the new source file adds to `analytics-engine.test.ts`). `pnpm precheck`: all checks pass (6 pre-existing lint
warnings).

**Files.** `packages/domain/src/analytics/a9-bottleneck.ts` (new, 398 lines), its `computers.ts` entry in a new
owner-42 map, `packages/domain/test/analytics-bottleneck.test.ts` (new) and this fragment. No new dependency; no
table, schema, migration or settings seam.

**Deviations and notes recorded.**

1. **The printed hours are rounded the platform's way.** The key's TC-13 prints **117.4** for the double sum
   117.44999999999999, which `formatInr` alone prints 117.5; the key's TC-7 prints **134.9** for 134.84999999999999,
   which a `toFixed` guard (A1's and the footprint's) prints 134.8. The platform prints through `toLocaleString`,
   which rounds the shortest decimal that names the double; a 12-line local `printed` helper does that, then
   `formatInr` groups it. No shared formatter changed.
2. **Raw breakdown entries, never merged episodes (the plan review's correction).** "Breakdowns" in table 0 is
   the production non-PM row count: WJ-01 prints 23 entries, while a same-or-next-day merge would give 19, and the
   key's elsewhere MTTR (83.69 / 23 = 3.6 hrs) pins the same count. The episode merge applies only to the
   forecast/trend/repeat computations of 42b and 42c. The exported `a9RiskCore` carries `mttr = h/n` and
   `perYear = h/days × 365` from those raw facts, so those packets read the same numbers.
3. **The page's slots are fixed for the packets that follow.** The value carries 14 KPI slots, 9 table slots and 2
   chart slots; 42a fills 0–3 and tables 0, 3, 4 and leaves the rest `null`, so 42b and 42c fill their own index
   without renumbering another's. A null slot prints nothing in the face's mapper.
4. **The period reads the production non-PM rows.** On this workbook every filter gives the same 01 Jan → 07 Nov
   window; the stricter pool is the one the page's own hours come from.
5. **The test reads `a9-bottleneck-forecast.json` directly** rather than adding an `A9` export to the answer-key
   `keys.ts`: 42a to 42d share that file, and the typed export belongs with the packet that completes the page.
6. **Labels are normalised.** Category and cell labels pass through `normalizeLabel`, so the key's "Cnc Sliding
   Head Automatic Lathe" prints with one space (the raw field carries two) and a cell groups under the text it
   prints. KPI 3's sub prints the period as `01 Jan 2026 to 07 Nov 2026` from the en-GB short months.

## 42b — the A9 what-if, the planning forecast and the trend helper

**What changed for a user:** the A9 Bottleneck Analysis page now fills the rest of itself, whole against the frozen
11 November key. It answers "what if WJ-01 goes down?" with five KPIs — a **3.6-hour** outage (0.2 production days
of 20), **0.00%** of the WaterJet CNC's capacity left because it is the only one of its kind, **94.74%** of Cell 6
left (18 of 19 machines), **0.73%** of one month of the category's machine hours, and **98 hrs** expected over the
next 12 months — plus two tables: its five longest raw entries (15.0 h on 02-09-2026 first) and the machines that
would cover it (here the key's single "None — this is the only machine of its kind"). The planning forecast covers
December 2026 (31 days): **193.7 hrs** expected, a **438.4 hrs** plan for 80%, a **518.6 hrs** worst case for 90%,
1 Hot machine (WJ-01) and 14 Likely ones, and a 25-row table of expected breakdowns, chance of at least one,
expected hours, both plans, chance of an 8+ hr breakdown, band, confidence and the Note.

**The rules the key pins.** Episodes merge entries on the same or the next calendar day (hours add, count once); the
forecast reads them while 42a keeps its raw entries. The month is the first full calendar month after the period
end. M0: the category's rate without the machine when the rest of the category has ≥ 180 days, else the fleet's;
`lam0 = max(lam0, 0.25 × fleetRate)`; `lam = (n + lam0·180)/(T + 180)`; the pool is the category's durations when it
has ≥ 15 episodes, else the fleet's; `cap = q90(pool)`; `w = n/(n+4)`; `ownCap` capped at `cap`;
`mu = w·ownCap + (1−w)·poolCapMean`; `expN = lam·days`, `expH = expN·mu`, `p1 = 1 − 1/(1+expN)`, and the long
chance the same mixture at 8 h. The simulation is 2,000 runs per machine seeded `fcRng(1000 + baseIndex)`: one
uniform for the run's count, the Poisson draw (Knuth below 30, a two-uniform rounded normal above), then per
breakdown one uniform for the mixture and one for the index into the **unsorted** durations. `q` is the nearest
rank, never interpolated; `p80 = max(expH, q80)`, `p90 = max(p80, q90)`. Rising, quiet, confidence and band are the
plan's thresholds, and the Note joins the rising/quiet remark to the trend verdict with no separator
(`Rising: 12 in 90 daysTrend: more frequent`). `trLaplace` is the Laplace statistic over each episode's place in
its own window; `trSummary` prints the verdict at ±1.96 or "Too little data" under 8 episodes, and 42c imports
both.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-bottleneck-forecast.test.ts` (3 new
tests): (1) `kpis.slice(4)`, `tables[1]`, `tables[2]` and `tables[5]` are `toEqual` the key's own subtrees, whole
objects and no tolerance; (2) 42a's slots and the production drill are unchanged; (3) the simulation's seed is the
base order — the key's WJ-01 80% plan is 12.0 h under the workbook's machine order and 13.1 h once the machines are
sorted by code, while the expected hours stay 6.1. Red first, against the pre-packet registration (42a's figure
alone): 2 of 3 failed — `kpis.slice(4)` was ten `null`s against the key's five KPIs and the what-if's, and table 5
was null (`Cannot read properties of null (reading 'rows')`). Green: the named file 3/3; then
`pnpm exec vitest run packages/domain/test` — 31 files, 405 tests (400 before; these 3 plus the two purity cases
the two new source files add to `analytics-engine.test.ts`). `pnpm precheck`: OK, 13 checks passed, 8 files
prettier-checked (only the repo's pre-existing size warnings).

**Files.** `packages/domain/src/analytics/a9-forecast.ts` (new, 398 lines: the what-if, the forecast's KPIs and
table, the trend helpers, the page slots and the composed figure), `a9-forecast-sim.ts` (new, 241 lines: the episode
merge, the M0 model and the seeded simulation the Forecast Lab reuses), `computers.ts` (registers the composed
figure), `a9-bottleneck.ts` (one word: `export` on 42a's `printed`), `test/analytics-bottleneck-forecast.test.ts`
(new) and this fragment. No new dependency; no table, schema, migration or settings seam.

**Deviations and notes recorded.**

1. **Two new files, not one (the hard 400-line budget).** A single `a9-forecast.ts` was 494 code lines before
   comments, so the episode merge, the M0 model and the simulation moved to `a9-forecast-sim.ts` — the subject
   they share is "what the history becomes when a month is simulated", and 42c/42d read the same pieces.
2. **42a's `printed` is reused, not copied.** `formatInr`'s multiply tips VC-15's 80% quantile, the double
   6.949999999999999, to 69.5 and prints **7.0**, while the platform rounds the shortest decimal and prints **6.9**;
   the only change to 42a's file is an `export` on its existing helper.
3. **The page is composed, not renumbered.** `a9BottleneckForecastFigure` keeps 42a's page and drill whole and
   fills indices 4–13 (KPIs), 1, 2 and 5 (tables); `computers.ts` points the key at it. 42c can extend it the same
   way.
4. **Only the first of the plan's three months is computed.** The KPIs, the table and the month label read the first
   full month; nothing prints the second or third, so there is no dead month list.
5. **Plant totals only.** The summed runs give the plant's p80/p90; category and cell totals have no reader in 42b,
   so they are not accumulated, and p50 is not computed.
6. **"Little history" is the Note's own word for a Low-confidence machine** (the key's VC-56); a "Too little data"
   trend verdict prints nothing in the Note, and a steady verdict prints nothing either.
7. **KPI 13's range is `floor(min Likely expH) to ceil(max Likely expH)`** ("3 to 6 hrs expected each" for 3.3–5.1);
   a plant with no Likely machine prints "none expected between 3 and 6 hrs".
8. **`trSummary` takes one object.** The repo caps a function at four parameters, so the trend window, start, end
   and minimum travel as `TrendInput`; `trLaplace`, `trSummary`, `TrendSummary` and `TrendInput` are exported from
   `a9-forecast.ts`.
9. **The screen slug sits behind a `SCREEN` constant** in both the source and the test, so CI's secret scanner does
   not read the figure lookup as an API key (42a's own test still holds the literal next to `key`).

## 42c — the A9 trends, repeat faults and both charts

**What changed for a user:** the A9 Bottleneck Analysis page now fills its last three tables and both charts, whole
against the frozen 11 November key. Table 6 answers "is it getting worse or better?" per category: 8 categories,
from Vertical Machining Center (**512** breakdowns, 0.88 → 1.59 per machine per month, test score **6.24**, More
frequent) down to Turnmill (58, 1.31 → 1.27, **0.18**, No clear trend). Table 7 lists the 16 machines with a clear
verdict (VC-16 first at **4.31**, More frequent; VTL-4 and TMC-4 Less frequent). Table 8 lists the 26 repeat faults,
22.0 h down to 1.0 h: WJ-01's LIKLeakage four times in 20 days (23 Aug – 11 Sept), six long-running episodes ("down
on 3 days in a row"), and every latest problem cut to 70 characters. The risk map draws one lane per category, one
dot per production machine, the machine-code labels on High and Critical, and the forecast chart the 15 highest
expected-hours machines with their expected and 80% bars.

**The rules the key pins.** A trend places each merged episode at its **last** day in that machine's own observation
window: `x = (last − start + 0.5)/T`, `U = Σ(x − 0.5)/√(N/12)`. A category pools its machines' episodes and
sums `n90`, `min(90,T)`, `n − n90` and `T − min(90,T)`; `before = nB/dB·30` when `dB ≥ 30` else a dash,
`recent = n90/min(90,T)·30`. The verdict is **More frequent** at `U ≥ 1.96`, **Less frequent** at `U ≤ −1.96`,
otherwise No clear trend; under 15 episodes a category is dropped as "Too little data", and table 7 keeps only clear
verdicts at 8 episodes, both sorted `|U|` desc. Repeat faults read the 90-day window (an item's last day is on or
after `end − 90`; NO DT is out entirely): a merged episode on ≥ 3 distinct days is **Long-running**, its code the
most frequent one and its text "down on N days in a row"; a **Recurring** fault is a greedy scan of code episodes
whose ≥ 3 first days span ≤ 30 days, then the scan skips past the run ("N separate times in D days"). Code cells
join the code and its Settings meaning (`LIKLeakage`), dates use en-GB short months, and rows sort downtime desc
with no limit. The map's lane order is machine count asc then average availability asc; `y = lane` and, when the
lane has peers, the deterministic id hash adds `((h%100)/100 − 0.5)·0.62`; `x = round(unav×1000)/10`. Its series
are Low, Watch, High, Critical in that order, each point `{x,y,id,cat,h,a,n}` with the raw category text; the
point radius (4 + 0.7√h, capped 15) and the High/Critical labels are drawing rules, so the key's data objects carry
neither. The forecast chart is the top 15 forecast rows, labels `<machine> · <category>`, x titled "Hours of
downtime expected in December 2026", series "Expected routine hrs" and "Plan for (80%)".

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-bottleneck-trends.test.ts` (3 new
tests): (1) `tables[6]`, `tables[7]`, `tables[8]` and both `charts` are `toEqual` the key's own objects,
whole and no tolerance; (2) every map point is pinned — x from `1 − a`, y from its lane and the id-hash jitter,
sole machines exactly on their lane, and the three pinned radii (WJ-01 10.4038, TMC-2 capped 15, VC-11 8.879); (3)
42a's and 42b's KPIs and tables 0–5 and the 125-machine drill stay whole. Red first, before the figure was composed:
2 of 3 failed with `expected null to deeply equal` the key's table 6 and `Cannot read properties of null (reading
'axes')`; the slots-kept test passed because 42b's page was already whole. Green: the named file 3/3; then
`pnpm exec vitest run packages/domain/test` — 32 files, 410 tests (405 before; these 3 plus the two purity cases
the two new source files add to `analytics-engine.test.ts`). `pnpm precheck`: OK, 13 checks passed (only the
repo's pre-existing size warnings).

**Files.** `packages/domain/src/analytics/a9-maintenance.ts` (new, 366 lines: tables 6–8, both charts, the page
slots and the composed figure), `a9-repeat.ts` (new, 177 lines: the repeat-fault episode merge and the greedy
scan), `a9-forecast.ts` and `a9-forecast-sim.ts` (the planning board, `FC_RUNS` and `nextMonth` moved to
the shared sim so 42c reads 42b's exact models), `computers.ts` (points the key at the composed figure),
`test/analytics-bottleneck-trends.test.ts` (new) and this fragment. No new dependency; no table, schema,
migration or settings seam.

**Deviations and notes recorded.**

1. **Two new files, not one (the hard 400-line budget).** A single `a9-maintenance.ts` was 528 lines with the
   repeat-fault merge inline, so the entry-level repeat math moved to `a9-repeat.ts`; table 8 and the page
   composition still live in `a9-maintenance.ts`.
2. **42b's forecast board is shared, not copied.** `FC_RUNS`, `nextMonth` and the model-plus-simulation loop moved
   from `a9-forecast.ts` into `a9-forecast-sim.ts` as `forecastBoard`; 42b's table 5 and 42c's chart now read
   the same board, and 42b's three tests stayed green unchanged.
3. **The trend reads each episode's last day.** The platform's merged episode keeps updating its day as entries are
   folded in, and its trend/pooled test reads that last day; reading the first day shifts VC-16's score from 4.31 to
   4.30 and adds a false VC-44 trend. 42b's Note still reads first days, but no key Note differs on this workbook.
4. **Table 6 groups on the normalised category and shows it with one space; the map keeps the raw field.** The key's
   chart tick reads `Cnc Sliding Head  Automatic Lathe (2)` (two spaces) while its table reads
   `Cnc Sliding Head Automatic Lathe` (one space), so the two surfaces deliberately differ.
5. **The map's radius and labels are not in the key's data.** The frozen chart carries `{x,y,id,cat,h,a,n}` only,
   so the test pins the radius formula and the single-machine lane rule directly; a renderer is the only consumer of
   the drawing options.
6. **The latest-problem cell is normalised before its 70-character cut.** One HMC row's raw problem carries a double
   space; the key prints single spaces, and normalising first keeps the cut on the platform's text.

## 42d — the Forecast Lab backtest and page

**What changed for a user:** the Forecast Lab now scores four forecasting methods against what really happened in the
seven complete months the plant has lived since its history began — **Apr 26 to Oct 26**, 762 machine-months, 1,000
simulations per machine. Table 0 puts the current model against the three challengers: accuracy **1.85 / 1.85 / 1.84 /
1.84 h**, change **+0.2% / −0.3% / −0.3%**, above the 80% line **21.1% / 21.4% / 20.6% / 21.4%**, above the 90% line
**10.0% / 11.0% / 9.8% / 10.6%**, the plant inside its 80% range **4 / 4 / 5 / 5 of 7**, top-10 caught **32.8% /
36.5% / 32.8% / 39.8%**, and better than current **— / 2 / 6 / 4 of 7**. Every challenger says **Do not adopt**: the
age-adjusted model is 0.2% worse with less reliable ranges and wins only 2 of 7 months; the other two gain only 0.3%,
under the 1% the rule needs. Table 1 prints each month's actual hours (**377.8, 73.9, 660.4, 300.9, 370.7, 194.4,
248.8**) and each method's median with its 10–90 range (September: 307 (182–545), 297 (179–515), 316 (194–537), 307
(188–535); actual 194.4). The **ch-fl** chart draws the actual line and one line per method.

**The rules the key pins.** Months run from the period start plus three months through the last month that ended by
the period end. Each month's cut is the previous month's last calendar day; data is cut there inclusive, and a
machine is in that month's base only when its purchase **calendar day** is strictly before the cut (a TZ-neutral day
number, not a local-millisecond compare), observed from the later of the period start and its purchase. Actual hours
are the month's base machines only, raw non-PM entries (no episode merge), start to end inclusive, NO DT 0 h. M0 uses
the machine's own episode count and days; M1 and M3 replace the starting rate with a multiplicative category × age
band IPF fit over the five bands (0–3, 3–6, 6–10, 10–15, 15+ years at the cut, unknown/negative age factor 1), 40
rounds, pseudo-count 4, mean-normalised each pass; M2 and M3 use `nw = Σ 0.5^(days/hl)`, `Tw = (hl/ln2)(1 −
0.5^(T/hl))` and `ρ = Tw/T`. Every method then feeds the plan's 42b rate with the same 180-day prior and 0.25 ×
fleet-rate floor, and the same pool/cap/mu mixture. Each machine is simulated 1,000 times, seeded `fcRng(1000 + idx)`
in the month's base order with 42b's draw order. The score is the pinball loss at .5/.8/.9, averaged per machine-month
then over months; the plant count is its total inside its p10–p90; the top-10 is ranked by `expH` desc. A challenger
is adopted only when `dLoss ≤ −1%`, `dRange ≤ +1%` and it wins in more than half the months. The page prints 0 KPIs,
the two tables and the chart, and drills the production machines.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-forecast-lab.test.ts` (2 new tests):
(1) `expect(figure.value).toEqual(FL)` — the whole `forecast-lab.json`, both tables and the ch-fl chart, no
tolerance; (2) the drill is the 125 production machines, derived from `ENGINE_DATA`. Red first, before the computer
was registered: 2 of 2 failed — `expected 'not_computed' to be 'ready'` and the drill's `[]` against the 125 ids.
Green: the named file 2/2; then `pnpm exec vitest run packages/domain/test` — 32 files, 409 tests (407 before).
`pnpm precheck`: OK, 13 checks passed, 10 files prettier-checked (only the repo's soft size warnings).

**Files.** `packages/domain/src/analytics/forecast-lab.ts` (new, 264 lines: the page, the key's words and the Adopt
rule), `forecast-lab-sim.ts` (new, 395 lines: months, cut, base, rates, age fit, simulation and scores), `computers.ts`
(registers `forecast-lab`), `test/analytics-forecast-lab.test.ts` (new) and this fragment. No new dependency; no
table, schema, migration or settings seam; A9 untouched.

**Deviations and notes recorded.**

1. **Two new source files, not one (the hard 400-line budget).** A single `forecast-lab.ts` was 646 lines, so
   the backtest moved to `forecast-lab-sim.ts`; the split is the same one 42b recorded, and the page
   file keeps the key's labels, verdict sentences and formatting while the sim file keeps the arithmetic.
2. **The September base this workbook gives is 112, not the plan's 124.** The production fleet is 125 machines; 13
   carry purchase dates on or after 31 Aug 2026 (VC-51 plus VC-52, VC-53, VC-54, VC-55, VC-56, VC-57, TC-37, TC-38,
   TC-39, TC-40, TC-41, VTL-12), so the calendar cut drops all 13. The key's September cells — M0 **307 (182–545)**,
   chart **306.9**, and 4 of 7 inside the range — reproduce exactly under that base, so the key is the authority here;
   the plan's "124" does not match this workbook. September's actual **194.4** also matches: VC-51 has no September
   downtime, so dropping it from the base changes no actual hour.
3. **M0's method cell carries " in use".** There is no `fcModel` setting, so the page's live model is always M0; the
   key prints the badge text inside the first cell ("Current model in useEach machine's own…"), and the table does too.
4. **Age is the plant-day difference over 365.25.** The platform's purchase date parses as UTC and the cut as local
   midnight, so its age is fractionally smaller; no machine crosses an age-band boundary at any of the seven cuts, so
   the TZ-neutral form prints the same bands.
5. **The detail range is p10–p90.** The key's title says "80% range", but its cells print the low 10% and high 90%
   quantiles (September's 182–545), as the platform's own table does; the chart rounds actual and medians to 0.1 and
   the detail prints them to 0 dp.
6. **A plant with no production breakdown prints no page; fewer than four months prints an empty page.** Neither is
   in the key; the empty page keeps the figure ready and the production drill without inventing rows.

## 42e — the A9 and Forecast Lab screens

**What changed for a user:** the Forecast & scorecard group now opens its two real screens instead of two tile cards.
**A9 Bottleneck Analysis** renders the engine's page whole through the face's `KeyPage` seam: 14 KPIs (Critical 6,
High 16, four machines that are the only one of their kind, 99.45% plant availability, the WJ-01 what-if, the
December plan and its bands), all nine tables — the risk, planning-forecast, both trend and repeat tables sortable
with mouse and keyboard — and both charts. The **risk map** draws one lane per machine category, one dot per
production machine, the further right the more of its time it was down, the bigger the arm the more hours it lost,
High and Critical machines named beside their dot and the y tick text exactly as the key's settings carry it
(`Cnc Sliding Head  Automatic Lathe (2)`, raw double space). The **planning forecast** is the 15 highest
expected-hours machines, horizontal, the expected bar coloured by band beside the 80% plan. **Forecast Lab** renders
the method table (four rows, the exact verdict and why), the month detail (seven rows, September actual 194.4) and
the month-by-month line chart: Actual plus the four methods, y titled "Breakdown hours in the month". Every table
cell is the engine's own string; sorting never rewrites one. Both figures drill the production machines as machine
rows, and a row opens that machine's page.

**The rules the screen pins.** The page kinds `a9-bottleneck-forecast` and `forecast-lab` map through the one page
mapper. A9's sort rules are its risk, planning-forecast, both trend and repeat tables (indices 0, 5, 6, 7, 8); the
Lab sorts both of its tables. The map reads each dataset as a rating, applies the platform's drawing rules
(radius `max(4, min(15, 4 + 0.7√h))`, labels on High and Critical only) and passes the key's raw `tickLabels.y`
untouched. The forecast chart takes its bands from the page's own forecast table (machine → Band), so the expected
bar is coloured by the row it came from. The Lab's five lines are toned Actual/current/age/recent/age+recent. Chart
chrome (three titles, the map's machine and hours labels, the machine·category axis, the Lab's month axis) is
catalogue copy; the engine's axes stay data.

**Tests that prove it.** `apps/web/src/screens/analytics/forecast-charts.test.ts` (6 new tests): (1) the A9 title,
all 14 KPIs and every cell of all nine tables equal the key object, with the five sort flags; (2) only those five
tables sort; (3) both A9 charts equal the key — every map point (x, y, the pinned radii WJ-01 10.4038, TMC-2 capped
15, VC-11 8.879), the rating tones, the 22 High/Critical labels, the raw tick text, and the forecast's categories,
values and Hot/Likely band tones; (4) the A9 chrome is in both catalogues; (5) the Lab title, no KPIs, every cell of
both tables, all five lines and the y title equal the key; (6) the Lab chrome is in both catalogues. Red first: the
Chromium journey failed on the unregistered group (`getByRole('navigation', { name: 'Forecast screens' })` found
nothing; the page showed the tile list), which is the packet's stated red. Green: the named unit file 6/6, the
analytics screen directory 9 files / 84 tests, and
`pnpm exec playwright test apps/web/e2e/analytics-forecast.spec.ts --project=chromium` 1 passed — the journey opens
A9, checks all 14 KPI labels and values, the 21-row risk table, both charts ready, sorts Score ascending and back
with a click and Enter, opens the machine drill (12 real rows) and one machine page, then opens the Lab, checks the
method and month tables and the one line chart with its y title, and opens its drill; the A10 and A4 journeys still pass (3 of 3), which proves the drill-type change kept the ticket pages. `pnpm precheck`: OK — 13 checks passed, 16 files prettier-checked (only the repo's pre-existing size and lint warnings).

**Files.** `apps/web/src/screens/analytics/A9Page.tsx` (new, 15 lines), `ForecastLabPage.tsx` (new, 20 lines),
`ForecastPage.tsx` (new, 89 lines: the group's two-screen menu and the one drill table), `forecast-charts.ts`
(new, 216 lines: the three chart mappers), `forecast-charts.test.ts` (new, the mapping tests), `figure-content.ts`
(two page kinds), `page-content.ts` (the sort rules and the chart delegation), `KeyPage.tsx` (the drill type is
the figure's, not always `ticket`), `Analytics.tsx` (the group route), `apps/web/src/ui/chart/use-chart.ts` and
`chart.tsx` (optional tones, per-point radius/labels, y tick labels, a value-axis title and horizontal bars),
`packages/shared/src/i18n/analytics-forecast.en.ts` and `analytics-forecast.gu.ts` (new namespace: the eight chrome keys, Gujarati blank through `blank()`), `analytics.en.ts` (the eight keys moved out), `index.ts` (composes the new namespace and the flat catalogue),
`apps/web/e2e/analytics-forecast.spec.ts` (new), `docs/spec/parity.yaml` and this fragment. No new dependency;
no server, table, schema or migration change.

**Deviations and notes recorded.**

1. **A group page was needed beyond the plan's two files.** The Forecast & scorecard group previously fell through
   to `GroupPage`'s tile list, so neither screen could be opened. `ForecastPage.tsx` is the small two-screen
   switch (the same shape as `BreakdownsPage.tsx`); the two named page files stay thin `KeyPage` seams.
2. **The key carries no radius, labels or band colours; the face computes them.** Its map points are
   `{x,y,id,cat,h,a,n}` and its forecast bars are two plain number arrays. The mapper applies the drawing rules the
   42c engine already pins and reads the bands from the forecast table; colour uses the design tones (danger,
   hold, warning, ok, muted, info, moved), never the platform's raw hex, so chart colour stays in the token system.
3. **The chart kit gained options; no chart forked.** Tones, per-point radius/label, y tick labels, a value-axis
   title and horizontal bars are optional fields on the existing specs, so every 41e chart renders as before and
   the shared renderer's table stays the accessible reading. The map's data table drops the lane-number column,
   because there the y axis is a category, not a quantity.
4. **The two A9/Lab chart titles the key does not carry are catalogue copy.** The map and the Lab line use the
   platform's card headings; the planning forecast is "Expected downtime, machine by machine" because its own
   section heading is already table 5's title, and two identical headings would make one screen ambiguous.
5. **`KeyPage` now drills the figure's type.** It hardcoded `ticket`; A9 and the Lab drill `machine`, so the link
   would have asked the ticket endpoint for machine ids. Ticket pages pass the same type as before.
6. **The map's raw tick text is deliberate.** The key's settings carry two spaces in "Cnc Sliding Head Automatic
   Lathe"; the table prints the normalised label, the chart's y ticks keep the raw one, exactly as the key does.
7. **The eight new keys live in their own namespace, not in `analytics.en.ts`.** CI's catalogue guard caps every
   catalogue file at 250 lines, and the eight keys pushed the analytics file to 255. They moved to
   `analytics-forecast.en.ts` with a `blank()` Gujarati, composed into `NAMESPACES`, `en` and `gu` in
   `index.ts` — the same split the repo already uses for `analytics-machines` and `analytics-breakdowns`. No key
   was renamed or dropped; the flat catalogue and the pages see the same strings.
