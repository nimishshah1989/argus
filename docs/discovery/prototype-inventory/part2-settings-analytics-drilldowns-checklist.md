# Cosmos Platform — Functional Inventory, Part 2
Source: `/mnt/user-data/uploads/cosmos_platform.html`, lines 2559–3472 and 3809–4900 (Guide 3473–3808 skipped). Every line in range was read. Helpers that are called here but defined elsewhere are listed with their line numbers so the reader can cross-reference; their bodies are covered by other parts. Line numbers are cited as `L####`.

Helpers used throughout (defined outside the range): `persist` L599, `genId` L607, `toISODate`/`fromISODate` L626/634, `machineYear` L676, `cellLogFor` L718, `getEffectiveCell` L722, `cellKey` L751 (anything not in `settings.cells` → `'—'`), `cellName` L752 (`'—'`→"No cell", otherwise "Cell X"), `cellsEff` L753, `machFrac` L771, `availSum` L775, `isExcluded`/`nonRobotMachines` L809/811 (despite the name, "nonRobot" now means "not excluded in Settings"), `annualHoursPerMachine` L815 (= prodHrsPerDay × workDaysPerYear), `availWin`/`availSwitchHtml` L827/839, `isPM` L852 (code trimmed and upper-cased = `PM`), `isNoDT` L853 (= `NO DT`), `filterBD` L860, `sumHrs` L883 (NO DT contributes 0), `calcAnalytics1/2/3` L894/946/1000, `nameInField` L1140, `calcEnergyHeatmap` L1153, `kpi` L1367, `mkChart` L1374, `PALETTE` L1393, `machineAge` L1516, `effH`/`rawH` L3805/3806 (effH = 0 for NO DT, otherwise downHrs; rawH = downHrs), `drill`/`drillExport`/`bubF`/`MONTHS12` L3801–3804, `acJ` L5040, `eyeBtn` L5471, `openMachineDetail` L5595, `drillAge` L5722, `drillProb` L6130, `renderA7` L7524, `previewSettingsSync` L8024.

---

## 1. Screens and pages in range

### 1.1 Settings page — `renderSettings()` L2559–2645
These cards appear in this order:
1. **Backup & Restore.** "Export to Excel" (`exportToExcel()`) and "Restore from Excel (replaces everything)" (hidden `.xlsx` file input → `importFromExcel(file)`). The description says the export covers CNC Machines, Conventional Machines, Breakdown Log, Cell Change Log and Settings.
2. **Machines Not Counted in Production Data** (`exclCardHTML()` L4630). A dropdown lists the machines that are not yet excluded, sorted by numeric-aware ID, shown as "ID — category · model", with an **Add** button. Excluded machines show as grey badges ("ID · category") with a red × to remove. When nothing is excluded the card reads "No machine is excluded…".
3. **Production Parameters.** Production Hours/Day (`s_prodHrs`), Working Days/Year (`s_workDays`), and a read-only computed field "Total Annual Production Hours = N hrs / machine / year". The card says this drives every MTTR / MTBF / BD% figure.
4. **Energy Parameters.** Efficiency Factor (%) (`s_efficiency`, 0–100) and a read-only worked example: "a 20 KVA machine's Running Load = 20×eff/100 KVA".
5. **Why-Why Analysis Settings.** Threshold in hours (`s_whyWhyThreshold`, min 0, step 0.5).
6. **Sync Settings from Excel.** A file picker that calls `previewSettingsSync(file)` (L8024, outside range). It reconciles Segments, Categories, Shifts, Locations, Cells, Breakdown Categories, Team Members and Maintenance Codes against an Excel "Settings" sheet (adds what is missing, removes what is gone) and shows a preview before applying. It never touches the machine master or the breakdown log.
7. **Simple list managers** (`listManagerHTML` L2667), shown in a grid. Each has a title, items with ×, a text input (Enter adds) and "+ Add". There are nine lists: `segments` (Machine Segments), `categories` (Machine Categories), `shifts`, `locations`, `cells`, `breakdownCategories` (E, M, E/M, PM…), `convCategories`, `procCategories`, `utilCategories`.
8. **Team Members & Vendors.** List rows show the name in bold, a type badge (Vendor amber, Team blue) and an "Inactive" badge when inactive, plus a Deactivate/Reactivate link and ×. The add row has Name and Type (Team/Vendor) inputs and "+ Add". Inactive members stay in history but drop out of new-entry dropdowns. That filtering happens elsewhere; the Why-Why form in this range does **not** apply it (see §6).
9. **Maintenance Code Reference.** Rows show the code in bold accent and the description, with **Edit** (inline: code input, description input, Save, Cancel) and ×. The add row has a Code input (upper-cased on save) and a Description input. The card notes that code "PM" is always treated as Preventive Maintenance.

### 1.2 A1 — BD % & PM Split — `renderA1()` L2809–2889
- **Year handling:** years come from breakdown dates. `a1Year` defaults to the current year; if the data has no entries for it, it falls back to the latest year present.
- **Availability-basis switch** (`availSwitchHtml`): "Days so far" (elapsed, the default) vs "Full year". The choice persists in `settings.availBasis`.
- **Six KPI tiles:**
  - Avg Available Hrs / Machine (`a.effHrs`, subtitle shows the availability label and the annual hours from Settings)
  - Total Machines
  - Total Available Hrs
  - Actual Breakdown (hrs and BD% of available)
  - PM Downtime (hrs and PM%)
  - Fleet Availability = `1 − bdPct − pmPct`
- **Chart "Breakdown % vs PM % by Cell":** grouped bar chart, BD% in red and PM% in amber, values rounded to 2 dp, y-axis ticks end in "%".
- **Table "By Cell — Detail":** Cell | Machines | Available Hrs | BD Hrs | BD % | PM Hrs | PM % | Total %.
  - Available hours are prorated by the cell-move log.
  - "Machines" is today's count.
  - Machines with no cell, or a cell not in Settings, appear as "No cell".
- **Month-on-Month Trend:** a year selector (`a1YearSel`) and a line chart of plant BD hours vs PM hours per month (filled, tension 0.3).
- **Matrix "Month-on-Month — BD Hours by Cell (year)":** each cell–month shows hours plus that cell-month's share of the year's total BD hours (`row[m]/yearTotalBD*100`, 1 dp). A row Total column follows; empty months show "—".
- **Matrix "Month-on-Month — PM Hours by Cell":** hours only, plus Total.

### 1.3 A2 — By Category & Cell — `renderA2()` L2898–2958, `renderA2Detail()` L2960–2979
- There is no year selector; it uses `calcAnalytics2()` with no arguments.
- **Eight bar charts:**
  - BD Hours by Category (PALETTE colours)
  - # Breakdowns by Category
  - Avg BD Hours per Machine by Category
  - Avg # Breakdowns per Machine by Category (`count/machines`)
  - The same four by Cell (purple and cyan)
- **Tables "By Category — Detail" and "By Cell — Detail":** Category or Cell | Machines | # Breakdowns | BD Hours | % of Total BD | Avg Hrs/Machine | Avg Hrs/Breakdown.
- **Machine-Level Detail:** pill toggle "By Category" / "By Cell" (`a2DetailMode`). There is one table per non-empty group: Machine ID | Cell (category mode) or Category (cell mode) | # Breakdowns | BD Hours | % of Total BD (category mode) or % of Cell BD (cell mode), sorted by hours descending.
  - In cell mode, a machine whose in-cell count differs from its overall count shows a sub-line: "moved in during the year" (when it is currently in this cell) or "now in Cell X", followed by "N hrs overall".
  - If the machine is currently in a different cell, it shows "now in Cell X".
  - A note explains that cell-mode rows add up to the cell total.

### 1.4 A3 — MTTR & MTBF — `renderA3()` L2997–3142, `renderA3MachineTable()` L3144–3156
- Year selector (`a3YearSel`) and the availability-basis switch.
- **Bar charts:** MTTR by Category (red), MTBF by Category (green), the same pair by Cell, and the same pair by Machine Age Band (MTTR amber).
- **Tables "By Category", "By Cell" and "By Machine Age Band":** Group | Machines | # Breakdowns | BD Hours | MTTR (Hrs) | MTBF (Hrs).
- **Matrix "Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide":**
  - Each cell takes two rows: MTTR (red, 2 dp) above MTBF (green, 1 dp).
  - Columns: 12 months, then Q1–Q4 Avg, then "Total {year}".
  - The row label shows "MTTR / MTBF · N breakdowns". Rows alternate shading.
  - A PLANT TOTAL pair of rows comes last.
  - The description states: monthly available hours = annual ÷ 12, with the running month prorated when "Days so far" is selected; Total MTTR = BD hours ÷ breakdowns; Total MTBF = (annual available hours − BD hours) ÷ breakdowns; a machine that moved cells counts in each cell only for its time there.
- **Matrix "Month-on-Month MTTR & MTBF — Age Band-wise and Plant-wide":** the same layout by age band, plus the plant rows.
- **Plant trend chart** (`ch-a3-planttrend`): two lines on dual y-axes, Plant MTTR on the left (`y`) and Plant MTBF on the right (`y1`). `spanGaps:false`, so months with no data break the line.
- **"By Individual Machine" table:**
  - A search box filters by machine ID substring.
  - Sort options: BD Hours desc, MTTR desc, MTBF asc ("worst first"), # Breakdowns desc.
  - Columns: Machine ID | Category | Cell | # Breakdowns | BD Hours | MTTR | MTBF.

### 1.5 Heat-grid components (in the "ui_a4" section; A4 Manpower itself renders elsewhere) L3163–3224
- `a4Year` and `a4SpecMode='category'` are declared here as state for A4, which renders outside this range.
- `renderHeatGrid(groups, unitLabel, opts)` draws a tile per group:
  - The label (`'—'` shows as "No cell").
  - The big value: total Connected KVA (1 dp), with the line "Connected {unit}".
  - Optionally "Running: X KVA".
  - "N machines · avg X".
  - Groups with 0 machines render as an empty tile reading "No machines".
  - The tooltip either lists the machine IDs or, when the tile is clickable, says "N machines — click to see each machine".
  - With `opts.drillType` set, a click calls `drillA5(type,key)`.
  - Below the grid is a min–max legend bar in KVA.

### 1.6 A5 — Energy Heatmap — `renderA5()` L3366–3400
- **Overview, three cards:**
  1. "Load by Cell — Connected & Running" (drills into the cell).
  2. "Load by Location — Connected & Running" (drills into the location).
  3. "Avg Connected KVA per Machine — by Cell", a normalised grid that uses `avgKva` as the tile value, with no running line and no drill.
  - The description shows the current efficiency factor.
- **Drill view** (`a5Drill` set): a "← Back to overview" button (`clearA5Drill`) and the card "Machine-wise Load — {Cell X | Location Y}", with one tile per machine (connected and running KVA). Built by `renderMachineDrillGrid` L3216.

### 1.7 A6 — Why-Why (Root Cause) Analysis — L3226–3364
- **Page** (`renderA6` L3238): the header gives the threshold and "X of Y completed".
- **Table:** Machine | Date | Problem (ellipsised, full text in the tooltip) | Down (Hrs) | Status badge (Completed green / Not Started amber) | action buttons.
  - The action button reads "Start Why-Why" or "View / Edit"; there is also a "PDF" button when the analysis is complete.
  - The empty state reads "No breakdowns currently exceed the X hr threshold".
- **Modal** (`openWhyWhyForm` L3267):
  - Header: machine ID, then category, cell, date and down hours, then the problem text.
  - Fields: textareas Why #1 ("Why did this breakdown happen?") through Why #5; Root Cause / Conclusion (required, marked *); a Completed By dropdown listing every `settings.team` name.
  - Buttons: Cancel, "Save Why-Why Analysis".
- **PDF** (`downloadWhyWhyPdf` L3318): jsPDF, A4 portrait in mm.
  - Title "WHY-WHY (ROOT CAUSE) ANALYSIS" and the subtitle "Cosmos Engitech — generated from the maintenance platform", followed by a rule.
  - Fields in order: Machine (with category and cell); Date and Down Time side by side; Problem Description; rule; Why #1–#5; rule; Root Cause / Conclusion; Completed By; Completed Date.
  - Empty values print as "—".
  - Filename: `WhyWhy_{machineId}_{date}.pdf`.

### 1.8 A7 Footprint helpers (render function `renderA7` is at L7524, outside range) L3402–3471
These are the computation and tooltip helpers (see §2.9). UI state: `fpClear` (clearance in metres, default 1) and `fpLayout` ('compact' | 'category'). `fpShowTip` places a floating tooltip (`#fpTip`) from the `data-fp` attribute and flips it left when it would overflow.

### 1.9 Drill-down system — L3809–4315
- **`openDrill(kind, params)` L3809:**
  - Sets `drill = {kind, p:params, f:{q,month,cell,cat,code,date,sort}}`, merging any `params.f`.
  - Navigates to page `drill` and scrolls to the top.
- **`drillSetF(k,v)` L3814:**
  - Sets a filter.
  - A `sort` change also resets the table-sort state `TS_STATE`.
  - A `q` change re-renders only the body, so the search input keeps focus; anything else re-renders the whole drill page.
- **`gotoList(page, selId, cat)`:** navigates to a list page and programmatically sets its category filter select, firing `change`.
- **`drillTop(title, desc, note)` L3828:**
  - A Back button whose target is `drill.p.back` (default dashboard). The label maps machines → "CNC Machines", a8 → "Age Analysis", a10 → "Problem Analysis", anything else → "Dashboard".
  - An "Export to Excel" button.
  - A title card with a description and an optional "How it is calculated:" note box. This explicit formula disclosure appears on every drill page.
- **`exportDrill()` L3821:** writes an `.xlsx` with one sheet "Data". Rows: `['COSMOS ENGITECH PVT. LTD.'], [title], [], header, ...rows`. Filename `{name}_{YYYY-MM-DD}.xlsx`. The data comes from whatever the last `setExport(name,title,header,rows)` call registered.
- **`renderDrill()` L3837** dispatches by kind:
  - `ctrl`, `make`, `age`, `fleet`, `year`, `avail`, `bdpct`, `daily`, `permachine`, `bdfree`, `prob` each have their own renderer.
  - Anything else (`bdcount`, `downtime`, `pm`, `nodt`) goes to `drillEntries`.
  - Page titles come from map `T`. `age` is missing from the map, so it shows "Details".
  - Subtitle: "Drill-down from CNC Machines" (ctrl/make), "from Problem Analysis" (prob), otherwise "from the Dashboard".
- **Shared renderers:**
  - `drillMachineLink(id)`: clickable ID that opens machine detail, plus an eye icon that opens the machine card.
  - `groupCard(title, rows, total, opts)`: table Key | Entries | Hours | % of hours. Rows are clickable to apply a filter; the table is limited to 340px height.
  - `aggBy(list,keyFn,hFn)`: `{key,n,h}`, skipping null or empty keys.
  - `personAgg(list,hFn)`: per team member, entries whose `doneBy` contains the exact name (comma-split, via `nameInField`).

#### 1.9.1 Entry drills (`bdcount` Total Breakdowns, `downtime` Total Downtime, `pm` PM Hours, `nodt` NO DT) — `drillEntries` L3904, `renderDrillBody` L3935
- **Base set** (`drillBase` L3885): `filterBD({excludePM:false})`.
  - `pm` keeps only PM entries.
  - `bdcount` and `downtime` keep non-PM entries.
  - `nodt` keeps non-PM entries coded NO DT.
- **Toolbar:**
  - Search covers machine ID, model, problem, doneBy and maintCode.
  - Month (Jan–Dec), Cell (`cellsEff()`, labelled "Cell X"), Category (settings categories except "robot"), Code (settings codes).
  - Sort: "newest first" or "hours (high to low)". The sort control is hidden on `downtime`; the default is `hours` for `nodt` and `date` otherwise.
  - A removable date chip appears when filtered to a single date.
  - "Clear filters" button.
- **Filters** (`applyDrillFilters` L3891):
  - Month matches the abbreviation only, across all years.
  - Cell is the **effective cell at the breakdown date** (`getEffectiveCell`).
  - Category is the machine's current category.
  - Code is an exact match after trim.
  - Date is an exact string match.
- **KPIs:**
  - Breakdowns / PM Entries / NO DT Entries (count)
  - Downtime / PM / NO DT Hours
  - Machines Involved
  - Avg per Entry (`total/count`)
  - On `downtime` only: "Top 50% of Hours" (N breakdowns, % of entries, hours) and "Machines in Top 50%" (N of M).
- **Monthly Trend chart:** a mixed bar and line chart on two y-axes, keyed by year+month and labelled "Jan 25".
  - `bdcount`: bars = count, line = hours.
  - `downtime`: stacked bars of top-50% hours (dark red) and other hours (light red), with a line for the count.
  - `pm` and `nodt`: bars = hours (purple or amber), line = entries.
- **Group cards:**
  - Machines card ("Machines by Number of Breakdowns" for `bdcount`, sorted by n then h; "Machines by Downtime Hours" for `downtime`, with top-50% rows highlighted; plain "Machines" at the end for pm/nodt).
  - By Category, By Maintenance Code, By Person (Done By) or By Team Member, and By Month. Clicking a row applies the matching filter; clicking a person puts the name in the search box.
- **Entries table:** # | Date (click filters to that date) | Machine | Category | Cell (effective) | Shift | Problem | Code | Done By | Down (Hrs), plus "% of Total" and "Cumulative %" on `downtime`. Top-50% rows have an amber background and a left bar.
- **Export:** `Cosmos_{kind}`. Columns # | Date | Machine | Model | Category | Cell | Shift | Problem | Code | Done By | Down (Hrs), plus "% of Total", "Cumulative %" and "Top 50%" (Yes) on `downtime`.

#### 1.9.2 Total Machines — `drillFleet` L4035
- **Segments:**

  | Segment | Counted in Total | Opens list page / filter select |
  |---|---|---|
  | CNC | yes | `machines` / `mcCatFilter` |
  | Conventional | yes | `conv` / `cvCatFilter` |
  | Process | yes | `proc` / `pvCatFilter` |
  | Utilities | no | `util` / `utCatFilter` |
  | DG Sets | no | `dg` (no category filter) |

- **Three KPI tiles** for CNC, Conv and Proc: count and % of total, each clickable to its list.
- **"Fleet by Segment" table:** Segment | Machines | % of Total | Avg Age. Segments outside the total carry a "not in Total" badge. Category sub-rows are sorted by count and are clickable through `gotoList`.
- **"Age Profile" chart:** stacked bars across the age bands 0-5, 5-10, 10-15, 15-20, 20+ and Unknown, one dataset per segment for CNC, Conv and Proc.
- **Export:** Segment | Machines | In Total Machines | Avg Age.

#### 1.9.3 Machines added in a year — `drillYear` L4072 (opened from the expansion timeline)
- **KPIs:** Added in Y; Fleet at end of Y (cumulative, year ≤ Y); Share of Fleet Added (added ÷ all CNC).
- **Table:** # | Machine (+eye) | Type (`machinePrefix`) | Make | Model | Category | Purchase Date ("year only" when there is no date) | Age | Cell. Sorted by numeric-aware ID. Includes excluded machines.
- Export provided.

#### 1.9.4 Fleet Availability — `drillAvail` L4091
- Uses `calcAnalytics1()` with no year, which means `dataYear()`.
- **KPIs:** Plant Availability; Lowest Cell; Highest Cell.
- **Table:** cells with avail > 0, ranked by availability ascending: Rank | Cell | Machines | Available Hrs | BD Hrs | PM Hrs | BD % | PM % | Availability | in-cell bar. Clicking a row opens the `bdcount` drill filtered to that cell.
- Includes the availability-basis switch, a formula note, and an export.

#### 1.9.5 Plant BD % — `drillBdPct` L4108
- A year selector (stored in `drill.p.year`, defaulting to the latest year).
- **Line chart "Monthly BD % and PM %":** each month's hours ÷ that month's available hours from `availSum(nonRobotMachines(), month start, min(month end, availWin.end))`. A month with 0 available hours plots null.
- **Table "By Cell — whole record":** Cell | Machines | BD Hrs | BD % | PM Hrs | PM % | BD + PM % | bar (relative to the maximum BD%). Sorted by BD% descending; a click opens `bdcount` for the cell.
- Export provided.

#### 1.9.6 Daily Breakdown Pattern — `drillDaily` L4136 (opened by the "Avg Complaints / Day" and "Avg BD Hours / Day" tiles)
- **KPIs:** Avg Complaints/Day; Avg BD Hours/Day; Busiest Day; Days with No Breakdown.
- **Weekly Trend chart:** bars = breakdowns, line = hours. Weeks start Monday and are labelled "dd Mon".
- **By Weekday table**, Monday to Sunday: Weekday | Days in record | Breakdowns | Avg Complaints/Day | Hours | Avg BD Hours/Day | bar.
- **"Busiest 10 Days — by Breakdowns"** and **"Worst 10 Days — by Downtime Hours"** tables. A click opens `bdcount` filtered to that date.
- **Export:** every calendar day (Date, Weekday, Breakdowns, Downtime Hrs).

#### 1.9.7 Breakdown-Free Machines — Dashboard card `bdFreeCard` L4220, chart `drawBdFreeChart` L4246, drill `drillBdFree` L4280
- **Dashboard card:**
  - "RUNNING CLEAN TODAY" in large type: free / active, and % of the CNC fleet.
  - ▲/▼ delta against 30 days ago.
  - "Record: X% (free of active) on date", with a progress bar showing current ÷ record.
  - Either "At the record — keep it going" or "N more breakdown-free machines needed to beat the record".
  - "See every machine →" button.
- **Chart:** 0–100% line of the daily free %, a dashed amber Record line and a dotted grey Average line.
  - The tooltip shows weekday and date; "Running clean: x of y machines in service (p%)"; change vs the previous day; dropped out that day; rejoined; entries logged; vs average; vs record.
  - A custom dashed vertical guide line follows the cursor.
- **Drill page:**
  - KPIs: Running Clean; Broke in last 30 days; Record; Longest Clean Run.
  - Table ranked by days since last breakdown: # | Machine | Category | Cell | Last breakdown | Days since ("none on record") | Breakdowns on record | Status badge (Running clean / Broke recently) | bar.
  - Export provided.

#### 1.9.8 BD Hours per Machine — `drillPerMachine` L4298
- **KPIs:** Average per Machine; Median Machine; Above Average (count and %); No Breakdowns (count).
- **Table:** # | Machine | Model | Category | Cell | Age | Breakdowns | BD Hrs | MTTR | vs Average (×) | bar. Sorted by hours descending. Covers every non-excluded CNC machine, including those with zero breakdowns.
- Export provided.

### 1.10 Dashboard bubble chart — L4317–4407
- **Filters toolbar** (`bubFilterHTML`):
  - Cell ("Cell X" from `settings.cells`), Category (excluding robot), Age band (0-5, 5-10, 10-15, 15-20, 20+, Unknown), Shift ("Shift X").
  - "Reset filters".
  - Zoom −, +, "Reset zoom".
  - A count label "N machines shown".
- **Chart:**
  - x = the machine's total BD hours; y = number of breakdowns; bubble radius = `4 + 18*sqrt(mttr/maxMttr)`.
  - The tooltip gives the ID, Model, Age, Breakdowns, BD hours and MTTR.
  - Clicking a bubble opens machine detail, but only when the user did not just drag.
  - The legend is hidden.
- **Interaction:**
  - Ctrl/Cmd + wheel zooms around the cursor (factor 0.8 or 1.25); a plain wheel still scrolls the page.
  - Dragging pans, starting after a 5px threshold.
  - Zoom is clamped to at most 1.5× the full span and at least 2% of it; the lower bound is clamped at ≥ 0.

### 1.11 Reports helpers (monthly and annual pages render at L5138+, outside range) — L4409–4560
- **`repHead`:** "COSMOS ENGITECH PVT. LTD.", title, subtitle, then "Maintenance Intelligence Platform / Generated dd-mm-yyyy" and optional extra text.
- **`repTile(label,val,prevTxt,delta,note)`:** a KPI tile showing the delta and the previous value.
- **`repSection`:** a section with an optional `rp-pb` page break.
- **`repList`:** a list with an empty-state message.
- **`repNotesBlock(key)`:** "Management Commentary and Actions".
  - A commentary textarea and a five-row action table (Action | Owner | Due date).
  - These are held in the in-memory `repNotes` only and are **not persisted**; the page says so.
- **`repPrintBtn` and `repDownloadPdf`:** "⬇ Download PDF" (see §2.11).
- Chart resize hooks on `beforeprint` and `afterprint`.

### 1.12 Controller split (CNC Machines tab) — L4562–4627
- **`ctrlSplitHTML`:** a "Controllers" card with one KPI tile per brand. Each tile shows the count, % of machines, number of series and the top three series with counts, and clicks through to `openDrill('ctrl',{brand, back:'machines'})`.
- **`drillCtrl`:**
  - KPIs: Machines; Series; Avg age.
  - "By series" table: Series | Machines | Avg age | Control units (unit ×n) | Breakdowns | BD hrs | machine chips (`*` = excluded; a click opens asset detail).
  - "Control unit part numbers" table: Control unit | Machines | Series (n) | chips. The table notes "Machines sharing the same control unit can share spares".
  - Export columns: Machine | Category | Series | Control unit | Controller (as entered) | Controller model (as entered) | Age (the header is mislabelled "Avg age counted") | In production data.

### 1.13 Make split — L4642–4683
- **`makeSplitHTML`:** a "Make" card with one KPI tile per make (count, %, top two categories) that drills through to `openDrill('make',…)`.
- **`drillMake`:**
  - KPIs: Machines; Models; Avg age.
  - "By model" table: Model | Category | Machines | Avg age | Controllers (brand+series ×n) | Breakdowns | BD hrs | chips.
  - "Controllers on these machines" table.
  - Export: Machine | Category | Model | Controller series | Control unit | Age | In production data.

### 1.14 Cell Change Log export and edit — L4685–4717
- **`exportCellLog`:** an `.xlsx` sheet "Cell Change Log" with a company header and the columns Date | Machine ID | From Cell | To Cell | From Location | To Location, newest first, with fixed column widths.
- **`openCellChangeEdit(id)` modal:**
  - Fields: Effective Date (required, `type=date`), From Cell (blank allowed), To Cell (required), From Location, To Location.
  - The options include the current value even if it has since been removed from Settings.
  - A hint explains the effective-date semantics.
- **`saveCellChangeEdit`:** after saving, re-renders the machine table and the cell log.

### 1.15 Data Checklist page — `renderDC` L4832
- **Header text:** "Everything that is missing…".
- **Tiles:** To do; Entries updated; Marked not available; % Closed.
- **Tabs:** To do / Not available / Log, each with a count.
- **To do tab:**
  - Area filter (Breakdown Log / Machines and Utilities / Analysis, each with a to-do count) and a search box (300ms debounce, focus restored after re-render).
  - Collapsible groups under area headers. bd_date, bd_mach and bd_hrs are open by default.
  - Each group header shows a caret, the title, a priority badge (High/Normal/Low) and a count.
  - An open group shows its "why" line and a bulk button "Mark all N as data not available", which needs a second click to confirm.
  - Rows show plain text and a sub-line, with buttons "Enter data →" (opens the right form) and "Data not available".
  - Rows are paged 30 at a time ("Show 30 more (N left)").
- **Not available tab:** marked items, newest mark first, each with "Enter data →" and "Undo".
- **Log tab:**
  - An explanatory description, a debounced search and "Export log".
  - Table: When | Event (Entry updated / Marked not available / Reversed) | Section | Item (+note) | action ("Reverse" if the item is still NA, otherwise "reversed or filled in").
  - Shows the latest 300 rows.
- **Sidebar badge** `#dcBadge`: the open to-do count, refreshed by `dcRefresh()`.

### 1.16 Action Center constants (start only; L4876–4900, the rest is beyond range)
- **`AC_DEF` defaults:**

  | Rule | Defaults |
  |---|---|
  | Recurring fault | repeatDays 7, repeatMinDays 2 |
  | Frequent breakdowns | freqDays 30, freqMin 4 |
  | Same cause in a cell | cellDays 7, cellMin 5 |
  | Long breakdowns without Why-Why | longDays 60 |
  | Weekly spike | spikePct 50, spikeMinHrs 10 |
  | Slow repairs | mttrMult 2, mttrMin 3, mttrDays 90 |
  | Share rules | humShare 15, shiftShare 55, teamShare 30 |
  | New machine | newMachDays 90, newMachMin 2 |
  | Spares spend | spareDays 90, spareShare 25 |
  | Worsening machine | riseMult 2, riseMin 3 |
  | Ageing machine | oldAge 15 |
  | Snooze | snoozeDays 7 |

- `AC_LABELS` holds a human label and a unit for each of these.
- `acCfg()` merges `settings.ac` overrides over the defaults, so these are already user-configurable.
- `AC_TYPES` (14 nudge types, including "Good news"), `AC_SEV` (high 3, med 2, low 1, info 0), `AC_SEVNAME`, and the UI state `acUI` (`tab:'open'`, sev, type, q, rules, openKeys).
- `acCompute()` begins at L4899 with `asOf` = local midnight today.

---

## 2. Calculations and formulas

### 2.1 Settings-derived constants
- **Annual hours per machine** = `prodHrsPerDay × workDaysPerYear` (L815).
  - On edit (`updateProdParams` L2647), an invalid or 0 value falls back to **20** h/day and **300** days, so the default annual figure is 6000 h.
- **Efficiency factor** (`updateEnergyParams` L2654): NaN or < 0 → **15**; otherwise `min(val,100)`. Running load = connected KVA × eff/100. `renderMachineDrillGrid` also falls back to 15 when the setting is undefined.
- **Why-Why threshold** (`updateWhyWhyParams` L2661): NaN or < 0 → **12**. Where the setting is undefined, every reader falls back to **24** (L3233, L3240, L4442, L4767). The two defaults disagree.

### 2.2 A1 (values come from `calcAnalytics1(year)` L894, outside range; the formulas are as stated in this range)
- **BD%** = BD hours ÷ total available hours. BD hours exclude PM, and NO DT counts as 0.
- **PM%** = PM hours ÷ the same available hours.
- **Fleet Availability** = `1 − bdPct − pmPct` (L2822, L4093).
- **Available hours:** `availSum(machines, W.start, W.end)` = Σ annual × `machFrac(m,start,end)`.
  - Each machine is counted from its purchase date.
  - The window is either the full year or "days so far" (up to the later of today and the last data date).
  - Per cell, available hours are prorated using the cell-move log.
- **Cell-month share** = `row[m]/yearTotalBD*100` (L2861).
- **Chart values:** `Math.round(pct*10000)/100`.

### 2.3 A2
- **Avg hrs per machine** = category or cell BD hours ÷ machines in the group (for cells, the machines currently there).
- **Avg breakdowns per machine** = `count/machines` (`per` L2950).
- **% of Total BD** = group hours ÷ total.
- **% of Cell BD** = machine's in-cell hours ÷ cell hours.
- **Avg Hrs/Breakdown** = hours ÷ count.

### 2.4 A3 MTTR / MTBF
- **MTTR** = BD hours ÷ breakdowns.
- **MTBF** = (available hours − BD hours) ÷ breakdowns.
- **Monthly available hours** = annual ÷ 12, with the running month prorated under the "Days so far" basis.
- **`quarterAvg(row, months, q)` L2988:** the arithmetic mean of the quarter's monthly values, skipping null or undefined; if all three are null it returns null.
  - It is an **unweighted** average of the monthly ratios, not total hours ÷ total breakdowns.
- **Rounding:** chart values are rounded to 2 dp (`roundOrNull`); MTTR displays at 2 dp and MTBF at 1 dp in the matrices.
- **Machine table sort:** MTBF ascending; everything else descending on the key.

### 2.5 Heat colours (L3166–3175)
- `heatT = max<=min ? 0.5 : clamp((v−min)/(max−min), 0, 1)`.
- `heatColor` = `hsl(140+10t, 45+30t %, 88−66t %)`, running light green → dark green.
- `heatText`: white text when t > 0.45, otherwise dark green `#14532d`.
- Min and max are taken over groups with machines > 0 only.

### 2.6 A5 energy
- **Per machine:** `kva = parseFloat(m.power)`; NaN → 0; `running = kva × eff`.
- **Grouping:** cell via `cellKey(m.cell)`; location via a raw `String(m.location)` match.
- **Normalised grid** = `avgKva` (total ÷ machine count).
- Uses all `state.machines`, including excluded ones (by design, per the exclusion card text).

### 2.7 A6 Why-Why candidates — `getWhyWhyCandidates` L3232
- `filterBD({excludePM:true})` drops PM entries and excluded machines.
- An entry qualifies when `Number(downHrs) > threshold` (strictly greater, using **raw** hours, so a long NO DT entry can qualify).
- Candidates are sorted by downHrs descending.
- **Completed** means `b.whyWhy` exists. There is no in-progress state.

### 2.8 Footprint (`calcFootprint` L3421)
- **Dimensions:** `fpDim` treats `m.length` and `m.width` as millimetres. `l = max(L,W)/1000` and `w = min/1000` metres; it returns null unless both are > 0.
- **Machine set:** `nonRobotMachines()`, i.e. excluding the excluded machines. Machines without dimensions go into `missing`.
- **bdMap:** across **all** `state.breakdowns`, non-PM entries are counted per machineId. `n` counts entries; `h` adds effective hours (NO DT = 0).
- **Item fields:** `l, w, area=l·w, L=l+clear, H=w+clear, W=L, kva=parseFloat(power)||0, bdN, bdH`.
- **Order:**
  - `category`: settings category index, then H descending, then ID.
  - `compact`: H descending, then W descending.
- **Areas:** `grossArea = Σ W·H` (including clearance); `netArea = Σ l·w`.
- **Packing:** shelf packing (`fpPack`). Items are placed left to right; a new row starts when `x + W > containerW`; row height = the tallest item.
- **Square search:** for each `f` from 0.8 to 2.2 in steps of 0.02, `cw = max(sqrt(grossArea)·f, maxW)` and `side = max(usedW, usedH) + clear`. The smallest `side` wins, giving the minimum square plot side.
- **`fpGroup(items,keyFn,keys)`:** per key, `n, area, avgArea, avgL, avgW, kva, bdH, bdN, kvaPerM2 = kva/area, bdHPerM2 = bdH/area, bdPerM2 = bdN/area, avgBdH = bdH/n`. Empty groups are dropped.
- **Clearance** (`fpSetClear`): NaN or < 0 → 1; maximum 5 m.
- **Category colour** = `PALETTE[index % len]`.

### 2.9 Drill formulas
- **Entry hours:** `hrs = rawH` for `nodt`, otherwise `effH`.
- **Avg per entry** = total ÷ count.
- **Top-50% concentration** (L3946–3952):
  - Sort by hours descending.
  - A row is in the top set if `total>0 && h>0 && cumulative_before < 0.5·total`, so the row that crosses 50% is included.
  - The same rule applies to machines ranked by total hours.
  - `cum` = cumulative share including the row.
- **Fleet total** = CNC + Conv + Proc counts (all machines, excluded ones included).
- **Avg age** = mean of non-null `machineAge`.
- **Age bands:** [0,5), [5,10), [10,15), [15,20), [20,999), plus Unknown.
- **drillYear:**
  - added = CNC machines with `machineYear(m) === y`
  - cumulative = machines with year ≤ y
  - share = added ÷ `state.machines.length`
- **drillAvail:** availability per cell = `1 − bdPct − pmPct`; ranked ascending.
- **drillBdPct:**
  - Monthly BD% = Σ cell BD hours in month (from `calcAnalytics1(yr).momBD`) ÷ `availSum(nonExcluded, monthStart, min(monthEnd, WY.end))`.
  - The bar = `bdPct / max(bdPct)`.
- **drillDaily:**
  - Day range = min to max breakdown date (PM excluded), inclusive; days with no entry count as 0.
  - Avg complaints per day = totN ÷ nDays; Avg BD hours per day = totH ÷ nDays (effH).
  - Weekday averages = weekday total ÷ the number of that weekday in the range.
  - Week key = Monday, computed as `date − ((getDay()+6)%7)`.
  - Busiest = sorted by n then h; Worst = sorted by h; top 10 of each.
- **Breakdown-free** (`calcBdFree` L4183, `BF_WIN = 30`):
  - Day numbers = `round(Date.UTC(local y,m,d)/864e5)`.
  - Each non-excluded machine gets the set of day numbers on which it had a non-PM entry (NO DT included).
  - `today = max(local today, latest entry day of any machine)`.
  - The series runs from `first + win − 1` to today.
  - For day D, a machine is **active** if `D ≥ purchase day`. `machDate` parses only ISO `YYYY-MM-DD` from `datePurchase`; with no date the machine is active always.
  - **Free** if it has no breakdown on or before D, or if `D − (last breakdown day ≤ D) ≥ 30`, i.e. days D−29..D are all clean.
  - Per day: `free, active, pct=free/active·100, dropped` (free yesterday, not today), `rejoined` (the reverse), and `entries` logged that day.
  - **Record** = the highest pct; ties go to the latest day (`>= best − 1e-9`).
  - **prev** = the series value `win` days before the last point.
  - **Rows:** `since = today − last`; `inSvc = max(1, today − max(svc, first) + 1)`, used to size the bar for machines with no breakdowns.
  - Card: `toBeat = max(0, ceil(bestPct/100·tot − 1e-9) − cur)`. Progress = `pct·100/bestPct`.
  - Chart average = mean of the daily pct values.
- **drillPerMachine:**
  - Per non-excluded machine: `n`, `h = sumHrs`, `mttr = h/n`.
  - `avg = Σh / machineCount`, with zero-breakdown machines included in the denominator.
  - Standard median; "above" = h > avg; "zero" = n == 0.
  - vs average = `h/avg`; bar = `h/maxH`.
- **Bubble:**
  - Per non-excluded machine, filtered by age band, then `filterBD({excludePM:true, machineId, cell, category})`, then optionally by shift (string compare).
  - `hrs = sumHrs`, `mttr = hrs/count`. Machines with count = 0 are dropped.
  - Radius = `4 + 18·sqrt(mttr/maxMttr)`.

### 2.10 Reports (`repStats(start,end,E)` L4434)
- **Entry set:** `E = repEntriesAll()`, i.e. `filterBD({excludePM:false, includeExcluded})`, each entry carrying a parsed date `d` and a `pm` flag. In-range means `start ≤ d ≤ end`.
- **Counts:** `n` = number of non-PM entries; `days = dayDiff(start,end)+1`, using `Math.round` on milliseconds so DST shifts don't skew the count.
- **frac** = `periodFrac(start,end)` = Σ over months of `(days covered)/(days in month)/12`, so the period's share of a year runs on the annual ÷ 12 basis.
- **availHrs** = `availSum(nonExcluded, start, end)`.
- **h** = `sumHrs(bd)` (NO DT = 0); **pmH** = `sumHrs(pm)`.
- **MTTR** = `h/n` (0 if n = 0). **MTBF** = `(availHrs − h)/n`, or `availHrs` when n = 0.
- **bdPct** = `h/availHrs`; **pmPct** = `pmH/availHrs`; **avail** = `1 − bdPct − pmPct` (0 when availHrs is 0).
- **Per-day rates:** `perDayN = n/days`; `perDayH = h/days`.
- **NO DT:** `nodtN`, and `nodtH` = Σ raw hours of NO DT entries.
- **Long breakdowns:** `long` = bd entries with raw downHrs > thr (default 24); `longDone` = those with `whyWhy`.
- **Breakdowns** by machine, by cell (effective cell at the date), by category, by code ('—' when blank) and by shift, each sorted by h then n descending.
- **lastDate** = the latest in-range date.
- **`codeDesc(c)`:** the settings description up to the first "—"; `'—'` → "no code recorded". `codedOnly` drops the '—' row.
- **`repGaps(start,end,E,minLen)`:** runs of consecutive calendar days with **no entries at all** (BD or PM) of length ≥ minLen, sorted longest first.
- **`repDelta(cur, prev, lowerBetter, kind)`:**
  - If prev is null, or (for pct kind) prev is 0, the result is "—".
  - pct kind: `d = (cur−prev)/prev·100`. pts kind: `d = (cur−prev)·100`.
  - Flat when |d| < 1 (pct) or < 0.005 (pts), shown as "≈ no change".
  - Otherwise "▲/▼ |d|%" or "pts", classed good or bad according to `lowerBetter`.
- **Fleet helpers:**
  - `repAdds(start,end)` = non-excluded machines with a purchase date in range.
  - `repFleetTo(end)` = purchase date ≤ end (**machines without an ISO purchase date are omitted**).
  - `repCats` = categories by count.
  - `repPct` = 1 dp %.

### 2.11 Report PDF (`repDownloadPdf` L4509)
1. Falls back to `window.print()` when html2canvas or jsPDF is missing.
2. Adds the `rp-capturing` class, resizes charts and waits 400 ms.
3. Splits `.rp-paper` children into units. A `section.rp-sec` taller than 420px is broken into its children, and its H3 is marked keep-with-next.
4. Captures each unit with html2canvas (scale 2, white background, CORS) and places it on A4 (210×297 mm, margin 10, bottom margin 15, gap 3 mm) as JPEG at quality 0.95.
5. A unit that does not fit starts a new page. A unit taller than a page is sliced into page-height canvas strips.
6. Footer on every page: "Cosmos Engitech Pvt. Ltd. — {title}" on the left and "Page i of n" on the right.
7. Filename `Cosmos_Monthly_Report_{Month}_{Year}.pdf` or `Cosmos_Annual_Report_{Year}.pdf`.

### 2.12 Controller parsing (`ctrlInfo` L4563)
The parser lower-cases `controller + ' ' + ctrlModel`.
- **Brand:**
  - `fanuc` → Fanuc.
  - `mitsu|mitshu|m-70/80/700|e-70/80|80vm|fca-<digit>` → Mitsubishi.
  - `siemens|sinumerik|240d|840d` → Siemens.
  - `nc studio|lambda` → "Other (PC based)".
  - Any other non-empty controller that is not `n/a|na|nc|-` → Other.
  - Otherwise "Not recorded".
- **Fanuc series** (after stripping "series" and "fanuc"):
  - `robot|r-30i` → "Robot controller (R-30iB)".
  - `0i/oi mate [tm][a-f]` → "Oi Mate-XX".
  - `oi [tm][a-f] (g) plus` → "Oi-XX Plus".
  - `oi [tm][a-f]` → "Oi-XX".
  - `oi plus` → "Oi Plus".
  - `18i/21i [tm]b` → e.g. "18i-TB".
  - Otherwise "Fanuc (series not recorded)".
- **Mitsubishi series:**
  - `[me]-?(70|80|700)` → e.g. "M80".
  - `(70|80)vm` → "M70/M80".
  - `fca-NN` → "MNN".
  - Otherwise "(series not recorded)".
- **Siemens series:** "Sinumerik 840D" or "Sinumerik 240D", otherwise "Siemens".
- **Unit** = `ctrlModel` upper-cased with whitespace collapsed; blank or N/A → "Not recorded".
- **Ctrl and make drill BD figures:** non-PM entries of non-excluded machines, effH.

### 2.13 Make normalisation (`makeName` L4643)
After trimming, lower-casing and collapsing whitespace:
- `cosmos` → Cosmos
- `you ji` → You Ji
- `you ji/cosmos` → "You Ji / Cosmos"
- `hi-?f?l?i?fe | hilife | hi-life | hiflife` → Hi-Life
- otherwise the raw text unchanged (so other case variants are **not** merged)

Blank → "Not recorded". Groups are sorted by count, then name.

### 2.14 Data Checklist (`dcCompute` L4741)
- **% Closed** = `(NA + done) / (todo + NA + done)`, rounded; 100 when the total is 0.
- **Entries updated** = the count of 'done' log entries (lifetime, capped at 3000 log rows).

---

## 3. Data entities and fields read or written

### 3.1 `state.settings` (written in this range)
- `prodHrsPerDay` (number, default 20), `workDaysPerYear` (number, default 300).
- `efficiencyFactor` (% 0–100, default 15).
- `whyWhyThresholdHours` (number ≥ 0; default 24 when undefined, 12 on invalid input).
- `availBasis` ('elapsed' | 'year'), written by `setAvailBasis` outside the range.
- **String arrays:** `segments`, `categories`, `shifts`, `locations`, `cells`, `breakdownCategories`, `convCategories`, `procCategories`, `utilCategories`.
  - Add: trimmed, non-empty, case-sensitive duplicate check.
  - Remove: by index after a confirm.
  - Rename: not supported.
- `team[]`: `{name, type:'Team'|'Vendor', status:'Active'|'Inactive'}`.
  - Name must be unique (exact match).
  - Status toggles; remove is by index after a confirm; rename is not supported.
- `codes[]`: `{code, description}`.
  - Code is upper-cased and unique.
  - `PM` cannot be renamed or removed.
  - Renaming a code cascades to every breakdown whose trimmed `maintCode` equals the old code.
  - Removal warns with the usage count; affected entries keep the old text.
- `excludedMachines[]`: CNC machine IDs.
- **Data Checklist state:**
  - `dcNA{key:{at ISO, label, group}}`
  - `dcSnap{key:{label, group}}`, the snapshot of open items at the last sync
  - `dcLog[]{id:'dl_…', at ISO, type:'done'|'na'|'reverse', key, label, group, note?}`, newest first, capped at 3000
- `ac{}`: Action Center overrides, merged by `acCfg`.

### 3.2 Breakdown record (`state.breakdowns[]`)
- **Read:** `id, date ('dd-mm-yyyy' string), machineId, downHrs, maintCode, problem, doneBy` (a comma-separated list of names), `shift, observedBy, electMech, whyWhy`.
- **Written:**
  - `maintCode`, via the code-rename cascade.
  - `whyWhy = {why1..why5, conclusion (required), completedBy (team name or ''), completedDate 'YYYY-MM-DD'}`.

### 3.3 Machine records
- **CNC (`state.machines`)** read: `id, category, cell, location, power` (KVA, a string parsed with `parseFloat`), `length/width` (mm), `datePurchase` (ISO `YYYY-MM-DD` expected by `machDate`; other formats go through `toISODate`), `make, model, controller, ctrlModel`, year (via `machineYear`).
- **Written:** `cell` and `location`, via the cell-log edit.
- **Other segments:** `state.convMachines`, `procMachines`, `utilMachines`, `dgMachines`. These carry the same fields; DG machines use `capacityKva` instead of `power`.

### 3.4 Cell change log (`state.cellChangeLog[]`)
- Fields: `{id, date 'dd-mm-yyyy', machineId, fromCell, toCell, fromLocation, toLocation}`.
- Edit validation: date and toCell are required; nothing else is checked.

### 3.5 Transient (not persisted)
`repNotes` (report commentary and five action rows), `repSel`, `drill`, `drillExport`, `bubF`, `a1Year`, `a3Year`, `a2DetailMode`, `a5Drill`, `fpClear`, `fpLayout`, `dcUI`, `acUI`, `editingCodeIndex`.

---

## 4. Workflows and business rules

1. **PM vs breakdown.**
   - Code `PM` (case-insensitive) is preventive maintenance and is never counted as a breakdown, in hours or counts.
   - Code `NO DT` (attended outside production hours or during lunch) counts as a breakdown occurrence but adds 0 downtime hours.
   - Raw NO DT hours are reported separately in the NO DT drill and `repStats.nodtH`.
2. **Excluded machines.**
   - Excluded from breakdown hours, MTTR/MTBF, BD%, availability, footprint, reports, breakdown-free, bubble and per-machine figures.
   - Still included in the Energy Heatmap, machine lists, fleet totals (drillFleet uses raw lists) and the added-by-year drill.
   - Breakdowns can still be logged for them, and Action Center still nudges about them.
   - Changing exclusions refreshes the Action Center badge and the Data Checklist.
3. **Effective cell.** A breakdown is attributed to the machine's cell **at the breakdown date**, using the cell change log, both in drill filters and in reports' by-cell breakdowns. Available hours are prorated the same way. A cell not in Settings becomes "No cell".
4. **Cell-move edit semantics.**
   - Entries before the effective date stay with the From cell; from that date on they belong to the To cell.
   - After the edit, the machine's current cell and location are reset to the **latest** log entry's To values. The location is set only if non-empty.
5. **Why-Why workflow.**
   - Candidates are selected automatically by threshold.
   - It is a single fill-and-conclude flow; a conclusion is required to save.
   - Saving stamps today's date (UTC ISO), and the PDF becomes available.
   - The Data Checklist "ww" group and report "long breakdowns" figures also track completion.
6. **Code governance.** `PM` is locked. A rename propagates into historical entries. Deleting keeps historical text but removes the code from dropdowns.
7. **Team.** Deactivating keeps history, and new-entry dropdowns elsewhere hide inactive members. Person aggregation matches exact names inside the comma-separated `doneBy`.
8. **Settings Sync from Excel.** Settings lists are reconciled against a "Settings" sheet with a diff preview before anything is applied (implementation at L8024).
9. **Backup and restore.** A full Excel export, and a full restore that replaces everything.
10. **Data Checklist rules** (`DC_GROUPS` L4721):

    | Key | Area | Priority | Rule |
    |---|---|---|---|
    | bd_date | bd | high | `ddmmyyyyToDate(date)` falsy |
    | bd_mach | bd | high | machineId not in `state.machines` |
    | bd_hrs | bd | high | not NO DT and downHrs not > 0 (**applies to PM entries too**) |
    | bd_code | bd | high | blank maintCode |
    | bd_done | bd | norm | blank doneBy |
    | bd_prob | bd | norm | blank problem |
    | bd_shift | bd | norm | blank shift |
    | bd_obs | bd | low | blank observedBy |
    | bd_em | bd | low | non-PM and blank electMech |
    | log_gap | bd | high | runs of ≥ 4 consecutive days with no entries at all, between the first and last entry dates (entries of non-excluded matched machines only); plus a "log not updated since X" item when the latest entry is > 2 days before today |
    | ww | an | norm | non-PM, non-excluded, **effective** hours > threshold, no whyWhy; newest first |
    | mc_age | mc | norm | machineAge null (all five segments) |
    | mc_dim | mc | norm | length or width not > 0 (DG skipped) |
    | mc_pw | mc | norm | power blank (DG: capacityKva); utilities whose category matches `stabili[sz]er` or `\bups\b` are skipped |
    | mc_cell | mc | norm | blank cell (CNC, Conv, Proc only) |
    | mc_loc | mc | norm | blank location (all segments) |

    - Item key = `group|breakdownId`, or `group|segmentKey|machineId`, or `log_gap|s|e` / `log_gap|latest|date`, or `ww|id`. Keys are stable, so marks survive re-computation.
    - Items are ordered by `DC_GROUPS` key order; priority is shown but not used for sorting.
    - The breakdown checks run on **all** breakdowns, including excluded machines' entries.
    - "Enter data →" opens: `openBreakdownForm(id)`, `openMachineForm/openConvForm/openProcForm/openUtilForm/openDgForm(id)`, `openWhyWhyForm(id)`, or `nav('breakdowns')` for gaps.
11. **Data Checklist life cycle** (`dcSync` L4784):
    - Each sync recomputes the issues.
    - An NA-marked item whose issue disappeared → logged as "done", with the note "was marked not available, now filled in", and its NA mark is cleared.
    - An item in the previous open snapshot that no longer exists → logged as "done".
    - The snapshot is replaced when the key set changes. Persist runs only on change.
    - Marking NA logs 'na' and removes the item from the snapshot. Undo or reverse logs 'reverse'.
    - Bulk NA applies only to the items visible after the search filter, with a two-click confirm.
    - Sync is triggered on page render, `dcRefresh` (badge), and exclusion changes. The page text says it also runs "when you open a page or close a form".
12. **Breakdown-free goal.** The maintenance KPI is to push the count of machines clean for ≥ 30 days up and beat the record share.
13. **Drill navigation contract.**
    - Each drill carries `back`, which drives the back button.
    - Clicking a row in one drill opens another drill with filters (e.g. cell → `bdcount` with `{cell}`, day → `bdcount` with `{date}`).
    - Every drill registers an Excel export.

---

## 5. Hard-coded or tenant-specific assumptions that should become configuration

- **Company identity:**
  - "COSMOS ENGITECH PVT. LTD." in every Excel export header (L3823, L4688, L4829), the report head (L4494) and the PDF footer (L4544).
  - "Cosmos Engitech" in the Why-Why PDF (L3331).
  - The "Cosmos_" prefix on every export filename.
  - "Maintenance Intelligence Platform" in the report head.
- **Make aliases** (`makeName` L4646–4649): Cosmos, You Ji, You Ji / Cosmos, Hi-Life. This should become a per-tenant alias table.
- **Controller regex catalogue** (`ctrlInfo`): Fanuc, Mitsubishi and Siemens patterns plus PC-based NC Studio/Lambda. This should be a configurable mapping or vendor dictionary.
- **Special codes:** `PM` and `NO DT` are hard semantic codes. They should become code-level flags such as "is preventive" and "zero-downtime".
- **"robot" category:** filtered out by name in category dropdowns (L3918, L4368). The `nonRobotMachines` name is a legacy of this.
- **Machine segments:** CNC, Conventional, Process, Utilities, DG Sets, with fixed rules for which count in "Total Machines" (CNC+Conv+Proc), which need cells (CNC/Conv/Proc), and which need dimensions (not DG). DG uses `capacityKva`. The power check skips utilities in the Stabilizer and UPS categories.
- **Age bands:** 0-5 / 5-10 / 10-15 / 15-20 / 20+ (L4046, L4369, L4378), plus the A3 age bands elsewhere.
- **Numeric constants:**
  - Breakdown-free window `BF_WIN = 30`.
  - Top-50% concentration share.
  - Data-gap minimum run of 4 days; log-lag alert at > 2 days.
  - Why-Why defaults 24 and 12; efficiency default 15%; production defaults 20 h × 300 d.
  - Efficiency example of 20 KVA.
  - Drill bars at 340px height; page size 30 (DC); log view of 300; log cap of 3000.
  - Week starts Monday.
- **Calendar and formatting:** calendar years (no fiscal year, which Indian plants usually report April–March); dates as `dd-mm-yyyy` strings; the A4 paper format.
- **Labels:** cells prefixed "Cell " and shifts prefixed "Shift ".
- **Monthly availability** on an annual ÷ 12 basis, rather than a working-day calendar (no holiday or Sunday calendar, even though the Daily drill says "includes Sundays and holidays").
- **Units:** power in KVA; footprint dimensions in mm, converted to m; clearance default 1 m, max 5 m.
- **Data Checklist:** group definitions, priorities, default-open groups and "why" texts.
- **Action Center:** thresholds in `AC_DEF`, already overrideable per tenant through `settings.ac`.

---

## 6. Bugs, hacks and fragile logic

1. **Why-Why default mismatch.** Invalid input resets the threshold to 12 (L2663), but an undefined setting means 24 everywhere else.
2. **Why-Why hours basis disagrees between screens.**
   - A6 and `repStats.long` use **raw** downHrs, so NO DT entries can become candidates.
   - The Data Checklist "ww" group uses **effective** hours, so NO DT entries are never flagged.
   - The counts therefore disagree.
3. **NO DT code is unprotected.** Only `PM` is locked against rename and delete. Renaming `NO DT` silently breaks the zero-downtime rule.
4. **No rename for list items, team members or cells.** Removing a cell or category that machines still use makes them "No cell" or unmatched, with no warning or usage count (unlike codes). The list-remove confirm shows the internal key (e.g. "breakdownCategories") rather than the title.
5. **Why-Why "Completed By" dropdown** lists inactive team members, and vendors.
6. **Why-Why PDF has no page-break handling.** Long whys or conclusions overflow past the A4 bottom. The `completedDate` is the UTC date, so it can be off by one in IST late at night.
7. **Raising the Why-Why threshold** hides completed analyses from A6. The data is kept but cannot be reached.
8. **Month filter ignores the year.** `applyDrillFilters` month = abbreviation across all years, while the trend chart is year-month.
9. **Person click** puts the name into free-text search, which matches substrings across problem, model and so on, unlike the exact `nameInField` used for the aggregation.
10. **`drillDaily` keys `byDay` by the raw `b.date` string** but iterates days with zero-padded `fmtDMY`. Non-padded or otherwise differently formatted stored dates silently drop out of the daily counts.
11. **`bdFreeCard` "to beat the record"** computes the count needed to *equal* the record (ceil of record × fleet), not to exceed it. When the fleet size changes, a share-based record can be unreachable or trivially met.
12. **`calcBdFree` date handling.**
    - `today = max(now, latest entry)`. If the log is not up to date, machines look clean for the unlogged days, inflating the KPI. The data-lag check lives only in the Data Checklist.
    - `machDate` accepts only ISO purchase dates. Machines with only a purchase year are treated as in service forever, and the same applies to `repAdds` and `repFleetTo`, which omit year-only machines.
13. **`drillAvail` and `drillBdPct` say "whole record"** but call `calcAnalytics1()` with no year, which resolves to `dataYear()`. This needs verifying (L4092, L4112, L4122). The "by cell — whole record" label may be wrong. A1 KPIs are year-scoped, so drill and tile values may differ.
14. **`quarterAvg` averages monthly ratios without weighting,** and includes zero values while the cells hide zeros as "—". Monthly MTBF uses annual ÷ 12 regardless of actual working days.
15. **Bubble chart listener leak.** `bubWireEvents` adds `window` pointermove and pointerup listeners each time a new canvas is wired. A new canvas on every dashboard render means the listeners accumulate.
16. **Unused variables:** `const eff = null` in `drillFleet`, `periodFrac`'s `frac` in `repStats`, `groupCard` `opts.color`, and `annual` in `drillAvail` and `drillBdPct`.
17. **`renderDrill` title map has no `age` entry**, so it shows "Details". The subtitle says "from the Dashboard" even when opened from Age Analysis.
18. **`footprint` bdMap** iterates every breakdown, including excluded machines and unknown IDs. That is harmless, because items come from non-excluded machines only, but it is inconsistent with `filterBD`. It also has no date scoping.
19. **Clearance is added once per item** (L+clear, W+clear), so packed neighbours get one clearance gap, and one more `clear` is added to the side. The model is approximate.
20. **`saveCellChangeEdit`** does not re-validate move order, a from-cell that mismatches the previous to-cell, a date before purchase, or identical from/to values. It relies on `cellLogFor` sorting.
21. **`makeName` duplicate branch** `k==='you ji' || k==='you ji'`. The second was probably intended as a non-breaking-space or no-space variant. Case variants of other makes are not merged.
22. **Controller export header** says "Avg age counted", but the column holds the machine's age.
23. **Data Checklist "done" detection is inference-based.** If a breakdown or machine is deleted, the threshold is raised, or a machine is excluded (gaps change), its items vanish and are logged as "Entry updated", which is a false positive. The log is capped at 3000, so "Entries updated" and % Closed drift.
24. **Data Checklist `bd_hrs`** flags PM entries with 0 hours, and `bd_date` / `bd_mach` / `bd_*` include excluded machines' entries. That is probably intended but inconsistent with gap detection, which ignores them.
25. **Report commentary and actions (`repNotes`) are lost on reload.** The page warns about this.
26. **`repDownloadPdf`** rasterises everything to JPEG (no selectable text, large files), depends on CDN libraries (falling back to print), and uses magic numbers (420px section split, 400 ms wait).
27. **`exportDrill`** uses the last registered export. A drill that returns early, e.g. `drillCtrl` with no brand, may leave the previous page's export registered. `drillDaily` does clear it.
28. **Heat-grid drill for location** compares raw `String(m.location)` (no trim or normalisation), while the cell drill uses `cellKey`.
29. **XSS-ish patterns.** Many `onclick` strings embed `esc(...)` values inside single quotes, e.g. `drillSetF('cat','${esc(r.key)}')`. HTML-escaping does not escape the `'` used for JS string delimiters, so names containing apostrophes break the handlers. Elsewhere `acJ` is used correctly.
30. **`drillBdPct` year `<option>`s** have no `value` attribute; they work only because the text equals the year.

---

## 7. Clever ideas worth preserving

- **"How it is calculated" boxes** on every drill page, with live numbers substituted into the formula (e.g. "1 − 3.2% − 1.1% = 95.7%"). Strong for trust and auditability.
- **Availability-basis switch** ("Days so far" vs "Full year") applied consistently, plus per-machine proration from the purchase date and cell-move proration of available hours and breakdown attribution (effective cell at the breakdown date).
- **NO DT concept:** an occurrence that counts as a breakdown but adds zero downtime.
- **Top-50% (Pareto) downtime highlighting** of breakdowns and machines, with a stacked monthly chart separating the "vital few".
- **Breakdown-free machines gamification:** a rolling 30-day clean count, a historical record of the best share, delta vs 30 days ago, "N more needed to beat the record", dropped/rejoined tooltips, and a fleet-in-service denominator that respects purchase dates.
- **Daily pattern analytics** that include zero days, with weekday normalisation by the number of that weekday in the range.
- **Data Checklist:** a data-quality to-do list with stable keys, priorities, deep links into the exact form, "data not available" closure with an audited, reversible log, automatic detection of fixes, and gap detection for unlogged days and log lag. Excellent for SaaS onboarding and data hygiene.
- **Exclusion list** with clearly documented scope (analytics out, energy and fleet in).
- **Code rename cascade** into historical entries, with usage counts on delete and protection of system codes.
- **Controller and make normalisation** from messy free-text into brand, series and control-unit part numbers, with the insight that machines sharing a unit can share spares. Worth generalising into an asset-taxonomy normaliser.
- **Footprint packer** that searches container widths for a minimum square plot side, with per-group density metrics (KVA/m², BD hrs/m²).
- **Bubble chart** (hours × count × MTTR-sized) with Ctrl-wheel zoom at the cursor, drag-pan that does not trigger clicks, and clamped zoom.
- **Energy heat grid:** connected vs running load (efficiency factor), a normalised per-machine view, and tile drill-down to individual machines.
- **Report tooling:** a period-over-period `repDelta` with "lower is better" semantics and separate % vs percentage-point handling; `repGaps` for missing-data runs; a management commentary and action table; a smart PDF pager (keep heading with next, slicing tall blocks, page X of Y footer).
- **Universal Excel export** of whatever the current drill is showing, with a title header.
- **Why-Why** auto-candidate selection by threshold, plus a one-click A4 PDF for the 5-Why record.
