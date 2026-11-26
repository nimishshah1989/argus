/**
 * The Guide (ticket 45, packet 45f): the 36 entry headings from the answer key, each entry's plain-English rule
 * and the optional formula line, plus the contents and link chrome. Its own namespace, so the main analytics
 * catalogue stays under the 250-line cap. Every key keeps its `analytics.guide.` prefix, so the face reads one
 * flat catalogue. The wording is ours; the headings are the key's, verbatim, and the coverage test keeps them so.
 */
export const analyticsGuideEn = {
  'analytics.guide.heading': 'The rule behind every figure',
  'analytics.guide.all': 'All',
  'analytics.guide.unbuilt': 'Not built yet',
  'analytics.guide.group.basics': 'Basics',
  'analytics.guide.group.overview': 'Overview',
  'analytics.guide.group.reliability': 'Reliability',
  'analytics.guide.group.problems': 'Problems',
  'analytics.guide.group.machines': 'Machines',
  'analytics.guide.group.people-money': 'People and money',
  'analytics.guide.group.reports-data': 'Reports and data',
  'analytics.guide.group.planning': 'Planning',
  'analytics.guide.takeaway':
    '{{group}} has the most ({{n}} of {{total}}). {{unbuilt}} are marked "Not built yet".',
  'analytics.guide.contents': 'Contents',
  'analytics.guide.openFigure': 'Open this figure',
  'analytics.guide.notBuilt':
    'This feature is not in this build yet. When it ships, this entry will explain its rule and open the screens it uses.',
  'analytics.guide.how.title': 'How this platform works',
  'analytics.guide.how.body1':
    'Argus reads the plant’s own records — machines, breakdowns, PM visits, cell moves and the corrections people save — and works out a figure when it is opened. No number on a screen is a stored total: it is computed from the same rows for the plant date shown, so two screens that share a rule always agree.',
  'analytics.guide.how.body2':
    'The menu groups the work into Today, Machines, Breakdowns, Forecast & scorecard, PM, Cost, Reports and this Guide. Every figure opens the rows behind it, and every entry here explains the rule it follows.',
  'analytics.guide.ground-rules.title': '1. Ground rules used everywhere',
  'analytics.guide.ground-rules.body1':
    'The production fleet is every machine whose segment is CNC and that the plant has not left out of production data. A report row whose machine is outside that fleet never enters an analysis; the Robot is out, and a PM entry is never a breakdown.',
  'analytics.guide.ground-rules.body2':
    'An entry with no downtime recorded is still a breakdown and is worth 0 hours. Hours are the recorded hours when the log has them, otherwise the minutes divided by 60, and nothing is rounded before a sum or a comparison.',
  'analytics.guide.ground-rules.body3':
    'Ages are completed years from the purchase date to the chosen plant date. A machine with only a year uses that year; a machine with no date and no year has no age. A missing value or an empty denominator prints —, never a zero.',
  'analytics.guide.available-hours.title': '2. Available hours',
  'analytics.guide.available-hours.body1':
    'A machine’s year holds production hours per day × working days per year, 6,000 by default. A span counts each calendar month it touches in proportion to the days covered, divided by 12, and a machine counts from the later of the span’s start and its purchase date. A machine bought after the span ends has no available hours.',
  'analytics.guide.available-hours.body2':
    'A period’s available hours are the sum over the production fleet. BD %, PM % and availability all divide by this one figure, so they share a basis across the face.',
  'analytics.guide.available-hours.body3':
    'The shift-calendar basis divides by the plant’s own shift windows instead: the two shifts cover 21 hours a day, so a machine’s year holds 6,300 working hours rather than the platform’s 20 × 300 = 6,000. The platform’s column stays on screen beside it, because that is what the old tool printed, and both columns stay so a reader can see exactly what the new basis changes.',
  'analytics.guide.available-hours.formula':
    'annual = prodHrsPerDay × workDaysPerYear; fraction = Σ (days covered ÷ days in month) ÷ 12; available = annual × fraction(max(from, purchase), to)',
  'analytics.guide.dashboard.title': '3. Dashboard',
  'analytics.guide.dashboard.body1':
    'The Dashboard is today at a glance: the fleet count by segment, the breakdown and PM totals, the downtime and the average day, the problems that cost the most hours, the fleet’s availability and the plant’s breakdown percentage.',
  'analytics.guide.dashboard.body2':
    'Each tile is one registered figure, computed for the plant date on the screen. A tile that carries rows opens the machines or tickets behind its number, and a chart draws those same rows in another shape.',
  'analytics.guide.mttr-mtbf.title': '4. MTTR and MTBF',
  'analytics.guide.mttr-mtbf.body1':
    'MTTR is the mean time to repair: downtime hours divided by the number of breakdowns in the period. MTBF is the mean time between failures: the fleet’s available hours minus those downtime hours, divided by the same count. Both print to two decimals.',
  'analytics.guide.mttr-mtbf.body2':
    'PM is not a breakdown, and a period with no breakdown has no MTTR — it prints —. The MTTR and MTBF page applies the same rules to the plant, a cell, a category and an age band.',
  'analytics.guide.mttr-mtbf.body3':
    'The shift split groups breakdowns by the shift recorded on the report, never by re-reading the clock, and each shift divides by its own share of the plant’s working hours: the day’s minutes split 629 and 631 with the overlap minute on the later shift, so the counts, BD hours, PM hours and working hours of the rows add to the plant exactly. The plant’s own MTTR, MTBF and availability are recomputed from those summed totals, never averaged from the rows, and a code the Settings have no window for keeps its row with dashes where a denominator is missing.',
  'analytics.guide.mttr-mtbf.body4':
    'The backlog is every breakdown ticket still open at the end of the as-of plant day, aged in the plant’s working hours to the next midnight and bucketed under 4, 4 to 24, 24 to 72 and over 72 hours. A support ticket, a PM job and a general work request are not breakdowns, and a closed or cancelled ticket is not open; the plant has no holiday calendar, so Saturday and Sunday are working time, and a plant with no shift window prints dashes instead of an age.',
  'analytics.guide.mttr-mtbf.body5':
    'The machine page’s reliability block fits a two-parameter Weibull to the working hours between one machine’s failures — the shape, the scale and the mean hours between failures — with the run since its last failure counted as a censored interval. A machine with five failures and four intervals gets its own fit; a smaller one shows its category’s pooled fit, labelled, or “Not enough history” with both counts. The Kaplan-Meier summary reads a quarter, half and three quarters of intervals shorter than, and the Crow-AMSAA slope is printed beside its word: failures are getting further apart, failures are coming faster, or no clear trend yet. The block’s critical spares are the parts recorded on the machine’s own breakdowns, most used first and then by the downtime they caused, the top five with the last day each was used; both lists open the breakdown tickets behind them.',
  'analytics.guide.mttr-mtbf.formula':
    'MTTR = BD hours ÷ breakdowns; MTBF = (available hours − BD hours) ÷ breakdowns',
  'analytics.guide.bd-pm.title': '5. BD % and PM split',
  'analytics.guide.bd-pm.body1':
    'BD % is breakdown hours divided by available hours; PM % is PM hours divided by available hours; availability is what remains, 1 − BD % − PM %. The split shows how much of the fleet’s available time went to failures and how much to planned work.',
  'analytics.guide.bd-pm.body2':
    'Every screen that prints these rates uses the same basis. A month or a machine with no available hours prints — rather than dividing by zero.',
  'analytics.guide.bd-pm.formula':
    'BD % = BD hours ÷ available hours; PM % = PM hours ÷ available hours; availability = 1 − BD % − PM %',
  'analytics.guide.category-cell.title': '6. Category and cell analysis',
  'analytics.guide.category-cell.body1':
    'Category analysis groups the period’s breakdowns by the machine’s category. Cell analysis groups them by the cell the machine was in on the day of the breakdown, read from the cell-change log, so a machine that moved counts in each cell it actually worked in.',
  'analytics.guide.category-cell.body2':
    'A blank cell, or one Settings does not list, is grouped under No cell. A breakdown with no category is dropped from the category tables, and both tables rank groups by hours and then by count.',
  'analytics.guide.category-cell.body3':
    'The breakdown map ranks the same failure hours four ways — by machine, cell, maintenance code and shift — worst first, with each row’s running share and the point where half the lost hours have been named: 13 of the 125 production machines, 3 of 9 cells, 3 of 23 codes and 1 of 3 shifts on the 11 November workbook. Its heat grids cut each row by the month of the report’s own date, and the cell is the machine’s registered cell, so a machine that moved does not split its hours.',
  'analytics.guide.age.title': '7. Age analysis',
  'analytics.guide.age.body1':
    'Age is completed years at the plant date. The analysis bands the fleet by age and compares each band’s breakdowns and downtime hours with the machines in it, so an old fleet is judged against its own size rather than against the plant as a whole.',
  'analytics.guide.age.body2':
    'A machine with no age is in no band; a year-only machine uses the plant date’s year minus its year, never the wall clock.',
  'analytics.guide.age.formula':
    'age = completed years from purchase date to the plant date; a year-only machine uses asOfYear − year',
  'analytics.guide.manpower.title': '8. Manpower',
  'analytics.guide.manpower.body1':
    'Manpower counts each person’s attended breakdowns, the hours they handled and their PM visits, from the names on the log’s Done By and Supported By fields. A job shared by two people counts once for each of them, so the team’s shares can add up to more than 100%.',
  'analytics.guide.manpower.body2':
    'The team list comes from Settings in its own order. Average repair time is the person’s hours divided by the breakdowns they attended, printed to two decimals, and — when they attended none.',
  'analytics.guide.energy.title': '9. Energy Heatmap',
  'analytics.guide.energy.body1':
    'The Energy Heatmap reads the installed load of every CNC machine — connected kVA from the machine master — and groups it by cell and by location. Running load applies each machine’s own efficiency factor, or the plant’s factor when the machine has none.',
  'analytics.guide.energy.body2':
    'A machine whose cell Settings does not list sits in the — bucket. The grid is a picture of installed capacity, not of production hours, so machines left out of production data stay in it.',
  'analytics.guide.why-why.title': '10. Why-Why analysis',
  'analytics.guide.why-why.body1':
    'Why-Why analysis starts with the breakdowns whose recorded hours pass the plant’s Why-Why threshold, worst first. Each candidate can be opened, studied with the team and saved as a root-cause record, and a saved record marks its entry done.',
  'analytics.guide.why-why.body2':
    'The threshold is a plant setting. A no-downtime entry keeps its recorded value and can still be a candidate; PM entries never are.',
  'analytics.guide.footprint.title': '11. Footprint',
  'analytics.guide.footprint.body1':
    'The footprint is the floor the fleet needs: each machine’s Length × Width from the master, plus 1.0 m clearance between machines and at the boundary, packed into the smallest square that fits every machine. A machine missing either dimension stays out of the calculation rather than guessing.',
  'analytics.guide.footprint.body2':
    'The page prints the machines’ own area, the floor with clearance, the share the fleet uses and the footprint by category, cell, location and purchase year, so the plant can see where its space goes.',
  'analytics.guide.machine-lists.title': '12. Machine and utility lists',
  'analytics.guide.machine-lists.body1':
    'The registers list every machine by segment — CNC, conventional, process, DG sets and utilities — with its make, model, age, power and cell from the master. The summary above each list counts the machines, the connected load and the average age.',
  'analytics.guide.machine-lists.body2':
    'The machine page opens one record whole: its identity, cell and location, footprint and load, its breakdown and PM history, and its current MTTR and MTBF. A machine the plant leaves out of production data keeps its master record but has no breakdown summary.',
  'analytics.guide.excel.title': '13. Excel export and restore',
  'analytics.guide.excel.body1':
    'The plant’s registers and the reports can be exported as one Excel workbook: a sheet for each register, the full breakdown log, the settings and the analytics sheets, written from the same figures the screens show. The workbook is data only, with the plant name and the record title at the top of each register sheet.',
  'analytics.guide.excel.body2':
    'The export is not a restore today. Reading a workbook back into the plant is the M5 importer; until it ships, keep the workbook as a record, not as a backup you can load.',
  'analytics.guide.reports.title': '14. Reports (Monthly and Annual)',
  'analytics.guide.reports.body1':
    'The monthly report covers the calendar month before the plant date, in full. It shows where the month’s time went by machine, cell, category and code, the longest breakdowns, the maintenance team’s work, the machines added and the blank commentary form, with a daily chart and a twelve-month trend.',
  'analytics.guide.reports.body2':
    'The annual report covers 1 January to the plant date. It compares month by month and quarter by quarter, ranks the machines and cells that cost the most hours, and shows the causes, categories, age bands, team, PM and long breakdowns. A partial month is marked (to date).',
  'analytics.guide.reports.body3':
    'Both reports print the same numbers as the screens and can be downloaded as a PDF. The comparison is the month or year before; when it holds no data, every comparison cell prints —.',
  'analytics.guide.action-center.title': '15. Action Center',
  'analytics.guide.action-center.body1':
    'The Action Center turns the log into work: recurring faults, frequent breakdowns, a rising trend, a cell that moves too often, a very long repair, a new machine, a person carrying too much and a record with gaps each raise a nudge with a severity.',
  'analytics.guide.action-center.body2':
    'Every nudge names the machines and entries behind it. It can be acknowledged, snoozed or resolved, with an owner, due date and note; the risk table ranks the machines with the most open nudges. A money nudge, such as the spares spend, is shown only to heads and admins.',
  'analytics.guide.data-checklist.title': '16. Data Checklist',
  'analytics.guide.data-checklist.body1':
    'The Data Checklist counts the gaps that make a figure less trustworthy: a breakdown with no date, machine, hours, code, shift, observer, problem or electrical/mechanical type; a Why-Why that is due; and a machine missing its age, dimensions, power, cell or location.',
  'analytics.guide.data-checklist.body2':
    'Each item names the record to fix. Breakdown items open the entries behind the count; machine items stay in the list, because there is no ticket behind them.',
  'analytics.guide.bottleneck.title': '17. Bottleneck Analysis',
  'analytics.guide.bottleneck.body1':
    'Bottleneck Analysis ranks the production fleet by the share of available time it lost, the number and length of its breakdowns and how far it sits from its peers. Each machine gets a risk score and a rating, and the risk map shows the fleet at a glance.',
  'analytics.guide.bottleneck.body2':
    'The page also shows the capacity left and the forecast months ahead. The fleet is production data, hours are effective hours, and PM is never a breakdown.',
  'analytics.guide.compare.title': '18. Compare Machines',
  'analytics.guide.compare.body1':
    'Compare Machines puts machines side by side over their own service window: breakdown frequency, downtime hours, repair time, recent trend, repeat faults and spares cost, each judged against machines of the same category and age.',
  'analytics.guide.compare.body2':
    'The page also prints a category reference column and a health score, so an old machine is measured against what is normal for its age rather than against a new one. The spares cost tile is a money figure for heads and admins.',
  'analytics.guide.forecast-planning.title': '19. Downtime forecast for Planning',
  'analytics.guide.forecast-planning.body1':
    'The planning forecast answers what the next months are likely to cost in downtime, machine by machine and for the plant, from the breakdowns already recorded. It uses the same fleet and hours rules as the rest of the face and never changes a record.',
  'analytics.guide.forecast-planning.body2':
    'The forecast is drawn on the Bottleneck Analysis page and in the Forecast Lab, where the methods and their backtest are shown. The plant date decides how much history the forecast may read.',
  'analytics.guide.trend-repeat.title': '20. Trend check and repeat faults',
  'analytics.guide.trend-repeat.body1':
    'The Breakdown Log is the plant’s full history: every breakdown and PM entry in date order, with its machine, problem, hours, code and the people who did the work. It is the record the analyses read, not a summary of them.',
  'analytics.guide.trend-repeat.body2':
    'Read it by machine, code or problem to see a repeat fault, and watch the count and hours month by month to see a trend. The log is the one screen that keeps PM rows; the analyses leave them out.',
  'analytics.guide.cells-total.title': '21. Cells, the "No cell" row and the Total column',
  'analytics.guide.cells-total.body1':
    'A cell is the place a machine worked. The cell-change log records each move and the day it took effect, so an analysis can ask which cell a machine was in on a breakdown’s date. A blank cell, or a value Settings does not list, is grouped under No cell.',
  'analytics.guide.cells-total.body2':
    'The Total column is the recomputed plant total: it adds the rows above it on the same basis, not the average of their printed cells. The two can differ when a row has no denominator, which prints —.',
  'analytics.guide.days-so-far.title': '22. Available hours: "Days so far" or "Full year"',
  'analytics.guide.days-so-far.body1':
    'Available hours can be counted two ways. Days so far runs from 1 January of the data year to the plant date; full year runs the whole calendar year. Both use the same monthly fraction, so a machine bought mid-year never earns hours before its purchase.',
  'analytics.guide.days-so-far.formula':
    'available = annual × fraction(max(from, purchase), to), with from = 1 January or the purchase date',
  'analytics.guide.breakdown-free.title': '23. Breakdown-free machines (Dashboard tile)',
  'analytics.guide.breakdown-free.body1':
    'Breakdown-free machines counts the production machines in service whose last breakdown was 30 or more days before the plant date, or that have none. PM does not count as a breakdown, and a no-downtime entry does.',
  'analytics.guide.breakdown-free.body2':
    'The tile prints the clean count against the machines in service, and opens the machines it counted.',
  'analytics.guide.health-score.title': '24. Health score (0 to 10) on Compare Machines',
  'analytics.guide.health-score.body1':
    'The health score is a 0-to-10 number for one machine, from six weighted parts: breakdown frequency 30%, downtime hours 25%, repair time 15%, recent trend 15%, repeat and very long faults 10% and spares cost 5%. Each part is judged against the fleet’s expectation for the machine’s category and age band.',
  'analytics.guide.health-score.body2':
    'A machine with little history is protected rather than scored as if it had failed for years; a part it does not have is left out and the remaining weights decide the score. 10 is healthy and 0 is the worst.',
  'analytics.guide.health-score.formula':
    'score = Σ (weight × part score) ÷ Σ (weights of the parts present), kept between 0 and 10',
  'analytics.guide.problem-analysis.title': '25. Problem Analysis',
  'analytics.guide.problem-analysis.body1':
    'Problem Analysis groups the production breakdowns by what went wrong: the words in the problem and the corrective action, the group’s family, repeat pairs on the same machine and the entries it cannot place. It counts the breakdowns, hours and quick stops in each group.',
  'analytics.guide.problem-analysis.body2':
    'The page ranks the groups that cost the most hours, shows how concentrated the downtime is, and prints the repeat pairs worth a Why-Why. PM and records without a production machine stay out.',
  'analytics.guide.sorting.title': '26. Sorting tables',
  'analytics.guide.sorting.body1':
    'A sortable table sorts when its header is clicked: numbers compare as numbers, words alphabetically, and a dash always stays at the bottom. A second click reverses the order, and a keyboard can sort with Enter or Space.',
  'analytics.guide.sorting.body2':
    'The reports do not sort: their tables are printed in the order the report defines. The engine’s own order returns when the sort is cleared.',
  'analytics.guide.fix-finder.title': '27. Fix Finder',
  'analytics.guide.fix-finder.body1':
    'Fix Finder searches the plant’s own breakdown log for cases like the one you type: the problem and corrective-action words, common synonyms and the query’s problem group. A problem match counts in full, an action-only match in part, and a group match adds a little.',
  'analytics.guide.fix-finder.body2':
    'It shows the closest cases, the hours they cost and what was done, so the same fix can be tried again. A no-downtime row is a real case and contributes 0 hours.',
  'analytics.guide.forecast-lab.title': '28. Forecast Lab',
  'analytics.guide.forecast-lab.body1':
    'The Forecast Lab compares the plant’s current forecast model with three alternatives over the same months and scores each on its error. The table shows the method, how it works and its score; the month detail shows what each method expected and what actually happened.',
  'analytics.guide.forecast-lab.body2':
    'The lab is a backtest, not a change to the plant’s data. A method is adopted only when its evidence is strong enough, and nothing is written back to the log.',
  'analytics.guide.team-focus.title': '29. Team Focus',
  'analytics.guide.team-focus.body1':
    'Team Focus turns the month’s analyses into ranked actions for the maintenance team: what to do before next month, what to fix for good, what to overhaul or replace, which Why-Why is due, which spares to keep ready and which records to complete.',
  'analytics.guide.team-focus.body2':
    'Each action carries the hours at stake, the machine and the evidence behind it, and a person can save an owner, a status and a note. The cost tile is a money figure for heads and admins.',
  'analytics.guide.money.title': '30. Money Matters',
  'analytics.guide.money.body1':
    'Money Matters puts a rupee value on lost machine-hours: the throughput one machine-hour is worth, times the share of those hours counted as lost sales. Each lever then multiplies the avoidable hours by the share the team can remove.',
  'analytics.guide.money.body2':
    'The page reuses the other screens’ analyses rather than recomputing them — the problem groups, the age-adjusted health expectation, the forecast and the Team Focus lanes. Money figures are visible to heads and admins only.',
  'analytics.guide.pm-calendar.title': '31. PM Calendar',
  'analytics.guide.pm-calendar.body1':
    'The PM calendar shows each machine’s next preventive maintenance on its due month, with the plant’s daily load: one PM a plant working day. A drag writes the job, never the plan — it raises the PM work order on the day you choose, or moves the open one — inside the plan’s tolerance, on a Monday to Saturday, and never onto a day that already holds a PM. A crowded day is marked and the page offers the nearest free working day. The same screen carries two rates: PM compliance (PM jobs closed inside their tolerance) and schedule compliance (planned jobs closed by the Sunday of their week).',
  'analytics.guide.oem.title': '32. OEM Analytics',
  'analytics.guide.oem.body1':
    'OEM analytics lists the machines under 300 days old, their breakdowns against older machines of the same model, and the cause a person decided for each; it shows no money.',
  'analytics.guide.learning.title': '33. Learning from your corrections',
  'analytics.guide.no-code.title': '34. Entries with no maintenance code',
  'analytics.guide.amc-legal.title':
    '35. AMC, extended warranty and legal compliance (per machine)',
};
