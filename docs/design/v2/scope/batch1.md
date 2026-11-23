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

| Screen         | Items checked | Present | Changed | MISSING                               |
| -------------- | ------------- | ------- | ------- | ------------------------------------- |
| Dashboard      | 38            | 3       | 9       | 0 (cleared, `scope/dashboard.md`)     |
| Action Center  | 36            | 7       | 15      | 0 (cleared, `scope/action-center.md`) |
| Data Checklist | 30            | 6       | 7       | 17                                    |
| Team Focus     | 16            | 7       | 5       | 4                                     |
| Compare        | 33            | 4       | 9       | 20                                    |
| Machine page   | 34            | 1       | 17      | 0 (cleared, `scope/machine.md`)       |
| **Total**      | **187**       | **28**  | **62**  | **97**                                |

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

**Cleared 20-Nov-2026: live at `/analytics/today`.** The 26 MISSING and 9 changed rows now read same or moved in `scope/dashboard.md`, with where each is. The invented sections that had no data are listed there as removed, with a `later:` line each.

## 2. Action Center

**Cleared 20-Nov-2026: live at `/analytics/today/action-center`.** The 14 MISSING and 15 changed rows now read same or moved in `scope/action-center.md`. "Hours won back" and money, the suggested owners and the 90-day strips had no source and are removed there, each with a `later:` line.

## 3. Data Checklist

**Cleared by DC-2 (#578): live at `/analytics/today/checklist`.** Every MISSING and changed row below now reads same,
changed or better in `scope/data-checklist.md`, with where each is. The table below is the original audit.

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

**Cleared 20-Nov-2026: live at `/analytics/machines/:id`.** The 16 MISSING and 17 changed rows now read same or moved in `scope/machine.md` (one row reads changed: a machine-page figure that is not computed shows the empty state). The History table, the next action, the 12-week trend and the spares' stock had no source and are removed there, each with a `later:` line.

## What I could not verify

- Team Focus and Compare are on an unmerged branch; I audited 13fe448e.
- Whether v2's "Breakdown share", "Fleet availability", MTBF and the checklist's "problem code" use v1's exact
  formulas: the fixtures are invented, so the model cannot tell me. Each is marked "I am not certain" above.
- Offline and "could not save" states: none found in v2 screens, but the shell may add them later.
- Whether checklist counts are already stored in `kpi_snapshot` per run.
