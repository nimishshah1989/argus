# M4a-42 — Forecast: A9 bottleneck and the Forecast Lab (ticket 42)

Ticket 42: [Engine] "A9 bottleneck, the planning forecast, the trend test, repeat faults and the Forecast Lab match the
platform's 11 November answer key." [Browser] "Their screens are sortable and drill real rows."

Acceptance: `fixtures/answer-key/a9-bottleneck-forecast.json` (`screen a9-bottleneck-forecast`, page `a9`,
Bottleneck Analysis: **14 KPIs, 9 tables, 2 charts**) and `fixtures/answer-key/forecast-lab.json` (`screen
forecast-lab`, page `fl`, Forecast Lab: **0 KPIs, 2 tables, 1 chart**) — whole objects, no tolerance, no
re-rounding. Both registry rows exist (`registry.ts` owner 42, drill `machine`); both parity rows exist
(`parity.yaml` `m4a.a9-bottleneck-forecast`, `m4a.forecast-lab`). No migration, no settings seam: `flHalfLife` is
already an `AnalyticsProfile` field (fixture 300) and there is no `fcModel` setting, so the page uses M0 (the lab
tests all four methods).

## Authority and the code the rules come from

The 11 Nov build at `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` (tracked). Function anchors:
`bnPeriod` 6167, `bnCompute` 6178–6225, `renderBnSim` 6227–6243, `renderBottleneck` 6245–6308, `fcCompute`
9630–9700, `fcHtml` 9687–9753, `fcChart` 9758–9770, `flBuild` 9418–9435, `flLams` 9436–9460, `flBacktest`
9460–9560, `trLaplace` 9749–9752, `trSummary` 9754–9760, `trHtml` 9762–9778, `rfCompute` 9780–9805, `rfHtml`
9805–9850. The rules are this plan's statement of them; the coder implements from the plan and never copies source.

## Shared rules

- **Fleet:** `isProduction` (CNC, not excluded) — `machine-facts.ts`. Robots and other registers are out.
- **Hours:** `effectiveHours` (NO DT = 0). PM excluded everywhere; a NO-DT row is a breakdown with 0 h.
- **Period:** 1 January of the earliest breakdown year → the latest breakdown date (key: 01 Jan 2026 → 07 Nov 2026);
  `perDay = prodHrsPerDay × workDaysPerYear / 365` (20 × 300 / 365).
- **Episodes vs entries:** an **episode** merges entries on the same or the next calendar day (hours add, count once).
  **42a uses raw entries** (Breakdowns = entry count, MTTR = hours/entries — WJ-01: 23 and 3.6). The episode merge is
  used only by the forecast, trend and repeat computations (42b/42c). A machine's observation starts at the later of
  1 Jan and its purchase date; `days` inclusive.
- **Formatting:** table dates `DD-MM-YYYY`; the KPI 3 sub period and repeat “From – to” rows use en-GB short month
  (`01 Jan 2026 to 07 Nov 2026`, `23 Aug – 11 Sept`); table labels are `normalizeLabel`led (collapsed whitespace),
  while the A9 map's tick labels keep the raw settings text; a 0 prints `—` only where the key does; never re-round.
- **Sums:** the platform adds within a machine's own bucket in data order, then across machines in **base (fleet) order**;
  that order decides the April actual cell (377.8, not 377.9).
- **`n90`:** episodes whose day is **strictly after** period end − 90 days.
- **Drills:** A9 and the Lab drill machine ids, every one a real machine row; the engine sorts and dedupes.
- Empty plant → `null`; the only placeholder is "Not computed yet".

## 42a — A9 risk and capacity (one PR)

`a9-bottleneck.ts` (new): per production machine, from **raw entries**: `h = Σ effectiveHours`, `n = entries`,
`avail = days × perDay`, `unav = min(1, h/avail)`, `a = 1 − unav`, `mttr = h/n`, `perYear = h/days × 365`;
`peers` = same category, `cellN` = same cell; `capLeft = (peers−1)/peers`, `cellLeft = (cellN−1)/cellN`;
`fleetUnav = Σh/Σavail`; `L = min(1, (unav/fleetUnav)/4)`, `C = 1/√peers`,
`score = round(100 × (0.5L + 0.5C))`; **Critical** when (`peers = 1` and `unav > fleetUnav`) or (`score ≥ 55` and
`peers ≤ 10`), else **High** ≥ 40, **Watch** ≥ 30, **Low**. Sort score desc then hours desc. KPIs 0–3: Critical count
(6), High count (16), sole-of-kind (4), plant availability `1 − fleetUnav` (`99.45%`, sub `machine hours up, 01 Jan
2026 to 07 Nov 2026`). Table 0: top 20, the key's 12 columns. Table 3: categories sorted machine count asc then
average availability asc — Machines, Effective machines (Σa, 1 dp), Avg availability, BD hrs (0 dp), Weakest machine
(code + its %), Capacity left if it stops. Table 4: cells sorted average availability asc — “Cell <n>” / “No cell
assigned”, Machines, Avg availability, BD hrs (0 dp), BD % (Σh/Σavail), Weakest machine. Drill: every production
machine id.
**Files:** `a9-bottleneck.ts` (new), `computers.ts` spread, `test/analytics-bottleneck.test.ts`, `changes/42-forecast.md`.
**Acceptance:** `kpis.slice(0,4)`, `tables[0]`, `tables[3]`, `tables[4]` equal the key's; the drill count derived and
every id a real machine. Red first; green the named test then `pnpm exec vitest run packages/domain/test`.

## 42b — A9 what-if, forecast and the trend helper (one PR)

`a9-forecast.ts` (new) also carries `trLaplace`/`trSummary` because the forecast table's Note column needs the machine
trend; 42c imports them.

**What-if** for the first risk machine (WJ-01, the key default): duration = MTTR, `days = hrs/ph`,
`catMonthShare = hrs/(peers × ph × wd/12)`; KPIs 4–8; table 1 = the 5 longest entries (Date, Problem truncated to 48
chars, Code, Hrs); table 2 = up to 8 covering machines sorted availability asc, or the key's single "None — this is the
only machine of its kind" row.

**Forecast:** next 3 calendar months from the period end, default the first (December 2026, 31 days). Episodes as
shared. M0 `flLams`: own category's rate excluding the machine when the rest of the category has ≥ 180 days, else the
fleet rate; `lam0 = max(lam0, 0.25 × fleetRate)`; `nw = n`, `Tw = T`, `rho = 1`;
`lam = (nw + lam0 × 180 × rho)/(Tw + 180 × rho)`. Pool = the category's durations when it has ≥ 15 episodes else the
fleet's; `cap = q90(pool)`; `poolCapMean = mean(min(d, cap))`; `w = n/(n+4)`;
`ownCap = mean(min(d, cap))` over the machine's durations (poolCapMean when it has none); `mu = w × ownCap + (1−w) ×
poolCapMean`; `expN = lam × days`, `expH = expN × mu`, `p1 = 1 − 1/(1+expN)`; long share the same mixture with
`FC_LONG = 8`; `pLong = 1 − 1/(1+expN×share)`. **Simulation, exact draw order:** for machine index `idx` in the base
(nonRobot production) order, `rng = fcRng(1000 + idx)` (mulberry32, `FC_RUNS = 2000`); per run one uniform for
`g = −ln(u || 1e-9) × expN`, then `cnt = pois(rng, g)` (Knuth below 30, two-uniform rounded normal approximation above,
never below 0); per breakdown one uniform for the mixture choice (`r.n && rng() < w` → own, else pool) and one for the
index (`floor(rng() × n)` into the **unsorted** durations); `sims[k] = Σ durations`; plant/category/cell totals add the
same run. Quantile `q(sorted, q) = sorted[min(n−1, max(0, floor(q×(n−1)+0.5)))]` (no interpolation);
`p80 = max(expH, q80)`, `p90 = max(p80, q90)`. Rising when `n90 ≥ 3` and `n90 ≥ 2×lam×90`; Quiet when `n ≥ 4`,
`n90 = 0`, `T > 180`; confidence High at `n ≥ 6` and `T ≥ 150`, Medium at `n ≥ 2` and `T ≥ 90`, else Low; band Hot
≥ 6 h, Likely ≥ 3, Watch ≥ 1, Stable below. Rows sort `expH` desc then `p80` desc; top 25. Plant totals from the summed
runs (`p50/p80/p90`), `expTotal = ΣexpH`, `expN = ΣexpN`, `hist = Σ fleet hours / period days × month days`. The Note
cell joins the rising/quiet remark and the trend verdict with **no separator** (the key prints
`Rising: 12 in 90 daysTrend: more frequent`); when absent it prints `Quiet for 90 days` or `Little history`.
`trLaplace`: each episode's relative position `x = (day − start + 0.5)/T`, clamped to 0..1;
`U = Σ(x−0.5)/√(N/12)`; `before = nB/dB×30` when `dB ≥ 30` else `—`, where `dB = T − min(90,T)` and `nB = n − n90`;
`recent = n90/min(90,T)×30`; verdict at ±1.96, "Too little data" under the minimum.
**Files:** `a9-forecast.ts` (new), `computers.ts` spread, `test/analytics-bottleneck-forecast.test.ts`, fragment.
**Acceptance:** `kpis.slice(4)`, `tables[1]`, `tables[2]`, `tables[5]` equal the key's; the forecast drill is the
production machines; a mutation of the seed order fails the table.

## 42c — A9 trends, repeat faults and charts (one PR)

`a9-maintenance.ts` (new): table 6 categories (minN 15, drop "Too little data", sort |U| desc); table 7 only machines
with a clear verdict (minN 8, sort |U| desc). Table 8 repeat faults, **90-day window** (membership = the item's last day
≥ end − 90 days; NO-DT entries excluded entirely): a **long-running** item is a merged episode on ≥ 3 distinct days,
its code the most frequent one, “down on N days in a row”; a **recurring** item is a greedy scan of code-episodes where
≥ 3 first days span ≤ 30 days, then skip past the segment; “How often” is `N separate times in D days` or the
long-running text; “From – to” is en-GB short months; Downtime is the hours sum; Latest problem is the last problem
text truncated to 70 chars; Code is the code plus its description (`LIKLeakage`). Rows sort **downtime desc, no limit**
(the key's 26 rows descend 22.0 → 1.0). Charts: `ch-a9-map` — one lane per category sorted machine count asc then
availability asc, y = lane + jitter (only when `peers > 1`; sole machines sit exactly on the lane; the jitter is the
deterministic id hash `h = (h×31 + char) % 997`, `((h%100)/100 − 0.5) × 0.62`), x = `round(unav×1000)/10`, radius
`4 + √h × 0.7` capped 15, colour by rating, only High/Critical labelled, tick labels raw (not normalized);
`ch-fc` — top 15 forecast rows, y labels `<machine> · <category>`, x "Hours of downtime expected in <month>", series
expected (coloured by band) and plan for 80%.
**Files:** `a9-maintenance.ts` (new), `computers.ts` spread, `test/analytics-bottleneck-trends.test.ts`, fragment.
**Acceptance:** `tables[6]`, `tables[7]`, `tables[8]` and both charts equal the key's; map points/radii pinned; drill
ids real.

## 42d — Forecast Lab (one PR)

`forecast-lab.ts` (new): **1,000 simulations per machine** (`FC_RUNS_LAB = 1000`; the page prints "1,000 simulations
per machine"), months from `per.start + 3 months` through the last full month (Apr–Oct 26, 7 months), base = data up to
month start − 1 day with not-yet-purchased machines dropped, per-method re-seed `fcRng(1000 + idx)`. Methods: M1/M3 use
the **five** age bands 0–3, 3–6, 6–10, 10–15, 15+ years at the month's data cut (unknown/negative age → factor 1) and a
multiplicative category×band IPF fit, **40 iterations**, pseudo-count **4**, mean-normalised each pass; M2/M3 use
`nw = Σ 0.5^(days/hl)` and `Tw = (hl/ln2)(1 − 0.5^(T/hl))`, `ρ = Tw/T`, feeding `lam = (nw + lam0·180·ρ)/(Tw + 180·ρ)`.
Pinball loss `pin(t,q,a) = a ≥ q ? t(a−q) : (1−t)(q−a)` at .5/.8/.9, averaged per machine-month then over months; the
plant-inside count is the plant total inside its **p10–p90** range; top-10 ranks machines by `expH` desc. Plus the change
vs current, above-80/90 shares, better-than-current count, the Adopt rule (`dLoss ≤ −1%` and `dRange ≤ +1%` and better
in more than half the months), the exact verdict/why sentences, table 0 (4 rows), table 1 "Month detail" (7 rows,
`Apr 26`, `median (low–high)` 0 dp), and the `ch-fl` chart (actual + one line per method, 0.1 rounding).
**Blocked sub-item (do not dispatch 42d until settled):** a faithful port of the stated scheme matches the key except
the **September** row (M0 310 (183–541) vs the key's 307 (182–545); M1 300 vs 297; M2 321 vs 316; M3 309 vs 307; the
chart's Current Sep 309.6 vs 306.9; M1 better-than-current 3 of 7 vs 2 of 7). The September base rule is missing from
both the plan and the plausible levers (cut ±1 day, full-period lam/pools, seed offsets). A spike must find it (read
`flBacktest`, lines 9460–9560) and the plan must state it before 42d is dispatched.
**Files:** `forecast-lab.ts` (new), `computers.ts` spread, `test/analytics-forecast-lab.test.ts`, fragment.
**Acceptance:** `expect(figure.value).toEqual(FL)` whole; the chart series match; the drill is the machines.

## Whole-page acceptance (after 42d)

`a9-value.test.ts`: `runWith` returns `a9-bottleneck-forecast` equal to `A9` whole and `forecast-lab` equal to `FL`
whole; both drill the production machines; an empty plant returns null. `pnpm exec vitest run packages/domain/test` and
`pnpm precheck` green.

## Rails

Red first; one writer per packet; file ≤ 400 lines, function ≤ 60; no new dependency; no code copied from the frozen
discovery (rules only); whole-subtree equality per packet and whole-key equality at the end; never weaken a test.
