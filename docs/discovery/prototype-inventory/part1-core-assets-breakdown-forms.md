# Cosmos Platform — Functional Inventory, Part 1 (lines 541–2560)

Source: `/mnt/user-data/uploads/cosmos_platform.html`. Covers: core state and persistence, utilities and date helpers, cell-change history, availability basis, breakdown filters, calcAnalytics1–4, calcEnergyHeatmap, calcExpansionTimeline, PAGE_META and navigation, Dashboard, every asset-register page (CNC, Robots, Conventional, Process, Utilities, DG Sets), the move-cell form, Breakdown Log, the breakdown form, and PDF + QR import of job cards.

A few helpers called from this range are defined further down the file. I looked them up only where they change a formula:
- `periodFrac` (L4424)
- `machDate` (L4556)
- `dayDiff` (L4423)
- `effH` (L3805)
- `MONTHS12` (L3804)
- `normalizeMachineDates` (~L8380)
- `eyeBtn` (L5471)

---

## 1. Screens and pages in range

### 1.0 App shell and navigation (L1273–1393)

**`PAGE_META` (L1273–1306)** maps each page key to a title and subtitle shown in `#pageTitle` / `#pageSub`. It is the full page catalogue, so the rebuild needs every entry:
- **Fleet and data entry:** dashboard, machines (CNC Machines), robots, conv (Conventional), proc (Process), dg (DG Sets), util (Utilities), breakdowns (Breakdown Log), settings.
- **Reports and checklists:** rep_month (Monthly Report), rep_year (Annual Report), dc (Data Checklist: "Mark items as data not available to close them"), ac (Action Center: "Nudges worked out from your data").
- **Detail views:** drill (Details, the drill-down from the Dashboard), asset (Machine Details), mdetail (Machine Breakdowns, "highest downtime first"), guide (Guide: "How every number in the platform is calculated").
- **Analytics:**
  - a1: BD % & PM Split
  - a2: Category & Cell Analysis
  - a3: MTTR & MTBF
  - a4: Manpower Efficiency
  - a5: Energy Heatmap ("Connected (rated) and Running (estimated) electrical load")
  - a6: Why-Why Analysis
  - a7: Footprint
  - a8: Age Analysis
  - a9: Bottleneck Analysis
  - a10: Problem Analysis
- **Tools:**
  - cmp: Compare Machines
  - ff: Fix Finder
  - mm: Money Matters ("lost hours cost against company turnover")
  - tf: Team Focus ("Ranked actions … with an owner and status for each")
  - fl: Forecast Lab ("recommends a change only if it is clearly better")

The subtitles also carry business rules. Robots are "kept separate from CNC machines (still part of the fleet total and the Breakdown Log)". Conventional, process and utilities are "kept separate from CNC analytics". DG sets "are never counted in connected load".

**Controlled-document references (L1308–1311).**
- `DOC_LIST_MACHINERY = 'CE-MTN-F-01'` (List of Machinery and Utilities) is shown on the machines, robots, conv, proc, util and dg pages.
- `DOC_BREAKDOWN_HISTORY = 'CE-MTN-F-04'` (Breakdown History) is shown on the breakdowns page.
- The header shows `#docRef` as "DOC. NO. <ref>" and hides it on other pages. This supports the plant's ISO-style Master List of Documented Information.

**`nav(page)` (L1315–1330)**
- Resets `TS_STATE = {}`, the table-sort state (defined elsewhere).
- Remembers `repFrom` (the page you came from) when you enter a report page (`rep_*`). `repBack()` returns there.
- Works out which sidebar item to highlight for "virtual" pages:
  - `mdetail` highlights its origin (asset kind, ac, cmp, ff, tf, mm, or dashboard), via `mdetailFrom` / `assetKind`.
  - `asset` highlights cmp, robots, drill (via `drillNavPage()`) or `assetKind`.
  - `drill` highlights `drillNavPage()`.
- Toggles `.page.active`, sets the title, subtitle and doc ref, closes the mobile sidebar (`.sidebar.open`), calls `renderPage`, then refreshes the Action Center badge (`acRefreshBadge`) unless on ac, and the Data Checklist (`dcRefresh`) unless on dc.

**`renderPage` (L1332–1365)** is a dispatcher to `render*` for every page key.

**UI primitives**
- `kpi(label,val,sub,barVar,onclick)` (L1367): a KPI tile with a coloured top bar (a CSS var). When it has an onclick it becomes clickable and keyboard-accessible (role=button, tabindex=0, Enter key) and shows "View details →".
- `mkChart(canvasId, config)` (L1374): a Chart.js wrapper that destroys the previous chart on the same canvas (`chartRefs`).
- `chartDefaults()` (L1380): must return a **new object every call**. Chart.js mutates the options object, and sharing it breaks later charts (axis types). Settings: responsive, `maintainAspectRatio:false`, grey ticks and grid, Inter font.
- `PALETTE` (L1393): 15 fixed hex colours.

### 1.1 Dashboard — `renderDashboard()` (L1398–1506)

**Data**
- `a1 = calcAnalytics1()` uses the latest data year.
- `bdAll = filterBD({excludePM:true})` covers **all years**.
- Counts:
  - `cncCount = state.machines.length` (includes robots and excluded machines)
  - `convCount`, `procCount`, `utilCount`, `dgCount` come from `state.convMachines`, `state.procMachines`, `state.utilMachines` and `state.dgMachines`
  - `totalMachines = cnc + conv + proc` (utilities and DG are excluded)
- `daily = dailyAverages(bdAll)` and `exp = calcExpansionTimeline()`.
- NO DT figures use the **raw** recorded hours, deliberately not `sumHrs`: `noDtEntries = bdAll.filter(isNoDT)`, `noDtHours = Σ downHrs`.

**Layout, top to bottom**
1. Banners and cards defined elsewhere: `acBanner()` (Action Center), `tfBanner()` (Team Focus) and `ffDashCard()` (Fix Finder).

2. **"Machine Data — Fleet size by segment"**, two rows of three KPIs:

   | KPI | Value | Subtitle | Click |
   |---|---|---|---|
   | Total Machines | totalMachines | "CNC + Conventional + Process" | `openDrill('fleet')` |
   | Utilities | utilCount | | `nav('util')` |
   | DG Sets | dgCount | "Power sources — not counted in load" | `nav('dg')` |
   | CNC Machines | cncCount | "N not counted in production data" if the excluded list is non-empty | `nav('machines')` |
   | Conventional Machines | convCount | | `nav('conv')` |
   | Process Machines | procCount | | `nav('proc')` |

3. **Card: "Machine Expansion Timeline — Since Inception"** (canvas `ch-dash-timeline`, 420px). A mixed chart:
   - **Stacked bars**, one dataset per machine-type prefix (TC, VC, HMC, …), on the right axis `y1` (stacked), showing machines added per purchase year.
   - **Line**, "Cumulative Fleet Size" on the left axis `y`, filled, dark (#111827).
   - Tooltip `afterBody` lists "Machines added:" with "ID — model" for the hovered segment.
   - Clicking a year calls `openDrill('year',{year})`; the cursor becomes a pointer on hover.
   - The description notes how many machines have no purchase year and are left out.

4. **"Breakdown Overview — CNC fleet — PM excluded from breakdowns"**, four KPIs:

   | KPI | Value | Subtitle | Click |
   |---|---|---|---|
   | Total Breakdowns | bdAll.length | | `openDrill('bdcount')` |
   | Total Downtime | a1.bdHours, 1 dp, "hrs" | | `openDrill('downtime')` |
   | PM Hours | a1.pmHours | | `openDrill('pm')` |
   | BD Hours but NO Downtime | noDtHours | "N entries — NO DT code, excluded from Downtime totals" | `openDrill('nodt')` |

5. **Availability-basis switch**, `availSwitchHtml()` (L839): a pill row labelled "AVAILABLE HOURS COUNTED" with "Days so far" (elapsed) and "Full year" (year). `setAvailBasis` saves the choice to settings and re-renders the current page, or the drill view.

6. **Five KPIs**

   | KPI | Value | Subtitle | Click |
   |---|---|---|---|
   | Fleet Availability | `fmtPct(1 − a1.bdPct − a1.pmPct)` | "average · <availLabel>" | `openDrill('avail')` |
   | Plant BD % | a1.bdPct | | `openDrill('bdpct')` |
   | Avg Complaints / Day | daily.avgCountPerDay | "over N days of records" | `openDrill('daily')` |
   | Avg BD Hours / Day | daily.avgHoursPerDay | | `openDrill('daily')` |
   | Avg BD Hours / Machine | a1.bdHours / cncCount | "Total downtime ÷ CNC machines" | `openDrill('permachine')` |

7. `bdFreeCard()` (a breakdown-free streak card, drawn by `drawBdFreeChart()`) and `problemTile()`, both defined elsewhere.

8. **Card: "Breakdowns vs Downtime — by Machine"**, a bubble chart (canvas `ch-dash-bubble`, 480px), drawn by `drawDashBubble()` with filters from `bubFilterHTML()` (both elsewhere).
   - Per the description, each bubble is one non-excluded CNC machine with at least one non-PM breakdown.
   - Y = breakdown count, X = downtime hours, bubble size = MTTR.
   - Hover shows ID, model and age. Clicking opens that machine's breakdowns.
   - Zoom uses +/− buttons or Ctrl+scroll; drag to pan.

### 1.2 Shared register summary — `machineSummaryHTML(list, cats, label, powerLabel, powerNote)` (L1528–1552)

Used by the CNC, Conventional, Process and Utilities pages.

**KPIs**
1. Count, with "N categories": the categories that have at least one machine.
2. Connected Load (KVA): Σ `parseFloat(power)`, or "—" if 0. Subtitle: "N machines without power data" or "all have power data". Utilities override the label to "Listed Power" with the note "compressors & dryer only — stabilizer / UPS KVA are capacities, not load".
3. Avg Age: the mean of `machineAge` over machines with a known age. Subtitle: "X of Y have a purchase date or year".

**"By Category" table:** Category | Machines | Avg Age (1 dp + " y") | Power (KVA), with "—" if no machine has power. Categories come from the settings list plus any category found in the data but not in settings, so nothing disappears. Empty categories are hidden.

### 1.3 CNC Machines — `renderMachines()` (L1882–1908)

**Layout**
- Summary over **all of `state.machines`**, robots included, even though the table hides them.
- `ctrlSplitHTML()` (controller-make split) and `makeSplitHTML()` (machine-make split), defined elsewhere.

**Toolbar**
- Search (`mcSearch`) over id, make, model and category. Serial is **not** searched here, unlike the other registers.
- Category filter (settings.categories) and Cell filter ("Cell X").
- A count label ("N machines") and **+ Add Machine**.

**Table (`renderMachineTable`, L2023)**
- Rows: `state.machines` minus robots by category (`isRobotCat`).
- Columns: # | Machine ID (accent colour, eye button opening the asset detail, grey badge **"NOT IN PRODUCTION DATA"** if excluded) | Segment (purple badge) | Category | Make | Model | Serial (mono) | Year | Age ("Ny" from `computeAge(datePurchase)`) | Location | Cell | Power | **Edit** | **Move** | **Del**.
- Empty state: "No machines match your filters".

**Card: "Cell / Location Change Log"**, `renderCellChangeLog()` (L1910)
- **Export to Excel** button (`exportCellLog`, elsewhere).
- Description: moves re-attribute history automatically.
- Table sorted newest first: Date (mono) | Machine | Cell Change ("from → **to**") | Location Change ("from → **to**" or "no change") | **Edit** (`openCellChangeEdit`, elsewhere) and **Delete**.
- Empty state: "No cell/location changes logged yet".

### 1.4 Robots — `renderRobots()` (L1996–2021)

- **Membership:** `robotList()` = machines whose category matches `/^robot/i`.
- **KPIs:**
  - Robots (count)
  - Connected load: Σ `+m.power`, shown as **"kW"** (other pages say KVA)
  - Breakdowns: non-PM breakdowns of robot machines, all years; subtitle "X h downtime in total", using `effH` so NO DT = 0
- **Toolbar:** search (id, make, model, category), count, and **+ Add Robot**, which opens `openMachineForm(null,'Robot')` pre-set to category Robot and segment CNC.
- **Table:** same columns as CNC, via `machineRowHTML`. Empty state: "No robots yet".
- **Note:** "Robots are still part of the fleet total and the Breakdown Log. To leave one out of production calculations, use the excluded-machines list in Settings."

### 1.5 Conventional / Process / Utilities — `renderConv` / `renderProc` / `renderUtil` (L1553–1794)

These three pages are near-identical copies.

**Layout**
- Summary block, then a toolbar: search (id, make, model, category, serial), category filter (`settings.convCategories` / `procCategories` / `utilCategories`), cell filter (String compare), count, and **+ Add Conventional Machine / Process Machine / Utility**.
- Table columns: # | Machine ID + eye (kind 'conv' / 'proc' / 'util') | Category | Make | Model | Serial | Year | Age (`machineAge`) | Location | Cell | Power (KVA) | L × W (mm) | Edit | Del.
- Blank values show a grey "—".

**Modals** (`openConvForm` / `openProcForm` / `openUtilForm`)
- Machine ID* (read-only on edit) and Category* (select).
- Make, Model, Serial No.
- Year of Purchase (number), Date of Purchase (date, with the hint "Age calculates automatically").
- Power (KVA, step 0.1).
- Location* (select) and Cell* (select).
- Length (mm), Width (mm).

**Save:** validates that the ID is present and unique (see §4). Delete asks for confirmation.

`convDims(m)` (L1524) gives area in m² = (L/1000)·(W/1000) when L and W are greater than 0, else null. It is not used in this range (likely used by Footprint).

### 1.6 DG Sets — `renderDg()` (L1802–1880)

- **KPIs:**
  - DG Sets (count)
  - Generating Capacity: Σ `capacityKva`, 0 dp
  - Largest Set: capacity, plus "ID · model"
  - Avg Age
- **Toolbar:** search (id, make, model, serial; no category), count ("N DG sets"), **+ Add DG Set**.
- **Table:** # | DG ID + eye | Make | Model | Serial | Year | Age | Location | Cell | Capacity (KVA) (green, bold) | L × W | Edit | Del.
- **Footer note:** DG sets supply power, and their KVA is never added to any load figure.
- **Modal:**
  - DG ID* and Capacity (KVA), with a hint
  - Make, Model, Serial, Year, Date of Purchase
  - Location and Cell, both **optional** with a blank option
  - Length and Width

### 1.7 CNC machine form — `openMachineForm(id, defCat)` (L2040–2085)

Sections:
- **Identity:** Segment* (settings.segments), Category* (settings.categories), Machine ID* (read-only on edit), Make, Model, Serial No.
- **Controller:** Controller, Controller Model, Controller Serial, Year of Purchase, Date of Purchase (date picker, converted with `toISODate`), Power (KVA).
- **Location & Dimensions:** Location*, Cell*, Asset Code, Conveyor (blank / L / R), Length (mm), Width (mm).

Buttons: Cancel, and Add or Update Machine. Delete is `deleteMachine` (L2113).

### 1.8 Move-cell form — `openMoveCellForm(id)` (L1931–1971)

- Current Cell / Location (read-only, "Cell X — Location").
- New Cell* (select, current one pre-selected).
- New Location (optional; "— keep current —" or the list).
- Effective Date* (defaults to today).
- Hint: "Breakdowns dated before this stay attributed to the old cell; from this date onward, they'll attribute to the new cell."
- Button: **Log Move**, which raises the toast "Logged: X moved to Cell N, <loc>, effective DD-MM-YYYY".

### 1.9 Breakdown Log — `renderBreakdowns()` (L2126–2211)

**Toolbar**
- Search over machineId, problem, doneBy and correctiveAction.
- Machine filter: `machineIds()`, which lists only **non-excluded** machines, sorted.
- Code filter ("code — description" from settings.codes).
- Team-member filter (all of settings.team, inactive included; matched by exact name within the comma list).
- Month filter, Jan–Dec. There is **no year filter**.
- Count label ("N entries").
- Hidden `<input type=file accept=.pdf multiple>` behind an **Import from PDF** button.
- **+ Log Breakdown** button.

**Table**
- Shows **all** breakdowns: PM, excluded machines and unmatched machines included.
- Sorted by date descending.
- Columns:
  - Sr No (from `computeChronoSrNoMap`)
  - Machine
  - Date (mono)
  - Shift
  - Problem (max 220px with ellipsis; full text in the title tooltip)
  - Done By
  - Supported By ("—" if blank)
  - Down (Hrs), 2 dp, colour-coded: **red if > 4 h, amber if > 1 h, else green** (raw downHrs, so NO DT entries are still coloured by their raw value)
  - Code (amber badge for PM, blue otherwise)
  - Spare Cost (₹ + cost1+cost2+cost3, or "—")
  - Edit, Del
- There is no export button on this page in this range.

### 1.10 Breakdown form — `openBreakdownForm(id)` (L2433–2497)

Sections:
- **Machine & Timing:**
  - Machine ID* (select from `machineIds()`, so non-excluded only)
  - Category (auto, read-only, updated live by `updateBDCategoryPreview`)
  - Date* (date picker)
  - Shift (blank + settings.shifts)
- **Problem & Resolution:**
  - Problem Description* (textarea)
  - Observed By (a hard-coded list: blank / Operator / Setter / Supervisor / Engineer)
  - Corrective Action (textarea)
- **Done By (up to 3) & Supported By (up to 3):** six `personSelect` dropdowns built from the full team list (`—` = none).
- **Downtime & Classification:**
  - Down Time (Min)*
  - Down Time (Hrs, auto), recalculated live by `updateDownHrsPreview`
  - Maint Code* (settings.codes)
  - Breakdown Category* (`electMech`; settings.breakdownCategories, default `['E','M','E/M','PM']`)
  - PM Hours, UTI Hours
- **Spares & Cost:** Spare 1–3 (text) and Cost 1–3 (₹, number).

Buttons: Cancel, and Save or Update Entry. Delete asks for confirmation ("cannot be undone").

### 1.11 PDF Import — `handlePdfImport` / `renderPdfImportPreview` / `applyPdfImport` (L2218–2431)

**Setup-failure modal:** "PDF Import — Setup Problem". It names the missing library or libraries and suggests trying a different network or checking the F12 console.

**Preview modal:**
- Summary line: "X new, Y already in the log, Z unknown machine, W unreadable. Only the X new entries will be added."
- Table: File | Entry (either "machine — date — first 50 chars of problem", "Unknown machine "ID"", "Error: …" or "QR code not found on this page") | Status badge (**New** green, **Duplicate** amber, **Unknown Machine** red, **Unreadable** red).
- Buttons: Cancel, and **Import N New Entries**. The import is applied, saved, followed by a toast, and the current page re-renders.

---

## 2. Calculations and formulas

### 2.1 Base constants and helpers

**Annual available hours per machine**, `annualHoursPerMachine()` (L815):
- `prodHrsPerDay × workDaysPerYear`.
- State defaults (L552) are 20 h/day × 300 days = **6,000 h/yr**. Non-numeric values become 0.

**`periodFrac(start,end)`** (L4424, used throughout):
- Gives the share of a year covered by the period.
- For each calendar month touched, it adds (days of that month inside the period) ÷ (days in that month) ÷ 12.
- So each month is worth exactly 1/12 of annual hours regardless of length, and part-months are pro-rated by day.

**`machDate(m)`** (L4556): parses `datePurchase` **only** in `YYYY-MM-DD` format. Anything else gives null, which is treated as "available from the start of the period".

**`machFrac(m,start,end)`** (L771): `s0 = max(start, purchaseDate)`. Returns 0 if s0 > end, else `periodFrac(s0,end)`.

**`availSum(machines,start,end)`** (L775): Σ `annual × machFrac`. A machine counts only from its purchase date.

**`cellFrac(machineId, cell, start, end)`** (L758): the fraction of days in [start,end], inclusive, that the machine sat in `cell`.
- Days are counted as UTC integers.
- It walks the sorted cell log, starting from `changes[0].fromCell`, or the machine's current cell if there is no log.
- Each segment before a change date is credited to the current cell when `cellKey(cur)===cell`.
- Returns inCell ÷ (ed−sd+1).

**`cellAvail(cell,start,end,annual,machines)`** (L777): Σ over machines of `annual × periodFrac(s0,end) × cellFrac(id,cell,s0,end)`, where s0 = max(start, purchase).
- This is **time-weighted** cell availability. A machine that moved mid-year contributes to both cells in proportion to the days it spent in each.
- It is taken over **all** non-excluded machines, not only those currently in the cell.

**`dataYear()`** (L780): the maximum year among breakdown dates, or the current year if there are none. This is the default analysis year.

### 2.2 Availability basis (elapsed vs year) — `availWin(year)` (L827)

- `start` = 1 Jan, `full` = 31 Dec.
- **'year' basis:** end = 31 Dec, so full-year hours are used even for future days.
- **'elapsed' basis** (the default):
  - `e = max(today at local midnight, lastDataDate())`
  - If e < 31 Dec, end = e, clamped to no earlier than 1 Jan.
  - For a past year, end = 31 Dec. If records are dated in the future, they extend the window.
- `frac` = 1 if the full year is covered, else `periodFrac(start,end)`.
- `mfrac(mi)` = the fraction of month mi that has elapsed (1, 0, or (days to end + 1) ÷ days in month).
- Returns `{start,end,frac,mfrac,basis,full}`.

`availLabel(year)` gives "full-year hours" or "hours to D Mon". It is used in KPI subtitles.

The setting is stored as `state.settings.availBasis` ∈ {'elapsed','year'}. Any other value is treated as 'elapsed'.

### 2.3 Breakdown classification

- `isPM(b)`: `maintCode.trim().toUpperCase() === 'PM'`.
- `isNoDT(b)`: `maintCode.trim().toUpperCase() === 'NO DT'`.
- `sumHrs(list)` (L883): Σ downHrs, but **NO DT entries contribute 0 hours**. They still count as occurrences.
  - Effect: NO DT entries add to breakdown counts and to MTTR denominators, but not to hours. MTTR, BD % and downtime are all affected.
- `effH(b)` (L3805) is the same rule for a single entry.
- `sumSpareCost(b)` = cost1 + cost2 + cost3.
- `bdIsCountable(b, includeExcluded)`: the machine must exist (an unmatched machineId is dropped) and must not be excluded, unless `includeExcluded` is set.

### 2.4 `filterBD(opts)` (L860), the central query

Options:
- `excludePM` (default **true**)
- `includeExcluded`
- `machineId`
- `category`: the machine's **current** category
- `cell`: `cellKey(getEffectiveCell(machineId, b.date))`, i.e. the **historical** cell on the breakdown date
- `ageMin` / `ageMax`: the machine's **current** age from `computeAge(datePurchase)`. Age is null if there is no `datePurchase`, so the `year`-only fallback is ignored here. The band is lo ≤ age < hi.
- `year`: from the DD-MM-YYYY date
- `month`: abbreviation, Jan..Dec

### 2.5 Daily averages — `dailyAverages(bdList)` (L666)

- days = (latest date − earliest date in the list) + 1, inclusive. This is calendar days between the first and last records, not working days and not the period to today.
- `avgCountPerDay` = count ÷ days.
- `avgHoursPerDay` = `sumHrs` ÷ days.
- On the Dashboard the list is all years, non-PM, non-excluded.

### 2.6 calcAnalytics1 — BD % vs PM (L894)

For `year` (default `dataYear()`), machines = non-excluded:
- `totalAvail = availSum(machines, W.start, W.end)`
- `effHrs = totalAvail ÷ count`: the average available hours per machine
- `bdList = filterBD({excludePM:true, year})`, `bdHours = sumHrs`
- `pmList` = PM entries of countable machines for the year, `pmHours = sumHrs`
- **Plant BD % = bdHours ÷ totalAvail**, **PM % = pmHours ÷ totalAvail**
- Dashboard **Fleet Availability = 1 − BD% − PM%**

**byCell**, for each cell in `cellsEff()`:
- `machines` = the count of machines **currently** in the cell (display only)
- `avail = cellAvail(...)` (time-weighted)
- BD and PM filtered by **historical** cell
- `bdPct`, `pmPct` and `totalPct = (bd+pm) ÷ avail`

**momBD / momPM:** per cell × Jan..Dec, `sumHrs` for the month, plus a total.

**yearTotalBD:** Σ over months and cells, used as the denominator for "% of total".

Return value includes `availLabel` and `basis`.

### 2.7 calcAnalytics2 — Category and Cell (L946)

This calculation has **no year filter**; it runs over all data.
- `cats` = settings.categories minus 'robot' (case-insensitive).
- `totalBDHours = sumHrs(filterBD({excludePM:true}))`.

**byCategory** (current category):
- machines (count), count, hours
- `avgPerMachine` = hours ÷ machines in category
- `avgPerBD` = hours ÷ count
- `pctOfTotal` = hours ÷ totalBDHours

**byCell** (historical cell): the same fields.

**machineStat(m, denom, inCell):**
- `count` and `hours` are restricted to breakdowns that happened while the machine was in that cell.
- `allCount` and `allHours` are machine-wide.
- `pctOfDenom` = hours ÷ denom.

**byCategoryDetail:** % of the overall total.

**byCellDetail:** % of **that cell's** total. It includes machines currently in the cell, plus any machine with breakdowns while it was in that cell, so the rows add up to the cell total.

### 2.8 calcAnalytics3 — MTTR and MTBF (L995–1135)

**`mttrMtbf(count, hours, avail)`:**
- **MTTR = hours ÷ count**, or 0 if count = 0.
- **MTBF = (avail − hours) ÷ count**. If count = 0, **MTBF = avail**.

All figures are for `year`, PM excluded:
- **byCategory:** avail = `availSum(catMachines)`, using the current category.
- **byCell:** avail = `cellAvail` (time-weighted); breakdowns by historical cell.
- **byAge:** bands [0,5), [5,10), [10,15), [15,20), [20,999), labelled '0-5 yrs' … '20+ yrs'. Both machines and breakdowns use **current** age. An extra row, **"Unknown (no purchase date)"**, appears when any machine lacks a `datePurchase`.
- **byMachine:** per machine, avail = `availSum([m])`.

**Month-on-month tables:**
- `monthWin(mi)` = [1st of month, min(month end, W.end)].
- Monthly avail is `cellAvail` or `availSum` over that window.
- **If a month has 0 breakdowns, both MTTR and MTBF are null** (shown as a dash and not plotted), rather than MTBF = avail.
- Rows are built for cells (`momCellMTTR` / `momCellMTBF`), age bands including Unknown (`momAgeMTTR` / `momAgeMTBF`), and the plant ('PLANT MTTR' / 'PLANT MTBF').
- The **Total** column comes from `totalPair`: the whole-period figure on the same basis as the byCell / byAge tables, or null if count = 0. Each row also carries `count` and `hours`.
- The code comment says monthly avail is "annual ÷ 12, flagged in the UI". The implementation is `periodFrac`: 1/12 of annual per full month, pro-rated by day for a partial month.

### 2.9 calcAnalytics4 — Manpower (L1140, L1177–1266)

**`nameInField(name, field)`:** splits on commas, trims, and requires an exact match. This avoids "Sagar" matching "Sagar T".

The team list is **all** of settings.team, inactive members included ("historical completeness").

**table** covers **all years** (`bdAll = filterBD({excludePM:true})`, no year filter):
- `doneCount` and `doneHrs` (breakdowns where the name is in doneBy)
- `avgMttr` = doneHrs ÷ doneCount
- `suppCount` and `suppHrs` (supportedBy)
- `totalInvolvement` = done + supp
- `pctOfTotal` = doneCount ÷ totalBD. A breakdown with several doers counts fully for each of them, so the percentages can add up to more than 100%.

**momPMCount / momPMHours** (for `year`, if given):
- PM entries on countable machines where the person is in doneBy, per month.
- Each row stores the actual entries in `row.months[mo]` for drill-down.
- `pmTotalCountRow` / `pmTotalHoursRow` ('PLANT TOTAL') add the team rows together, so a PM done by two people is counted twice.

**catMatrix** (all years): person × non-robot category, breakdown count as doer.

**codeMatrix** (all years):
- Codes = the distinct trimmed maintCodes found in **all** breakdowns except PM, including those of excluded machines and NO DT.
- The counts come from `bdAll`.

**momCount / momHours:** per person per month for `year`, as doer.

### 2.10 Energy heatmap — `calcEnergyHeatmap()` (L1153–1175)

- Uses **all `state.machines`** (CNC including robots and excluded machines; not conv/proc/util/DG).
- Load = nameplate `power` (KVA) as a proxy, since energy is not metered. The code comment justifies this as a planning signal.
- `effFactor = settings.efficiencyFactor` (default **15**) ÷ 100.

Per group:
- `totalKva`
- `avgKva` = total ÷ n
- `runningKva = totalKva × effFactor`
- `avgRunningKva`
- `machineIds`

Grouping:
- **byCell:** settings.cells, plus '—' if any machine has no valid cell.
- **byLocation:** `settings.locations` with exact string match. Machines with a location outside that list are silently dropped.

Returns `effFactorPct`.

### 2.11 Expansion timeline — `calcExpansionTimeline()` (L694–711)

- `machineYear(m)`: `parseInt(datePurchase.slice(0,4))` if present, else `parseInt(m.year)`, else null. The year-only fallback covers machines with no purchase date.
- `machinePrefix(m)`: the leading letters of the machine ID (TC, VC, HMC, DCMC, GRD, VTL, TMC, WJ, CAM, Star …), but only if the ID has more characters after them. Otherwise it falls back to category, then to the ID.
- Includes **all** machines, robots and excluded ones too (fleet growth is not a breakdown metric).
- Per purchase year: `addedThisYear`, `cumulative`, and `byPrefix{prefix: [ids]}`.
- Prefixes are ordered by first appearance year.
- Also returns `unknownCount` (machines with no year) and `totalMachines`.

### 2.12 Age

- `computeAge(datePurchaseISO)` (L650): whole years from `new Date(str)` to today, with a month/day correction, floored at 0. Null if the date is missing or invalid.
- `machineAge(m)` (L1516), used on the registers: `computeAge`, else (current year − `m.year`) if 1900 < year ≤ the current year.
- The CNC table and analytics use only `computeAge`, so a machine with a year but no date shows "—" there.

### 2.13 Downtime conversion (form and import)

- `downHrs = round(downMin ÷ 60, 2 dp)`, i.e. `Math.round(min/60*100)/100`. It is 0 if min ≤ 0.
- `downMin` is the primary input; `downHrs` is stored, not derived at read time.

### 2.14 Dashboard derived numbers

- **Avg BD Hours / Machine** = a1.bdHours (latest year, non-excluded) ÷ `state.machines.length` (all CNC including excluded and robots).
- **NO DT hours** = raw Σ downHrs of NO DT entries, all years.
- **Total Breakdowns** = all years, while **Total Downtime and PM Hours** cover `dataYear()` only. See §6.

---

## 3. Data entities and fields

### 3.1 Root state (L548–553)

```
state = {
  machines: [], breakdowns: [], cellChangeLog: [],
  settings: { segments:[], categories:[], shifts:[], locations:[], cells:[], team:[], codes:[], prodHrsPerDay:20, workDaysPerYear:300 }
}
```

These keys are created lazily: `convMachines`, `procMachines`, `utilMachines`, `dgMachines`.

Settings keys read in this range:
- `excludedMachines` (array of IDs)
- `availBasis` ('elapsed' | 'year')
- `efficiencyFactor` (%, default 15)
- `convCategories`, `procCategories`, `utilCategories`
- `breakdownCategories` (default E, M, E/M, PM)

`EMBEDDED_DATA_VERSION = 17` (L541) is a seed-data version, probably used to decide whether to reseed.

### 3.2 CNC machine (`state.machines`; form L2091)

| Field | Type / format | Notes |
|---|---|---|
| `id` | string, required, unique among CNC | The prefix letters drive the "type" grouping; the primary key everywhere |
| `segment` | string from settings.segments | e.g. CNC |
| `category` | string from settings.categories | 'Robot' (prefix /^robot/i) means a robot |
| `make`, `model`, `serial` | string, trimmed | |
| `controller`, `ctrlModel`, `ctrlSerial` | string | Controller split charts |
| `year` | string (number input) | Fallback for age and timeline |
| `datePurchase` | **intended ISO YYYY-MM-DD**, but the form writes **DD-MM-YYYY** (bug, §6) | Drives age, availability start and timeline |
| `power` | string (KVA) | Connected load and heatmap |
| `location` | string from settings.locations | |
| `cell` | string/number from settings.cells | Current cell; history lives in cellChangeLog |
| `assetCode` | string | |
| `conveyor` | '' / 'L' / 'R' | |
| `length`, `width` | string (mm) | Footprint |

### 3.3 Conventional / Process / Utility items (L1621, L1702, L1783)

`{id, category, make, model, serial, year, datePurchase (ISO, raw from the date input), power, length, width, location, cell}`. There is no segment, controller, assetCode or conveyor.

### 3.4 DG set (L1869)

`{id, make, model, serial, year, datePurchase (ISO), capacityKva, length, width, location (optional), cell (optional)}`. There is no category. **`capacityKva` is deliberately a different field from `power`**, so that it can never be summed into load.

### 3.5 Breakdown (`state.breakdowns`; form L2525, import L2365)

| Field | Type / format | Notes |
|---|---|---|
| `id` | `genId('bd')` or `genId('bd_pdf')` = prefix_ + base36 timestamp + 5 random chars | |
| `machineId` | string, must match a CNC machine at entry time | Can become orphaned after the machine is deleted |
| `date` | **DD-MM-YYYY string** | Converted from the date picker with `fromISODate` |
| `shift` | string from settings.shifts or '' | |
| `problem` | string, required, trimmed | |
| `observedBy` | '' / Operator / Setter / Supervisor / Engineer | Free text from the PDF |
| `correctiveAction` | string | |
| `doneBy`, `supportedBy` | comma+space-joined names (up to 3 each in the form) | Matched by `nameInField` |
| `downMin` | number (minutes) | Primary input |
| `downHrs` | number, round(min/60, 2) | Used in all calculations |
| `maintCode` | string from settings.codes[].code | 'PM' and 'NO DT' are special |
| `electMech` | E / M / E/M / PM (configurable) | "Breakdown Category"; from `bc` in the QR |
| `pmHrs`, `utiHrs` | number | Captured but not used in the calculations in this range |
| `spare1..3`, `cost1..3` | string / number (₹) | Spare cost = Σ cost |
| `whyWhy` | object (`why1..why5`, conclusion, completedBy …), written by the Why-Why page (L3302) | **Not preserved by `saveBreakdown`** (§6) |

### 3.6 Cell change log entry (L785)

`{id: 'cellchg_…', machineId, date: DD-MM-YYYY, fromCell, toCell, fromLocation, toLocation}`.

### 3.7 Settings sub-entities used here

- `codes[]`: `{code, description}`.
- `team[]`: `{name, type, status}`. `status 'Inactive'` is honoured only by `activeTeam()`, which is not used by the breakdown form. `type` is shown in manpower (team vs vendor, per the "Team & vendor performance" subtitle).

### 3.8 Validation rules in range

**Machines and assets**
- CNC machine: ID required. On add, the ID must not already exist among CNC machines.
- Conventional / Process / Utility: ID required. On add, it must be unique within its own list **and** among CNC machines.
- DG: ID required. On add, it must be unique within DG, CNC, conventional and process (**utilities not checked**).

**Breakdowns**
- Breakdown form: machine required and must exist; date required; problem required.
- Down Time (Min), Maint Code and Breakdown Category are marked * but **not validated**. Code has no blank option, so it defaults to the first code.

**Cell moves**
- Cell and date are required.
- A move is rejected if the new cell equals the current cell and the location is unchanged or blank.

**PDF payload**
- Must have `mid` and `d`, and `mid` must match an existing CNC machine (excluded machines are allowed).

### 3.9 Persistence

- IndexedDB database `cosmos_engitech_db`, store `state`, key `'main'`.
- The whole state is saved as one JSON blob (deep-cloned).
- `persist()` is debounced by 400 ms. Errors are only written to the console; the user sees no feedback.
- `loadStateFromDB` returns null on failure.

---

## 4. Workflows and business rules

1. **PM vs breakdown.** Entries with maintCode "PM" are preventive maintenance. They are excluded from breakdown counts, hours, MTTR, MTBF and BD % by default, and reported separately as PM hours / PM % and per-person PM tables. The Breakdown Log still lists them, with an amber badge.

2. **NO DT ("BD Hours but NO Downtime").** A real breakdown occurrence, but the minutes happened outside production hours or during the lunch break.
   - It counts in every breakdown **count** (and therefore lowers MTTR).
   - It contributes **0 hours** to downtime, MTTR, BD % and MTBF.
   - The Dashboard shows its raw hours separately, as a reconciliation tile.

3. **Excluded machines** (`settings.excludedMachines`; the older name was "robots", and `isRobot()` = `isExcluded()`).
   - Removed from all production data: hours, MTTR/MTBF, BD %, availability and reports.
   - Kept in lists, fleet totals, the Breakdown Log and the Action Center.
   - They do not appear in the Breakdown Log machine filter or the breakdown form's machine list.

4. **Robots by category** (`isRobotCat`, `/^robot/i`) is a **separate** concept from exclusion.
   - It moves machines from the CNC table to the Robots page.
   - Analytics category lists drop the category literally named 'robot'.
   - A robot is **not** excluded from cell or plant totals unless it is also on the excluded list.

5. **Asset classes.** CNC machines and robots live in `state.machines`. Conventional, process, utility and DG items each have their own list and are never in CNC analytics.
   - Total Machines = CNC + Conventional + Process.
   - Utilities and DG are counted separately.
   - DG capacity is supply, never load.
   - Utilities "listed power" counts compressors and dryers only conceptually. The code itself just sums `power`; the note tells the user to leave stabiliser/UPS KVA out of power.

6. **Cell moves and historical attribution**
   - `logCellChange` records from/to cell and location with an effective date, then updates the machine's current cell (and location, if given).
   - `getEffectiveCell(machineId, date)` starts from the earliest log entry's `fromCell`. It then applies each change whose date ≤ the breakdown date. If there is no log or no date, it uses the current cell.
   - `getEffectiveLocation` follows the same logic using location entries.
   - Cell availability is time-weighted to match (`cellFrac`).
   - Deleting a log entry does **not** revert the machine's current cell; the confirm text says so.

7. **"No cell" bucket.** `cellKey` maps any blank cell, or one not in settings, to '—' ("No cell"). `cellsEff()` adds this bucket to every cell table when needed, so totals always reconcile.

8. **Availability counting.** Each machine counts from its purchase date, pro-rated, and per cell only while it is there. The basis is switchable between "Days so far" and "Full year", stored in settings and global across pages.

9. **Breakdown entry**
   - The user picks a machine (its category is shown automatically), date, shift, problem, observer, corrective action, up to 3 doers and 3 supporters, downtime in minutes (hours computed automatically), maint code, E/M category, PM/UTI hours, and up to 3 spares with costs.
   - Dates are stored as DD-MM-YYYY.
   - An edit replaces the entire record (keeping the id).

10. **Serial numbers.** `computeChronoSrNoMap` numbers all breakdowns oldest-first by date. Ties keep array (insertion) order. The numbers ignore current filters and sorting.

11. **PDF / QR import of job cards from the mobile entry tool**
    - **Libraries:** if pdf.js 3.11.174 or jsQR 1.4.0 failed to load from the `<head>` CDN, it lazily loads them from fallback CDNs (`ensureLibraryLoaded`). If they are still missing, it shows the setup-problem modal. The pdf.js worker comes from cdnjs.
    - **Decoding** (`decodeQrFromPdf`), on page 1 only:
      1. Render the full page at scale 4 and run jsQR.
      2. Fallback: render at scale 10 and crop to the top-right region (x 76–100%, y 0–18%), matching where the entry tool prints the QR (x 169–195 mm, y 14–40 mm on A4).
      - The canvas is pre-filled white so transparent areas don't ruin contrast.
      - The QR payload must be JSON.
    - **Payload mapping:**

      | QR key | Breakdown field |
      |---|---|
      | `mid` | machineId |
      | `d` (ISO) | date (converted to DD-MM-YYYY) |
      | `sh` | shift |
      | `pr` | problem |
      | `ob` | observedBy |
      | `ca` | correctiveAction |
      | `db` | doneBy |
      | `sb` | supportedBy |
      | `dm` | downMin (downHrs derived) |
      | `mc` | maintCode |
      | `bc` | electMech |
      | `sp` | spare1 |

      `pmHrs`, `utiHrs` and all costs are set to 0; spare2 and spare3 are left blank.
    - **Dedupe:** the signature is `breakdownSig = machineId|date|shift|trimmed problem|round(downMin×10)`. It is checked against existing breakdowns **and** within the current batch. Duplicates are shown but not imported.
    - **Classification:** New / Duplicate / Unknown Machine / Unreadable (no QR, bad JSON, missing mid or d, or a thrown error).
    - Only the "New" entries are imported, after the user confirms. The file input is reset so the same files can be picked again.

12. **Machine delete.** It warns when breakdown history exists, then deletes anyway. The breakdowns stay but become "unmatched", so they disappear from all analytics (`bdIsCountable`) while still showing in the log. Cell log entries are left behind.

13. **Controlled documents.** The register and log pages carry the plant's ISO document numbers in the header.

---

## 5. Hard-coded or tenant-specific assumptions that must become configuration

- **Tenant identity:** the IndexedDB name `cosmos_engitech_db`. Variable names and comments refer to Cosmos Engitech.
- **Document numbers:** `CE-MTN-F-01` (List of Machinery and Utilities) and `CE-MTN-F-04` (Breakdown History), with the "DOC. NO." label. These must become per-tenant document-register settings, and possibly per page.
- **Production calendar:** the defaults `prodHrsPerDay: 20` and `workDaysPerYear: 300`. They are a single plant-wide value, with no per-machine, per-cell or per-shift calendar and no holidays.
- **Fiscal year:** availability windows and the "year" filter are **calendar Jan–Dec**. An Indian plant usually reports Apr–Mar, so the year start should be configurable.
- **Month names** are hard-coded in English as `['Jan',…'Dec']` (repeated at L643, L920, L1060, L1197, L2127), and month filters compare abbreviation strings.
- **Special maintenance codes:** 'PM' and 'NO DT' are matched by literal text. These should become flags on code definitions ("is preventive", "no production loss").
- **Robot detection:** a category literally named 'robot' (analytics) or starting with "robot" (Robots page). Robot creation defaults to `category:'Robot'` and `segment:'CNC'`.
- **Observed By options:** Operator / Setter / Supervisor / Engineer.
- **Breakdown Category defaults:** E / M / E/M / PM.
- **Done By and Supported By capped at 3 each.** Spares capped at 3, with costs in **₹**.
- **Running-load efficiency factor:** default 15%.
- **Age bands:** 0–5, 5–10, 10–15, 15–20 and 20+ years.
- **Downtime colour thresholds:** > 4 h red, > 1 h amber.
- **Machine-type prefix:** derived by regex from the ID's leading letters (a plant-specific naming convention: TC, VC, HMC, DCMC, GRD, VTL, TMC, WJ, CAM, Star). It should be an explicit "type" field.
- **QR position:** the crop region (top-right 24% × 18% of an A4 page) and the payload key names (`mid`, `d`, `sh`, `pr`, `ob`, `ca`, `db`, `sb`, `dm`, `mc`, `bc`, `sp`) are tied to one specific mobile entry tool.
- **CDN URLs and versions:** pdf.js 3.11.174, jsQR 1.4.0, Chart.js. A SaaS product should bundle these.
- **Units:** KVA for consumers, with the Robots page saying kW. Dimensions in mm, area in m².
- **Display text:** "Cell " prefixed to cell values, the "No cell" label, all UI strings in English, and dates displayed DD-MM-YYYY (an Indian convention).
- **Asset classes:** the six fixed classes (CNC, Robot, Conventional, Process, Utility, DG) are hard-wired as separate state arrays with copy-pasted pages. The class list and each class's field schema should be configurable.
- **CNC-only fields:** Conveyor (L/R) is a plant layout attribute. Asset Code and Controller (make, model, serial) are CNC-specific.
- **Dashboard and page copy:** the descriptions say "CNC fleet". The utilities power note mentions "compressors & dryer only".

---

## 6. Bugs, hacks, fragile logic and data-quality patches

**Data loss and integrity**

1. **`saveMachine` writes `datePurchase` as DD-MM-YYYY** (`fromISODate`, L2096). The rest of the code expects ISO:
   - `machDate` returns null, so availability is counted from 1 Jan instead of the purchase date.
   - `computeAge(new Date('15-03-2010'))` gives Invalid Date or swapped day and month, so the age is wrong or missing.
   - `machineYear` reads `slice(0,4)` ("15-0"), giving parseInt = 15, so the timeline year is 15.

   It is patched only on the next load by `normalizeMachineDates` (~L8380), a "safety net" that is itself a data-quality patch. The conventional, process, utility and DG forms store ISO correctly, so the formats are inconsistent.

2. **The machine edit form replaces the whole object**, so any field not in the form is lost. Changing the cell through the Edit form **bypasses the cell change log**, which silently re-attributes all history to the new cell when the machine has no log entries.

3. **`saveBreakdown` rebuilds the record**, which wipes `b.whyWhy` (the root-cause analysis written by the Why-Why page) and any other extra fields every time a breakdown is edited.

4. **Editing a breakdown on an excluded machine is impossible.** The machine select lists only non-excluded machines, so the value is blank and the save fails with "Machine ID is required". For the same reason, breakdowns can't be logged for robots or excluded machines through the form, though PDF import allows them.

5. **Names not in the team list get dropped.** In the breakdown form, a doneBy/supportedBy name missing from the team list (or beyond the third) has no matching option and is silently dropped on save. The person dropdowns also include inactive team members (`activeTeam()` exists but is unused).

6. **Back-dated moves are not supported.** `logCellChange` sets `fromCell` to the **current** cell. Logging a move dated before an existing later move produces a broken from/to chain, and `getEffectiveCell` trusts `changes[0].fromCell` with no consistency check. Deleting a log entry doesn't recompute the current cell.

7. **Deleting a machine orphans its breakdowns and cell log entries.** They vanish from analytics without warning in the reports.

**Inconsistent bases and units**

8. **Dashboard mixes periods.** Total Breakdowns, NO DT hours and the daily averages cover **all years**; Total Downtime, PM Hours, BD %, availability and Avg BD Hours/Machine cover **`dataYear()` only**. Once there is more than one year of data, the tiles stop reconciling.

9. **Avg BD Hours / Machine** divides non-excluded downtime by **all** CNC machines, including excluded ones and robots. Total Machines and CNC count also include robots. The CNC page summary counts robots, but its table hides them.

10. **calcAnalytics2 and the main calcAnalytics4 table have no year filter**, while A1 and A3 do. The meaning of "% of total" depends on the page.

11. **Category analytics drop 'robot', but cell and plant totals keep robots** unless they are excluded, so category rows don't add up to the plant total.

12. **Age filters use current age, not age at the time of the breakdown.** They ignore `m.year` when there is no purchase date, while the registers use the year fallback, which is inconsistent.

13. **The month filter in the Breakdown Log has no year**, so "Mar" merges every March.

14. **The CNC cell filter uses strict `m.cell===cellF`**, a string from the select. Numeric cells from the seed data would never match, whereas the conv/proc/util pages use `String()`. The move-form pre-selection has the same strict comparison (`c===m.cell`).

15. **The Robots page labels connected load "kW"** while summing KVA values.

16. **Energy heatmap scope.** It uses all CNC machines, including excluded ones and robots, and ignores conventional and process machines even though they draw power. `byLocation` silently drops machines whose location isn't in settings, so it may not add up.

17. **MTTR is diluted by NO DT entries** (count with 0 hours). This may be intended, but it should be explicit.

18. **MTBF uses inconsistent zero-breakdown rules:** MTBF = avail when count = 0 in totals and by-machine figures, but null in monthly cells.

19. **Code comments contradict the code.** The A3 comment says monthly availability is "annual ÷ 12 evenly", but `periodFrac` pro-rates by day. Comments in the code itself are a weak spec; the Guide page should be checked against the code.

20. **`availWin` 'elapsed' uses max(today, last record date)**, so future-dated records (typos) extend the window. Despite the label "Days so far", it is based on today, not on data coverage.

**Validation and IDs**

21. **Cross-list ID uniqueness is inconsistent.** CNC checks only CNC; conventional, process and utility check own + CNC; DG checks own + CNC + conventional + process, but not utility.

22. **Required fields are not enforced.** Down Time and Breakdown Category are marked * but not validated. Maint Code defaults silently to the first option, and so do the category, location and cell selects (there is no blank option), so mis-entry goes unnoticed.

23. **Default dates use UTC.** The move form default is `new Date().toISOString().slice(0,10)`, which gives yesterday's date before 05:30 IST.

24. **Sr No is not truly permanent.** It is recomputed every time, so a back-dated insert renumbers every later entry. Breakdown sort comparators never return 0 (unstable for equal dates).

25. **The breakdown signature for dedupe** includes shift and the exact problem text. An entry typed by hand with slightly different text, then imported from PDF, will double-count. Edits to imported records also change the signature.

**Code quality and resilience**

26. `editingProcId` and `editingUtilId` are implicit globals (never declared), unlike `editingConvId` and `editingDgId`.

27. `pmList` in A1 applies `filterBD` and then a redundant `.filter(bdIsCountable)`. The month-on-month loops call `filterBD` 12 × cells times or more, each scanning all breakdowns: O(n·cells·months), with `getEffectiveCell` re-sorting the log per call. This is a performance risk at SaaS scale.

28. **Persistence is fragile:**
    - A single JSON blob in browser IndexedDB, with no versioning or migration in this range besides `EMBEDDED_DATA_VERSION`.
    - Save failures are silent.
    - It is per-browser only, with no multi-user model.
    - A 400 ms debounce means changes made just before closing the tab can be lost.

29. **XSS-adjacent issues:**
    - `onclick='applyPdfImport(${JSON.stringify(...)})'` inlines the imported data into an HTML attribute with single quotes. An apostrophe in a problem text breaks the button.
    - IDs are inserted into onclick strings via `esc()`, which HTML-escapes, so inside JS strings this is mostly safe, but fragile.

30. **The PDF import reads page 1 only**, so multi-page or multi-card PDFs import only the first card.

31. **Dates are stored as DD-MM-YYYY strings** and sorted by string-reversal hacks (`split('-').reverse().join('')`). Machine dates use a different format (ISO), so there are two date formats in one dataset.

---

## 7. Clever ideas to preserve in the product

1. **Time-aware cell attribution:** an effective-dated move log, plus `getEffectiveCell`, so historical breakdowns stay with the cell the machine was in at the time.

2. **Time-weighted cell availability** (`cellFrac` × `periodFrac`). A moved machine's available hours are split across cells by the days spent in each, so cell BD % and MTBF stay correct. The product should generalise this to any time-varying attribute: category, location, criticality, owner.

3. **Purchase-date-aware availability.** A machine bought mid-year contributes only from that date, which avoids inflating the denominator.

4. **The "Days so far" vs "Full year" availability switch,** with dynamic labels ("hours to 14 Oct"), so a year-to-date BD % isn't understated.

5. **The "No cell" bucket,** so tables always reconcile to the totals, and the category list is extended with categories found in the data but missing from settings.

6. **The NO DT concept.** A breakdown that happened outside production hours counts as an event but not as lost time, with a separate reconciliation tile showing its raw hours. This should become a code-level flag.

7. **Exclusion as a separate concept from asset type.** Some assets stay in the fleet and log but are left out of production KPIs.

8. **Supply vs consumption separation.** DG capacity lives in a distinct field so it can never be summed into load. Utility capacity is likewise marked "listed, not load". Running load is estimated as rated KVA × a configurable efficiency factor, with an honest note that it is a proxy.

9. **The fleet expansion timeline:** stacked bars by machine-type prefix plus a cumulative line, with the exact machines added shown in the tooltip, and a click to drill into that year.

10. **The breakdowns-vs-downtime bubble chart** (size = MTTR), which separates "breaks often" machines from "rare but long" ones. It is clickable and zoomable.

11. **Clickable KPI tiles everywhere,** each drilling into its supporting records (`openDrill(key)`), with keyboard access.

12. **Exact-token name matching** for multi-person doneBy/supportedBy fields (avoids "Sagar" vs "Sagar T"), and team stats that include inactive staff for historical completeness.

13. **Chronological permanent Sr No,** independent of view sorting (it needs a stored sequence to be truly permanent).

14. **PDF/QR job-card import:**
    - The mobile tool embeds a JSON QR in a generated PDF, and the desktop app reads it.
    - Two-pass decoding: full page at scale 4, then a high-resolution crop of the known QR location.
    - A white canvas pre-fill.
    - CDN fallback loading.
    - Signature-based dedupe against existing records and within the batch.
    - A preview with New / Duplicate / Unknown / Unreadable classification before commit.

    In the SaaS this should become a native mobile entry flow, with the QR/PDF path kept for offline paper job cards.

15. **Controlled-document numbering on register pages** (ISO 9001 / IATF traceability).

16. **Explicit guards in comments** (fresh Chart.js options object, NO DT semantics, robot rule exceptions). They document intent and should become product rules and tests.

17. **Age shown even when only the year of purchase is known** (`machineAge` fallback), plus an "X of Y have data" subtitle on averages, which signals data completeness on every KPI.

18. **MTTR/MTBF month-on-month shows a dash rather than 0** when a month has no events, so the charts aren't distorted.
