# Part 4 inventory — cosmos_platform.html lines 6448–8554

Covers Compare Machines + health score (`cmp*`), Team Focus (`tf*`), Money Matters (`mm*`), Forecast Lab (`fl*`), the Planning downtime forecast (`fc*`), the trend test (`tr*`), repeat faults (`rf*`), Footprint (A7), Manpower (A4), the modal, ISO document header rows, Excel export/import, settings sync, date normalisation, dedupe, data corrections and `init()`. Every line in the range was read. I also looked briefly at a few helpers outside the range to check behaviour: `bnPeriod` 5748, `bnParse` 5747, `effH` 3805, `isPM`/`isNoDT` 852-853, `calcFootprint`/`fpPack`/`fpGroup` 3405-3459, `machDate` 4556 and `nonRobotMachines` 811.

Key shared primitives used throughout:
- `bnPeriod()` (5748): `{start: 1 Jan of the year of the EARLIEST breakdown date, end: latest breakdown date}`. The analysis window always starts on 1 January. It does not start at the first real entry.
- `bnParse(s)` parses only `D-M-YYYY` / `D/M/YYYY`. Anything else returns null, and the row then silently drops out of date-based analytics.
- `effH(b)` returns 0 for `maintCode == 'NO DT'`, otherwise `downHrs`. `isPM(b)` is true when `maintCode == 'PM'`.
- `nonRobotMachines()` returns machines NOT in `settings.excludedMachines`. The name is misleading: it excludes any machine on the exclusion list. `isRobotCat(m)` is a separate regex test (`/^robot/i`) on the category.
- Available hours per calendar day: `perDay = prodHrsPerDay × workDaysPerYear / 365`.

---

## 1. Screens / pages in range

### 1.1 Compare Machines (`page-cmp`, `renderCompare` 6649–6756)
Purpose: a like-for-like comparison of two machines in the same category, with an age-adjusted health score.

- **Layout** (`cmp-layout`): a collapsible left pane (`cmpPaneHtml` 6615) and a main column. When collapsed, the pane shows a hamburger button and a vertical "MACHINES" label.
- **Left pane**:
  - Category name and "N machines · drag into A or B".
  - Hide button (`«`).
  - Search box. It filters by id, make and model, and refreshes only the list (`cmpSetSearch` 6571).
  - Sort pills: "Worst health" (health ascending), "Most downtime" (hours descending), "Oldest" (age descending), "ID" (natural numeric sort).
  - List items (`cmpPaneItems` 6600). Each item shows a drag grip, the id, an A/B tag if selected, make and model, "· not in production data" if the machine is excluded, `n BD · hrs · age`, and a coloured health-score chip.
  - Items are draggable (`cmpDragStart`) and clickable (`cmpClickAdd` 6572). Clicking toggles the machine out if it is already in A or B. Otherwise it fills A, then B; when both are full it replaces B.
- **Header card**:
  - "CATEGORY" select. It lists only categories with ≥2 non-robot machines, sorted by count descending then name (`cmpCats` 6559), with the label "Cat (n machines)".
  - "⇆ Swap" button.
- **Drop zones A / B** (`cmpZone` 6624), with a "VS" divider between them.
  - Empty zone: "Drop a machine here".
  - Filled zone: shows id, make/model, `n BD · hrs · age`, the score chip and label, and a ✕ clear button.
  - A filled zone is itself draggable. Dragging A onto B swaps them (`cmpDrop` 6581). A "pop" animation class is set on the slot that just changed (`cmpPop`).
- **Quick picks** (`cmpQuick` 6591):
  - "Worst vs best": lowest vs highest health score in the category.
  - "Oldest vs newest": by purchase date.
  - "Surprise me": random pair, using `Math.random`.
- **With only one machine chosen**: the scorecard for that machine, plus an empty state ("Drag a machine into B…").
- **With both chosen**:
  - Explanatory line giving each machine's own window (from max(data start, purchase date) to the last entry, in days), and naming the reference column (category average if both machines share a category, otherwise plant average, with a machine count).
  - **Two machine tiles**: id, make/model, category · cell · age, a big health score, and buttons "All breakdowns" (`openMachineDetail`) and "Machine record" (`openAssetDetail('machines')`).
  - **Health scorecard** (`cmpScoreCard` 6634):
    - Per machine: big score /10 with colour, label, confidence ("Low (short history)"), and an age line: "Age x yrs (band): expected about N breakdowns and H hrs a year". If there is no purchase date it says "No purchase date, so no age adjustment".
    - Table rows for the 6 components: label, weight %, a bar (score×10 %), the score, and a detail sentence. Missing spares shows "not scored (no spares data)".
    - The text references "Guide (section 24)".
  - **"What the data says"**: an auto-generated bullet verdict (rules in §4).
  - **"Health checkup" table**: columns are Parameter | A | B | Category/Plant average. A green background plus ✓ marks the better machine on each directional row. The 17 rows (label, better direction, reference) are:
    1. Health score (high)
    2. Availability (high; ref)
    3. Breakdowns (low; ref)
    4. Breakdowns/month (low; ref)
    5. BD hours (low; ref)
    6. BD hours/month (low; ref)
    7. MTTR (low; ref)
    8. MTBF (high; ref)
    9. Longest breakdown (low; ref)
    10. Days since last breakdown (high)
    11. Spares cost ₹ (low; ref)
    12. Spares cost per breakdown (low)
    13. Breakdowns last 90 days (low)
    14. Breakdowns, 90 days before (info)
    15. Electrical (E) count (info)
    16. Mechanical (M) count (info)
    17. PM entries logged (high)
  - **Specifications table**: Category, Make, Model, Controller, Control unit, Age, Year, Power (kW — the export calls the same field Power(KVA)), Footprint (L×W in m from mm), Cell, Location. Cells where the machines differ are bold (case-insensitive compare).
  - **Chart `ch-cmp-code`**: grouped bar. BD hours by maintenance code, top 12 codes by combined hours, A vs B. Blank code is labelled "No code".
  - **Chart `ch-cmp-month`**: line chart of BD hours by month, A vs B (tension .25).
  - **"Longest breakdowns" tables** (one per machine): top 5 by effH. Columns: Date, Problem (44 chars), Code, Hrs.
  - **"By shift" table**: per shift, A count/hrs and B count/hrs.
- Entry point from elsewhere: `openCompare(id)` (called from the machine detail page at line 5516) pre-fills A and the category.
- Colours: `CMP_A '#2563eb'`, `CMP_B '#ea580c'`.

### 1.2 Team Focus (`page-tf`, `renderTeamFocus` 6913)
Purpose: a ranked list of planned maintenance actions with owner and status tracking.

- **Header card**:
  - Title "Team Focus for {next month label}".
  - KPI tiles: Actions (open / in-progress counts), Done (with the "not needed" count), Progress % = (done + skip) / n.
  - Buttons: "Copy briefing for WhatsApp" (`tfCopy`) and "Download Excel" (`tfExport`).
  - Checkbox "Show done and not needed".
- **"Start with these N" card**: up to 6 focus actions (selection rule in §2.3).
- **One card per lane** (A, B, C, F, D, E, in `TF_LANES` order, 6761): name, colour, description, and "(open of total)".
- **Action card** (`tfCard` 6898):
  - Coloured left border (green once done; done or skip items are faded).
  - Lane badge, title, and "about X hrs a month at stake (about ₹ Y a year)". The money part uses `mmRate()`.
  - Red "Came back after it was marked done" when the action was reopened.
  - Facts (HTML) and "What to do".
  - Status select: Not started / In progress / Done / Not needed.
  - Owner select: from `activeTeam()`; a past owner who is no longer on the team is kept.
  - Note input.
  - Buttons: "Open machine", "Problem group" (`probOpen`), "What fixed it before" (`tfGoFix` → page `ff` with a keyword query), and "Open" (nav to `a6` etc.).
- **Dashboard banner** `tfBanner()` (6954; used at line 1416): "N Team Focus actions open for {month}, top: …", clickable to go to `tf`.

### 1.3 Money Matters (`page-mm`, `renderMoney` 7028)
- **Header**:
  - Inputs:
    - Annual turnover (₹ crore; min 0.01, max 100000).
    - "Share of a lost hour that is really lost sales %" (step 5).
    - "Share of avoidable hours the team can remove %" (step 5).
  - Button "Download Excel" (`mmExport`).
- **KPI tiles**:
  - Average turnover per machine / year.
  - Value of one machine-hour.
  - Money lost to breakdowns (period).
  - Same per year (with % of turnover).
  - Could have been added (per year).
- **Message card**: a narrative sentence with the biggest lever.
- **"Where the money could have been more" table**: Lever | Machines | Hours (period) | Money (period) | Money per year | Open button. There are 4 levers plus a "All four together, without counting any hour twice" row.
- **"Where the money was lost"**:
  - Dimension buttons: Problem / Category / Machine / Cell / Month.
  - Chart `ch-mm`: bar in ₹ lakh. Horizontal top 12 for the non-month dimensions, with the top 3 dark blue. Vertical for month.
  - Table: dimension, [Machines], Breakdowns, Hours, Money (period), Money/yr, [Money lost per machine — category only], Share %.
  - Rows click through to the machine detail or the problem group.
- **"What is coming and what is planned" KPIs**:
  - Next month expected (`D.plant.p50 × rate`), Plan for 80%, Worst case 90%.
  - Average month so far.
  - Open Team Focus actions (₹/yr, clickable).
- **"How to read this"**: a caveat note (equal weighting, upper bound, PM and speed/quality losses excluded).

### 1.4 Forecast Lab (`page-fl`, `renderForecastLab` 7233)
- **Header**:
  - Explanation of the walk-forward backtest.
  - Half-life input (30–365 days).
  - "Run the test again" button.
  - "Download Excel" button (disabled until results exist).
  - "Planning forecast is using: X".
- **States**: Busy ("Running the test on past months…"), error, and "not enough history" (it needs ≥3 months before the first test month).
- **Verdict card**: either "Keep the current model" (with an optional top-10 capture remark) or "X is recommended" with the reason. A calc note gives the number of months, machine-months and simulations per machine.
- **Table "How each method did"**: Method (with "in use" badge) | Accuracy score | Change vs current | Above 80% line | Above 90% line | Plant inside 80% range | Top-10 caught | Better than current | Verdict (Adopt / Do not adopt / Baseline + why) | "Use for Planning" button (`flUse`).
- **Chart `ch-fl`**: line chart. Actual (green, thick) against each model's median (dashed). Colours: M0 grey, M1 blue, M2 orange, M3 purple.
- **Month detail table**: Month | Actual hrs | per model "p50 (p10–p90)". The cell is red when the actual fell outside the band.

### 1.5 Downtime forecast for Planning (`fcHtml` 7365, embedded in the Bottleneck page at line 5861)
- Month select: the 3 months after the data end month.
- Button "Download Excel for Planning" (`exportForecast`).
- **KPI tiles**:
  - Expected routine downtime (with expected breakdown count and the historic monthly average `hist`).
  - Plan for (80%).
  - Worst case (90%).
  - Hot machines (count plus the first 4 ids).
  - Likely machines.
- How-to-read note (with the 8-hour long-breakdown threshold).
- **Chart `ch-fc`**: horizontal bar for the top 15 machines. "Expected routine hrs" is coloured by band; "Plan for (80%)" is grey. Clicking a bar → `bnPick(id)`.
- **Table**: # | Machine | Category | Cell | Expected breakdowns | Chance of ≥1 | Expected hrs | Plan for 80% | Worst 90% | Chance of an 8+ hr one | Band pill | Confidence | Note. Notes are: Rising (n in 90 days), Quiet for 90 days, Little history, Trend: more/less frequent.
- Rows click → `bnPick`. Shows the top 25 by default, with a "Show all N machines" toggle.

### 1.6 Trend check (`trHtml` 7457, Bottleneck page)
- Plant verdict sentence. Gives per-machine-per-month rate "before → last 90 days", the test score U and N, and a warning that a rise can come from better logging (it points to the Data Checklist).
- **Category table**: Category | Machines | Breakdowns | rate before→recent | Test score | Verdict pill. Categories flagged "Too little data" are dropped; the rest are sorted by |U|.
- **"Machines with a clear trend" table**: only machines with ≥8 episodes and |U| > 1.96. Columns are the same, and rows click → `bnPick`.

### 1.7 Repeat faults (`rfHtml` 7500, Bottleneck page)
- Window select: "Active in the last 90 days" / "Whole data period". Shows "x recurring · y long-running" and a "Download Excel" button (`exportRepeat`).
- The calc note gives the definitions and the % of breakdowns with a code.
- **Table**: # | Machine | Category | Type badge (Recurring orange / Long-running purple) | Code (+ description via `codeDesc`) | How often | From – to | Downtime hrs | Latest problem logged (70 chars).
- Rows click → `bnPick`. The section promotes the "5 Whys" (Toyota) practice.

### 1.8 Footprint (`page-a7`, `renderA7` 7524)
- **KPIs**:
  - Machines Mapped (with dimensions / total non-excluded).
  - Machine Area (Σ L×W m²).
  - Floor Needed (side² m²; text gives the side and the gap).
  - Machine Area Share (net / side²).
  - Avg Footprint per machine.
- **Plant Footprint card**:
  - Controls: GAP (m) number input (0–5, step 0.5; disabled in tight mode) and ARRANGE select (Compact by size / Grouped by category / No spaces).
  - Line: "Square size … machines cover x% … packed block actually used W × H".
  - Category colour legend.
  - **SVG**: drawn to scale, with dimension lines and "Length/Breadth N m" labels. Each machine is a rectangle in its category colour with its id label (only if the font fits). Hovering shows a tooltip `fpShowTip`: id, model, category, L×W = area, cell, location.
- **Tables**:
  - Average Footprint by Category: colour, Machines, Avg L×W, Avg area with an inline bar, Total area, % of machine area.
  - By Cell (current cell): Machines, Area, %, Avg.
  - By Location: same columns.
  - Footprint Growth by Purchase Year: Year, Machines added, Area added, Cumulative.
  - 10 Largest Footprints: Machine, Model, L×W, Area.

### 1.9 Manpower (`page-a4`, `renderA4` 7650)
- **KPIs**: Total Breakdowns (PM excluded), Total BD Hours, Team Members Tracked (including vendors).
- **Chart `ch-a4-count`**: horizontal bar of breakdowns "Done By" per person (doneCount > 0), using PALETTE colours.
- **Manpower Table**, sorted by doneCount: Name, Type badge (Vendor amber / Team blue), # BD Done, BD Hours Done, Avg MTTR, # BD Supported, Hours Supported, Total Involvement, % of Total.
- **PM month-on-month by team member**:
  - Two rows per person (count in purple, hours in grey), with row shading, sorted by total PM count.
  - Hovering a cell shows a tooltip "machine — date — hrs" for each PM entry, sorted by date.
  - PLANT TOTAL rows for count and hours.
- **Specialization matrix**: pills "By Category" / "By Fault Code" (`renderA4Spec` 7759). Column headers are truncated to 12 characters.
- **YEAR select**: placed in the "Month-on-Month — # Breakdowns Handled" card. It is fed by distinct breakdown years.
- **MoM matrices**: # breakdowns handled and BD hours handled, per name × month, with totals.

### 1.10 Modal (7775–7784)
- `openModal()` / `closeModal()`. Closing clears `modalBox`, resets `editingMachineId` / `editingBreakdownId`, and 50 ms later re-renders the Data Checklist (`renderDC` if on page `dc`, else `dcRefresh()`).
- A click on the overlay backdrop closes the modal.

### 1.11 Settings Sync Preview modal (`renderSettingsSyncPreview` 8044)
- Shows the diff per list in three colours: "+ Add" (green), "− Remove" (red), "~ Description changed" (amber, codes only).
- Buttons: Cancel and "Apply Changes". Says "already match" when there is no change.

---

## 2. Calculations & algorithms

### 2.1 Compare-machine statistics (`cmpStats` 6457)
The machine window comes from `cmpWindow(A,B)` (6449): start = max(bnPeriod.start, purchase date(s)), end = data end, `days = round((end-start)/day)+1`. With a single machine, `cmpWindow(m,null)` is used.

The breakdown list is `filterBD({excludePM:true, machineId, includeExcluded:true})` restricted to the window.

| Metric | Formula |
|---|---|
| n | count of breakdown entries. These are raw entries, not merged episodes. NO DT entries count in n. |
| h | Σ effH (NO DT = 0) |
| avail | `days × perDay` |
| Availability a | `1 − min(1, h/avail)`; 1 if avail = 0 |
| MTTR | h / n |
| MTBF | (avail − h) / n; equals avail if n = 0 |
| perMonth, hPerMonth | n / days × 30.4, h / days × 30.4 |
| max | longest single effH |
| noDT | count of NO DT entries |
| pmN | count of PM entries in the window |
| cost | Σ (cost1 + cost2 + cost3) |
| withSp | entries with cost > 0 |
| costPer | cost / n |
| codes / shifts | `{n, h}` per maintCode (blank → '—') and per shift |
| em | E / M counts and hours (from the `electMech` field, upper-cased) |
| months | hours per `yyyy*100 + month` |
| last, daysSince | last breakdown date over ALL time (not the window), days to data end |
| n90 / h90 | entries with date > end − 90 days (taken from ALL entries, not windowed) |
| p90n / p90h | entries in (end − 180, end − 90] |

**Reference column** `cmpRef` (6475): runs `cmpStats` for every machine in the pool. The pool is the same category if A and B share one, otherwise all non-excluded, non-robot machines. Each machine uses its own window. Each metric is a simple mean across machines. MTTR is averaged only over machines with n > 0. Nothing is cached, so it recomputes on every render.

**Dead code**: `cmpHealth` (6485) is an older percentile-rank health (100 × (1 − mean of share-of-peers-with-lower h, n and mttr)) and is never called. `cmpSetP` / `cmpP` remain only in the cache signature; no UI uses them.

### 2.2 Age-adjusted health score (`cmpCtx` 6520–6558)

**Constants**
- `CMP_BANDS` (6491): [0,3), [3,6), [6,10), [10,15), [15,999) years.
- `CMP_W` (6492): freq .30, hrs .25, mttr .15, trend .15, repeat .10, spares .05.
- Labels (`cmpScoreLbl` 6498): ≥8.5 Excellent, ≥7 Healthy, ≥5.5 Fair, ≥3.5 Poor, otherwise Critical.
- Colours (`cmpScoreCol` 6497): ≥7 green, ≥5 amber, otherwise red. The colour and label thresholds do not line up: a 5.2 is amber but labelled "Poor".

**Rows**
- One row per machine with a non-robot category, *including excluded machines*.
- Window = bnPeriod, starting at max(start, purchase date). `days`; `yrs = days/365`.
- `age = (dataEnd − purchase)/365.25 days`. This is age at the *end* of the data, not at each event.
- band = `cmpBand(age)`, or −1 if there is no date or the date is in the future.
- `excl = isExcluded(m)`.

The fit set is `!excl && days > 0`.

**`cmpIpf(rows, key, K)` (6500).** This is a shrunk multiplicative Poisson model, rate per machine-year = c[category] × a[ageBand], fitted by 40 iterations of iterative proportional fitting:
- `r0 = Σkey / Σyrs`, the fleet rate. Initialise `c[k] = r0`, `a[b] = 1`.
- Category update: `c[k] = (Σ_k key + K) / (Σ_k yrs·a[band] + K/r0)`. This is a gamma prior worth K pseudo-events at rate r0. Rows with band −1 use a = 1.
- Band update: `a[b] = (Σ_b key + K) / (Σ_b yrs·c[cat] + K)`. The prior pulls a toward 1. An empty band gets a = 1.
- Normalise: `mean = Σ yrs·a[band] / Σ yrs` (over rows with band ≥ 0); `a /= mean`, `c *= mean`.
- Used with `K = 4` for breakdown counts (`fitN`) and `K = 40` for hours (`fitH`).

**Category baselines** `base[cat]`, from the fit rows:
- `m0 = h/n` (category MTTR; falls back to the plant MTTR, or 1).
- `cy = cost / yrs` (spares ₹ per machine-year).
- `cpb = cost / n`.
- Expected values per machine: `rateN = c_N[cat] × a_N[band]` (r0 if the category is unknown, a = 1 if no band); `expN = rateN × yrs`. The same for hours: `expH`.

**Transform `cmpMap(r)`** (6496): `clamp(7 − 3.5·log2(max(r,1e-6)), 0, 10)`.
- r = 1 → 7.
- r ≈ 0.55 → 10. The code comment says "half = 10"; strictly, r = 0.5 maps to 10.5 and is then clamped.
- r = 4 → 0.
- Each doubling costs 3.5 points.

**Components** (each scored 0–10):
1. **freq**: `cmpMap((n+3)/(expN+3))`. Additive smoothing of 3 pseudo-events.
2. **hrs**: `cmpMap((h+10)/(expH+10))`. Smoothing of 10 hours.
3. **mttr**: `cmpMap( ((h + 3·m0)/(n+3)) / m0 )`. Shrunk MTTR (3 pseudo-repairs at the category mean) against the category MTTR. Not age-adjusted.
4. **trend**: `cmpMap( ((n90+2)/(eR+2)) / ((p90n+2)/(eP+2)) )`.
   - `eR = rateN × overlapDays(service, [end−89d, end]) / 365` and `eP = rateN × overlapDays(service, [end−179d, end−90d]) / 365`, where `ov()` (6537) returns in-service overlap days.
   - This is a ratio of observed/expected in the last 90 days to observed/expected in the 90 days before.
5. **repeat**: `clamp(10 − 2.5·clusters − 1.5·long, 0, 10)`, from `cmpRepeat` (6513).
   - Clusters: per maintCode (blank/'—' excluded), entries sorted by date. Greedy scan from i: extend j while `date[j+1] − date[i] ≤ 30 days`. If `j−i+1 ≥ 3`, count one cluster and continue at j+1; otherwise i+1.
   - Long: entries with `effH > whyWhyThresholdHours` (default 24).
   - Not normalised by exposure or age.
6. **spares**: only when the category has `cy > 0` and `cpb > 0`. `eC = cy × yrs`, `K = 2·cpb`, score `cmpMap((cost+K)/(eC+K))`. Not age-adjusted.

**Overall score**: `Σ w·score / Σ w` over the components present. Without spares the remaining weights sum to 0.95 and are renormalised.

**Confidence**: days ≥ 150 High, ≥ 60 Medium, otherwise Low.

**Caching**: cached in `cmpCtxCache`. The signature is breakdown count, machine count, cmpP, window dates, excluded ids and the Why-Why threshold. It does **not** include edits that keep counts the same (an edited hours value or date), so a stale score is possible until a count changes.

### 2.3 Team Focus (`tfCompute` 6797)
Inputs:
- `fcCompute()` (forecast), `probCalc()` (problem groups / episodes, outside this range), `cmpCtx()`, `acCompute()` (Action Center).
- `months = period days / 30.44`.
- `SKIP` groups: "PM logged as a breakdown", `PG_OTHER` ("Other / unclear"), "Installation / relocation / trial".

**Lanes and rules**
- **A, "Before next month"**: forecast rows (sorted by expH) with band Hot or Likely, or (trend Rising and band ≠ Stable). Up to 8.
  - Finds the machine's top problem group by hours (needs ≥2 events). The to-do quotes the last corrective action, clipped to 100 characters. With no repeat group, a generic walk-through text is used.
  - stake = expH (hours forecast next month).
  - key `fc|id|YYYY-MM`.
- **B, "Fix for good"**:
  - (i) Machine × problem-group repeats from `P.rep`. Occurrences = events more than 3 days apart (`occ`, 6820). Keep occ ≥ 3, top 6. stake = h / months; sig = occ; key `fixm|machine|group`. The to-do appends `TF_ADVICE[group]`.
  - (ii) The top 3 problem groups by hours (excluding SKIP), with the 3 machines they hit most. stake = h / months; sig = n; key `fixg|group`.
- **C, "Overhaul or replace?"**: health label Critical or Poor, not excluded, `h > expH`. Ranked by excess per month `(h − expH)/(days/30.44)`, top 5. stake = that excess; sig = n; key `ovh|id`.
- **F, "Why-Why due"**: Action Center items with rule `long` and status `open`, top 5. stake = effH of the first entry / months; go = `a6`.
- **D, "Spares to keep ready"**:
  - Part-name normalisation `tfPartKey` (6795): lower-case, letters only, drop stop-words (`TF_PART_STOP`: no any nil na none nos pcs pc mm kg x c a the of and set new old) and words under 2 characters, de-duplicate, sort, join.
  - Keep keys used ≥3 times on ≥2 machines; top 5 by count.
  - Display name = the most frequent raw spelling, with parentheses and words containing digits removed.
  - stake = hours of the jobs that used the part / months.
- **E, "Fix the record"** (stake 0):
  - Blank code ≥ 10% of raw entries.
  - `P.multiList` (pairs logged ≥4 times).
  - `P.pmLike` (PM work logged as a breakdown).
  - "Other / unclear" ≥ 15% of hours (go `a10`).
  - Named spare with zero cost on ≥ 20 breakdowns.

**Status persistence**: `state.settings.tfStatus[key] = {st, owner, note, at (ISO), sig}`, written by `tfSet` (6887). When an action is marked done, the current `sig` is saved. **Auto-reopen**: if an action is done, has a sig, and the current sig > the saved sig (the fault came back more often), it is set back to open with `reopened = true`.

**Focus list**: from the live actions (lanes other than E, status open or in progress), take pools per lane in the order A, B, C, F, D, each sorted by stake. Round-robin: rank k = 0..3 from each lane in turn until there are 6 items, then sort the result by stake. This deliberately mixes different kinds of work.

**Money per action**: `stake × 12 × mmRate()` per year.

### 2.4 Money Matters
- `mmCfg` (6963): turnover in crore (default **100** if unset or ≤ 0), conv % (default 100), succ % (default 50), both clamped to 0–100.
- `mmBase` (6968):
  - `N = nonRobotMachines().length` (machines not on the exclusion list).
  - `annHrs = prodHrsPerDay × workDaysPerYear`.
  - `turnRs = turn × 1e7`.
  - `perMachine = turnRs / N`.
  - `rateRaw = turnRs / (N × annHrs)`.
  - **`rate = rateRaw × conv`**: ₹ per lost machine-hour, with equal weight for every machine.
  - `days` = period days; `ann = 365 / days`.
- Period loss: `lost = P.tot × rate`, where P.tot comes from probCalc (episode hours).
  - Annualised: `lostAnn = lost × ann`.
  - `pctT = lostAnn / turnRs`.

**Levers** (`mmLevers` 6978). For each problem episode e with hours h, there are four avoidable fractions x:
1. **rep**: 1 if the machine|group pair has ≥3 separate occasions (`mmOcc`, the 3-day rule), otherwise 0.
2. **exc**: `f2 = min(1, max(0, h_m − expH_m)/h_m)`, the machine's share of hours above its age-adjusted expectation.
3. **long**: if h > threshold (default 24), `(h − thr)/h`.
4. **slow**: `f4 = max(0, 1 − m0/mt)` for machines with n ≥ 3, where `mt` = machine MTTR and `m0` = category MTTR from `C.rows` (non-excluded, n > 0).

Per lever: `hrs += h·x·succ`, and the machine and event are counted. Combined without double counting: `keep = Π (1 − succ·x_i)`, `comb += h·(1 − keep)` (a probabilistic union). Recoverable ₹ = `comb × rate` (period) and `× ann` (year).

**Breakdown by dimension** (`mmDim` 6997): problem group, category, machine, cell (`getEffectiveCell` at the first entry date, so historical cell moves are respected), month.
- n = number of log entries in the episodes.
- The category row also carries the machine count from the master.
- Per-machine money = `h × rate / machines`.

**Forecast money**: next-month p50 / p80 / p90 plant hours × rate. Average month = `lost / (days/30.44)`.

**Formatting** `mmRs` (6962): ≥1e7 → "₹ x.xx cr", ≥1e5 → "₹ x.xx lakh", otherwise ₹.

### 2.5 Forecast models (shared by Forecast Lab and the Planning forecast)
Constants (7292): `FC_LONG = 8` h, `FC_RUNS = 2000`, `FC_S0 = 180` (prior strength in days), `FC_FLOOR = 0.25`.

**Episode construction** (`flBuild` 7094; the same logic is inlined in `fcCompute` 7311):
- Per non-excluded, non-robot machine, using non-PM breakdowns with date ≤ end. Date-less rows are included only when end ≥ data end.
- Exposure `T = days(max(period start, purchase) → end) + 1`. A machine is skipped if purchased after `end`.
- Sort entries by date. Merge an entry into the previous episode when its day index is ≤ 1 day after the episode's *last* date. This chains, so a 10-day continuous fault is one episode. Hours add up; `k` counts the entries.
- `durs` = episode hours.

**Rate estimation** `flLams(base, end, model, hl)` (7114):
- Models `FL_MODELS` (7084):
  - M0 Current (category shrinkage).
  - M1 Age-adjusted.
  - M2 Recent-weighted.
  - M3 Age + recent.
- Recency (M2, M3):
  - Weighted count `nw = Σ 0.5^(ageDays/hl)`.
  - Weighted exposure `Tw = hl/ln2 × (1 − 0.5^(T/hl))`, the integral of the decay over the window.
  - `rho = Tw/T`.
  - Otherwise `nw = n`, `Tw = T`, `rho = 1`.
- `fleetRate = Σnw / ΣTw`.
- Prior mean `lam0`:
  - Age models: `cmpIpf` on `{cat, yrs = Tw/365, n = nw, band from age at end}` with K = 4; `lam0 = c[cat] × a[band] / 365`.
  - Otherwise, if the *other* machines in the category have ≥ 180 exposure days (`c.T − r.T ≥ 2×90`): leave-one-out category rate `(c.nw − nw_i)/(c.Tw − Tw_i)`. Otherwise `fleetRate`.
  - Floor: `lam0 = max(lam0, 0.25 × fleetRate)`.
- Posterior (gamma-Poisson): **`λ = (nw + lam0·S0·rho) / (Tw + S0·rho)`** per day, with S0 = 180 prior days.
- `basis` = 'age' | 'category' | 'plant' (shown in the export note).
- The Planning forecast uses `fcModelId()`, which is `settings.fcModel` if valid, otherwise M0, together with `flHL()` = `settings.flHalfLife` clamped to 30–365, default 120.

**Duration model** (`flSimulate` 7142, `fcCompute` 7330):
- Pool = the category's episode durations if there are ≥ 15 of them, otherwise the fleet's.
- `cap = 90th percentile of the pool` (`fcQ` 7302 is a nearest-rank quantile: `sorted[floor(q(n−1)+0.5)]`).
- Own capped mean and pool capped mean; `w = n/(n+4)`.
- **Routine mean** `mu = w·ownCap + (1−w)·poolCap`.
- `expN = λ × daysInMonth`; **`expH = expN × mu`** (the "Expected routine" figure, which excludes the long tail).
- `p1 = 1 − 1/(1+expN)`, the chance of at least one breakdown. This is the zero probability of a geometric distribution with mean expN, consistent with the simulation.
- `pLong = 1 − 1/(1+expN·share)`, where `share = w·ownShare≥8h + (1−w)·poolShare≥8h`.

**Monte Carlo** (per machine, FC_RUNS = 2000 runs in Planning, 1000 in the Lab):
- RNG: `fcRng(seed)` (7294) is mulberry32, seeded with `1000 + machineIndex`, so results are reproducible. In the Lab every method uses the same random numbers (common random numbers).
- Each run:
  - `g = −ln(U) × expN`: an exponential (Gamma shape 1) mixing of the rate, giving an overdispersed, geometric-like count.
  - `cnt = Poisson(g)`: Knuth multiplication for g ≤ 30, a normal approximation (Box–Muller, rounded, ≥ 0) for g > 30.
  - Each event: with probability w, resample one of the machine's own *uncapped* episode durations; otherwise one from the uncapped pool.
  - Sum the hours.
- Per machine: sorted sims; `p50`, `p80 = max(expH, q80)`, `p90 = max(p80, q90)`. Plan-for is never shown below expected.
- Plant, category and cell totals are summed run by run (machines independent), then quantiled. So the plant quantiles are below the sum of the machine quantiles (stated in the export).

**Classification** (`fcCompute`):
- Band (7350): expH ≥ 6 Hot, ≥ 3 Likely, ≥ 1 Watch, otherwise Stable. Colours are in `FC_COL`.
- Trend (7348):
  - 'Rising' if episodes in the last 90 days ≥ 3 and ≥ 2 × λ × 90.
  - 'Quiet' if n ≥ 4, no episodes in 90 days, and T > 180.
- Confidence (7349): High needs n ≥ 6 and T ≥ 150; Medium needs n ≥ 2 and T ≥ 90; otherwise Low.
- Per-machine Laplace trend: `trSummary([r], 8)`.
- `hist` = fleet episode hours / period days × days in month (the historic average month, including long breakdowns).
- Forecast months: `fcMonthOptions` (7295) gives the 3 calendar months after the month of the last entry, using full calendar days. Working days and shutdowns are ignored, as the note admits.
- Cache `fcCache` with signature (breakdown count, month, excluded ids, data end, machine count, model, HL).

### 2.6 Forecast Lab backtest (`flRun` 7192)
- **Test months** `flMonths` (7169): from (period start + 3 months), i.e. April when the data starts in January, through the last month that is complete by the data end.
- For each month: `end` = the day before the month starts; `base = flBuild(end)`; `act = flActual(month)` (non-PM effH per machine). For each model: `flScore(flSimulate(base, flLams(...), days, 1000), act)`.

**`flScore`** (7180):
- Pinball (quantile) loss `pin(t,q,a) = a ≥ q ? t(a−q) : (1−t)(q−a)`, averaged over t = .5, .8, .9 per machine, then averaged over machines. This is the **accuracy score in hours**.
- MAE of the mean.
- Exceedance counts above p80 and p90.
- Plant total actual and expected mean.
- Plant `inBand` = actual within [p10, p90]. The UI calls this the "80% range"; it is the 10–90 interval.
- **Top-10 capture** = actual hours of the 10 machines ranked highest by expH ÷ actual hours of the true top 10.
- Machines not in `base` (purchased later) are ignored.

**Aggregation**:
- loss and MAE: mean over months.
- `ex80 = Σe80 / Σmachine-months`; likewise ex90.
- inBand count; mean capture.
- `plantErr` = mean |p50 − act| / act.
- `bias = Σexp/Σact − 1`. Both plantErr and bias are computed but never displayed or exported.
- **Calibration distance** `range = |ex80 − 0.20| + |ex90 − 0.10|`.

**Adoption rule**: a challenger is `ok` only if all three hold:
- `dLoss = (loss − loss_M0)/loss_M0 ≤ −1%`;
- `dRange ≤ +0.01`;
- it beats M0's loss in more than half of the months.

`best` = the lowest-loss ok model, otherwise M0. The verdict text explains which criteria failed.

**Execution**: `flStart` (7220) runs in `setTimeout(40)` with busy/error states. The result is cached by `flSig` (breakdown count, machine count, excluded ids, data end, HL). `flSetHL` saves the HL setting and forces a re-run. `flUse(k)` writes `settings.fcModel` (deleted for M0), clears `fcCache` and shows a toast.

### 2.7 Laplace trend test (`trLaplace` 7444, `trSummary` 7449)
- Each episode is placed at its relative position in its own machine's window: `x = (dayIdx(e) − dayIdx(start) + 0.5)/T`, clamped to [0,1].
- `U = Σ(x − 0.5) / sqrt(N/12)`, pooled across machines. Under a constant rate, x ~ U(0,1), so U ~ N(0,1).
- `TR_Z = 1.96`. U > 1.96 → 'More frequent', U < −1.96 → 'Less frequent', otherwise 'No clear trend'.
- N < minN → 'Too little data'. minN = plant 30, category 15, machine 8.
- Descriptive rates: `recent = n90/Σmin(90,T)×30` and `before = (n − n90)/(T − 90-day part)×30`. `before` is null if the "before" exposure is under 30 days.

### 2.8 Repeat faults (`rfCompute` 7480)
- Uses non-PM entries, excluding NO DT. Hours are `max(0, effH)`; code is the trimmed maintCode or '—'; problem text is kept.
- `rfEpisodes` (7474): sort by date and chain-merge entries ≤ 1 day apart. Tracks first, last, hours, entry count, the set of distinct days, code counts and the latest problem text.
- **Long-running**: a per-machine episode (all codes) covering ≥ 3 distinct days. Reports the dominant code.
- **Recurring**: per machine × code (excluding '—'), build episodes, then a greedy scan.
  - If episode i+2 starts within 30 days of episode i, extend j while each later episode starts within 30 days of episode i.
  - Emit one item (n = number of episodes, summed hours), then continue at j+1.
- Window filter: `last ≥ data end − 90 days` (or everything when the window is "all"). Items are sorted by hours.
- `coded` = share of non-PM entries with a code and not NO DT. The denominator includes NO DT rows.

### 2.9 Footprint packing (A7; `calcFootprint` 3421, rendered at 7524)
- Dimensions: `l = max(L,W)/1000`, `w = min(L,W)/1000` (metres, always landscape).
- Each item is inflated by the clearance on both axes (`L = l + c`, `H = w + c`).
- `grossArea = Σ(l+c)(w+c)`; `netArea = Σ l·w`.
- Ordering:
  - Compact: by H descending, then W descending.
  - Category: in settings category order, then H descending, then id.
- **Shelf packing** `fpPack`: fill left to right; start a new row when x + W exceeds the container width; the row height is the tallest item in the row.
- Container widths tried: `max(sqrt(grossArea) × f, maxW)` for f = 0.80 … 2.20 in steps of 0.02 (71 trials).
- `side = max(usedW, usedH) + c`; keep the smallest side.
- 'tight' layout → clearance 0. Items are drawn at x + ec, y + ec, so the boundary margin equals the gap.
- Utilisation = `netArea / side²`. `pack = grossArea / side²` is computed but unused.
- Groupings come from `fpGroup` (by category, cell, location). It also computes kVA/m², BD hours/m² and breakdowns/m², none of which are rendered (`heat` and `maxDens` are dead code at 7565–7566).
- Purchase-year growth uses `datePurchase.slice(0,4)`.

### 2.10 Manpower (A4)
`calcAnalytics4(year)` sits outside this range. The page renders `table` rows (`doneCount`, `doneHrs`, `avgMttr`, `suppCount`, `suppHrs`, `totalInvolvement`, `pctOfTotal`, `type`), `momCount`, `momHours`, `momPMCount`, `momPMHours` (with per-month entry lists `{machineId, date, hours}`), `pmTotalCountRow`/`pmTotalHoursRow`, and the specialization matrices `catMatrix` and `codeMatrix` with column lists `cats` and `codesUsed`.

### 2.11 Statistical soundness (brief)
- **Health score**: the design is sound in spirit. It is an exposure-based Poisson expectation with additive smoothing and a log-ratio mapping, which makes it robust to small n. Weaknesses:
  - Age is measured at the data end, not over the window.
  - Bands with few machines are pulled to 1 only by K = 4. The hours model uses K = 40 "hours" as its prior, which is unit-dependent.
  - mttr, repeat and spares are not age-adjusted. repeat is not exposure-normalised, so machines with a full year of history are penalised against newer ones.
  - The components are correlated (freq, hrs and mttr share data), so the effective weight on frequency is higher than stated.
  - The weights are judgemental, not fitted.
  - The thresholds (7 = expected) are arbitrary but explained in the UI.
- **Forecast**:
  - The gamma-Poisson shrinkage with leave-one-out category priors is good practice.
  - The exponential (shape 1) mixing is a very heavy overdispersion assumption (variance = μ + μ²), chosen ad hoc rather than estimated. The backtest reported 16% and 8% exceedance, i.e. slightly conservative.
  - Machines are simulated independently, so plant quantiles ignore plant-wide common shocks (power, coolant supply, calendar effects) and are likely too narrow.
  - expH uses capped durations while the simulation uses uncapped ones, so "Expected" < mean of the sims by design.
  - Durations are resampled from very few own episodes (w = n/(n+4)), which is noisy for small n.
- **Forecast Lab**:
  - Walk-forward and common random numbers are correct design.
  - With about 6 test months the "> half the months" rule is a coin-flip-level test.
  - The user can tune the half-life in-sample and re-run until a challenger "wins", which is selection bias. No significance testing.
  - The pinball loss is in hours, so a few machines with large losses dominate it.
- **Laplace test**:
  - Correct formula for the pooled conditional test.
  - It assumes independent events (an NHPP) within each machine. Merging episodes helps.
  - It is sensitive to under-logging in early months: the window starts 1 January even if logging began later. The UI warns about this.
  - The per-machine tests are run at 5% across about 100 machines with no multiple-comparison correction, so about 5 false "trends" are expected.
- **Money**: equal per-hour value is a stated simplification. The lever union assumes independence between levers. `succ` is applied inside the union (`1 − succ·x`), which is reasonable.

---

## 3. Data entities & fields

### 3.1 Read
- **Machine**: `id, category, make, model, controller, ctrlModel, year, datePurchase (ISO), power, length (mm), width (mm), cell, location, segment, serial, ctrlSerial, assetCode, conveyor`.
- **Breakdown**: `id, machineId, date (DD-MM-YYYY), shift, problem, observedBy, correctiveAction, doneBy, supportedBy, downMin, downHrs, maintCode, electMech (E/M), pmHrs, utiHrs, spare1-3, cost1-3, whyWhy{why1..5, conclusion, completedBy, completedDate}`.
- **Settings read**:
  - `prodHrsPerDay, workDaysPerYear, efficiencyFactor, whyWhyThresholdHours`
  - `excludedMachines, categories, cells, locations, team[{name,type,status}], codes[{code,description}]`
  - `tfStatus, mmTurnover, mmConv, mmSucc, flHalfLife, fcModel, problemGroups` (via probCalc)

### 3.2 Written (settings)
- `tfStatus[key] = {st: open|prog|done|skip, owner, note, at, sig}`
- `mmTurnover` (crore, ≥ 0.01), `mmConv` (0–100), `mmSucc` (0–100)
- `flHalfLife` (30–365), `fcModel` (M1/M2/M3; absent means M0)
- Settings sync: segments, categories, shifts, locations, cells, breakdownCategories, team, codes.
- Import replaces the entire `state`: machines, convMachines, procMachines, utilMachines, dgMachines, breakdowns, cellChangeLog, settings.
- `state.meta.dataVersion`.

### 3.3 Other asset types
- Conventional / Process / Utility machines: `id, category, make, model, serial, year, datePurchase, power, location, cell, length, width`.
- DG sets: the same, but with `capacityKva` instead of power and no category.
- Cell change log: `id, date, machineId, fromCell, toCell, fromLocation, toLocation`.

### 3.4 Excel exports in range

**Full backup `exportToExcel`** (7806) → `Cosmos_Engitech_Export_YYYY-MM-DD.xlsx`

| Sheet | Doc header | Columns |
|---|---|---|
| CNC Machine Master | CE-MTN-F-01 "LIST OF MACHINERY & UTILITIES" / "LIST OF CNC MACHINES" | Sr., Machine ID, Segment, Category, Make, Model, Serial No, Controller, Ctrl Model, Ctrl Sr No, Year, Date of Purchase, Power(KVA), Location, Cell, Asset Code, Length(mm), Width(mm), Conveyor, Age (Yrs) |
| Conventional Machines | F-01 / "LIST OF CONVENTIONAL MACHINES" | Sr., Machine ID, Category, Make, Model, Serial No, Year, Date of Purchase, Power(KVA), Location, Cell, Length(mm), Width(mm), Age (Yrs) |
| Process Machines | F-01 / "LIST OF PROCESSING MACHINES" | same as Conventional |
| DG Sets | F-01 / "LIST OF DG SETS" | Sr., DG ID, Make, Model, Serial No, Year, Date of Purchase, Capacity(KVA), Location, Cell, Length(mm), Width(mm), Age (Yrs) |
| Utilities | F-01 / "LIST OF UTILITY EQUIPMENTS" | same as Conventional |
| Breakdown Log | CE-MTN-F-04 "BREAKDOWN HISTORY" (no list title) | Sr., Machine ID, Date, Month, Shift, Problem Description, Observed By, Corrective Action, Done By, Supported By, Down(Min), Down(Hrs), Maint Code, E/M, PM(Hrs), UTI(Hrs), Spare 1, Cost 1, Spare 2, Cost 2, Spare 3, Cost 3, Total Spare Cost, Record ID |
| Cell Change Log | none | Date, Machine ID, From Cell, To Cell, From Location, To Location, Record ID |
| Why-Why Analysis | none | Machine ID, Date, Down (Hrs), Problem, Why 1–5, Root Cause / Conclusion, Completed By, Completed Date (only breakdowns with `whyWhy`) |
| Settings | none | Parameter/Value rows (Production Hrs/Day, Working Days/Year, Efficiency Factor (%), Why-Why Threshold (Hrs), Excluded Machines (comma list)), then section blocks: Segments, Categories, Conventional Categories, Process Categories, Utility Categories, Shifts, Locations, Cells, Breakdown Categories, Team Members (Type, Status), Maintenance Codes (Description) |
| App Settings | none | Key, Part, "Value (do not edit)": the JSON of every setting not in `SETTINGS_ON_SETTINGS_SHEET`, chunked at 30,000 characters (Excel cell limit 32,767) |
| Analytics 1 - BD% | — | Annual Hrs/Machine, Total Machines, Total Available Hrs, Actual BD Hours, BD %, PM Hours, PM %; then by Cell (Machines, Available Hrs, BD Hours, BD %, PM Hours, PM %). Uses the **current calendar year** |
| Analytics 2 - Category-Cell | — | Category/Cell × Machines, # Breakdowns, BD Hours, Avg/Machine, Avg/Breakdown |
| Analytics 3 - MTTR-MTBF | — | by Category, Cell, Age Band, Machine: count, hours, MTTR, MTBF |
| Analytics 4 - Manpower | — | Name, Type, #BD(Done), Hrs(Done), AvgMTTR, #BD(Supported), Hrs(Supported), Total Involvement, % of Total (current calendar year) |

**Feature exports**

| Export | File | Sheets and columns |
|---|---|---|
| Team Focus `tfExport` | `Cosmos_Team_Focus_<date>.xlsx` | Sheet "Actions". Header rows: company name, "Team Focus for <month> — <date>". Columns: Start-with rank, Kind, Machine, Action, Why (HTML stripped), What to do, Hours a month at stake, Status, Owner, Note, Last updated |
| Money Matters `mmExport` | `Cosmos_Money_Matters_<date>.xlsx` | "Summary" (Item/Value: turnover, machines, per-machine turnover, available hours, conv %, ₹/hour, days, BD hours, money in the period, money per year, succ %); "Opportunity" (Lever, What it means, Machines, Hours, Money period, Money per year, plus an all-together row); "By problem" / "By category" / "By machine" / "By cell" / "By month" (dimension, Breakdowns, Hours, Money period, Money per year) |
| Forecast Lab `flExport` | `Cosmos_Forecast_Lab_<date>.xlsx` | "Summary" (Method, Accuracy score, Change vs current %, Above 80%, Above 90%, Plant inside range, Top-10 caught %, Better than current, Verdict, Reason); "By month" (Month, Actual hrs, then median / low 10% / high 90% for each model) |
| Planning forecast `exportForecast` | `Cosmos_Downtime_Forecast_<YYYY-MM>.xlsx` | See below |
| Repeat faults `exportRepeat` | `Cosmos_Repeat_Faults_<all\|last90days>.xlsx` | Sheet "Repeat faults", with 3 title rows. Columns: #, Machine, Category, Type, Maintenance code, Meaning, How often, From, To, Downtime (hrs), Latest problem logged, **Root cause found, Action taken** (blank, for manual completion). Freeze panes |

The Planning forecast workbook (`Cosmos_Downtime_Forecast_<YYYY-MM>.xlsx`):
- **"Forecast"** sheet:
  - Title rows: "COSMOS ENGITECH PVT. LTD. — Plant CE21" and a basis line.
  - 20 columns A–T: Rank, Machine, Category, Make, Model, Cell, Breakdown episodes so far, Days observed, Expected breakdowns, Chance ≥1, Routine hrs per breakdown, **Expected hrs (live formula `=I*K`)**, Plan for 80%, Worst 90%, Chance 8+ hr, Longest episode, **Expected % of month hours (formula `=L/(days×prodHrsPerDay)`)**, Band, Confidence, Note.
  - A PLANT TOTAL row with SUM formulas, plus plant p80/p90 rows.
  - Freeze panes, autofilter, number formats.
- **"By category"** and **"By cell"** sheets: Machines, Expected, p80, p90.
- **"How to read"** sheet: methodology text.

### 3.5 Import (`importFromExcel` 8107)
- Reads the sheets **by fixed column position**:
  - CNC Machine Master: r[1..18].
  - Conv / Proc / Util: r[1..12].
  - DG Sets: r[1..11].
  - Breakdown Log: r[1..23]. Record ID is r[23]. Duplicate or missing ids → `genId('bd')`.
  - Cell Change Log: r[0..6].
  - Why-Why: re-attached by machine + date + problem.
  - Settings: by row label.
  - App Settings: parts joined, then `JSON.parse`.
- The header row is found by the `'Sr.'` marker (`stripDocHeader` 7795), which looks at most 12 rows down.

---

## 4. Workflows & business rules

1. **Compare**:
   - Pick a category (≥2 machines).
   - Drag or click two machines. A and B can never be the same machine. Changing category clears selections from other categories.
   - Each machine is measured on its own in-service window. Rates are normalised per day in service.
2. **Compare verdict rules** (6708–6726):
   - First bullet: health score A vs B, naming the biggest component gap if ≥ 1 point.
   - Worse machine by hours; "N× the downtime" if the ratio is > 1.15.
   - Biggest code difference if > 0.5 h.
   - MTTR difference if > 25% of the larger value. Adds "longest single breakdown pulls the average up" if max ≥ 2× the other's.
   - Frequency difference if > 25%.
   - Spares totals.
   - Getting worse/better if (n90 + p90n) ≥ 4 and n90 > 1.3× or < 0.7× p90n.
   - Small-sample warning if either machine has n < 5.
   - Age note if the ages differ by ≥ 3 years.
3. **Team Focus lifecycle**:
   - Actions are generated fresh on every render from the analytics. Status, owner and note persist by stable key.
   - "Done" items in lanes B and C reopen automatically if the problem recurs (the signature count rises).
   - The briefing is copied as WhatsApp-formatted text, using `*bold*`, numbering, "Do:" and "Owner:" lines, and an open count. There is a clipboard fallback via `execCommand`.
4. **Money Matters**: the user sets turnover, conversion % and success %, which are saved in settings. Every other page's stake-in-₹ uses `mmRate()`. Team Focus shows ₹/yr only when the rate is > 0.
5. **Forecast governance**:
   - The Forecast Lab runs automatically on its first visit and caches the result.
   - A challenger is adopted only by explicit user action ("Use for Planning"), even when it is recommended. The Planning forecast states which method is in use.
6. **Planning forecast**:
   - Planning picks one of the next 3 months.
   - The Excel goes to the Planning department, with live formulas so Planning can tweak inputs.
   - Rules: PM is excluded; NO DT counts as 0 hours; repeated entries on the same or next day count as one episode.
7. **Repeat faults**: exported with blank Root cause / Action columns, so the sheet doubles as a Why-Why worksheet.
8. **Backup/restore**:
   - Export → full workbook (ISO-style controlled document headers).
   - Import = **full replace**, after a confirm dialog. Optional sheets that are missing keep the current data. Settings missing from the file keep the current values.
9. **Settings sync** (non-destructive to data):
   - Upload an export, preview the diff, then Apply.
   - Applying overwrites the simple lists, team and codes wholesale (when the incoming list is non-empty).
   - Machines and breakdowns are untouched.
10. **Load (`init` 8454)**:
    - Load the saved state from IndexedDB (`loadStateFromDB`).
    - If the embedded data version (`EMBEDDED_DATA_VERSION = 17`, line 541) is newer than the saved version, **additive merge**:
      - Records keyed by id; saved records win; embedded records are added only when missing.
      - Settings lists are unioned; team is unioned by name; codes by code.
    - With no saved data, use the embedded data.
    - Then always run, saving if anything changed: `ensureSettingsDefaults`, `normalizeMachineDates`, `applyIntentionalRemovals`, `applyDataCorrections`, `deduplicateBreakdowns` (with a toast), `deduplicateCellLog`.
    - `nav('dashboard')`.
    - `tsInit()` is called right after `init()` without awaiting it.
11. **Date conventions**: machine purchase dates are stored as ISO `YYYY-MM-DD`; breakdown and cell-change dates as `DD-MM-YYYY`.

---

## 5. Hard-coded / tenant-specific assumptions → configuration

| Item | Location | Note |
|---|---|---|
| `'COSMOS ENGITECH PVT. LTD.'` | 6948, 7074, 7282, 7406, 7517, 7791 | Company name in every export header |
| `'Plant CE21'` | 7406, 7517 | Plant code |
| `DOC_LIST_MACHINERY 'CE-MTN-F-01'`, `DOC_BREAKDOWN_HISTORY 'CE-MTN-F-04'` (1309–1310) | export headers | ISO document numbers and record titles ("LIST OF MACHINERY & UTILITIES", "BREAKDOWN HISTORY", the list titles) |
| File name prefixes `Cosmos_*` | all exports | |
| `REMOVE_TEAM_NAMES = ['Maint. Team','HO','CIPL','Mahadev Patil']` | 8404 | Personal names hard-coded; removed on **every** load |
| `REMOVE_CODE_VALUES = ['MEC','FS','MS','NI','UTI','M/M','INT','PP']` | 8405 | Removed on every load |
| `applyDataCorrections` | 8442 | Deletes `bd_363` and a specific TC-2 "Spindle noise" 30-min row; renames machine `Star-01 → S-1`; makes negative durations positive |
| `ensureSettingsDefaults` defaults | 8410 | Cosmos-specific category lists (util: Air Compressor, Air Dryer, Air Receiver Tank, Stabilizer, UPS; proc: Hydrostatic Test Pump, Ultrasonic Washing, Marking, Laser Marking, Magnetic Deburring, Helium Testing, Copper Spray, Blasting, Polishing Head; conv: Bandsaw, Lathe, Broaching, Drilling, Radial Drill, Circular Cutting, Hydraulic Press, Plate Cutting); breakdownCategories E, M, E/M, PM; prodHrsPerDay 20; workDaysPerYear 300; efficiencyFactor 15; whyWhy 24 h; default exclusion = category "robot" |
| Import fallbacks prodHrs 20 / workDays 300 | 8213–8219 | |
| Maintenance code semantics `'PM'`, `'NO DT'` | via isPM / isNoDT | Need to be per-tenant code roles |
| `electMech` values E / M | 6464 | |
| `TF_ADVICE` (22 problem-group playbooks) | 6770 | CNC-specific domain content, keyed by problem-group *names*. Should be a tenant/industry library |
| `TF_PART_STOP` stop-words | 6794 | |
| SKIP group names "PM logged as a breakdown", "Installation / relocation / trial", "Other / unclear" | 6803 | String-coupled to probCalc |
| Health weights `CMP_W`, age bands `CMP_BANDS`, map 7 / 3.5, smoothing 3 / 10 / 2 / 2·cpb, repeat penalties 2.5 / 1.5, IPF K 4 / 40, confidence 150 / 60 days | 6491–6555 | Should be configurable per tenant |
| Forecast: `FC_LONG 8`, `FC_RUNS 2000`, `FC_S0 180`, `FC_FLOOR 0.25`, band cut-offs 6/3/1 h, pool min 15, w = n/(n+4), cap p90, Rising/Quiet rules, confidence rules | 7292–7350 | |
| Lab: 1000 runs, 3-month burn-in, adoption thresholds 1% / 0.01 / >50% | 7192–7211 | |
| Trend: Z 1.96, minN 30/15/8 | 7440, 7355 | |
| Repeat rules: 30-day / ≥3 / ≤1-day merge / ≥3 consecutive days; TF occurrences >3 days apart, ≥3 | 7474–7495, 6820 | |
| Team Focus caps (8/6/3/5/5/5), data thresholds (10% blank code, 15% Other, 20 costless spares), focus size 6 | 6797–6881 | |
| Money defaults: turnover **₹100 crore**, conv 100%, succ 50%; Indian crore/lakh formatting; ₹ symbol | 6962–6965 | Currency and locale should be configurable |
| Hard-coded backtest claim in the forecast notes sheet: "Tested on April to September 2026: … 16% … 8%" | 7431 | Stale text; should be generated from the live Forecast Lab |
| `30.4` / `30.44` days per month; `'en-GB'` dates; month abbreviations arrays | many | |
| Compare colours, `Guide (section 24)` reference | 6448, 6645 | |
| Machine-level fields assumed (controller, ctrlModel, conveyor, segment) | export / import | CNC-specific schema |
| `EMBEDDED_DATA_VERSION` + `INIT_*` arrays | 8456–8496 | Tenant seed data embedded in code |

---

## 6. Bugs, hacks, fragile logic

1. **`REMOVE_TEAM_NAMES` / `REMOVE_CODE_VALUES` run on every load** (8504). A user can never legitimately add a team member "HO" or a code "INT"/"UTI"/"PP": it is deleted silently on the next load. This exists only to compensate for the additive merge re-adding embedded records.
2. **Additive merge resurrects deletions** (8470–8486). Any machine, breakdown, team member or code the user deleted comes back when `EMBEDDED_DATA_VERSION` increases. This is the root cause of the removal-list hack and the `bd_363` correction.
3. **`deduplicateBreakdowns` can delete real data** (8359). The signature is machine | date | shift | trimmed problem | round(downMin × 10). It ignores downHrs, correctiveAction, doneBy and id, so two genuine identical stoppages (e.g. "Coolant leakage", 30 min, same shift) collapse into one. It runs silently on every load. Where downMin is 0 and only downHrs is filled, all same-text entries in a shift collapse.
4. **`applyDataCorrections` is tenant data embedded in code**. It deletes by `id === 'bd_363'`: in another tenant, or after re-numbering, it would delete an unrelated record.
5. **Repeat clusters count "NO DT" as a fault code** (`cmpRepeat` 6514). It excludes only blank and '—', so three NO DT entries within 30 days penalise the health score. NO DT entries also count in `n` for freq/mttr (`cmpStats` counts raw entries; effH = 0 lowers MTTR).
6. **Inconsistent repeat definitions** across the app:
   - `cmpRepeat`: raw entries, same code, ≥3 within 30 days.
   - `rfCompute`: episodes, chained ≤1 day.
   - Team Focus / Money `occ`: problem *group*, >3 days apart, ≥3.
   - The Money Matters lever text says "four or more times", but the code threshold is occ ≥ 3.
   - Action Center: a separate rule set.
   These produce different counts for the same fault.
7. **`bnPeriod` starts at 1 January of the first data year.** If logging started mid-year, exposure is inflated: availability is overstated, rates are understated, the Laplace test is biased toward "More frequent", and Forecast Lab test months start at the wrong place.
8. **`cmpCtx` / `probCalc` / `fcCompute` / `flSig` caches key on record counts, not content.** Editing the hours or date of an existing breakdown does not invalidate them, so scores and forecasts go stale until a count changes or the page reloads.
9. **Settings Sync preview is not "exactly what will change"**:
   - Team type/status changes are applied (wholesale replace) but not shown.
   - Conv/Proc/Util categories and prodHrs/workDays are parsed but never applied.
   - An incoming *empty* list is ignored rather than clearing the current one.
10. **Import type and trim issues**:
    - Team names and codes are pushed raw (`c0`, 8235–8236), unlike `parseSettingsSheetFromWorkbook`, which trims and stringifies. A numeric code becomes a Number and breaks string comparisons.
    - A missing `Settings`, `Breakdown Log` or `CNC Machine Master` sheet throws (`sheet_to_json(undefined)`) and only a generic toast is shown.
    - Columns are read by position, so reordered columns silently corrupt data.
    - Breakdown fields not in the export (any extra flags, audit fields) are lost on restore. Restore can therefore erase data that only exists in the app.
    - The comment "Restore generates fresh breakdown IDs" (8255) is outdated: ids are now preserved from Record ID.
    - The import does not run corrections/dedupe/date normalisation until the next reload.
11. **`normalizeDateCellDMY` passes non-matching strings through.** An ISO string or "12/3/2025" typed in Excel is stored unchanged; `bnParse` then rejects ISO strings, and the row silently drops out of all date analytics. `normalizeDateCell` likewise passes through unknown formats such as "12/03/2015" or "2015".
12. **A4 year order bug** (7651–7653): `calcAnalytics4(a4Year)` is computed *before* `a4Year` is corrected to the latest available year. On first render in a year with no data, the tables use the empty year while the select shows another. The PM card text says "Uses the Year selector above", but the selector is below it. `window._a4` is a global hand-off.
13. **Export uses the current calendar year** for Analytics 1 and 4 (`new Date().getFullYear()`), not the selected year or the data year. In January the analytics sheets are empty.
14. **Forecast export**:
    - `Q` = L / (days × prodHrsPerDay) uses calendar days × hours per production day, which does not match the `perDay` (workDays/365) convention used elsewhere. It divides by zero if prodHrsPerDay = 0.
    - When there are no machines, `SUM(I6:I5)` and `!autofilter` refer to an empty or inverted range.
    - `avail` in `fcHtml` (7371) is computed and unused.
15. **Footprint page**:
    - It says machines without dimensions are "listed below", but `missing` is never rendered.
    - Dead code: `heat`, `maxDens`, `pack`, and the kva/bd densities in fpGroup.
    - "Robot is excluded" actually means *every* excluded machine is omitted.
16. **Forecast RNG seeds by machine index** (`1000 + idx`). Adding or removing one machine reshuffles every other machine's simulation, so forecasts "jump" even when the machine's data has not changed.
17. **Heavy synchronous compute on the dashboard**: `tfBanner` → `tfCompute` → `fcCompute` (2000 runs × machines × events), `cmpCtx` (40 IPF iterations × 2, each filtering all rows), `cmpRef` (uncached, `cmpStats` for every machine on every compare render). The Forecast Lab runs 4 models × months × machines × 1000 runs on the main thread, with only a 40 ms `setTimeout` before it.
18. **Team Focus card indices**: the buttons pass the array index into `tfCache.acts`. Any recompute between render and click (e.g. `tfBanner` on another page) that changes order would update the wrong action.
    - `facts` is injected as raw HTML; some fields are escaped, but Action Center `a.detail` passes through.
    - `add = a => { a.lane = a.lane; …}` is a no-op.
    - `tfStatus` grows unbounded, with orphaned keys when group names or months change. Lane A keys include the month, so the status resets each month by design.
19. **Units**: lane A stake = forecast hours *next month*, while the other lanes' stake = historical hours *per average month*. They are mixed in one ranking.
20. **Money "Next month, expected"** uses the simulation median `plant.p50`, while the forecast page's "Expected routine" uses `expTotal` (capped mean). Two different "expected" numbers are shown for the same month.
21. **The Forecast Lab "Plant inside 80% range"** actually tests [p10, p90].
22. **`cmpScoreCol` vs `cmpScoreLbl` thresholds differ** (5 vs 5.5), so an amber chip can read "Poor".
23. **Spec label "Power (kW)"** in Compare, but the export header says "Power(KVA)". Same field, inconsistent unit.
24. **`init()` is not awaited before `tsInit()`** (8522–8523): a possible race if `tsInit` touches `state`.
    - In the merge branch, `mergedSettings.team.map` throws if the saved settings lack `team`. Defaults are applied only after the merge.
25. **`cmpStats.last` / `n90` / `p90n` use all-time entries**, while n and h are windowed. That is fine today, but inconsistent if the window ever becomes selectable (`cmpP` remnants).
26. **`exportToExcel` Settings sheet** exports Efficiency Factor and the threshold, but `parseSettingsSheetFromWorkbook` (sync) ignores them.
27. **`deduplicateCellLog` / `deduplicateBreakdowns` run only on load**, not after import or merge in the same session.

---

## 7. Clever ideas worth preserving

1. **Age- and category-adjusted health score.** A multiplicative category × age-band Poisson model fitted by shrunk IPF, smoothed observed/expected ratios, and a log2 mapping where "7 = as expected". Each part comes with a plain-language detail ("x breakdowns against y expected"), plus a confidence level and a stated per-year expectation. Fair comparison of old and new machines is a real differentiator.
2. **Each machine measured on its own in-service window** (purchase date vs data start) in Compare, the forecast and the health score.
3. **Drag-and-drop A/B comparison** with quick picks ("Worst vs best", "Oldest vs newest", "Surprise me"), an auto-written narrative verdict, ✓-marked better values, and a reference column that switches to the category average when like-for-like.
4. **Episode merging** (entries on the same or next day = one fault). This stops multi-day repairs from inflating frequency, and is used consistently in the forecast and trend test.
5. **Gamma-Poisson shrinkage with a leave-one-out category prior, a fleet floor and a 180-day prior strength.** A machine with one early breakdown is not labelled unreliable.
6. **"Routine" vs long-tail split**: expected hours use p90-capped durations, while the simulation keeps the tail. Planning figures (80/90%) are never below expected. A separate "chance of an 8+ hr breakdown" is shown.
7. **Plant / category / cell totals simulated jointly**, not summed from quantiles, with the reason explained to the user in the export.
8. **Forecast Lab**:
   - Walk-forward backtest using only data available at the time.
   - Common random numbers across methods.
   - Pinball loss plus calibration (≈20% / ≈10% exceedance) plus top-10 capture.
   - A conservative, explicit adoption rule (accuracy and calibration and consistency).
   - Human-in-the-loop "Use for Planning", with the method shown wherever the forecast appears.
9. **Recency weighting done properly**: the exposure is decayed too (`Tw = hl/ln2·(1−0.5^(T/hl))`), not only the counts.
10. **Pooled Laplace trend test** with plain-language verdicts, a minimum-N guard, and an explicit "check logging completeness before acting" warning.
11. **Team Focus**:
    - Lanes for different *kinds* of work.
    - Round-robin focus selection so the top 6 are diverse.
    - Stable action keys with persistent owner/status/note.
    - **Auto-reopen when a "done" fault recurs** (signature counter).
    - Hours-at-stake with a ₹ conversion.
    - "What fixed it before" deep link.
    - One-click WhatsApp briefing.
    - Data-quality actions ("Fix the record") treated as first-class work.
12. **Money Matters**:
    - A simple, transparent turnover → ₹/machine-hour conversion, with user-tunable "lost-sales share" and "team success" sliders.
    - Avoidable-hours levers linked to the analysis pages.
    - A **non-double-counting union** (`1 − Π(1 − s·x)`).
    - Explicit caveats ("upper bound", bottleneck weighting would sharpen it).
13. **Planning-ready Excel**:
    - Live formulas (`=I*K`, SUM), freeze panes, autofilter and number formats.
    - A "How to read" sheet with the method, the limits and the backtest result.
    - The repeat-fault export doubles as a Why-Why worksheet (blank Root cause / Action columns).
14. **ISO controlled-document headers** (company, record title, DOC. NO.) on exports, with `stripDocHeader` reading both old and new layouts via the `'Sr.'` marker.
15. **Round-trippable backup**:
    - The human-readable Settings sheet plus an **App Settings sheet** holding JSON for everything else, chunked under Excel's cell limit.
    - Optional-sheet tolerance for older files.
    - Why-Why analyses re-attached by natural key.
16. **Settings Sync with a diff preview** before applying (add / remove / description changed).
17. **Self-healing load**: defaults backfill, date-format repair, dedupe and corrections, all with console/toast reporting. The *concept* (idempotent migrations) should be kept; the implementation (hard-coded lists, content-signature dedupe) should not.
18. **Footprint study**: a to-scale SVG layout packed into the smallest square (shelf packing over 71 container widths), with configurable clearance, by-category grouping, and cumulative area growth by purchase year. Useful for capex and space planning.
19. **Manpower PM matrix**: paired count/hours rows per person with hover detail of each machine and date. Also a specialization matrix by category or fault code.
