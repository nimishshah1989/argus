# v2 coverage audit, batch 1: does the redesign keep everything the plant had?

Audit date 20-Nov-2026. Read-only. Rule being checked (Nimish, 20 Nov): a redesign may change how things are
shown, never reduce the detail, figures, filters, drill-downs, exports, insights or analytics the plant had.

**What was compared.** v1 = the live screens in `apps/web/src/screens/analytics/` plus the engine figures they
read (`packages/domain/src/analytics/`, `packages/shared/src/action-center.ts`), the frozen answer keys in
`fixtures/answer-key/*.json`, `docs/spec/PARITY.md`, `docs/spec/parity.yaml` and the e2e specs in `apps/web/e2e/`.
v2 = the gallery screens: Dashboard, Action Center, Data Checklist and Machine page from `origin/main` (7932927f);
**Team Focus and Compare are not on `main` yet**, so I read them from the unmerged branch
`origin/claude/batch1-people` (13fe448e). If that branch changes before it merges, those two sections need a re-check.

**How to read it.** "Present" = same figure, same meaning. "Changed" = still there but shown, counted or timed
differently (the note says how). "MISSING" = the user can no longer see it on this screen. v2 screens are fixtures
(invented numbers), so I judged what the model _type_ can carry, not the numbers.

## One-page summary

| Screen         | Items checked | Present | Changed | MISSING |
| -------------- | ------------- | ------- | ------- | ------- |
| Dashboard      | 38            | 3       | 9       | 26      |
| Action Center  | 36            | 7       | 15      | 14      |
| Data Checklist | 30            | 6       | 7       | 17      |
| Team Focus     | 16            | 7       | 5       | 4       |
| Compare        | 33            | 4       | 9       | 20      |
| Machine page   | 34            | 1       | 17      | 16      |
| **Total**      | **187**       | **28**  | **62**  | **97**  |

"Changed" on the Machine page includes four things v2 adds (who fixed it, repeat and waited filters, the story per
breakdown, a 12-week trend); Compare's "Present" includes the new machine picker.

**The ten most serious losses**

1. **No figure opens its rows any more.** Every v1 number drills to the tickets or machines behind it (parity row
   "every number on every screen drills to its tickets", `m4a.drill-down`). No v2 key figure, chart, Pareto bar or
   target bar has a drill; chips open a short drawer, not the rows.
2. **Compare lost most of its page:** the 0–10 age-adjusted health score and its five-part scorecard, the category
   average column, 11 of the 17 checkup rows, the specifications table, both "longest breakdowns" tables, the
   "by shift" table and the by-maintenance-code chart (parity `m4a.compare`, which is marked done).
3. **Machine page lost its engineering facts:** the reliability fit (shape, scale, mean, quartiles, "failures coming
   faster / further apart"), the 14-fact nameplate, age, floor area, connected and running load, record completeness,
   the cell-move history and the open-tasks list.
4. **Dashboard keeps 6 of v1's 20 engine figures, all re-timed to "this month".** Gone: the six machine counts,
   total breakdowns, no-downtime hours, breakdown-free machines, the bubble chart, the expansion timeline, plant
   events (power and air failures), the three daily and per-machine averages.
5. **Dashboard lost "What needs you now"**: breached acknowledge and restore clocks, paused tickets waiting on
   someone, overdue follow-up tasks, each with a link to the ticket.
6. **Data Checklist runs 5 of v1's 16 checks.** Gone: missing date, Done By, problem text, shift, Observed By,
   Electrical/Mechanical type, log gaps of 4+ days, "Why-Why not done" on long breakdowns, dimensions, power,
   location. The breakdown's date is no longer named and the drill to its ticket is gone.
7. **Action Center lost its sorting tools and part of its record:** the four priority counts, the type filter
   (16 kinds), the priority filter, search over the nudges, priority headings, good-news nudges, the "reopened" and
   "out of production data" marks, and the due date and note on an acknowledgement.
8. **Money is shown to everyone.** Parity says money figures are for the maintenance head, plant head and admin only,
   and v1 shows no money on Today or the Action Center. v2 Dashboard, Action Center and Compare print rupees and their
   models carry no role switch. A people screen also has no "you may not see this" state for an operator.
9. **Periods changed without saying so.** v1 Dashboard figures cover the year-to-date span or the whole log; Compare
   covers the machine's whole history. v2 shows "this month", "last 90 days", "this year so far". The same label
   ("Fleet availability", "Breakdowns") now means a different number.
10. **Smaller but real:** Team Focus notes, lane hints and per-lane progress; "Not computed yet" honesty labels;
    the excluded-machines note; the offline state (I am not certain v2 has one; I found none).

**The five best intelligence wins (all from data or engine code we already have)**

1. **Health score in words, back on Compare and the Machine page**: "loses 2.6× what a machine its age and type
   loses" (`compare-score.ts`, `team-focus-health.ts` already compute it). Size S. Cheap win.
2. **Early warning: "failures are coming faster"** on the Dashboard and Machine page, from the reliability fit's
   trend slope (`reliability.ts`, already per machine). Size S. Cheap win.
3. **Forecast with its track record**: next month's hours with a band, plus "our last 6 forecasts were right 5
   times" (`a9-forecast.ts`; the frozen `forecast` table and its `outcome` column). Size S–M.
4. **A confidence line under every figure**: "14 breakdowns have no hours; this figure may be low", from the Data
   Checklist counts the engine already makes (`data-checklist.ts`). Size S. Cheap win.
5. **"It came back after it was fixed" plus the fix that worked elsewhere** on Action Center decisions: the board
   already flags `reopened`; `a9-repeat.ts` finds repeat faults and `fix-finder.ts` ranks similar past fixes.
   Size S–M.

**Data the v2 fixtures show that we do not collect** (these need a product decision, not just wiring): a machine
"idle, no job loaded" (we hold no production-job data); spare parts "in stock / out of stock" (we record spares
used on a breakdown, not stock levels); how many days a data gap has been open and "vs last week" on the checklist
(the engine keeps no first-seen date for a gap; `kpi_snapshot` could hold the counts from now on); a person's role
and "load" (we have job titles and per-person work minutes, but no rule for "overloaded"); a "suggested owner"
(no engine rule yet).

---

## 1. Dashboard

v1: `Dashboard.tsx`, `TodayFigures.tsx`, `NeedsNow.tsx`, `FigureTile.tsx`, `DrillTable.tsx`; figures from
`packages/domain/src/analytics/computers.ts` lines 117–181 (20 `dashboard.*` keys, registry `registry.ts` 80–102);
e2e `analytics.spec.ts`; parity `m4a.dashboard` ("KPI tiles, bubble chart, expansion timeline, derived numbers").
v2: `screens/v2/dashboard/` (model.ts, View.tsx, fixture*.ts).

| Item                                                                  | Where v1 / spec has it                                                           | v2      | Note                                                                                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total machines (CNC + Conventional + Process)                         | `computers.ts` 118                                                               | MISSING | The machines table lists them; no count is printed.                                                                                                                              |
| Utilities count                                                       | `computers.ts` 119                                                               | MISSING |                                                                                                                                                                                  |
| DG sets count                                                         | `computers.ts` 120                                                               | MISSING |                                                                                                                                                                                  |
| CNC machines count                                                    | `computers.ts` 121                                                               | MISSING |                                                                                                                                                                                  |
| Conventional machines count                                           | `computers.ts` 122                                                               | MISSING |                                                                                                                                                                                  |
| Process machines count                                                | `computers.ts` 123                                                               | MISSING |                                                                                                                                                                                  |
| Total breakdowns (count)                                              | `computers.ts` 124                                                               | MISSING | v2 shows hours, not the count; per machine only "stops in 90 days".                                                                                                              |
| Total downtime hours                                                  | `computers.ts` 129                                                               | Changed | Now "Breakdown hours **this month**" (v1: whole log). Same label idea, different number.                                                                                         |
| PM hours                                                              | `computers.ts` 133                                                               | Changed | Only as the PM line on the 12-month chart; no total.                                                                                                                             |
| Breakdown hours with no downtime (NO-DT)                              | `computers.ts` 137                                                               | MISSING |                                                                                                                                                                                  |
| Breakdown-free machines ("x of y ran clean 30 days")                  | `dashboard-flags.ts`; e2e `analytics.spec.ts` 160                                | MISSING | A green square on the plant map hints at it per machine, but the plant sentence is gone.                                                                                         |
| Costliest problems: problem and hours                                 | `TodayFigures.tsx` `problemItems`                                                | Changed | Now a Pareto of hours with a running total.                                                                                                                                      |
| Costliest problems: share % per problem                               | same                                                                             | Changed | Only the top three's combined share, in the "why" text.                                                                                                                          |
| Costliest problems: number of breakdowns per problem                  | same                                                                             | MISSING |                                                                                                                                                                                  |
| Bubble chart (each machine: hours × breakdowns, sized by repair time) | `figure-content.ts` 219; parity `m4a.dashboard`                                  | MISSING | Machines table has hours and stops but no repair time and no picture.                                                                                                            |
| Expansion timeline                                                    | `computers.ts` 178; parity `m4a.dashboard`                                       | MISSING |                                                                                                                                                                                  |
| Fleet availability                                                    | `computers.ts` 154                                                               | Changed | KPI card and target bar, for **this month**; v1 is the year-to-date span and counts PM and plant events as lost. I am not certain v2 keeps that definition. Adds a target (new). |
| Plant events (machine-hours lost to power and air failures)           | `computers.ts` 147                                                               | MISSING |                                                                                                                                                                                  |
| Plant breakdown %                                                     | `computers.ts` 148                                                               | Changed | Probably the "Breakdown share" target bar, this month. I am not certain it is the same formula.                                                                                  |
| Average complaints per day                                            | `computers.ts` 165                                                               | MISSING |                                                                                                                                                                                  |
| Average breakdown hours per day                                       | `computers.ts` 171                                                               | MISSING |                                                                                                                                                                                  |
| Average breakdown hours per CNC machine                               | `computers.ts` 141                                                               | MISSING |                                                                                                                                                                                  |
| Change against 30 days earlier, on every figure                       | `Dashboard.tsx` 85–97                                                            | Changed | Only on 4 key figures and 5 target bars, against last month.                                                                                                                     |
| Every figure opens its rows ("See the rows")                          | `TodayFigures.tsx` `TileLink`, `DrillTable.tsx`; e2e `analytics.spec.ts` 300–312 | MISSING | KPI cards, chart, Pareto and target bars carry no link to rows.                                                                                                                  |
| "Not computed yet" label on a figure the engine has not computed      | `TodayFigures.tsx` 133; e2e 236                                                  | MISSING | v2 model has no per-figure "not computed" state.                                                                                                                                 |
| "N machines left out of production data" in the lede                  | `Dashboard.tsx` 63                                                               | MISSING |                                                                                                                                                                                  |
| As-of date                                                            | `Dashboard.tsx` 62                                                               | Present | Source line and verdict context.                                                                                                                                                 |
| Date the changes are compared against                                 | `Dashboard.tsx` 64                                                               | Changed | "vs Oct".                                                                                                                                                                        |
| Action Center banner (open high and medium counts, link)              | `Dashboard.tsx` 38–56; e2e `analytics-action-center.spec.ts`                     | Changed | Replaced by the decisions list; the high/medium counts are gone.                                                                                                                 |
| Needs-now: breached acknowledge / restore clocks                      | `NeedsNow.tsx` 10–22                                                             | MISSING |                                                                                                                                                                                  |
| Needs-now: paused tickets waiting on someone                          | `NeedsNow.tsx` 33                                                                | MISSING |                                                                                                                                                                                  |
| Needs-now: follow-up tasks past their date                            | `NeedsNow.tsx` 34–36                                                             | MISSING |                                                                                                                                                                                  |
| Needs-now count line ("x items, y clocks breached")                   | `NeedsNow.tsx` 102; e2e 340–357                                                  | MISSING |                                                                                                                                                                                  |
| Needs-now: link to open each ticket                                   | `NeedsNow.tsx` 66–71                                                             | MISSING |                                                                                                                                                                                  |
| Screen menu to Team Focus, Action Center, Data checklist              | `Dashboard.tsx`; e2e 320                                                         | Present | v2 nav.                                                                                                                                                                          |
| Loading, error with Retry                                             | `Dashboard.tsx` 129–141                                                          | Present | `screens/v2/data.ts`, `ui/v2/screen-states.tsx`.                                                                                                                                 |
| Offline state                                                         | `viewState` in `Dashboard.tsx`                                                   | MISSING | I found none in v2; I am not certain.                                                                                                                                            |
| No money on Today; money only for head, plant head, admin             | `Dashboard.tsx` 157; PARITY.md 130                                               | MISSING | v2 prints "₹ 10.4 lakh lost" and rupees on decisions to any reader; model has no role switch.                                                                                    |

New in v2 (not losses): verdict with "why", decisions with hours and rupees, time to repair, time between failures,
PM on time, targets, 12-month trend, plant map by state, machines table (search, 4 filter chips, sort, 12-week
sparkline).

### More intelligent: what the data we already hold could say

| Idea                                 | What the user sees                                                   | Data                                           | Engine today?                                                                     | Size |
| ------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- | ---- |
| Failing faster (cheap win)           | "3 machines are failing faster than before: TC-4, GRD-127, VC-94"    | Breakdown history; reliability fit per machine | Yes: trend slope in `reliability.ts`                                              | S    |
| Forecast with a track record         | "Next month 290–330 h. Our last 6 forecasts were right 5 times"      | `forecast` table (`predicted`, `outcome.hit`)  | Forecast yes (`a9-forecast.ts`, `forecast-freeze.ts`); hit rate needs a small sum | S–M  |
| Where half the hours sit (cheap win) | "Cell 8 and the night shift carry half of this month's hours"        | Breakdown reports by cell, shift, code         | Yes: `breakdown-map.ts` marks the row that passes half                            | S    |
| Confidence line (cheap win)          | "14 breakdowns have no hours; this figure may be low"                | Data Checklist counts                          | Yes: `data-checklist.ts` counts per group                                         | S    |
| Clocks we keep missing               | "Restore clock missed 6 times this week, 2 last week; all on Cell 3" | `sla_timer`, `ticket_event`                    | Not as a figure; data is built                                                    | M    |
| Did last month's fixes work          | "The encoder cable fix on VC-18: 0 repeats in 5 months"              | `intervention` table (before/after)            | Table built; no figure yet                                                        | M    |

## 2. Action Center

v1: `ActionCenterPage.tsx`, `action-center.ts`, `action-center-filters.tsx`, `action-center-parts.tsx`; board
`packages/shared/src/action-center.ts`; engine `action-center-figure.ts`; e2e `analytics-action-center.spec.ts`;
parity `m4a.action-center` ("13 data rules, good news, AMC and legal reminders", done). v2: `screens/v2/action-center/`.

| Item                                                              | Where v1 / spec has it                                                                | v2      | Note                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| Four priority count tiles (high, medium, low, info)               | `action-center-filters.tsx` 19; `bySeverity`                                          | MISSING | v2 key figures are decisions waiting, hours at stake, no owner, settled this week.                         |
| As-of date                                                        | `ActionCenterPage.tsx` lede                                                           | Present | Source line.                                                                                               |
| "Machines needing attention": machine and model                   | `ActionCenterPage.tsx` `RiskTable`                                                    | Changed | Machine chip, name, type, cell; the model is dropped.                                                      |
| Risk score (high 3, medium 2, low 1)                              | `action-center-figure.ts` 118–157                                                     | Present | Same weights in the v2 model comment.                                                                      |
| Risk "why": which rules fired, ×N                                 | same, `why`                                                                           | MISSING | Replaced by counts per priority and a "next step"; the rule names are lost.                                |
| Risk table: top 8 only                                            | `RISK_LIMIT`                                                                          | Changed | v2 lists every machine with open nudges.                                                                   |
| Risk table search, sort, paging                                   | `ActionCenterPage.tsx`                                                                | Present | Plus new filter chips (all, has high, has medium).                                                         |
| Machine opens its machine page                                    | `machineHref`                                                                         | Changed | Opens the machine drawer.                                                                                  |
| Status tabs Open / Acknowledged / Snoozed / Resolved, with counts | `TAB_ORDER`                                                                           | Changed | Waiting / Parked / Settled; "acknowledged and in hand" is no longer its own state.                         |
| Priority filter                                                   | `action-center-filters.tsx` 78                                                        | MISSING |                                                                                                            |
| Type filter (16 kinds)                                            | `action-center-filters.tsx` 93; `NUDGE_RULES`                                         | MISSING |                                                                                                            |
| Search over the nudges                                            | `filterCards`                                                                         | MISSING | Search exists only on the machines table.                                                                  |
| Nudges grouped under priority headings, with counts               | `severityGroups`                                                                      | MISSING | Decisions are ordered by hours won back.                                                                   |
| Nudge type label (e.g. "Recurring fault", "Slow repairs")         | `RULE_LABELS`                                                                         | Changed | Four kinds only: Decide, Fix for good, Inspect, Plan.                                                      |
| Nudge title                                                       | card                                                                                  | Present |                                                                                                            |
| Machine chips                                                     | card                                                                                  | Present |                                                                                                            |
| Number of entries behind the nudge                                | `entries`                                                                             | Changed | A 90-day strip of breakdown days.                                                                          |
| Latest entry date                                                 | `evidence`                                                                            | Changed | Visible only as a mark on the strip, no date printed.                                                      |
| "Reopened" mark                                                   | `reopened`                                                                            | MISSING |                                                                                                            |
| "Out of production data" mark                                     | `excluded`                                                                            | MISSING |                                                                                                            |
| Good-news nudges (info)                                           | rule `good`, severity `info`                                                          | MISSING | No kind for good news.                                                                                     |
| AMC / warranty and legal reminders                                | rules `amc`, `legal`                                                                  | Changed | One fixture decision is "Renew the service contract"; I am not certain every reminder fits the four kinds. |
| Acknowledge with an owner                                         | `action-center-parts.tsx` 46                                                          | Changed | One "Assign" button with a suggested person; choosing another person is not in the model.                  |
| Due date on an acknowledgement                                    | `action-center-parts.tsx` 55                                                          | MISSING |                                                                                                            |
| Note on an acknowledgement                                        | `action-center-parts.tsx` 57                                                          | MISSING |                                                                                                            |
| Snooze for N days                                                 | `snoozeDays`                                                                          | Changed | "Parked until a date"; who sets the date is not shown.                                                     |
| Resolve                                                           | card                                                                                  | Changed | The decision's one action settles it.                                                                      |
| Reopen                                                            | card                                                                                  | Changed | "Undo".                                                                                                    |
| Stored acknowledgement shown (owner, due, note, until)            | `action-center-parts.tsx` 71–90                                                       | Changed | Settled line gives when and who; due and note are gone.                                                    |
| "Could not save" alert                                            | `ActionCenterPage.tsx`                                                                | MISSING | I am not certain; gallery has no network.                                                                  |
| Empty tab message                                                 | `Cards`                                                                               | Present | `settledEmpty`.                                                                                            |
| Refused view for a role without analytics                         | `Waiting`, e2e                                                                        | MISSING |                                                                                                            |
| Loading, error with Retry                                         | `NotReady`                                                                            | Present |                                                                                                            |
| Offline state                                                     | `viewState`                                                                           | MISSING | I am not certain.                                                                                          |
| No money on this screen (spares rupees kept out)                  | `action-center.ts` header                                                             | Changed | v2 prints "₹ x lakh a year" on decisions to everyone.                                                      |
| Raise an inspection ticket from a nudge                           | server route `nudges/:key/ticket` (`apps/server/src/modules/analytics/nudges.ts` 313) | Changed | Not in v1's screen; v2's "decide" button could use it. Counted as changed, not a loss.                     |

### More intelligent: what the data we already hold could say

| Idea                                 | What the user sees                                               | Data                                      | Engine today?                                                | Size |
| ------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ | ---- |
| Came back after a fix (cheap win)    | "This was settled on 2-Nov and came back 3 times since"          | Board `reopened`, nudge acks              | Yes: `reopened` is on the board                              | S    |
| Raise the inspection now (cheap win) | "Inspect" makes a real inspection ticket, linked                 | Server route exists                       | Yes: `nudges.ts` `acceptNudge`                               | S    |
| The fix that worked before           | "Arjun V fixed the same fault on VC-18; no repeat in 5 months"   | Breakdown reports (action taken, done by) | Yes: `fix-finder.ts` ranks similar fixes                     | M    |
| Who is best placed                   | "Neel S closed 9 of the last 12 spindle jobs, fastest median"    | `breakdown_report_person`, `work_segment` | Per-person tables in `a4-manpower.ts`; no "best placed" rule | M    |
| Slipping commitments (cheap win)     | "2 decisions are past the due date their owner gave"             | Ack `due` vs as-of date                   | Data stored; one comparison                                  | S    |
| Money at stake, head roles only      | "Worth ₹ 1.3 lakh a month" shown only to head, plant head, admin | Cost per hour in settings                 | `money-matters.ts`, `money-focus.ts`                         | S    |

## 3. Data Checklist

v1: `DataChecklist.tsx`, `checklist-view.ts`; engine `data-checklist.ts` (16 groups, lines 14–31); e2e
`analytics.spec.ts` 320–333; parity `m4a.data-checklist`. v2: `screens/v2/data-checklist/` (12 invented checks in
`fixture-checks.ts`).

| Item                                                                       | Where v1 / spec has it            | v2      | Note                                                                            |
| -------------------------------------------------------------------------- | --------------------------------- | ------- | ------------------------------------------------------------------------------- |
| "Still to do" total                                                        | `checklist-view.ts`               | Changed | "Records to fix". v1 counts items (a machine missing 3 things = 3).             |
| Count in the breakdown log                                                 | `SECTION_LABELS.log`              | MISSING | Group summary counts checks, not items.                                         |
| Count in the machine records                                               | `SECTION_LABELS.machines`         | MISSING |                                                                                 |
| Count in the analysis (Why-Why)                                            | `SECTION_LABELS.analysis`         | MISSING |                                                                                 |
| Groups ranked by size                                                      | `DataChecklist.tsx` `ranked`      | Changed | Parts of the data ranked by gaps.                                               |
| Check: breakdown date missing or invalid (`bd_date`)                       | `data-checklist.ts` 66            | MISSING |                                                                                 |
| Check: machine id not found (`bd_mach`)                                    | 67                                | Present | "Every breakdown names a machine".                                              |
| Check: downtime hours missing, NO-DT excepted (`bd_hrs`)                   | 68                                | Changed | "Downtime on every closed breakdown"; I am not certain NO-DT is still excepted. |
| Check: maintenance code missing (`bd_code`)                                | 69                                | Changed | "Without a problem code"; I am not certain it is the same field.                |
| Check: Done By missing (`bd_done`)                                         | 70                                | MISSING |                                                                                 |
| Check: problem description missing (`bd_prob`)                             | 71                                | MISSING |                                                                                 |
| Check: shift missing (`bd_shift`)                                          | 72                                | MISSING |                                                                                 |
| Check: Observed By missing (`bd_obs`)                                      | 73                                | MISSING |                                                                                 |
| Check: Electrical / Mechanical type missing (`bd_em`)                      | 74                                | MISSING |                                                                                 |
| Check: 4+ days with no log entries; log not updated in 2+ days (`log_gap`) | `gapItems` 81–120                 | MISSING |                                                                                 |
| Check: long breakdown with no Why-Why (`ww`)                               | `whyWhyItems` 123–135             | MISSING |                                                                                 |
| Check: purchase date or year missing (`mc_age`)                            | 176                               | Present |                                                                                 |
| Check: length and width missing (`mc_dim`)                                 | 177                               | MISSING |                                                                                 |
| Check: power / kVA missing (`mc_pw`)                                       | 178                               | MISSING |                                                                                 |
| Check: cell missing (`mc_cell`)                                            | 183                               | Present |                                                                                 |
| Check: location missing (`mc_loc`)                                         | 184                               | MISSING |                                                                                 |
| Every open item listed (first 20, then "show all")                         | `GroupCards`                      | Changed | One table, 10 a page, search, filter by part, sort by age.                      |
| Each breakdown item names its date and machine                             | `data-checklist.ts` 64            | MISSING | v2 row shows the machine and what is wrong; which breakdown (date) is lost.     |
| Drill to the tickets behind the breakdown gaps                             | `FigureDrill`; `drillIds` 222–227 | MISSING | Rows open the machine or person drawer.                                         |
| "Nothing to fix" state                                                     | `EmptyState`                      | Present | `allClear`.                                                                     |
| As-of date                                                                 | lede                              | Present | Source line.                                                                    |
| "Not computed yet"                                                         | `DataChecklist.tsx` 177           | Changed | v2 has a general empty state.                                                   |
| Loading, error with Retry                                                  | `NotReady`                        | Present |                                                                                 |
| Offline state                                                              | `viewState`                       | MISSING | I am not certain.                                                               |
| Exact counts kept for 1,000+ items (Indian grouping)                       | `grouped()`                       | Changed | Strings arrive printed; fine if the API keeps the grouping.                     |

New in v2: an owner per part of the data, a "fix" action, how long each gap is open, which figure each gap changes,
the checks that pass, and 7 new checks (end time, machine type, excluded machines, PM readings, PM plan, PM due date,
technician shift). The new checks are good, but they do not replace the 11 that went. Gap age and "vs last week" need
data we do not keep (see summary).

### More intelligent: what the data we already hold could say

| Idea                                      | What the user sees                                                         | Data                            | Engine today?                                                                                                                                 | Size |
| ----------------------------------------- | -------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Which figure each gap changes (cheap win) | "12 breakdowns with no hours: Total downtime and Availability are too low" | Group → figure map              | Fixed mapping, no engine maths                                                                                                                | S    |
| Who leaves the gaps                       | "Most missing shifts come from reports closed on the night shift"          | Ticket closer, report shift     | Not computed; data is on `breakdown_report`                                                                                                   | M    |
| Is data getting better                    | "Gaps down from 64 to 31 in four weeks"                                    | Checklist counts per engine run | `kpi_snapshot` is written each run (`apps/server/src/modules/analytics/run.ts`); I am not certain the checklist counts are stored there today | S–M  |
| Suggested fill-in                         | "Problem group for 18 unclassified entries: suggested 'Coolant', accept?"  | Problem text                    | Yes: `problem-suggest.ts` (the platform's own text classifier)                                                                                | M    |
| Why-Why overdue, oldest first (cheap win) | "3 stops over the Why-Why limit; oldest 41 days"                           | `ww` items carry the date       | Yes: `whyWhyItems`                                                                                                                            | S    |

## 4. Team Focus (from the unmerged branch `origin/claude/batch1-people`)

v1: `TeamFocusPage.tsx`, `team-focus-actions.ts`; engine `team-focus.ts` (six lanes, three KPIs, 31 actions in the
key); e2e `analytics-compare.spec.ts` 145–169; parity `m4a.team-focus` ("ranked actions with owner, status, note",
done). v2: `screens/v2/team-focus/`.

| Item                                                | Where v1 / spec has it  | v2      | Note                                                                                      |
| --------------------------------------------------- | ----------------------- | ------- | ----------------------------------------------------------------------------------------- |
| KPI "Actions" with "x not started, y in progress"   | `team-focus.ts` 307     | Changed | "Open actions".                                                                           |
| KPI "Done" with "x marked not needed"               | 311                     | Changed | Folded into one "Done" share.                                                             |
| KPI "Progress %"                                    | 312                     | Present | v2 "Done", share done or not needed.                                                      |
| Six lanes, each its own group                       | `FOCUS_LANES`           | Changed | Lane name kept as a pill on each row; rows are not grouped; three lanes share one colour. |
| Lane hint (what the lane is for)                    | `FOCUS_LANE_HINTS`      | MISSING |                                                                                           |
| Per-lane "open of total"                            | `LaneCard`              | MISSING |                                                                                           |
| Lane order (A, B, C, F, D, E)                       | `FOCUS_LANES`           | Changed | Sorted by hours at stake.                                                                 |
| Every action listed (31 in the key)                 | e2e 154–155             | Present | Table, 10 a page, search.                                                                 |
| Action title                                        | `ActionRow`             | Present |                                                                                           |
| Machine named                                       | `ActionRow`             | Present | Chips.                                                                                    |
| Hours at stake                                      | `stakeText`             | Present | v2 says "a month"; I am not certain v1's stake is per month.                              |
| Status (not started, in progress, done, not needed) | `focusStatusKey`        | Present | Same four.                                                                                |
| Owner                                               | `ActionRow`             | Present | Chip, or "No owner".                                                                      |
| Note                                                | `ActionRow`; parity row | MISSING |                                                                                           |
| Drill to the machines the actions name              | `FigureDrill`           | MISSING | A row opens only its first machine.                                                       |
| Not-ready message                                   | `TeamFocusPage.tsx`     | Changed | General empty state.                                                                      |

New in v2: actions with no owner as decisions, a people table (open, hours, done, load), a rebalance proposal.
These need a rule for "overloaded" and a suggested-owner rule; neither exists in the engine.

### More intelligent: what the data we already hold could say

| Idea                                      | What the user sees                                              | Data                                  | Engine today?                                                | Size |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ | ---- |
| Real workload                             | "Neel S logged 52 h on breakdowns this week, team average 31 h" | `work_segment`, `crew_member`         | Per-person tables in `a4-manpower.ts`; weekly view not built | M    |
| Who is best placed                        | "Suggested: Meera K, closed 7 coolant jobs, fastest median"     | `breakdown_report_person`, categories | Not a rule yet                                               | M    |
| Hours priced, head roles only (cheap win) | "Open actions are worth ₹ 4.2 lakh a year"                      | Cost per hour                         | Yes: `money-focus.ts`                                        | S    |
| Did it work                               | "After the axis-encoder fix, VC-67 had 0 repeats in 60 days"    | `intervention` (before/after)         | Table built; no figure                                       | M    |
| Overdue Why-Why ageing (cheap win)        | "Why-Why on the 11-hour spindle stop: due 12 days ago"          | `ww` items, lane F                    | Yes: lane F in `team-focus.ts`                               | S    |

## 5. Compare (from the unmerged branch `origin/claude/batch1-people`)

v1: Machines face, `?screen=compare`, drawn by `KeyPage.tsx` / `key-body.tsx` from engine `compare.ts` and
`compare-score.ts`; answer key `fixtures/answer-key/compare.json` (no KPIs, six tables, two charts); e2e
`analytics-compare.spec.ts` 110–138; parity `m4a.compare` (done). v2: `screens/v2/compare/`.

Both v1 and v2 compare two machines only. v1 lets the engine pick the pair (the worst two of the biggest CNC
category); v2 adds a picker, which is better, but the engine computes one pair today, so the API needs a new input.

| Item                                                                                                                                         | Where v1 / spec has it             | v2            | Note                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| Health score 0–10, age-adjusted                                                                                                              | key "Health checkup" row 1         | MISSING       |                                                                                               |
| Health scorecard: 5 weighted parts (frequency 30%, hours 25%, repair time 15%, trend 15%, repeat and very long 10%), each against "expected" | key "Health scorecard"             | MISSING       |                                                                                               |
| Category average column                                                                                                                      | key "Health checkup"               | MISSING       | v2 compares the two only; no peer.                                                            |
| Availability                                                                                                                                 | checkup                            | Changed       | "This year so far" against planned time; v1 uses the machine's whole history.                 |
| Breakdowns                                                                                                                                   | checkup                            | Changed       | This year so far.                                                                             |
| Breakdowns per month                                                                                                                         | checkup                            | MISSING       |                                                                                               |
| Breakdown hours                                                                                                                              | checkup                            | Changed       | This year so far.                                                                             |
| Breakdown hours per month                                                                                                                    | checkup                            | MISSING       |                                                                                               |
| MTTR                                                                                                                                         | checkup                            | Changed       | Period differs.                                                                               |
| MTBF                                                                                                                                         | checkup                            | Changed       | v2 = (planned − breakdown hours) ÷ count, this year; I am not certain v1 uses the same basis. |
| Longest breakdown                                                                                                                            | checkup                            | MISSING       |                                                                                               |
| Days since last breakdown                                                                                                                    | checkup                            | MISSING       |                                                                                               |
| Spares cost                                                                                                                                  | checkup                            | MISSING       | v2 shows "Money lost" (hours × rate) instead, a different figure.                             |
| Spares cost per breakdown                                                                                                                    | checkup                            | MISSING       |                                                                                               |
| Breakdowns, last 90 days                                                                                                                     | checkup                            | MISSING       |                                                                                               |
| Breakdowns, the 90 days before                                                                                                               | checkup                            | MISSING       |                                                                                               |
| Electrical breakdowns                                                                                                                        | checkup                            | MISSING       |                                                                                               |
| Mechanical breakdowns                                                                                                                        | checkup                            | MISSING       |                                                                                               |
| PM entries logged                                                                                                                            | checkup                            | MISSING       |                                                                                               |
| ✓ on the better value                                                                                                                        | checkup                            | Changed       | "Better / 2.7× more / About the same", in words; better.                                      |
| One-line explanation under each row                                                                                                          | checkup row hints                  | Present       | `hint` per figure.                                                                            |
| Specifications: category, age, cell                                                                                                          | key "Specifications"               | Present       | In the line under each machine.                                                               |
| Specifications: make, model, controller, control unit, year, power, footprint, location                                                      | key "Specifications"               | MISSING       |                                                                                               |
| Longest breakdowns, machine A (date, problem, code, hours; top 5)                                                                            | key table 4                        | MISSING       |                                                                                               |
| Longest breakdowns, machine B                                                                                                                | key table 5                        | MISSING       |                                                                                               |
| By shift (breakdowns and hours per shift, both machines)                                                                                     | key table 6                        | MISSING       |                                                                                               |
| Chart: breakdown hours by maintenance code                                                                                                   | key `ch-cmp-code`; e2e 126         | Changed       | "What is different" lists the top problems in words; the code chart is gone.                  |
| Chart: breakdown hours by month                                                                                                              | key `ch-cmp-month`; e2e 127        | Changed       | Breakdown hours a week, 12 weeks.                                                             |
| Sort any table column                                                                                                                        | `key-body.tsx`, `engine-table.tsx` | MISSING       | No tables left.                                                                               |
| Drill to the two machines' rows                                                                                                              | e2e 129–137                        | Changed       | Chips open the machine drawer.                                                                |
| Choose the two machines                                                                                                                      | not in v1                          | Present (new) | Counted present: v2 adds it.                                                                  |
| Money only for head roles                                                                                                                    | PARITY.md 130                      | MISSING       | "Extra money lost" shown with no role switch.                                                 |
| Loading, error                                                                                                                               | key screen states                  | Present       |                                                                                               |

### More intelligent: what the data we already hold could say

| Idea                                       | What the user sees                                         | Data                              | Engine today?                                   | Size |
| ------------------------------------------ | ---------------------------------------------------------- | --------------------------------- | ----------------------------------------------- | ---- |
| Expected for its age, in words (cheap win) | "VC-28 loses 2.6× what a 4-year-old VMC loses; VC-22 1.1×" | Breakdowns, machine age, category | Yes: `compare-score.ts`, `team-focus-health.ts` | S    |
| Rank in the fleet (cheap win)              | "VC-28 is 3rd worst of 18 VMCs"                            | Same score for every machine      | Yes: the score is computed per machine          | S    |
| Where the gap comes from                   | "70% of the gap is ATC faults on the night shift"          | Code and shift per report         | `breakdown-map.ts`, `shift-split.ts`            | S–M  |
| Before and after                           | Compare a machine with itself before and after an overhaul | `intervention` table              | Table built; no figure                          | M    |
| Compare cells, shifts or technicians       | Same two-box layout for Cell 6 vs Cell 8                   | Reports by cell, shift, person    | `breakdown-map.ts`, `a4-manpower.ts`            | M    |
| By failure code                            | "VC-28: 9 of 27 failures are encoder / cable / bend"       | Failure codes on reports (M4b)    | Data built; small grouping                      | S    |

## 6. Machine page

v1: `MachinePage.tsx`, `machine-tiles.tsx`, `machine-summary.tsx`, `machine-parts.tsx`, `machine-tasks.tsx`,
`reliability-parts.tsx`, `machine-record.ts`; engine `machine-page.ts`, `reliability.ts`, `critical-spares.ts`;
answer key `machine-page.json`; e2e `analytics-machine-reliability.spec.ts`, `analytics-machines.spec.ts` 201;
parity `m4a.machine-pages`. (`machine-values.ts` is the register and cell-log screen, not this page; its CSV export
of the cell change log stays on the Machines screen and is out of scope here.) v2: `screens/v2/machine/`.

| Item                                                                                                                                                                       | Where v1 / spec has it                                   | v2            | Note                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| Age, with its basis (or "no purchase date")                                                                                                                                | `machine-tiles.tsx` 61–70                                | MISSING       |                                                                 |
| Floor area (length × width)                                                                                                                                                | 74–81                                                    | MISSING       |                                                                 |
| Connected load (kVA)                                                                                                                                                       | 85                                                       | MISSING       |                                                                 |
| Running load estimate, with efficiency factor                                                                                                                              | 92                                                       | MISSING       |                                                                 |
| Breakdowns                                                                                                                                                                 | 109                                                      | Changed       | Last 90 days (v1: all the machine's history).                   |
| Breakdown hours                                                                                                                                                            | 117                                                      | Changed       | This month.                                                     |
| MTTR                                                                                                                                                                       | 126                                                      | Changed       | Period differs.                                                 |
| PM hours                                                                                                                                                                   | 135                                                      | Changed       | This month, and again in the PM card.                           |
| Each tile opens its rows                                                                                                                                                   | `machine-tiles.tsx` 35                                   | MISSING       |                                                                 |
| Last breakdown date                                                                                                                                                        | `machine-summary.tsx` 17                                 | Changed       | Readable as the top row of the history table, not stated.       |
| Most frequent problem                                                                                                                                                      | 22                                                       | MISSING       |                                                                 |
| All breakdowns (drill)                                                                                                                                                     | `DrillAction`                                            | Changed       | History table, but only the last 12 months.                     |
| Reliability fit: shape, scale, mean                                                                                                                                        | `reliability-parts.tsx` 72–83                            | MISSING       |                                                                 |
| Fit sample and quartiles                                                                                                                                                   | 89–93                                                    | MISSING       |                                                                 |
| Trend: failures coming faster / further apart                                                                                                                              | 102; `analytics.machine.fit.*`                           | MISSING       |                                                                 |
| "Not enough history" explanation, category fit                                                                                                                             | 118–131                                                  | MISSING       |                                                                 |
| Critical spares table (part, uses, downtime, last used; top 5 of N)                                                                                                        | 145–170; e2e `analytics-machine-reliability.spec.ts` 224 | Changed       | Sentences per part; adds stock status, which we do not collect. |
| "No spare recorded" message                                                                                                                                                | 145                                                      | Changed       | Not modelled; I am not certain.                                 |
| Open follow-up tasks list                                                                                                                                                  | `machine-tasks.tsx` 84                                   | MISSING       |                                                                 |
| PM tasks list                                                                                                                                                              | 85                                                       | Changed       | "Next PM" and last visits.                                      |
| Cell and location moves (date, cell, location)                                                                                                                             | `machine-summary.tsx` 95–125                             | MISSING       |                                                                 |
| Nameplate: segment, category, make, model, serial, controller, controller model, controller serial, asset code, year, date of purchase, cell, location, conveyor side (14) | `machine-parts.tsx` 60; `analytics.machine.fact.*`       | MISSING       | v2 shows type and cell only.                                    |
| PM visits count                                                                                                                                                            | `machine-summary.tsx` 41                                 | Changed       | "Done on the day x of y, last 12 months".                       |
| PM hours (all)                                                                                                                                                             | 46                                                       | Changed       | This month.                                                     |
| Record completeness ("x of y fields", missing list)                                                                                                                        | 68–81                                                    | MISSING       |                                                                 |
| Breadcrumb back to the registers                                                                                                                                           | `MachinePage.tsx` `DrillTrail`                           | Changed       | v2 nav.                                                         |
| "No page for this machine" / "Not computed"                                                                                                                                | `MachinePage.tsx` 92                                     | Present       | `ashell.entity.notFound`.                                       |
| Operator refused                                                                                                                                                           | e2e `analytics-machine-reliability.spec.ts` 352          | MISSING       |                                                                 |
| Machine outside the figure's fleet says so                                                                                                                                 | e2e 318                                                  | MISSING       | I am not certain; no such state in the model.                   |
| Loading, error                                                                                                                                                             | `NotReady`                                               | Changed       | Present in `data.ts`; offline missing.                          |
| Who fixed each breakdown                                                                                                                                                   | not on v1 page                                           | Changed (new) | v2 adds it (done-by on the report).                             |
| Repeat and waited-for-spares filters                                                                                                                                       | not on v1 page                                           | Changed (new) | v2 adds them.                                                   |
| Breakdown story per row                                                                                                                                                    | not on v1 page                                           | Changed (new) | v2 adds it.                                                     |
| 12-week trend                                                                                                                                                              | not on v1 page                                           | Changed (new) | v2 adds it.                                                     |

### More intelligent: what the data we already hold could say

| Idea                                                   | What the user sees                                                  | Data                               | Engine today?                              | Size |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ | ---- |
| Failing faster (cheap win)                             | "Failures are coming faster: every 9 days now, every 16 in spring"  | Failure dates, working hours       | Yes: `reliability.ts`                      | S    |
| Likely next failure                                    | "Half of machines like this fail again within 140 working hours"    | Reliability fit (scale, quartiles) | Yes: fit is computed; wording only         | S–M  |
| Health against its peers (cheap win)                   | "Health 4.1 / 10; expected 7 for its age; 3rd worst of 18"          | Compare score                      | Yes: `compare-score.ts`                    | S    |
| Repeat fault and whether the last fix held             | "Coolant leak 4 times since 13-Oct pump-seal fix; fix did not hold" | Repeat faults, past actions        | Yes: `a9-repeat.ts`, `fix-finder.ts`       | S–M  |
| Spares to keep ready (cheap win, no stock data needed) | "Encoder cable used 4 times in 90 days; keep 2"                     | Spares named on reports            | Yes: `critical-spares.ts`                  | S    |
| AMC, warranty and legal dates                          | "Warranty ends 12-Jan-2027; next calibration due 3-Dec"             | `asset_register`                   | Data built; nudges `amc`, `legal` exist    | S    |
| PM effectiveness                                       | "Breakdowns in the 30 days after a PM: 1; before: 4"                | PM tickets, breakdowns             | Not computed (spec names PM effectiveness) | M    |

## What I could not verify

- Team Focus and Compare are on an unmerged branch; I audited 13fe448e.
- Whether v2's "Breakdown share", "Fleet availability", MTBF and the checklist's "problem code" use v1's exact
  formulas: the fixtures are invented, so the model cannot tell me. Each is marked "I am not certain" above.
- Offline and "could not save" states: none found in v2 screens, but the shell may add them later.
- Whether checklist counts are already stored in `kpi_snapshot` per run.
