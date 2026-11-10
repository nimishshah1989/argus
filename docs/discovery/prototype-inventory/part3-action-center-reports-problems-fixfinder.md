# Cosmos platform functional inventory, Part 3 (lines 4877-6447)

Scope: Action Center (AC_*, acCompute), Monthly Report, Annual Report, Asset detail, Machine detail, Age Analysis (A8 + age drill), Bottleneck Analysis (A9, bn*), Problem Analysis (A10, prob*/PG_*), table-sort utility (ts*), Fix Finder (ff*). Every line in 4877-6447 was read. Helper functions defined elsewhere (repStats, filterBD, effH, etc.) were looked up only where the semantics matter, and are marked "(outside range)".

Key shared helpers referenced (outside range, needed to understand the formulas):
- `effH(b)` (l.3805) = 0 if Maint Code is "NO DT", otherwise `Number(b.downHrs)||0`. `rawH(b)` = `Number(b.downHrs)||0`.
- `isPM(b)`: maintCode trimmed and uppercased === 'PM'. `isNoDT(b)`: === 'NO DT'.
- `filterBD(opts)` (l.860): drops entries on machines excluded in Settings unless `includeExcluded`; drops PM unless `excludePM:false`.
- `repEntriesAll(includeExcluded)` (l.4418) gives `{b, d (parsed dd-mm-yyyy), pm}` for all entries, PM included.
- `repStats(start,end,E)` (l.4434) gives n, h, pmH, pmN, mttr = h/n, mtbf = (availHrs-h)/n, bdPct = h/availHrs, avail = 1 - h/avail - pmH/avail, perDayN, `long` = breakdowns with **raw** downHrs > whyWhyThresholdHours (default 24), and byMachine/byCell (effective cell at the breakdown date)/byCat/byCode/byShift aggregates sorted by hours.
- `annualHoursPerMachine()` = settings.prodHrsPerDay × settings.workDaysPerYear.
- `nameInField(name, field)`: splits field on commas and needs an exact trimmed match.
- `machineAge(m)` takes age from the purchase date, falling back to the year field. `computeAge(datePurchase)` uses the purchase date only.
- `nonRobotMachines()` = CNC machines not in settings.excludedMachines. `isRobotCat(m)` = category matches /^robot/i.

---

## 1. Screens / pages in range

### 1.1 Action Center (`page-ac`, `renderAC` l.5100)
Purpose: a rule-based "nudge" engine over the breakdown log, PM entries, machines and team. It says what needs attention now and supports a light acknowledge / snooze / resolve workflow.

UI elements:
- **Header**: subtitle "Nudges worked out from the breakdown log, PM entries, machines and team as of {asOf}. Latest log entry: {date}". Buttons: **Rules and limits** (toggles `acUI.rules`; label becomes "Hide") and **Export to Excel** (`acExport`).
- **KPI tiles** (counts of *open* nudges by severity): High priority, Medium, Low, Good news.
- **Rules and limits editor** (when toggled): one numeric input per key of `AC_DEF` (`id=acr_<key>`, min 0, step any), labelled from `AC_LABELS`. Buttons: **Save rules** (`acSaveRules`) and **Reset to defaults** (`acResetRules`). The text points to the Guide (Action Center).
- **"Machines needing attention" table** (top 8 by risk score). Columns: Machine (clickable chip that opens the machine detail with from='ac', plus the model dimmed), Score, Why (a chip per rule type, with "xN" when N>1). The description says "high counts 3, medium 2, low 1".
- **Tab bar**: Open / Acknowledged / Snoozed / Resolved, each with a count.
- **Filters**: priority select (High/Medium/Low/Good news), type select (all AC_TYPES labels), free-text search over title + machines + detail. The search is debounced 300 ms, re-renders and re-focuses the input.
- **Nudge cards** (`acCard` l.5083), one per nudge:
  - Severity label and type label. A "new activity since you closed it" marker appears when `reopened`. A "Not in production data" tag appears when all machines are excluded. "Latest entry {date}" is shown.
  - Title, which is clickable to expand when the nudge has entries. Detail (evidence). A "Team involved" line (top 5 Done By names with counts). An optional "Show all N" `<details>` list (age rule). "Suggested action" text.
  - Machine chips (max 8, then "+N"). Each opens the machine detail.
  - "Assign owner and note" `<details>`: Owner select (active team members), Due date (date input), Note text. Shown only when the nudge is open and not info.
  - Buttons when open (not for info): **Acknowledge**, **Snooze {snoozeDays} days**, **Resolved**. For "long" nudges there is also **Open Why-Why** (`openWhyWhyForm(bdId)`). When the nudge is closed, a state label shows ("Acknowledged" / "Snoozed until {date}" / "Resolved", plus owner, due and note) with a **Reopen** button.
  - "Breakdown details and team" button: expands `acExpandHtml`.
- **Expanded evidence** (`acExpandHtml` l.5067): "Breakdowns behind this nudge: N entries, H hrs (latest 40 shown)".
  - Table columns: Date, Shift, Machine, Problem, Code, E/M, Hours, Done by, Supported by, Corrective action (first 140 chars). Sorted by date, newest first, max 40 rows.
  - "Team members involved" table: Name, Attended, Hours, Avg repair (hrs), Supported. Footnote: shared jobs count for each person, and hours are the full breakdown hours.
- **Global hooks**: `acRefreshBadge()` sets the nav badge `#acBadge` to the number of open High nudges. `acBanner()` returns a clickable banner ("X high-priority and Y medium nudges need attention, Open Action Center →") for use elsewhere (dashboard).
- **Export** (`acExport` l.5056): XLSX sheet "Action Center". Title rows: "COSMOS ENGITECH PVT. LTD.", "Action Center — {date}". Columns: Priority, Type, Status, Nudge, Evidence (HTML stripped), Suggested action, Machines, Latest entry, Owner, Due, Note. File name: `Cosmos_Action_Center_YYYY-MM-DD.xlsx`. All nudges are exported, ignoring the tab and filters.

### 1.2 Monthly Maintenance Report (`page-rep_month`, `renderRepMonth` l.5138)
- **Picker bar** (no-print): ← Back (`repBack`), MONTH select (names), YEAR select (years present in the breakdowns plus the current year), Print button (`repPrintBtn`). State is held in `repSel.m = {y, mo}` (mo is 0-based) and defaults to the current month.
- A future month shows "has not started yet".
- **Header** (`repHead`): "Monthly Maintenance Report — {Month YYYY}", the period text and "Compared with {prev}" (adding "(same days)" when the month is in progress).
- **Headline sentence**: breakdowns (± % vs prev), downtime hrs (± %), MTTR, plant BD %, fleet availability.
- A reference footnote appears when the month is in progress: the previous month in full, n and hrs.
- **8 tiles** (`repTile(label, value, prevText, delta, sub)`):
  1. Breakdowns
  2. Downtime (hrs)
  3. Avg repair time (MTTR, hrs)
  4. Plant BD % (delta in pts)
  5. Fleet availability (higher is better, pts)
  6. Breakdowns per day
  7. PM hours (sub: "N PM entries", not lower-is-better)
  8. "Over {thr} hrs" count (sub: total hrs)
  Each tile shows "{prevTxt}: x" and a coloured delta (`repDelta`), or "no earlier data".
- **Three insight lists**: "What went well" (good), "Concerns" (bad), "Needs attention" (watch). The rules are in §2.2.
- **Trend section**: two combo charts.
  - `ch-rp-daily`: x = day of month 1..max(dim, prevDim). Bars show the current month's daily breakdown count (amber). A line on the right axis shows the current month's daily downtime hours (red). A dashed grey line shows the previous month's daily breakdown count (the full previous month). Days after today are null for an in-progress month.
  - `ch-rp-12m`: the last 12 months ending at the selected month. Future months are skipped and leading months with no BD and no PM are trimmed. Bars show breakdowns and the line shows downtime hrs (y1).
- **"Where the time went"**: four rank tables (`rankTbl`), with columns [Label, Breakdowns, Hours, Prev. hrs, Change ▲/▼]:
  - Top 5 machines (label via `repMachineLabel`)
  - Cells (top 9, `cellName`)
  - Machine categories (top 5)
  - Causes / maintenance code (top 6, code plus its description, '—' shown as "(none)")
- **Concentration footnote**: "b50 breakdowns (x% of entries) made up half of the downtime hours, and c50 machines (x% of the CNC fleet) caused half of the hours."
- **Longest breakdowns** (top 10 with effH>0). Columns: Date, Machine, Problem (truncated to 48 characters), Code, Done by, Hours.
- **Maintenance team table** (one row per person in settings.team, inactive included, with any activity). Columns: Name, Breakdowns attended, {prev}, Change (blue up / grey down, because it is workload), Hours, Prev. hrs, Change (red up / green down), Avg repair (hrs), Supported (count in supportedBy), PM visits (PM entries with the name in doneBy), Share (n / cur.n). Footnote: shares can exceed 100%, plus a count of breakdowns with no listed team member.
- **Machines added table**. Columns: Category, Fleet at start, Added this period, Added {prev}, Change, Fleet at end, then a total row "Total CNC machines". A footnote lists the added machines (id, category, purchase date) in purchase order. When in progress, a further note gives the previous month in full.
- **Report notes block** `repNotesBlock('m'+y+'-'+mo)` (outside range; this is a free-text note persisted per report).
- **Footer**: the available-hours method (annual hrs = prodHrsPerDay × workDaysPerYear), "Robot is excluded", "NO DT entries count as breakdowns with 0 hours", and "current fleet of N CNC machines is used for every month".

### 1.3 Annual Maintenance Report (`page-rep_year`, `renderRepYear` l.5295)
- **Picker**: ← Back, YEAR select, Print. State is `repSel.y`.
- A future year shows a "not started" message. In progress means YTD, compared with the same span of the previous year.
- **Header**: "Annual Maintenance Report — {y}", with the period "1 January to {date} {y} (year to date)" or "Calendar year {y}".
- **Headline**: `take[0]` (n, hrs, per day, BD %, availability).
- **8 tiles**: Breakdowns, Downtime (hrs), MTTR, MTBF (higher is better), Plant BD %, Fleet availability, PM hours, Over {thr} hrs.
- **"Key takeaways"** (take[1..]) and **"Recommended focus areas"** (recs). See §2.3.
- **Month by month**: combo chart `ch-ry-month` (bars = breakdowns, line = downtime hrs; partial month labelled with "*") and a table. Columns: Month (marked "(to date)"), Breakdowns, Downtime hrs, vs prior month (▲/▼ %), MTTR, BD %, PM hrs, Availability. The best complete month row is green (`rp-best`) and the worst is red (`rp-worst`). The section is page-broken for print (`{pb:true}`).
- **Quarter by quarter** table. Columns: Quarter, Breakdowns, Downtime hrs, vs prior quarter, MTTR, BD %, Availability.
- **Where the downtime comes from**: Pareto chart `ch-ry-pareto` (top 15 machines; bars = hrs, line = cumulative % on a 0–100 right axis), the "n50 machines of N caused 50%" note, and a top-10 table. Columns: #, Machine, Category, Age (y), Cell, Breakdowns, Hours, Share, Cumulative, Months in top 5.
- **By cell** table. Columns: Cell, Machines, Breakdowns, Hours, Hrs / machine, BD %.
- **By cause** table (top 8). Columns: Code (+desc), Breakdowns, Hours, Share.
- **Machine categories — reliability** table. Columns: Category, Machines, Breakdowns, Hours, Hrs/machine, MTTR, MTBF.
- **Machine age** table (bands 0-5, 5-10, 10-15, 15-20, 20+). Columns: Age band, Machines, Breakdowns, Hours, Hrs/machine, plus a note on machines with no date.
- **Maintenance team** (top 8). Columns: Name + type, Breakdowns, Hours, Avg hrs, PM visits.
- **Preventive maintenance and long breakdowns**: a PM-by-month table (Month, PM entries, PM hours), and "Breakdowns over {thr} hrs — N in total" (top 8: Date, Machine, Hours (raw), Problem).
- **Machines added month by month** matrix. Columns: Category, Start of y, Jan..{lastM}, Added, End, then a Total row. Footnote: the busiest month for additions.
- **Fleet tiles**:
  - CNC machines counted in production data
  - Added in y (lists up to 8 IDs)
  - Fleet at end of y (all CNC bought up to y)
  - Other assets (conventional + process + utilities + DG counts)
- **Notes block** `repNotesBlock('y'+y)`, then the footer.

### 1.4 Asset detail (`page-asset`, `renderAssetDetail` l.5479)
- Asset kinds: `ASSET_PAGES` = {machines:'CNC Machines', conv:'Conventional Machines', proc:'Process Machines', util:'Utilities', dg:'DG Sets'}. `ASSET_SEG` holds the segment labels. `assetList(kind)` maps each kind to its state array.
- `eyeBtn(kind,id,from)` is the eye-icon button used in asset lists. It calls `openAssetDetail(kind,id,from)`.
- Back button target depends on `assetFrom`: 'drill' → drill page, 'robots' → robots, 'cmp' → Compare, otherwise the asset list of that kind.
- Page title = machine id. Subtitle = segment + category.
- **Hero**: ID, make · model, and badges: segment, category, Cell, and "ROBOT — excluded from analytics" if `isExcluded(m)`. For CNC there is a "⇆ Compare with another machine" button (`openCompare`). "Record completeness: X of N fields" counts these fields:
  - CNC (10): make, model, serial, year|datePurchase, power, location, cell, length, width, controller
  - Others (9): the same with capacityKva for DG and no controller
- Sections:
  - **Identity**: Machine ID, Segment (CNC), Category, Make, Model, Serial No, Asset Code (CNC)
  - **Purchase & Age**: Year of Purchase (year or from date), Date of Purchase, Age (years), Age basis ("From purchase date" / "Estimated from year")
  - **Location**: Location, Cell, Conveyor (CNC)
  - **Electrical / Power Supply**:
    - Non-DG: Connected load (KVA) and Running load (est.) = power × efficiencyFactor (default 15%)
    - DG: Capacity (supply) KVA and "Counted in load? Never — DG sets supply power"
    - Utilities without power: note "Stabilizer / UPS rating is capacity, not load"
  - **Dimensions & Footprint**: Length mm, Width mm, Floor area = L×W/1e6 m²
  - **Controller** (CNC): Controller, Controller Model, Controller Serial
- **CNC only, Breakdown Summary**:
  - For excluded (robot) machines: "Not counted in production data … Action Center still watches this machine".
  - Otherwise: Breakdowns (PM excluded, clickable → machine detail), BD hours, MTTR, MTBF (annual basis via `mttrMtbf(n, hrs, annual)`), PM visits / hours, Last breakdown, Most frequent problem (exact problem-text match with count), and a "View all breakdowns →" button.
- **Cell & Location History** (CNC): from `cellLogFor(id)`, each row is date: Cell from → to, plus a location change if any. If there are none: "None — still in original cell".
- Non-CNC: a note that breakdown tracking covers CNC only.

### 1.5 Machine detail (`page-mdetail`, `renderMachineDetail` l.5607)
- `openMachineDetail(id, from)`. Back routing in `backToDashboardChart`: asset, drill, ac, cmp, ff (Fix Finder), tf (Team Focus), mm (Money Matters), otherwise the dashboard, scrolling to `#ch-dash-bubble`. The back label varies to match.
- **KPIs**:
  - Machine (model · Age · Cell)
  - Breakdowns (PM excluded)
  - BD Hours (NO DT = 0)
  - MTTR = BD hrs ÷ breakdowns
  - "Top 50% of BD Hours": topN of N, with "topN breakdowns = H hrs (x% of total)"
- **Table "Breakdowns — Highest to Lowest Downtime"**: sorted by effH desc. Rows that make up the first 50% of hours, counting from the longest and including the row that crosses 50%, are highlighted amber. Columns: #, Date, Shift, Problem, Code, Done By, Down (Hrs) (with a "(NO DT)" tag), % of Machine Total, Cumulative %.
- **Table "By Maintenance Code"**: Code, Breakdowns, BD Hours, % of Machine Total, sorted by hours.

### 1.6 Age Analysis (A8, `renderA8` l.5680) and Age drill (`drillAge` l.5722)
- Card 1, "Downtime by Machine Age — BD Hours": one KPI tile per age band from `calcAnalytics3().byAge` (outside range). Each shows hours, machines and breakdowns. Clicking opens `openDrill('age',{band, back:'a8'})`.
- Card 2, "Avg BD Hrs per Machine": tiles per band showing hours / machines (normalised for band size), clickable the same way.
- Card 3, combo chart `ch-a8-combo`: bars = machines per band (left axis), line = avg BD hrs per machine (right axis).
- Card 4, scatter `ch-a8-scatter`: one dot per machine with x = age (yrs) and y = BD hours. The tooltip shows id (category), age and hrs. Clicking opens asset detail (from 'drill'). Machines with no age are left out.
- Card 5, stacked bar `ch-a8-mix`: machine counts per band, stacked by category (PALETTE colours).
- **Drill "Age band — {band}"**:
  - KPIs: Machines, Breakdowns, BD hours (+ per machine), MTTR, Top 3 machines' share of band hours.
  - Table "Machines in this band": #, Machine (link → asset detail, plus a "breakdowns" chip → machine detail), Category, Make/Model, Cell, Age, Breakdowns, BD hrs, MTTR, % of band hrs.
  - Table "By category": Category, Machines, Breakdowns, BD hrs, BD hrs/machine.
  - Table "By maintenance code": Code, Breakdowns, BD hrs, % of band hrs.
  - Export via `setExport` (file `Cosmos_Age_{band}`). Columns: Machine, Category, Make, Model, Cell, Age (yrs), Breakdowns, BD hrs, MTTR.
- `drillNavPage()` maps the drill kind to its parent nav: ctrl/make → machines, age → a8, prob → a10, otherwise dashboard.

### 1.7 Bottleneck Analysis (A9, `renderBottleneck` l.5812)
- Shows "No breakdown data yet." if there is no data.
- **Export to Excel** (`exportBottleneck`): file `Cosmos_Bottleneck_Analysis`. Columns: Rank, Machine, Category, Cell, Machines of same kind, Availability %, BD hrs, Breakdowns, MTTR, Longest (hrs), Capacity left if down %, Cell capacity left %, Expected BD hrs / year, Score, Rating.
- **KPIs**:
  - Critical (count)
  - High
  - Only one of their kind (peers = 1)
  - Plant availability (1 − fleetUnav, with the period dates)
- **"What management should know"** (auto bullets):
  1. Critical machines (up to 5, each with category, availability and backup count).
  2. Sole-of-kind machines and their average availability vs the plant.
  3. The least available machine (availability, hrs, n, and the share of category capacity lost if it stops = 1/peers).
  4. Small groups (≤3 machines) with average availability below the plant.
- **Risk map scatter** `ch-a9-map`:
  - Rows (y lanes) = categories, sorted by machine count ascending, then by average availability ascending. The axis is reversed so the smallest groups are at the top. Lane labels read "Category (n)".
  - x = unavailability % of machine hours.
  - Dot radius = clamp(4 + √hrs × 0.7, 4, 15).
  - Colour by rating (Low grey, Watch yellow, High orange, Critical red; `BN_COL`).
  - A deterministic jitter within the lane (hash of ID) is applied only when the lane has more than one machine.
  - A custom plugin shades alternate lanes and draws a green dashed vertical line at the plant average. Another labels Critical and High dots with their ID.
  - The tooltip shows ID, availability, BD hrs and the number of machines of that kind. Clicking a dot runs `bnPick` (simulator).
- **"Highest-risk machines" table** (top 20, with a toggle "Show all N machines" via `bnToggleAll`). Columns: #, Machine, Category, Cell, Same kind, Available, BD hrs, Breakdowns, Longest, Capacity left if down, Score, Rating pill. Clicking a row picks it for the simulator.
- **"What if it goes down?" simulator card** (`renderBnSim` l.5785):
  - Inputs: machine select, duration select (Typical = machine MTTR / Its longest breakdown / Custom hours) and a custom hours number input (default 24).
  - Verdict text in three cases: sole machine; ≤3 peers (capacity lost and backup availability); more peers.
  - KPIs: Outage length (hrs and production days), {cat} capacity left, Cell {cell} capacity left, Category capacity lost (share of one month of category hours), Expected downtime next 12 months (hrs and production days).
  - Tables: "Its longest breakdowns so far" (top 5: Date, Problem (48 chars), Code, Hrs) and "Machines that would have to cover (same category)" (weakest 8 by availability: Machine (click to pick), Cell, Availability, BD hrs).
- **"Capacity by machine category" table** (smallest groups first). Columns: Category, Machines, Effective machines (Σ availability), Avg availability, BD hrs, Weakest machine (clickable, with availability), Capacity left if it stops ((n−1)/n).
- **"Capacity by cell" table** (lowest availability first). Columns: Cell ("No cell assigned" for '—'), Machines, Avg availability, BD hrs, BD % (Σh / Σavail), Weakest machine.
- The A9 page also appends `fcHtml()`, `trHtml()`, `rfHtml()` and calls `fcChart()`. These are defined at l.7365+ (forecast/trend/other cards) and are outside this range, but they are rendered on this page.

### 1.8 Problem Analysis (A10, `renderProblems` l.6033)
- Toolbar: checkbox "Count multi-day repairs once" (same machine and same problem within 3 days becomes one event) and **Export to Excel** (`exportProblems`).
- **KPIs**:
  - Breakdowns studied (events, with total hrs, PM excluded)
  - Top problem group (name before " / ", with % of hours)
  - Quick stops (≤30 min) % of breakdowns, with their % of hours
  - Repeat problems (% of hours, pairs count)
- **"What stands out"** bullets (§2.6).
- **Pareto** `ch-prob-pareto`: a horizontal bar chart of the top 16 groups by the selected metric (select "Ranked by downtime hours" / "Ranked by number of breakdowns"). Labels carry the share %. The top 3 bars are dark blue. The tooltip shows n, hrs, hrs each, machines and cumulative %. Clicking a bar opens the group drill. Height scales with the number of rows.
- **"Often, or long?" bubble chart** `ch-prob-scatter`: x = number of breakdowns, y = average hrs per breakdown, r = clamp(√hrs × 1.3, 5, 26). The top 9 groups by hrs get a text label (the name before " / ", clamped inside the chart area). Clicking opens the drill.
- **"All problem groups" table** (rows click → drill). Columns: Problem group, Family, Breakdowns, % of breakdowns, Hours, % of hours, Hrs each, Machines, Quick (% ≤0.5 h).
- **"Families of problems" table**. Columns: Family, Breakdowns, % of breakdowns, Hours, % of hours, Groups inside.
- **"Repeat offenders" table** (top 15; a row click → drill filtered to that machine). Columns: Machine, Category, Problem group, Times, Hours.
- **"What if we cut a problem?"**: a group select (with hrs), a range slider "Reduce by" 0–100 step 5 (default 50%), and output KPIs: Downtime saved, Breakdowns avoided, Plant availability (after, was, +pts) and MTBF (after, was).
- **"Things to check in the data"** bullets (data-quality issues, §2.6).
- **"Words not yet recognised"** card (only if any): the top 14 words from un-grouped events. Columns: Word, In entries, Hours, Example problem, and "Add to group" (a select that adds the word to the group's keywords immediately and persists).
- **Keyword editor** (collapsible "Problem groups and keywords (edit)", `probEditHtml`). Table columns: Order (↑/↓), Group name, Family, Keywords (textarea), × remove. Buttons: + Add group (inserted at the top), Reset to the standard list, **Save and re-group**. Explanatory text gives the matching rules.
- **Drill "prob"** (`drillProb` l.6130):
  - Title is the group name (− machine when filtered). Subtitle: n, hrs, hrs each, family.
  - Two group cards (`groupCard`, outside range): By machine (top 12) and By category.
  - Entries table with a live search (machine/problem/action/category). Columns: Date (with "N entries, to {dEnd}" for merged events), Machine (`drillMachineLink`), Category, Problem, Corrective action, Code, Hours.
  - Export: `Cosmos_Problem_{name}`. Columns: Date, Machine, Category, Problem, Corrective action, Maint code, Hours, Entries.
- **Dashboard tile** `problemTile()`: "Problems costing the most downtime". It shows the top 3 groups excluding "Other / unclear", each with a bar relative to #1, plus hrs · % · BDs. Clicking goes to A10.
- **Export** `exportProblems`: workbook with three sheets.
  - Groups: Problem group, Family, Breakdowns, %, Hours, %, Hrs each, Machines, Quick %.
  - Repeat offenders.
  - All events: Date, Machine, Category, Problem group, Family, Problem, Corrective action, Maint code, Hours, Entries.
  - Header rows "COSMOS ENGITECH PVT. LTD." and "Problem Analysis — …" (noting when merge is on). File `Cosmos_Problem_Analysis_YYYY-MM-DD.xlsx`.

### 1.9 Table sorting (global utility, l.6163–6263)
A "Sort" control (a column select plus an Ascending/Descending toggle button) is added to every eligible table on the active page. Clicking a column header sorts too, and clicking again reverses. Total rows stay pinned at the bottom. See §2.8.

### 1.10 Fix Finder (`page-ff`, `renderFixFinder` l.6383)
- **"Describe the problem" card**:
  - Large query input (Enter = search).
  - Machine input with a datalist of all CNC machines (option label = category).
  - Category select (non-robot categories). It is disabled when a machine is chosen, because the machine's category is used.
  - **Find fixes** and **Clear** buttons.
  - "TRY" chips: spindle problem, coolant leakage, ATC arm stuck, 4th axis clamp, turret not clamping, air leakage, alarm servo, machine accident.
- Empty state: "Searches N past breakdowns (PM excluded)." No-match state names the words not found and suggests part names or alarm text.
- **"What I understood" card**:
  - Lists the query terms. Used terms are bold, with "(read as 'X')" when spell-corrected. Unused terms are struck through: "(not used in any past entry)".
  - Shows the detected problem group, and the machine or category.
  - KPIs:
    - Similar cases (with a confidence label: Good evidence ≥12, Some evidence ≥5, otherwise "Few similar cases — treat as a hint only"; colour green/amber/red)
    - On this machine
    - Typical downtime (median, with the average in the sub; NO DT = 0)
    - Last seen
  - A repeat note for the chosen machine (≥2 similar: repeat warning with date range and hours; 1: "had one similar"; 0: "guidance comes from other machines").
- **"Top fixes that were used before"**: up to 5 action types. Each shows: rank, name, "n of N similar cases (x%)" and "k on {machine}", a bar, avg hrs down, machine count, last used, parts used (top 3 with ×count), and 2 example actions (own machine first, de-duplicated, highlighted).
- **"What technicians found"**: up to 5 clustered cause phrases with case counts (single-case clusters show the machine and date).
- **Result sections**:
  1. Same machine history (10 rows, "Show all N")
  2. Same category (10)
  3. "Rest of the plant" in `<details>`, opened automatically when the useful hits number fewer than 5
  With no machine or category, one section "Similar breakdowns across the plant" (15 rows).
  Row columns: Match (bar + %, green ≥80, blue ≥55, else grey), Date, Machine (→ machine detail from 'ff'), Problem (highlighted), What was done (highlighted), Down (hrs), Done by.
- **Dashboard card** `ffDashCard()`: a quick search input that goes to the Fix Finder page (`ffFromDash`).

---

## 2. Calculations & algorithms

### 2.1 Action Center rules (`acCompute` l.4899–5030)

**AC_DEF defaults (l.4877), editable and stored in `state.settings.ac`; merged by `acCfg()`:**

| key | default | meaning (AC_LABELS) |
|---|---|---|
| repeatDays | 7 | Recurring fault look-back days |
| repeatMinDays | 2 | same cause on ≥ N different days |
| freqDays | 30 | Frequent breakdowns look-back |
| freqMin | 4 | ≥ N breakdowns |
| cellDays | 7 | Same cause in a cell look-back |
| cellMin | 5 | ≥ N breakdowns |
| longDays | 60 | Long BD without Why-Why look-back |
| spikePct | 50 | weekly spike % over 4-week avg |
| spikeMinHrs | 10 | and ≥ N hrs |
| mttrMult | 2 | slow repairs × fleet avg |
| mttrMin | 3 | ≥ N breakdowns |
| mttrDays | 90 | look-back (also reused by the Ageing rule) |
| humShare | 15 | HUM code share % |
| shiftShare | 55 | one shift share % |
| teamShare | 30 | one person share % |
| newMachDays | 90 | bought within N days |
| newMachMin | 2 | ≥ N breakdowns |
| spareDays | 90 | spares look-back |
| spareShare | 25 | one machine's % of spares spend |
| riseMult | 2 | worsening × previous period |
| riseMin | 3 | ≥ N breakdowns |
| oldAge | 15 | old-machine age, years |
| snoozeDays | 7 | snooze length |

Other constants: Why-Why threshold `thr` = settings.whyWhyThresholdHours (default 24). Severity weights `AC_SEV` = high 3, med 2, low 1, info 0.

**Data windows:**
- `asOf` = today at midnight. `age(d)` = whole days between asOf and the entry date.
- `E` = every entry including excluded machines (`repEntriesAll(true)`) with a valid date. `Ep` = E without excluded machines (production only).
- `W(days,off)` = entries with off ≤ age < days+off. `BD` = W without PM (all machines). `BDP` = production-only, non-PM.
- `fresh` = last entry ≤2 days old.

**Each nudge has these fields:** key, rule, sev, machines[], entries[], ev (latest entry date), title, detail, action, plus optional bdId / agg / list. `excl` = every machine is excluded.

**Rules:**
1. **recur — Recurring fault** (`BD(repeatDays)`)
   - Group by machine|maintCode. Skip entries with no code and NO DT entries.
   - Distinct dates ≥ repeatMinDays → nudge.
   - Severity **high** if distinct days ≥3 or any two dates are consecutive. Otherwise **med**.
   - Detail: count, hrs, dates, "(consecutive days)", and up to 3 distinct problem texts (60 chars).
   - Key `recur|{mid}|{code}`.
2. **freq — Frequent breakdowns** (`BD(freqDays)`, all non-PM entries including NO DT)
   - n ≥ freqMin. Severity **high** if n ≥ ceil(freqMin×1.5) (6 with the defaults). Otherwise med.
   - Detail includes the previous period count (`BD(freqDays, freqDays)`) and the most common code.
   - Key `freq|{mid}`.
3. **rise — Worsening machine** (else-branch of freq, so it only fires when freq did not)
   - Fires if n ≥ riseMin AND n ≥ riseMult × max(prev, 1). Severity med.
   - The action text says "at least doubled" as hard-coded wording.
   - Key `rise|{mid}`.
4. **cell — Same cause in a cell** (`BD(cellDays)`)
   - Group by effective cell at the breakdown date (`getEffectiveCell`, '—' if none) and code. No code / NO DT are skipped.
   - Fires if count ≥ cellMin AND distinct machines ≥2. Severity **high** if ≥4 machines, otherwise med.
   - Key `cell|{cell}|{code}`.
5. **long — Long breakdown without Why-Why** (`BD(longDays)`)
   - Fires for each entry with effH > thr and no `b.whyWhy`. Severity **high** if effH ≥ 2×thr, otherwise med.
   - Key `long|{bdId}`. The card carries an "Open Why-Why" button.
6. **spike / good — Plant trend** (production only)
   - h7 = hours in the last 7 days. hp = hours in days 7–34 divided by 4 (average week).
   - **Spike** if hp>0 AND h7 ≥ hp×(1+spikePct/100) AND h7 ≥ spikeMinHrs. Severity **high** if h7 ≥ 2×hp, otherwise med. Machines = top 3 contributors. Key `spike|hrs`.
   - Else **Good news** (sev info) if `fresh` AND hp ≥ spikeMinHrs AND h7 ≤ 0.6×hp. Key `good|hrs`. It has no entries and no action buttons.
7. **mttr — Slow repairs**
   - fleetAvg = mean effH over production entries in mttrDays with effH>0.
   - Per machine (all machines, effH>0 entries): count ≥ mttrMin AND avg ≥ mttrMult × fleetAvg → severity med.
   - Key `mttr|{mid}`.
8. **30-day plant patterns** (`BDP(30)`, only if n ≥ 10, hard-coded; production only):
   - **hum — Human mistakes**: share of code 'HUM' (uppercased) ≥ humShare. Severity **high** if ≥ 2×humShare, otherwise med. Machines = top 5 by count. Detail gives the top 3 machines and top 3 shifts. agg = true. Key `hum|all`.
   - **shift — Shift pattern**: more than one distinct shift, the top shift's share ≥ shiftShare, AND n ≥ 20 (hard-coded). Severity low. agg. Key `shift|{shift}`.
   - **team — Team workload**: over active team members, count entries with the name in doneBy (`nameInField`). If the top person's share ≥ teamShare → severity low. agg. Key `team|{name}`.
9. **newm — New machine**
   - For each CNC machine with purchase date (`machDate`) within 0..newMachDays days ago: non-PM entries on or after the purchase date (NO DT included, excluded machines included) ≥ newMachMin.
   - Severity **high** if ≥4 (hard-coded), otherwise med. Detail lists the distinct codes.
   - Key `newm|{id}`.
10. **spares — Spares spend** (`BD(spareDays)`)
    - Cost per entry = cost1+cost2+cost3 (`sumSpareCost`).
    - A machine fires if its share of the total ≥ spareShare AND it has ≥2 costed entries. Severity med. Currency is "Rs".
    - Key `spares|{mid}`.
11. **age — Ageing machines** (production, look-back = **mttrDays**, not its own parameter)
    - avg = Σ hrs over machines / count of all non-robot machines (zero-hour machines included).
    - Old = machineAge ≥ oldAge AND hrs ≥ 2×avg (2 is hard-coded) AND avg>0, sorted by hrs.
    - One aggregated nudge (severity low), with machines = top 5 and a `list` of all of them.
    - Key `age|all`.

**Status resolution** (l.5018), from `state.settings.acAcks[key] = {status:'ack'|'snooze'|'done', owner, due, note, at (ISO), until?}`:
- snooze: 'snoozed' if `until` > now, otherwise 'open' (not flagged as reopened).
- ack/done: if the nudge's latest entry date `ev` > ack date (truncated to midnight), the status becomes 'open' with `reopened=true` ("new activity since you closed it"). Otherwise 'ack' or 'resolved' (for done).
- No ack: 'open'.

**Sort**: severity desc, then ev desc.

**Machine risk score** (l.5026): over open, non-info nudges, each machine listed gets +weight. The weight is 1 if the nudge is aggregated (hum/shift/team/age), otherwise AC_SEV (high 3, med 2, low 1). The count of each rule is tracked too. The top 8 are shown.

**acSaveRules**: any NaN or negative input reverts to the default. **acResetRules** deletes settings.ac.

**acTeam(entries)** (l.5061): splits doneBy and supportedBy on commas (with no team-list filter). Per name: n attended, h (full effH per person), sup count. Sort n desc, then sup, then h.

### 2.2 Monthly report logic (`renderRepMonth`)
- **Period**: from day 1 to the month end, or to today if the month is in progress. N = days covered.
- **Comparison**: the previous month. If in progress, the same N days (capped at the previous month's length). Otherwise the full previous month. `prevFull` is computed for reference.
- `hasPrev` = prev has BD or PM entries.
- `chg(c,p)` = "up/down x%".
- **Insights** (only when hasPrev and prev.n):
  - Downtime Δ% ≤ −10 → good. ≥ +10 → bad.
  - Breakdown count Δ% ≤ −10 → good. ≥ +10 → bad.
  - MTTR Δ% ≤ −15 → good. ≥ +15 → bad.
  - prev had long breakdowns (>thr) and current has none → good.
  - The cell with the largest hours increase vs prev: if the increase is ≥15 hrs → bad. The largest decrease ≤ −15 hrs → good.
- **Always**:
  - If there are long breakdowns, list them (top 4 by hrs, problem truncated to 40) as bad.
  - Top machine ≥15% of hours → bad.
  - Top coded cause (excluding '—') ≥30% of hours → bad.
  - Machines with ≥6 breakdowns → watch.
  - PM hours moved more than ×3 or below ÷3 vs prev → watch, listing the 3 largest PM entries from the bigger month.
  - **Repeat offenders**: the current month's top-5 machines by hrs that are also in the top 5 of month −1 or −2 → watch, with each month's hrs. The current period uses end-to-date; earlier months are full.
- **Concentration (50% rule)**:
  - c50 = machines (sorted by hrs) counted while the cumulative total before that machine is under 50% of hours (so the crossing machine is included).
  - b50 = the same over individual breakdowns sorted by effH.
  - The percentage of the fleet is c50 / cur.nMach.
- **Team rows**: per person in settings.team, using `nameInField` on doneBy, supportedBy, and doneBy of PM entries. Share = n / cur.n. Unassigned = breakdowns where no team name matches doneBy.
- **Machines added**:
  - `repAdds(start,end)` = non-robot CNC with purchase date in range.
  - `repFleetTo(date)` = purchase date ≤ date. Fleet at start = purchase ≤ the last day of the previous month.
  - `repCats()` = categories ordered by count, with "(no category)".
  - Comparison: additions in the same-days previous period (`addsPrev`), and the full previous month (`addsPrevFull`).
- `dTxt` threshold: |Δ| < 0.05 hrs shows as flat.
- **Charts** as in §1.2. Values are rounded to 0.1.

### 2.3 Annual report logic (`renderRepYear`)
- **Comparison**: if in progress, prev = Jan 1 of y−1 to the same month and day of y−1. Otherwise the full y−1. `hasPrev` = prev.n > 0 (unlike monthly, PM is ignored).
- **Months**: 0..end month. `partial` = month end > period end.
  - Best and worst month: among complete months with n>0, both need ≥2 such months. Best = minimum hrs, worst = maximum hrs. Worst/best ratio uses max(best, 0.1).
- **Quarters**: Q1..Q4 up to the end. `partial` flag.
- **Offenders**: a machine counts if it appears in a month's top-5 (by hrs) in ≥3 months.
- **Pareto**: byMachine with cumulative share. n50 = machines whose prior cumulative total is under 50% (crossing machine included).
- **Age bands**: [0,5), [5,10), [10,15), [15,20), [20,999) using `machineAge`, which falls back to the year. Per band: machines, n, h, per = h/machines. Machines with unknown age are listed separately.
- **Category rows**: machines = count of non-robot machines with that category. av = `availSum(machines in cat, start, end)`. MTTR = h/n. **MTBF = (av − h)/n**, or av when n = 0. per = h/machines.
- **Cell rows**:
  - machines = count with current `m.cell` matching.
  - av = `cellAvail(cell, start, end, annual, mach)`, which counts time in the cell from the purchase date and accounts for moves.
  - Machine-equivalents w = av / (annual × cur.frac). per = h/w. BD % = h/av.
- **Team**: all settings.team. n, h, PM visits. Sorted by n.
- **Additions matrix**: per category per month (purchase month) for months 0..lastM (current month if the year is current, otherwise 11). The start count is the fleet bought up to Dec 31 of y−1. The busiest month is reported.
- **Fleet**:
  - addedYear = non-robot machines with `machineYear` = y.
  - fleetEnd = machineYear ≤ y.
  - Other assets = counts of conv, proc, util and DG arrays.
- **Takeaways**:
  1. Headline.
  2. YoY Δ% for hours and count, or a no-previous-year note.
  3. Best and worst month.
  4. n50 machines.
  5. Leading coded cause with its hrs share.
  6. Count of uncoded breakdowns and their share of hours.
  7. Last complete quarter vs the one before (Δ%).
- **Recommendations**:
  - Top 5 machines and their share.
  - Offenders (≥3 months) up to 6.
  - Leading coded cause if ≥20% of hrs.
  - Long breakdowns (>thr) with the worst 3 (raw hrs).
  - The worst age band (≥3 machines) by hrs per machine.

### 2.4 Asset / machine detail metrics
- **Running load** = connected KVA × efficiencyFactor% (default 15). **Floor area** = length × width / 1e6 m².
- **Completeness** = count of non-empty fields out of 10 (CNC) or 9.
- **Asset Breakdown Summary**: `mttrMtbf(n, hrs, annualHoursPerMachine())` (outside range, "annual basis"). PM visits come from raw `state.breakdowns` filtered by isPM. "Most frequent problem" is an exact trimmed string match.
- **Machine detail**:
  - The list is sorted by hours.
  - **50% highlight**: a row is "inTop" if total>0, its own hrs>0, and the cumulative total *before* the row is under 50%. topN = the count of such rows.
  - % = hrs/total. Cumulative % = running total.
  - MTTR = total/n.
  - By-code groups use '—' for a blank code.

### 2.5 Bottleneck scoring (`bnCompute` l.5753)
- **Period** (`bnPeriod`): start = **Jan 1 of the year of the earliest breakdown date** (any entry, PM and excluded included). End = the latest breakdown date. Dates are parsed by `bnParse` (dd-mm-yyyy or dd/mm/yyyy).
- **perDay** = prodHrsPerDay × workDaysPerYear / 365 (available hours per calendar day).
- **Machines**: non-robot (not excluded) AND category not starting with "robot".
- **Per machine**:
  - st = max(period start, purchase date).
  - days = max(1, round((end − st)/day) + 1).
  - avail = days × perDay.
  - h = Σ effH (non-PM). n, max (longest).
  - unav = min(1, h/avail). a = 1 − unav.
  - mttr = h/n. perYear = h/days × 365.
- **Fleet**: fleetUnav = Σh / Σavail.
- **Redundancy**:
  - peers = machines in the same category (including itself). capLeft = (peers−1)/peers.
  - cellN = machines in the same current cell. cellLeft = (cellN−1)/cellN.
  - backupA = the mean availability of the other peers.
- **Score**:
  - L (load/unreliability) = min(1, (unav / fleetUnav) / 4). This saturates at 4× the fleet unavailability. If fleetUnav = 0, L = 0.
  - C (concentration) = 1/√peers.
  - **score = round(100 × (0.5·L + 0.5·C))**.
- **Rating**:
  - **Critical** if (peers = 1 AND unav > fleetUnav) OR (score ≥ 55 AND peers ≤ 10)
  - else **High** if score ≥ 40
  - else **Watch** if ≥ 30
  - else **Low**
  - (A sole machine always scores ≥ 50, so it is at least High.)
- Sort: score desc, then hrs desc.
- **Category table**: eff = Σa (effective machines). avg = mean a. Weakest = minimum a. left = (n−1)/n. Sorted by n ascending, then avg ascending.
- **Cell table**: avg a. bdp = Σh/Σavail. Weakest machine. Sorted by avg ascending.
- **Simulator** (`renderBnSim`):
  - Outage hrs = mttr ('typ'), max ('max') or custom.
  - Production days = hrs / prodHrsPerDay.
  - monthly = prodHrsPerDay × workDaysPerYear / 12.
  - **Category capacity lost** = hrs / (peers × monthly).
  - Expected next-12-month downtime = perYear (and perYear / ph in production days).
  - Covering machines = the other peers sorted by availability ascending.
  - The stated assumption is that every machine of the category is fully loaded.
  - Verdict thresholds: peers = 1; peers ≤ 3; otherwise.

### 2.6 Problem Analysis (prob*)
**PG_DEFAULT keyword list (l.5885), in order, as group name, family and keywords:**
1. Machine accident / crash. Family: Crashes and setup. Keywords: `accid, acceid, crash, collision`
2. PM logged as a breakdown. Family: Other. Keywords: `pm`
3. Tool-change arm stuck (ATC). Family: Tool changing. Keywords: `arm stuck, arm stucked, atc arm, arm not, arm motor, arm position, arm proximity, atc`
4. Magazine / tool pot. Family: Tool changing. Keywords: `magazin, tool pot, pot not, tool fell, tool full, tool pocket`
5. Tool clamp / unclamp / drawbar. Family: Tool changing. Keywords: `tool clamp, tool unclamp, tool un-clamp, tool declamp, tool release, drawbar, draw bar, draw tube`
6. Tool-change error (general). Family: Tool changing. Keywords: `tool change, toolchange, tool chang`
7. 4th axis / rotary / angular head. Family: Rotary and 4th axis. Keywords: `4th, fourth, rotary, angular head, tilting`
8. Axis motor / drive / encoder / servo. Family: Axis, drive and geometry. Keywords: `fssb, servo, encoder, drive, amplifier, axis motor, overcurrent, over current, power module, x axis, x-axis, y axis, y-axis, z axis, z-axis, axis not, axis jam, axis alarm, axis hum, sv0`
9. Home position / geometry / backlash. Family: Axis, drive and geometry. Keywords: `home position, reference, geometr, geomatr, backlash, centre, center, taper, teppar, tapper`
10. Coolant leakage. Family: Fluids and chips. Keywords: `coolant leak, coolant lek, colant, coolnat, nozzle leak, water leak, kmt, pump leak, oil leak, coolant pipe, coolant hose`
11. Coolant pressure / flow. Family: Fluids and chips. Keywords: `coolant, cts`
12. Air leakage / low air pressure. Family: Fluids and chips. Keywords: `air, pneumat`
13. Conveyor / chip jam. Family: Fluids and chips. Keywords: `conv, chain, scrap, chip`
14. Spindle motor / overload / noise. Family: Spindle, turret and chuck. Keywords: `spindle, 1001`
15. Turret clamp / indexing. Family: Spindle, turret and chuck. Keywords: `turret, index`
16. Chuck / jaw / collet. Family: Spindle, turret and chuck. Keywords: `chuck, collet, jaw, tailstock, tail stock`
17. Lubrication / low oil. Family: Fluids and chips. Keywords: `lubric, lube, grease, oil`
18. Hydraulic pressure. Family: Fluids and chips. Keywords: `hydraul, hyd`
19. Door / guard / limit switch / sensor. Family: Electrical and controls. Keywords: `door, guard, limit, prox, sensor, interlock`
20. Push button / switch / cable / panel. Family: Electrical and controls. Keywords: `push button, pushbutton, switch, cable, lamp, light, fuse, mcb, panel, display, mpg, connector`
21. Fan / filter / overheating. Family: Electrical and controls. Keywords: `fan, fen, filter, overheat, temperature, dust`
22. Alarm / PLC / parameter / reset. Family: Electrical and controls. Keywords: `alarm, alram, parameter, plc, reset, program, communication, error`
23. Installation / relocation / trial. Family: Other. Keywords: `install, resift, shift, relocat, trial`
24. Belt / bearing / coupling / wear. Family: Mechanical wear. Keywords: `belt, bearing, coupling, gear, pulley, pully, bush, vibration, noise, noice, broken, loose`

Fallback: `PG_OTHER` = "Other / unclear" (family Other). The active list comes from `state.settings.problemGroups` if it is non-empty, otherwise the default.

**Compile** (`probCompile` l.5914): keywords are split on commas, trimmed, lowercased and regex-escaped. A keyword of 1–3 alphanumeric characters becomes `\bkw\b` (whole word). Anything else is a substring match. Multi-word phrases are substrings.

**Classify** (`probClassify` l.5919):
- Pass 1: the first group in list order with any keyword matching the **problem** text only.
- Pass 2: the first group matching problem + " " + corrective action.
- Otherwise "Other / unclear".
- Order matters: specific groups must come above general ones.

**Events** (`probEvents` l.5926):
- Non-PM, non-excluded entries with a parseable date.
- key = machineId | `probNorm(problem)` (lowercase, alphanumerics only, first 30 characters).
- Sorted by key, then date.
- When `probMerge` is on, consecutive entries with the same key and a gap ≤3 days from the last event end are chained into one event (hrs summed, dEnd extended). The group comes from the first entry.

**Aggregation** (`probCalc` l.5940, cached by signature):
- Per group: n, h, machines set, quick (h ≤ 0.5), zero (h = 0), events, and per-machine counts.
- Per family: n, h, groups set.
- Rows are sorted by h.
- **Repeat offenders**: a machine × group pair with ≥4 events (hard-coded). Sorted by h. repH and repN are totals.
- top5 / top20 = hours of the 5 and 20 longest events.
- Median event hours = the upper median (index floor(n/2)).
- **Data issues**:
  - `multiList` = raw (unmerged) machine + normalised problem pairs with ≥4 entries, or ≥3 entries and ≥20 hrs.
  - `pmLike` = events in the group named exactly 'PM logged as a breakdown'.
  - noCode = raw entries with a blank maintCode. noEM = raw entries with a blank electMech.

**"What stands out"** bullets:
- The top group by hours.
- The most frequent group, if it differs ("saves interruptions more than hours").
- The longest-per-breakdown group with n ≥ 3, if it differs.
- Quick-stop share vs the top-5/top-20 event share.
- Repeat pairs.
- The top 3 families' share of hours.

**What-if** (`probWhatHtml` l.5976):
- A = available hours from `availSum(nonRobotMachines(), availWin(dataYear()))`.
- saveH = g.h × pct. saveN = g.n × pct.
- Availability before = 1 − tot/A. After = 1 − (tot − saveH)/A.
- MTBF before = (A − tot)/N. After = (A − (tot − saveH))/(N − saveN).
- Assumes saved events have the group's average length.

**Word mining** (`probWords` l.6016):
- Over events in "Other / unclear": tokenise problem + action (lowercase, split on non-alphanumeric).
- Drop tokens shorter than 3, pure digits, and anything in `PW_STOP`. De-duplicate per event.
- Count n and h, with an example problem. Sort by n, then h. Take the top 14.
- `PW_STOP` (l.6015) is a hard-coded English stoplist plus maintenance verbs: the, and, for, with, …, machine, mc, problem, issue, check, checked, found, change, changed, replace, replaced, ok, normal, working, run, start, stop, open, close, fix, fixed, repair, repaired, clean, cleaned, remove, put, puted, attach, tighten, handover, hand, over, etc.

**Add word** (`probAddWord`): appends the word to the chosen group's keywords (if absent), writes the **entire** list to settings.problemGroups, clears the draft and cache, then `saveStateToDB()`, a toast and a re-render.

**Editor**:
- Drafts are held in `probDraft`.
- Move up/down. Delete. Add (inserted at the top as "New group"/Other).
- Reset loads PG_DEFAULT into the draft.
- Save: drops groups with blank names and trims. If the result equals PG_DEFAULT, the setting is deleted. Otherwise it is stored, then persisted.

### 2.7 Charts in Problem Analysis
- Pareto: cumulative % = running total / tot (tot = hours or count) over the displayed top 16.
- Bubble chart: as in §1.8.

### 2.8 Table sort (ts*)
- `tsNum`:
  - Normalises the unicode minus and strips ▲ ▼ ↑ ↓ + ₹ $ , and whitespace.
  - Needs a leading number and a suffix of ≤6 characters, so "12.5hrs" and "45%" parse.
  - '—' and '-' give null.
- `tsDate`: accepts dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd and "12 Jan 2025" (month parsed from 3 letters).
- `tsColType`: the type is 'date' if ≥70% of non-empty cells parse as dates, otherwise 'num' if ≥70% parse as numbers, otherwise 'text'.
- `tsEligible`:
  - Exactly one thead row.
  - No rowspan or th colspan.
  - No inputs, selects or textareas in the tbody.
  - No td colspan.
  - Not inside `#probEdit`.
  - ≥3 body rows.
  - Report pages (`page-rep_*`) are skipped entirely.
- **Pinned rows**: first cell matches `TS_TOTAL` (`/^(total|grand total|plant total|plant|overall|all machines|all)\b/i`), or the row class contains "total", or the row is in a tfoot. Pinned rows stay at the bottom.
- **Sorting**:
  - Default direction: numbers and dates descending first, text ascending.
  - Nulls always last.
  - Stable via the original index `_tsOi`.
  - Text uses `localeCompare(…, {numeric:true})`.
  - Header classes ts-asc / ts-desc.
- **State**: `TS_STATE[key]`, where key = page id | card heading (first 40 characters) | header signature | occurrence index. It survives re-renders in memory only.
- **Placement**: if the card has a single table and its h3/h4 precedes it, the control goes into the heading. Otherwise a `.ts-bar` goes above the table.
- **Wiring**: a `MutationObserver` on `#content` (subtree), batched via requestAnimationFrame. `TS_BUSY` plus `takeRecords()` stop the observer reacting to its own reorder. Tables are marked `data-ts=1` once processed.

### 2.9 Fix Finder ranking (ff*) — step by step
1. **Index** (`ffIndex` l.6300, cached by signature: breakdown count, problemGroups, excluded IDs). For each non-PM, non-excluded entry with a valid date:
   - `ps` = the set of stemmed tokens of the problem. `as` = the same for the corrective action.
   - Document frequency `df[stem]` is counted over the union of ps and as.
   - Group `g` = `probClassify` (same keyword groups as A10).
   - `h` = effH.
   - `parts` = spare1..3, trimmed, dropping values matching /^(no|nil|na|n\/a|none|not|-+)/i.
   - `at` = action type (`ffActType`).
   - `vocab` = all stems.
2. **Tokenise** (`ffToks`): lowercase, split on non-alphanumeric, keep length ≥2, not numeric, not in `FF_STOP`. FF_STOP = PW_STOP + {problem, issue, issues, not, working, work, fault, trouble, machine, machines, please, need, how, fix, fixed}.
3. **Stem** (`ffStem`): lowercase. If the length is >5, remove one suffix matching /(ing|ation|age|ed|es|ion|ly)$/. Else if the length is >3, remove a trailing "s".
4. **Expand each query term** (`ffTerms`), for each unique query stem s:
   - cand ∋ s if s is in the vocabulary.
   - Synonyms: if s is in an `FF_SYN` class, add every stemmed class member that exists in the vocabulary. The 14 classes are:
     - stuck/jam/jammed/struck/stucked/lock/locked
     - noise/noice/sound/vibration/vibrat
     - leak/lekage/leakge/dripping/drip/seepage
     - overload/ol/overcurrent/overheat/heating/hot
     - alarm/alram/error/fault
     - coolant/colant/coolnat/cooling
     - clamp/unclamp/declamp/clamping
     - atc/toolchange/changer
     - broken/break/broke/damage/damaged/cracked
     - accident/acceident/crash/collision
     - geometry/geomatry/geometr
     - power/voltage/supply/mains
     - slow/sluggish
     - stop/stopped/halt/shutdown
   - Fuzzy, only if s has ≥4 characters:
     - Max edit distance mx = 0 if len ≤ 5, 1 if 6–7, 2 if ≥ 8.
     - For each vocabulary stem v: if both are ≥5 characters and one is a prefix of the other, add v.
     - Else if mx>0, the first letter matches and the banded Levenshtein `ffLev(s,v,mx)` ≤ mx, add v. If s itself is not in the vocabulary, remember the most frequent such v as `fixed` (shown as "read as").
   - idf = ln(1 + N / clamp(Σ df(cand), 1, N)), or 0 if there are no candidates. Terms with idf>0 are "live".
5. **Query group**: `probClassify(query)`. It is used if it is not Other. If there are no live terms and no group, the result is "none".
6. **Score each entry**: for each live term, if any candidate is in the problem stems, add idf. Else if any is in the action stems, add 0.6×idf.
   - r = sc / Σidf(live).
   - If the entry's group = the query group, r = min(1, r + 0.25), or + 0.6 when there are no live terms (group-only query).
   - Keep r ≥ 0.30. Sort by r desc, then date desc.
7. **Relevance cut** (`renderFixFinder`):
   - best = top r. thr = max(0.35, 0.6×best).
   - rel = hits ≥ thr, capped at 80, scoped to the chosen category if only a category was picked. With a machine, all plant hits are used.
   - Buckets: own (same machine), cat (same category, other machines), rest.
8. **Fix aggregation** (`ffFixes`):
   - Group rel by action type.
   - Weight w = Σ(r × 2 if same machine, else r).
   - Also track n, total h, machines, own count, parts frequency (lowercased) and latest date.
   - Drop "Other / various actions" unless n ≥ 2.
   - Top 5 by w.
9. **Action types** (`FF_ACT` l.6284, first regex match wins, on the lowercased corrective action):
   1. Routine PM work: `\bpm\b`
   2. Vendor / OEM / warranty support: `service engineer|warrant|vendor|\bho team\b|gcm|cipl|\boem\b|supplier|fanuc|siemens|company`
   3. Replaced a part: `replac|spare|interchange|\bnew\b|\bchanged?\b (the|old|broken|motor|pipe|belt|card|fuse|filter|sensor|switch|cable|seal|bearing|coil|valve|relay|proxy|it|with)|\bchanged\b|\bchange (the|old)`
   4. Reset / restart: `reset|re-?start|reboot|switch(ed)? off|power off|power cycle`
   5. Parameter / PLC / program setting: `p[ae]r[ae]m[a-z]*|\bplc\b|program|ladder|\bbit\b|offset|setting|forcefully|m-?code|\bset\b|correct`
   6. Cleaned / flushed / unblocked: `clean|clening|flush|blow|unblock|drain|scrap|screap|chip|dust|dirt`
   7. Tightened / adjusted / aligned: `tight|adjust|all?ign|alling|loose|proximity|sensor|limit switch|position|roller`
   8. Topped up oil / lubricated: `top up|topup|top-up|lubric|\blub\b|grease|\boil\b`
   9. Bypassed / temporary workaround: `bypass|by-pass|temporar`
   10. Repaired in-house: `repair|reparied|reparing|solder|braze|wiring|\bwire\b|cable|joint|connect|weld|coonection`
   11. Calibrated / re-set geometry: `geometr|geomatr|calibrat|backlash|centre|center|taper|homing|\bhome\b`
   12. Manual release / manual operation: `man+ually|manual`
   13. Checked, no fault found: `no (any )?(issue|problem|fault)|not found|checked|\bcheck\b|normal|\bok\b`
   Otherwise "Other / various actions".
10. **Cause snippets** (`ffSnips`):
    - Regex `(found that|found|due to|because of|because|caused by|cause was)\s+([^.;,&]{4,70})` on the action, with leading articles stripped. The phrase is stemmed.
    - Greedy clustering with Jaccard ≥ 0.4 against existing clusters. The cluster's token set grows by union.
    - Top 5 by count.
11. **Highlight** (`ffHi`): each alphanumeric token of the text whose stem is in any live candidate set is wrapped in `<mark>`.
12. **Summary stats**: nRel, median and mean hours, last date, confidence bands (≥12, ≥5). The repeat note uses own hits ≥ thr.

---

## 3. Data entities & fields read/written

**Breakdown entry (`state.breakdowns[]`)**
- Read: id, date (dd-mm-yyyy or dd/mm/yyyy string), shift, machineId, problem, correctiveAction, maintCode (PM, NO DT, HUM, other codes), electMech, downHrs, doneBy (comma list), supportedBy (comma list), whyWhy (truthy = done), spare1..3, cost1..3.
- Nothing in range writes to entries.

**Machine (CNC, `state.machines[]`)**
- id, segment, category, make, model, serial, assetCode, year, datePurchase (ISO yyyy-mm-dd), power (KVA), location, cell, conveyor, length, width (mm), controller, ctrlModel, ctrlSerial.

**Other asset arrays**
- `state.convMachines`, `procMachines`, `utilMachines`, `dgMachines` (DG uses capacityKva). Fields are the same, minus the CNC-only ones.

**Cell change log**
- Via `cellLogFor(id)`: date, fromCell, toCell, fromLocation, toLocation. `getEffectiveCell(machineId, date)` resolves the cell at a given date.

**Settings (`state.settings`) read**
- prodHrsPerDay, workDaysPerYear, efficiencyFactor (default 15), whyWhyThresholdHours (default 24), cells[], codes[] ({code, description}, description split on '—'), team[] ({name, type, status 'Inactive'}), excludedMachines[].

**Settings written**
- `settings.ac` (rule limits), `settings.acAcks` {key: {status, owner, due, note, at, until}}, `settings.problemGroups` [{n, f, k}].
- Report notes are keyed 'm{y}-{mo}' / 'y{y}' (written via repNotesBlock, outside range).
- Persistence: `persist()` (AC) and `saveStateToDB()` (problem groups).

**In-memory UI state (not persisted)**
- acUI {tab, sev, type, q, rules, openKeys}, acCache, repSel {m, y}, assetKind/assetId/assetFrom, mdetailId/mdetailFrom, bnSel/bnDur/bnCustom/bnAll, probMerge/probMetric/probWhatG/probWhatPct/probDraft/probCache/probQ, TS_STATE, ffQ/ffM/ffC/ffShowAll/ffCache, window._probL, window._acT.

**Exports**: XLSX via the global `XLSX` (SheetJS). The generic `setExport` + `exportDrill` pair is outside range.

**Navigation targets used**: nav('ac'|'asset'|'mdetail'|'drill'|'robots'|'cmp'|'ff'|'tf'|'mm'|'dashboard'|'a10'), openDrill('age'|'prob'), openWhyWhyForm, openCompare, repBack.

---

## 4. Workflows & business rules

- **Nudge lifecycle**:
  - States: open → Acknowledge (ack), Snooze N days (snoozed until now + snoozeDays), or Resolved (done). Each records owner, due and note from the inline form plus a timestamp.
  - **Reopen** deletes the ack record.
  - **Automatic reopen**: if a newer entry contributes to the nudge (latest entry date > ack date), it returns to Open with a "new activity" flag.
  - An expired snooze silently returns to open.
  - Good-news nudges (info) cannot be acknowledged.
  - The ack is keyed by a deterministic nudge key (rule + machine/code/cell/bdId/shift/person), so it persists across days while the condition remains.
- **Thresholds are per tenant** and editable in-app with a reset. Labels explain every limit (a Guide section exists elsewhere).
- **Why-Why link**: long breakdowns over `whyWhyThresholdHours` without a Why-Why raise a nudge with a direct "Open Why-Why" action. Reports count long breakdowns too.
- **Production data vs watched**:
  - Machines "excluded" in Settings (robots) are left out of all plant metrics.
  - The Action Center still evaluates machine-level rules on them (recur, freq, rise, cell, long, mttr, newm, spares use `E`/`BD`, which include excluded machines) and flags those nudges "Not in production data".
  - Plant-level rules (spike, hum, shift, team, age, the mttr fleet average) use production data only.
- **NO DT**: counts as a breakdown occurrence with 0 hours everywhere. It is excluded from the recur and cell rules.
- **PM**: excluded from breakdowns. It is reported separately (PM hours/visits). PM entries mis-coded as breakdowns are detected via the "PM logged as a breakdown" keyword group.
- **Reports**:
  - The month in progress compares with the same number of days of the previous month. The year in progress compares with the same span of the previous year.
  - Reports are printable (no-print picker, `{pb:true}` page breaks) and carry per-report free-text notes.
  - Table sorting is disabled on report pages.
- **Shared jobs**: a breakdown counts for every person named in Done By, so shares can exceed 100%. Team rows show attended counts in neutral colours (workload is not judged as good or bad), while hours rising are shown in red.
- **Problem keyword learning loop**: un-grouped words are surfaced and one click adds them to a group, which re-classifies immediately and persists. The full editor allows reorder, add and delete, with reset to the standard list.
- **Multi-day repair merge toggle**: a data-quality aid. A repair logged daily as separate entries is counted once (same machine, same normalised problem, gap ≤3 days).
- **Fix Finder principle**: "Nothing is invented: every result is a real log entry". Results are scoped machine → category → plant, the chosen machine's cases count double in fix ranking, and the page shows explicit confidence labelling.
- **Bottleneck simulator assumption**: every machine of a category is fully loaded, so an outage's share of category capacity is lost.

---

## 5. Hard-coded / tenant-specific assumptions to make configurable

1. **Company name** "COSMOS ENGITECH PVT. LTD." in the AC and Problem exports, and the `Cosmos_*` file-name prefixes (AC, Age drill, Bottleneck, Problem, Problem drill).
2. **Maintenance code semantics**: 'PM', 'NO DT', 'HUM' are hard-coded literal codes (HUM drives the human-mistake rule). These need a code → semantic-role mapping (preventive, no-downtime, human error).
3. **Machine classification**:
   - Robots are detected by category /^robot/i (`isRobotCat`, Fix Finder category filter) in addition to the excluded list.
   - "CNC" is the only breakdown-tracked asset kind. The asset kinds (CNC, Conventional, Process, Utility, DG Set) are fixed.
4. **Date format**: dd-mm-yyyy strings are parsed in several places (`bnParse`, `ddmmyyyyToDate`, `tsDate`). Purchase dates are ISO. Weeks run from asOf back and are not calendar weeks.
5. **Language**: every keyword list is English or Hinglish with plant-specific misspellings:
   - PG_DEFAULT, PW_STOP, FF_STOP, FF_SYN, FF_ACT, and the cause-phrase regex (found, due to, because).
   - Tokenisation is `[^a-z0-9]`, which drops all non-ASCII text (Devanagari or Marathi entries would be invisible).
   - The stemmer is English-suffix based.
6. **Vendor names in FF_ACT**: 'gcm', 'cipl', 'ho team', 'fanuc', 'siemens', 'company'. These are tenant-specific vendor and OEM identifiers.
7. **Machine-type vocabulary**:
   - Keywords assume CNC machining centres and lathes (ATC, turret, 4th axis, FSSB, SV0 alarms, the "1001" spindle alarm, KMT, CTS).
   - The spindle group's "1001" is a controller alarm number that is probably Fanuc-specific.
8. **Thresholds that are not in AC_DEF and should be**:
   - freq high = 1.5 × freqMin; recur high = 3 days or consecutive.
   - cell high ≥4 machines.
   - long high ≥ 2×thr.
   - spike high ≥ 2× average; good news ≤ 0.6× average and fresh ≤ 2 days; the 4-week baseline.
   - The 30-day window, n ≥ 10 and n ≥ 20 for the 30-day patterns.
   - hum high ≥ 2× share.
   - newm high ≥ 4.
   - spares ≥ 2 entries.
   - age 2× fleet average, and the look-back reusing mttrDays.
   - Risk weights.
9. **Report thresholds**:
   - ±10% downtime/count, ±15% MTTR, ±15 hrs per cell, 15% top-machine share, 30% top-cause share, ≥6 breakdowns, PM ×3 or ÷3, top 5 / 2 of 3 months.
   - Annual: ≥3 months in the top 5, 20% cause share, worst age band with ≥3 machines.
10. **Age bands** 0-5 / 5-10 / 10-15 / 15-20 / 20+ are duplicated in `ageBandOf` and the annual report.
11. **Bottleneck constants**: L saturation at 4× fleet, 50/50 weights, the Critical/High/Watch cut-offs 55/40/30, peers ≤ 10, the default custom outage of 24 h, and the top-20 list.
12. **Problem Analysis constants**: quick stop ≤ 0.5 h; repeat ≥ 4; multi-entry ≥4 or (≥3 and ≥20 h); merge gap 3 days; normalised problem key of 30 characters; Pareto top 16; words top 14; the what-if default 50% step 5.
13. **Fix Finder constants**: action weight 0.6; group boost 0.25 / 0.6; min r 0.30; thr max(0.35, 0.6×best); cap 80; own weight 2×; confidence 12/5; edit distances by length; snippet Jaccard 0.4; the TRY chips (CNC-specific examples).
14. **Currency** "Rs" in the spares nudge. The ₹ symbol is handled in `tsNum`.
15. **Efficiency factor** default 15% (running load estimate). The availability basis is prodHrsPerDay × workDaysPerYear, spread evenly.
16. **Shift labels** are rendered as "Shift X" (they assume shift codes like A/B/C).
17. **Group name coupling**: `pmLike` finds the PM group by its literal name 'PM logged as a breakdown'. Groups should carry a stable ID or role flag.

---

## 6. Bugs, hacks, fragile logic

1. **Index-based actions in the Action Center**: `acSet(idx)`, `acReopen(idx)` and `acToggle(idx)` index into `acCache.list`. That list is recomputed by every `acCompute()` call, including `acRefreshBadge`/`acBanner` from other pages. If the data or date changes between render and click, the wrong nudge can be acted on. Use keys instead.
2. **Reopen check uses day granularity**: an entry dated the same day as the acknowledgement never reopens a nudge (`ev > at` with at truncated to midnight, and ev is a date-only value).
3. **Expired snooze** returns to "open" without a "reopened" marker, and ack records are never garbage-collected (`settings.acAcks` grows forever).
4. **Risk-score description mismatch**: the UI says "high counts 3, medium 2, low 1", but aggregated nudges count 1 regardless of severity (a high HUM nudge counts 1).
5. **"rise" action text** says "at least doubled" even when riseMult is changed.
6. **Ageing rule** reuses `mttrDays` as its look-back window. Its 2× multiplier is not configurable. The average divides by all non-robot machines, including those with zero hours (an intentional fleet average, but undocumented).
7. **Excluded machines inside machine rules**:
   - The `spares` total includes excluded machines' spend, which skews the shares.
   - The `mttr` rule compares any machine (including robots) against a production-only fleet average.
   - The `newm` rule iterates `state.machines`, including excluded machines, and counts NO DT entries.
8. **Robot drill-through is empty**: AC nudges can involve excluded (robot) machines, but `openMachineDetail` uses `filterBD` (which excludes them), so clicking a robot chip shows "0 breakdowns".
9. **XSS / HTML injection**:
   - AC titles interpolate machine IDs, codes and code descriptions unescaped (`${mid}`, `cdesc(code)`, the cell name). Some details are unescaped too (the spares and mttr details use mid unescaped).
   - The spike detail uses `esc` inconsistently.
   - `eyeBtn` builds `onclick="openAssetDetail('kind','${esc(id)}')"`, so an ID with an apostrophe breaks it.
   - The asset and machine detail links use `'${esc(m.id)}'` similarly.
10. **Search input hack**: the AC search re-renders the whole page on every debounced keystroke and then restores focus and caret by ID.
11. **Annual report data issues**:
    - A YTD on 29 Feb gives `new Date(y-1,1,29)` = 1 Mar.
    - `hasPrev` ignores PM, unlike the monthly report.
    - `pendingWW` is not filtered by `!whyWhy` (the name misleads; it lists all long breakdowns). It sorts by rawH, which includes NO DT hours, while tiles use effH.
    - `noPm`, `gaps`, `missingAge`, `missingDim`, `yNo` (partly), and `cNo` in the monthly report are computed but unused (dead code).
12. **Long-breakdown definitions are inconsistent**: `repStats.long` uses raw downHrs > thr (NO DT with hours qualifies), while the AC long rule uses effH > thr.
13. **Two availability models**:
    - Reports use `availSum`/`periodFrac` (annual ÷ 12 per month, purchase-date aware).
    - Bottleneck uses calendar days × (ph×wd/365) from **Jan 1 of the earliest data year**. If logging started mid-year, availability is inflated for every machine.
    - `new Date(m.datePurchase)` parses ISO as UTC.
    - The A10 what-if uses availability for `dataYear()` only, while P.tot covers all years of data. With multi-year data the availability and MTBF what-if numbers are wrong.
14. **Age inconsistency**:
    - A8's `ageBandOf` uses `computeAge` (purchase date only), so machines with only a year fall into "Unknown".
    - The annual report and AC use `machineAge` (with a year fallback), so the same machine can land in different bands on different pages.
    - A8 mixes `calcAnalytics3().byAge` labels (KPIs/combo) with `ageBandData` bands (mix chart). The "Unknown" band may be missing from the labels.
15. **Cell counts**: annual `cellRows` counts machines by the current `m.cell`, while hours use the effective cell at the breakdown date. These are inconsistent after moves.
16. **Cache signatures** for probCalc and ffIndex cover only `breakdowns.length`, settings and exclusions. Editing an entry's text, hours or code without changing the count leaves stale results until reload or another change. Machine category edits are not covered either.
17. **Keyword pitfalls**:
    - Substring keywords over-match: `conv` matches "conventional"; `shift` (installation group) matches "shift A"; `index`, `limit`, `error`, `light`, `drive`, `program`, `center`, `reference`, `switch`, `chain`, `oil`/`air` (whole word) and so on.
    - Group order decides the result ("Coolant pressure" catches all generic coolant text before "spindle").
    - The `pm` group can catch "pm" text in the problem.
    - Keywords containing regex characters are escaped (good). Keywords with spaces are always substring matches.
18. **probAddWord** silently discards any unsaved editor draft (`probDraft=null`). It also materialises the full default list into settings, so future default-list improvements will not reach this tenant.
19. **Problem merge** uses the first entry's classification and text. probNorm truncates to 30 characters, so different long problems with the same prefix merge.
20. **Fix Finder quirks**:
    - The stop-list conflicts with the synonyms. FF_STOP contains 'fault', 'stop', 'stopped', 'change', 'not', 'working', so the alarm class's 'fault' and the stop class's 'stop'/'stopped' can never match. "tool change" queries lose 'change'.
    - The stemmer is inconsistent: 'vibration' → 'vibr' but 'vibrat' → 'vibrat'. 'leakage' → 'leak' and 'lekage' → 'lek'.
    - With a machine selected, `rel` = all plant hits. The own/cat/rest filter union is the whole list, and the "if rel<5" fallback is a no-op. Machine scoping affects only the 2× weight and the section split.
    - `renderFixFinder(keep)` ignores its parameter.
    - `ffGo` uppercases the machine ID, which assumes upper-case IDs.
    - FF_ACT order effects: e.g. "sensor replaced" → "Replaced" (fine), but "checked and replaced" also → Replaced, and any action containing "company" → Vendor.
21. **Table sort**:
    - A table is marked `data-ts` even when ineligible, so if it later gains rows it is never enhanced.
    - Sorting moves DOM rows. Any handler that relies on row index would break (current handlers use IDs).
    - The type sniffing threshold of 70% can misclassify mixed columns.
    - `TS_TOTAL` matches a first cell starting with "all" or "plant" (e.g. a machine named "Plant-1" would be pinned).
22. **Performance**:
    - `acCompute` runs on every badge refresh, banner and render.
    - `bnCompute` is recomputed in full on every simulator change.
    - `Math.max(...array)` spreads over all entries (stack limits on very large logs).
    - `ffTerms` scans the whole vocabulary per term with Levenshtein.
23. **Dates**: local-time `new Date(y,m,d)` throughout. `age()` uses Math.round on ms differences (DST-safe enough in IST, fragile elsewhere).
24. **Bottleneck page** appends `fcHtml`/`trHtml`/`rfHtml`, cards from a different feature area (outside range), which couples them.
25. **Back navigation** is a hand-written `if` chain per origin page (`backToDashboardChart`, `renderAssetDetail`). It is brittle when pages are added.

---

## 7. Clever ideas worth preserving

1. **Action Center as an explainable rule engine**:
   - Every nudge carries a title, numeric evidence, a plain-language suggested action, the underlying entries (drill-through table) and the team involved.
   - Deterministic keys enable acknowledge, snooze and resolve with owner, due date and note.
   - **Auto-reopen on new evidence**.
   - A **machine risk ranking** aggregated from open nudges.
   - User-tunable limits with plain-English labels.
2. **"Good news" nudges** guarded by data freshness (≤2 days), so a missing log does not look like improvement.
3. **"Production data" vs "watched"** separation: robots and excluded assets stay out of KPIs but are still monitored.
4. **Fair period comparison**: a month to date is compared with the same days of the previous month, and a year to date with the same span of the previous year. The reference full-month figure is shown too.
5. **Narrative report generation**: automatically written "What went well / Concerns / Needs attention", takeaways and recommendations from explicit thresholds. Repeat offenders across months, the concentration (50%) rule, and neutral colouring for workload metrics.
6. **The 50%-of-hours highlight** on the machine detail (Pareto inside a single machine).
7. **Machines-added fleet tracking** by purchase date in both reports (start, added, end by category).
8. **Bottleneck score** combining relative unavailability (vs fleet, capped at 4×) and redundancy (1/√peers). The sole-machine Critical override, "effective machines" = Σ availability, capacity-left-if-down, and a **what-if outage simulator** with typical/longest/custom durations and covering machines.
9. **Lane-based risk map**: categories as rows (smallest first), unavailability on x, a fleet-average line, deterministic jitter, and labels only for Critical/High.
10. **Keyword problem taxonomy with families**: a two-pass match (problem first, then action), short keywords as whole words, ordered priority, an in-app editor, and a **"words not yet recognised" learning loop** that turns unclassified text into keywords with one click.
11. **Data-quality self-diagnosis**: multi-day repairs logged daily (with a merge toggle), PM logged as breakdowns, blank codes and E/M, and the un-grouped share.
12. **"Often or long?" bubble chart** separating nuisance stops from long rare failures, plus quick-stop vs top-N-event analysis.
13. **What-if fix savings**: removing X% of a problem group recomputes availability and MTBF.
14. **Fix Finder**: a typo-tolerant, synonym-aware TF-IDF-like search over the plant's own log, with problem-vs-action weighting, a problem-group boost, and scoping machine → category → plant.
    - It shows "What I understood" with spell-correction display, confidence labelling, and fixes ranked by action type (own-machine cases count double) with parts used.
    - **Cause-phrase mining** ("found / due to / because") clusters by Jaccard.
    - It never invents anything; every row is a real entry. This would also be a good retrieval layer for an LLM in the SaaS.
15. **Universal table sorting** via MutationObserver: type sniffing (number/date/text), pinned total rows, stable sort, and sort state remembered per table across re-renders.
16. **Asset record completeness score** and an estimated running load from connected load × efficiency factor (DG sets are never counted as load).
