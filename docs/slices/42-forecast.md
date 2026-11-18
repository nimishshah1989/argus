# M4a-42 — Forecast: A9 bottleneck and the Forecast Lab (ticket 42)

Ticket 42: [Engine] "A9 bottleneck, the planning forecast, the trend test, repeat faults and the Forecast Lab match the
platform's 11 November answer key." [Browser] "Their screens are sortable and drill real rows."

Acceptance: `fixtures/answer-key/a9-bottleneck-forecast.json` (`screen a9-bottleneck-forecast`, page `a9`,
Bottleneck Analysis: **14 KPIs, 9 tables, 2 charts**) and `fixtures/answer-key/forecast-lab.json` (`screen
forecast-lab`, page `fl`, Forecast Lab: **0 KPIs, 2 tables, 1 chart**) — whole objects, no tolerance, no
re-rounding. Both registry rows exist (`registry.ts` owner 42, drill `machine`); both parity rows exist
(`docs/spec/parity.yaml` `m4a.a9-bottleneck-forecast`, `m4a.forecast-lab`). No migration, no settings seam:
`flHalfLife` is already an `AnalyticsProfile` field (fixture 300) and there is no `fcModel` setting, so the page uses
M0 (the lab tests all four methods).

## Authority and the code the rules come from

The 11 Nov build at `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` (tracked). Function anchors:
`bnPeriod` 6167, `bnCompute` 6178–6225, `renderBottleneck` 6245–6308, `renderBnSim` 6227–6243, `fcCompute`
9630–9700, `fcHtml` 9687–9753, `fcChart` 9758–9770, `flBuild` 9418–9435, `flLams` 9436–9460, `trLaplace`
9749–9752, `trSummary` 9754–9760, `trHtml` 9762–9778, `rfCompute` 9805–9850, `rfHtml` 9850–9905.
The rules below are the plan's statement of them; the coder implements from this plan, not by copying the source
(discovery is reference only).

## Shared rules (ticket 40/41 rules that carry)

- **The fleet** is `isProduction` (CNC, not excluded) — `machine-facts.ts`. Robots and non-CNC registers are out.
- **Hours are effective hours** (`effectiveHours`: NO DT = 0). PM is excluded everywhere; a NO-DT row is a breakdown
  with 0 h.
- The **period** is 1 January of the earliest breakdown year → the latest breakdown date (the key: 01 Jan 2026 →
  07 Nov 2026); `perDay = prodHrsPerDay × workDaysPerYear / 365` (20 × 300 / 365).
- A machine's observation starts at the later of 1 Jan and its purchase date; `days` is inclusive.
- **An episode** merges entries on the same or the next calendar day (one fault logged again); hours add, count once.
- **Formatting** is the platform's: `formatInr` for grouped numbers, `formatPercent` for percentages, one decimal for
  hours, `DD-MM-YYYY` for dates, a 0 prints `—` only where the key does; never re-round a printed number.
- **Drills:** A9 and the Lab drill machine ids, every one a real machine row; the engine sorts and dedupes.
- Empty plant → `null`; the only placeholder is "Not computed yet".

## 42a — A9 risk and capacity (one PR)

`a9-bottleneck.ts` (new): the risk core. For each production machine: `avail = days × perDay`,
`unav = min(1, h/avail)`, `a = 1 − unav`, `mttr = h/n`, `perYear = h/days × 365`; `peers` = machines in the same
category, `cellN` = in the same cell; `capLeft = (peers−1)/peers`, `cellLeft = (cellN−1)/cellN`;
`fleetUnav = Σh / Σavail`; `L = min(1, (unav/fleetUnav)/4)`, `C = 1/√peers`,
`score = round(100 × (0.5L + 0.5C))`; rating **Critical** when (`peers = 1` and `unav > fleetUnav`) or
(`score ≥ 55` and `peers ≤ 10`), else **High** at ≥ 40, **Watch** at ≥ 30, else **Low**. Sort score desc, then hours
desc. KPIs 0–3: Critical count, High count, sole-of-kind count, plant availability `1 − fleetUnav`
(`99.45%`). Table 0 top 20 (the key's 20): the key's 12 columns. Table 3 "Capacity by machine category": categories
sorted by machine count asc then average availability asc; values `n`, `eff = Σa` (1 dp), `avg`, `h` (0 dp),
weakest machine (lowest a, name + its %), `left`. Table 4 "Capacity by cell": cells sorted by average availability
asc; `Cell 1`… labels (a blank cell prints "No cell assigned"), `n`, `avg`, `h` (0 dp), `bdp = Σh/Σavail`,
weakest. Drill: every production machine id.
**Files:** `a9-bottleneck.ts` (new), `computers.ts` spread, `test/analytics-bottleneck.test.ts`, fragment.
**Acceptance:** `kpis.slice(0,4)`, `tables[0]`, `tables[3]`, `tables[4]` equal the key's; the drill count equals the
derived production fleet and every id is a real machine. Red first; green the named test then
`pnpm exec vitest run packages/domain/test`.

## 42b — A9 what-if and the planning forecast (one PR)

`a9-forecast.ts` (new): the what-if for the first risk machine (WJ-01, the key's default) and the planning forecast.
What-if: duration = the machine's MTTR (the platform's "typical"), `days = hrs/ph`,
`catMonthShare = hrs/(peers × ph × wd/12)`; KPIs 4–8 (outage length, category capacity left, cell capacity left,
category capacity lost, expected downtime next 12 months); table 1 = the 5 longest breakdowns of that machine
(Date, Problem, Code, Hrs); table 2 = up to 8 covering machines of the same category sorted availability asc
(Machine, Cell, Availability, BD hrs) or the key's single "None — this is the only machine of its kind" row.
Forecast: the next 3 calendar months from the period end (default the first, December 2026, 31 days); episodes as
shared; `flLams` M0 (no age, no recent): own category's rate excluding the machine when the rest of the category has
≥ 180 days, else the fleet rate; `lam = max(lam0, 0.25 × fleetRate)` smoothed by `FC_S0 = 180`; pool = the
category's durations when ≥ 15 else the fleet's; `cap = p90(pool)`; censored mean with `w = n/(n+4)`;
`expN = lam × days`, `expH = expN × mu`, `p1 = 1 − 1/(1+expN)`; long share from the same mixture;
`pLong = 1 − 1/(1+expN×share)`; 2,000 seeded runs `fcRng(1000 + index)` (mulberry32) with a Poisson count and
duration draws, `p80 = max(expH, q80)`, `p90 = max(p80, q90)`; trend rising when `n90 ≥ 3` and
`n90 ≥ 2 × lam×90`, quiet when `n ≥ 4`, `n90 = 0`, `T > 180`; confidence High at `n ≥ 6` and `T ≥ 150`, Medium at
`n ≥ 2` and `T ≥ 90`, else Low; band Hot ≥ 6 h, Likely ≥ 3, Watch ≥ 1, else Stable. Rows sort `expH` desc, then
`p80` desc; top 25. Plant totals from the sum of the runs (`p50/p80/p90`), `expTotal = ΣexpH`, `expN = ΣexpN`,
`hist = Σ fleet hours / period days × month days`. KPIs 9–13 and table 5 exactly as the key (the note cell joins the
rising/quiet remark and the trend remark with no separator, as the platform prints them).
**Files:** `a9-forecast.ts` (new), `computers.ts` spread, `test/analytics-bottleneck-forecast.test.ts`, fragment.
**Acceptance:** `kpis.slice(4)`, `tables[1]`, `tables[2]`, `tables[5]` equal the key's subtrees; the forecast drill is
the production machines; a mutation that drops the seeding order fails the table (proof the RNG is the key's).
**Open item:** the exact printed text of the note cell and the KPI subs is in the key; the coder must reproduce the
key's strings, not paraphrase them.

## 42c — A9 trends, repeat faults and charts (one PR)

`a9-maintenance.ts` (new): `trLaplace` — each episode's relative position `x = (day − start + 0.5)/T`, clamped,
`U = Σ(x−0.5)/√(N/12)`; `before = nBefore/daysBefore × 30` when the before-window is ≥ 30 days else "—",
`recent = n90/days90 × 30`; verdict at ±1.96 (`TR_Z`), "Too little data" under the minimum (categories 15,
machines 8). Table 6 categories sorted by |U| desc after dropping "Too little data"; table 7 only machines with a
clear verdict, sorted by |U| desc. Table 8 repeat faults: episodes per machine and per maintenance code; a
long-running fault has ≥ 3 distinct days in the window; a recurring code has 3+ episodes whose first days span ≤ 30;
the 90-day default window; the key's 26 rows and their order. Charts: `ch-a9-map` — one lane per category sorted by
machine count asc then availability asc, y = lane index + a deterministic jitter from the machine id
(`h = (h×31 + char) % 997`, scaled ±0.31), x = `round(unav×1000)/10`, radius `4 + √h×0.7` capped 15, colour by
rating, only High/Critical labelled; `ch-fc` — top 15 forecast rows, y labels `<machine> · <category>`, x
"Hours of downtime expected in <month>", two series (expected coloured by band, plan for 80%).
**Files:** `a9-maintenance.ts` (new), `computers.ts` spread, `test/analytics-bottleneck-trends.test.ts`, fragment.
**Acceptance:** `tables[6]`, `tables[7]`, `tables[8]` and the two charts equal the key's; the map's data points and
radii are pinned; every drill id real.
**Open item:** the repeat-fault sort/limit rule and the trend "before" window definition are settled from
`rfCompute`/`trSummary` at dispatch (the key's 26 rows pin the result).

## 42d — Forecast Lab (one PR)

`forecast-lab.ts` (new): the four methods (M0 current, M1 age-adjusted, M2 recent-weighted, M3 age + recent) over
`flBuild`/backtest months; the pinball loss at the median/80/90, the change vs current, the above-line shares, the
plant-inside-80% count ("4 of 7"), top-10 caught, better-than-current count and the verdict text; table 0 "How each
method did" (4 rows), table 1 "Month detail" (7 months) and the `ch-fl` line chart. The seeded scheme is
`fixtures/answer-key/README.md` (mulberry32, 2,000 runs, half-life 300 from the fixture). The age model uses
`cmpBand`/`cmpIpf` (the platform's piecewise fit, 4 bands) and the recent-weighted model uses the half-life decay
`0.5^(days/hl)`.
**Files:** `forecast-lab.ts` (new), `computers.ts` spread, `test/analytics-forecast-lab.test.ts`, fragment.
**Acceptance:** `expect(figure.value).toEqual(FL)` whole (2 tables, 1 chart); the chart's four series and the actual
line match; the drill is the machines.
**Open item:** the exact backtest loop (`flBacktest`, lines ~9460–9560), the "Better than current" print and the
verdict sentences are read from that function and the key at dispatch; the plan's rules must be completed in the
plan review before the coder starts.

## Whole-page acceptance (after 42d)

`a9-value.test.ts`: `runWith` returns `a9-bottleneck-forecast` equal to `A9` whole (14 KPIs, 9 tables, 2 charts) and
`forecast-lab` equal to `FL` whole; both drill the production machines; the engine's reply sorts/dedupes; an empty
plant returns null. `pnpm exec vitest run packages/domain/test` and `pnpm precheck` green.

## Rails

Red first; one writer per packet; file ≤ 400 lines, function ≤ 60; no new dependency; no code copied from the frozen
discovery (rules only); whole-subtree equality per packet and whole-key equality at the end; never weaken a test.
