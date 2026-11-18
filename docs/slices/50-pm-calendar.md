# M4b-50 — PM calendar and compliance (ticket 50)

Ticket 50: the PM calendar (FullCalendar under an ADR) spreads load and moving a job reschedules it; the machine
page lists its open and PM tasks; PM compliance and schedule compliance are defined once here and match
hand-computed fixtures (`docs/plan/MILESTONES.md:440-445`). Blocked by 49. Authority: **ADR 0009**
(`docs/adr/0009-fullcalendar.md`), **D17** (no new table), **D27** (lazy chart chunks and the token palette),
**D28** (the advisory gate), the 0015 migration and 49's frozen contract (`docs/slices/49-pm-plans.md`). This plan
is frozen: every fork below is a numbered ruling with its cost if wrong; there is no open question left for a
builder.

**Revision (19 Nov 2026, after the plan review).** Re-frozen against the merged 49a (`e10b5bb2`) and the contracts
49b/49c land with: the calendar consumes `pmPlansForScheduling`/`pmNextDue`, not a new plan query; a drag never
edits a `pm_plan` row (it materialises or moves a ticket's `task_expected_on`); the compliance definitions moved
from plan-chain reconstruction to the work order's own scheduled date, because 49's one-plan-per-machine reduction
does not store the 427 visits; the hand-computed fixture, the per-row `kpi_snapshot` profile, the live workbook's
PM sheets and the load cap are recorded; the no-dependency fallback is the ADR's, not a second design.

## Prerequisite contract (49a/49b/49c, assumed merged before 50 starts)

50 does not reopen these; it consumes them by name.

1. **Plans and their next due.** `apps/server/src/modules/plant/repo/records.ts` exports `PmPlan` and
   `PmPlanDraftInput` (`:23-35`, `:7-21`), `insertPmPlan` (`:114`), `pmPlanById` (`:144`) and
   `activePlanForMachine` (`:155`). 49b adds `pmPlansForScheduling(client, tenantId)` and `pmPlanForMachine`, and
   49c adds `recordPmCompletion`; all are exported through `plant/index.ts` (`docs/slices/49-pm-plans.md:240-242`).
   `pmPlansForScheduling` is **one row per machine**: an active machine plan, else the active category plan for
   that machine's category, scrapped machines out (`docs/slices/49-pm-plans.md:341-343`). Every row carries a
   non-null `machineId`; 50a's seed test proves the category expansion.
2. **The planned raise.** `apps/server/src/modules/tickets/planned.ts` exports
   `raisePlannedTicket(client, input)` with
   `input = { tenantId; machineId; channel: 'pm' | 'inspection'; problem; reportedByPersonId?; raisedLoginId?; at? }`
   (`:10-21`), raising `kind: 'general'`, `raisedChannel` the input channel, a `WR-` reference, in the caller's
   transaction (`:46-104`). 46c's shared `PLANNED_CHANNELS`/`isPlannedChannel` are the one predicate
   (`packages/shared/src/channel.ts:17-21`).
3. **The PM job and close.** `pm.generate` raises one `general`/`pm` ticket per due machine unless an open PM ticket
   exists (`docs/slices/49-pm-plans.md:317-344`); `pmDue(plan, {today, horizonDays, openPm, baseline})` returns
   `{due, nextDue, rule, overdue}` (`:317-320`). `pmReportSchema` has an optional `planId`; the close builds the
   stored `pm_report` before the store and `recordPmCompletion` moves `last_done_on`/`last_meter_reading` for an
   active plan (`docs/slices/49-pm-plans.md:380-392`).
4. **The channel filters.** The floor's `openOnMachines` counts only breakdown channels and the desk's
   `workRequests` excludes planned channels; a PM job does not make a machine look occupied
   (`docs/slices/49-pm-plans.md:203-209`). 50 relies on that and adds no filter.
5. **The schema.** `pm_plan` has no scheduled-date column: `last_done_on`, the `created_at` clock anchor, interval,
   meter fields and `active` are all it holds (`packages/db/migrations/0015_m4b_schema.sql:105-129`). The planned
   ticket's `task_expected_on date` column already exists on `ticket` (`0001_schema_v1.sql:255`); 50 uses it as
   the planned job's scheduled date (R3/R11).

## Facts it rests on (verified in this checkout, 19 Nov 2026)

| Fact                              | Evidence                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ticket and its blocker        | `docs/plan/MILESTONES.md:440-445` (blocked by 49; calendar, load spreading, drag reschedule, machine tasks, the two compliance figures)                                                                                           |
| The plan's own shape              | `docs/slices/49-pm-plans.md:45-56`; one recurring plan per machine, checklist on the row, job is a `pm` ticket, no new table/module/dependency/migration                                                                          |
| `pm_plan` columns and grants      | `packages/db/migrations/0015_m4b_schema.sql:105-129`; the `pm`/`inspection` channel CHECK at `:29-31`; `breakdown_report.pm_report` at `:34-39`                                                                                   |
| The planned raise                 | `apps/server/src/modules/tickets/planned.ts:10-21` (input), `:46-104` (kind `general`, `WR-`, caller's transaction)                                                                                                               |
| The planned channels              | `packages/shared/src/channel.ts:17-21` (`PLANNED_CHANNELS`, `isPlannedChannel`)                                                                                                                                                   |
| The PM repo                       | `apps/server/src/modules/plant/repo/records.ts:23-35` (`PmPlan`), `:114-142` (`insertPmPlan`), `:144-151` (`pmPlanById`), `:154-171` (`activePlanForMachine`)                                                                     |
| The PM settings resource          | `apps/server/src/modules/plant/settings-pm.ts:1-11` (one recurring plan, generic store), `:120` (the `Resource`); `apps/web/src/screens/settings/pm-plans-spec.tsx:5-24` (the screen and next-due rule)                           |
| The next-due rule already written | `apps/web/src/screens/settings/pm-plans-spec.tsx:14-24`: `last_done_on` else the plant-local `created_at`, plus `interval_days`                                                                                                   |
| The machine page                  | `apps/web/src/screens/analytics/MachinePage.tsx:55-98`; `apps/web/src/screens/analytics/machine-summary.tsx:165-175` (`RecordBody` blocks)                                                                                        |
| The PM menu group is empty        | `apps/web/src/screens/analytics/groups.ts:75` (`{ id: 'pm', … screens: [] }`); labels at `:98-140`; the face switch at `apps/web/src/screens/analytics/Analytics.tsx:70-87`                                                       |
| The route budget                  | `apps/server/src/modules/tickets/routes.ts` is 384 lines; `registerTickets` ends at `:384`; a new route file, not more routes in this one                                                                                         |
| The engine's input                | `packages/domain/src/analytics/types.ts:109-122` (`TicketRow`), `:222-239` (`EngineData`); the ticket loader at `apps/server/src/modules/tickets/repo/analytics.ts:10-18` already selects `raised_channel` and `task_expected_on` |
| The loader                        | `apps/server/src/modules/analytics/load.ts:178-220`                                                                                                                                                                               |
| The snapshot                      | `apps/server/src/modules/analytics/snapshot.ts:7-8` (one `PROFILE = 'legacy'` today), `:18-39`; `kpi_snapshot` at `packages/db/migrations/0014_m4a_schema.sql:54-74`                                                              |
| The figure plumbing               | `packages/domain/src/analytics/registry.ts:90-111`; `packages/domain/src/analytics/computers.ts:220-243`; `packages/domain/test/analytics-engine.test.ts:68-92` (owner 38–45 today)                                               |
| The i18n limits                   | `packages/shared/test/catalogue.test.ts:108-115` (250 lines, key-identical `gu`, frozen shipped namespaces); `analytics.en.ts` is 248 lines; `packages/shared/src/i18n/pm.en.ts` is 22 lines and its `gu` is `blank(pmEn)`        |
| The dependency list               | `THIRD_PARTY.md:30` already lists "FullCalendar standard plugins" (MIT) as the PM calendar; SPEC §5a commits it (`docs/spec/SPEC.md:186`); ARCHITECTURE repeats it (`docs/ARCHITECTURE.md:170`)                                   |
| The chart precedent               | `docs/decisions/D27-charts-echarts.md` (one lazy door, a guard test, a chunk check, an exact pin); `docs/decisions/D28-dependency-advisory-gate.md` (high advisory fails CI)                                                      |
| The platform's PM page            | `fixtures/answer-key/pm-plan.json:14` (`extra.status` `{od:154, ok:15, late:1, up:257}`, summing to 427) and the page text (`:5-14`: "at most 1 PM a day", "±15 days", "162 dates are suggestions", "Spread the load")            |
| The workbook settings             | `fixtures/answer-key/input.json:2219` (`pmTolDays:15`), `:2220` (`pmFreq:2`), `:2226` (`pmCap:1`), `:2229` (`pmDays:[1..6]`)                                                                                                      |
| The triage                        | `docs/plan/m4a-triage.md:23-24`: pm-plan 427 planned dates, the calendar page itself is ticket 50; two real PM reports                                                                                                            |
| 48's basis                        | `docs/slices/48-shift-kpis.md:14-16` (schedule compliance is 50's, PM compliance is 50's while PM hours are 48's) and `:574` ("No schedule compliance and no PM compliance (ticket 50, E10)")                                     |
| The parity rows                   | `docs/spec/parity.yaml:1270-1293` (`m4a.pm-plan`, `m4a.pm-reports`, both `todo` until 49's merge); 50 flips pm-plan only                                                                                                          |
| The slow-machine constraints      | `page-content.ts` 397/400, `analytics.en.ts` 248/250, `use-chart.ts` 394/400; 50 touches none of them                                                                                                                             |

### The platform's PM numbers, and why they are reference only

`pm-plan.json` counts the platform's **427 projected visits**, not the product's 125 plans: `154 + 15 + 1 + 257 =
427` (`fixtures/answer-key/pm-plan.json:14`). The platform's `pmStat` calls a visit done on time when it is done
within ±15 days of the visit's date, late otherwise, and "not marked done" once the visit plus tolerance is past
(`docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html:9087-9098`). 49 reduced those 427 visits to 125
plans and preserved each machine's **next** date, not the visit list (`docs/slices/49-pm-plans.md:120-143`). The
platform's status counts therefore cannot be reproduced from the product's tables and are **not** the
denominator below; they are evidence for the ± window and for what "on time" meant. The product's compliance is
defined over **planned work orders (tickets)**, the only dated record the product keeps.

## The shape in one paragraph

The PM group (`/analytics/pm`) gets one new screen: a lazy FullCalendar 7.1.5 month grid of each machine's **next**
PM — the plan's next due, or the open PM ticket when one exists — with the plant's daily load. Dragging an
occurrence never edits the plan: it creates a PM ticket at the target date, or moves an existing open PM ticket's
`task_expected_on`, writes one audit event, and leaves `pm_plan.last_done_on`/`created_at` untouched. A move is
allowed only inside the plan's tolerance window, on a working day, and never onto a day that already holds a PM;
the page marks crowded days and offers the nearest free day (`spread`), which is the load-spreading rule. The same
screen shows two figures computed once in `packages/domain`: **PM compliance** (PM work orders done inside their
± tolerance ÷ PM work orders judged) and **schedule compliance** (planned work orders done by the end of their
scheduled Monday–Sunday week ÷ planned work orders judged). Both are computed on read, and only a stored analytics
run freezes them in `kpi_snapshot` (profile `standard`); 53 reads the month-end row. The machine page gains a live
"Tasks" block: its open (non-PM) tickets and its open PM tickets, each linking to `/desk/:id`, from the existing
ticket list with no new endpoint. The live workbook's PM Plan and PM Reports sheets are wired from the plans and
the closed `pm_report`s (125 next-date rows, not 427 visits). No new module, table, column or migration.

## Rulings (each settled here; none left open)

**R1 — FullCalendar 7.1.5, MIT, under ADR 0009, lazy and behind one door.** The package is `@fullcalendar/react`
7.1.5 with the `daygrid`, `interaction` and `classic` theme subpath plugins and `temporal-polyfill` 1.0.8 (a peer
dependency, MIT). It is pinned exactly in `apps/web/package.json`; its transitive `@fullcalendar/core` 7.1.5 and
`@full-ui/headless-calendar` 7.1.5 are MIT and enter the repo-root `THIRD_PARTY.md` (not a `docs/` file). One file,
`apps/web/src/screens/analytics/PmCalendar.tsx`, names `@fullcalendar`; the page that imports it is reached through
`React.lazy(() => import('./PmCalendarPage.js'))`, so the library is a separate chunk and never a start-up file. A
source guard and a build-chunk guard mirror D27's ECharts guard, with a planted violation. No premium plugin, no
resource view, no scheduler. **Cost if wrong:** a later calendar view (a list view, a resource timeline) needs a new
ADR for the timeline and a paid licence for the premium views; a list view is another free subpath of the same
package, not a new dependency.

**R2 — the calendar's data source is each machine's next due, plus its open PM ticket.** `pmPlansForScheduling`
gives one effective plan per machine (prerequisite 1); its next due is
`pmNextDue({lastDoneOn, createdAt, intervalDays}, timeZone)` — the rule 49a already uses
(`apps/web/src/screens/settings/pm-plans-spec.tsx:14-24`), moved to `packages/shared/src/pm.ts` so the screen, the
calendar and the tests share it; the settings spec re-exports `pmPlanNextDue` as the shared function's alias, so
49a's test is unchanged. A machine with an open `pm` ticket shows the ticket at
`task_expected_on ?? plantDay(reported_at)` and suppresses the plan occurrence (the scheduler already suppresses
that machine). A machine without one shows exactly one occurrence at its next due. **The calendar does not
project the platform's 2027 visit series or its 154 overdue visits**; 49's reduction lost them, and 53/54 read the
ticket record instead. **Cost if wrong:** a planner sees one PM per machine and must come back after each close
for the next one; the platform's 427-row year view is not reproduced, which 49 R2 already records as its cost.

**R3 — a drag never edits the plan; it writes the job (the ticket).** For a projected occurrence with no ticket,
`POST /api/v1/pm/reschedule` calls `raisePlannedTicket` with `at: now`, `scheduledOn: <target>`, channel `pm`, and
the plan's title in the problem; the new ticket's `task_expected_on` is the target. For an open PM ticket, the
same endpoint updates that row's `task_expected_on` and does **not** touch `reported_at`, `started_at` or the
plan. `pm_plan.last_done_on`, `last_meter_reading` and `created_at` are only ever moved by a close
(`recordPmCompletion`, 49c). A move writes one `ticket_event` of type `update` with
`changes.scheduledOn = {from, to}` and the actor; the plan's own audit line stays its settings update. Moving a
ticket that is `working` or `waiting`, or that has `started_at` set, is refused with 409. **Cost if wrong:** a
planner who wants to shift the recurrence itself (all future PMs) must edit the plan's interval/last-done on the
settings screen; the calendar shifts one job, which is the meaning of "moving a job reschedules it". A database
trigger or a later integration that reads `task_expected_on` as a task-only field would see the PM ticket's
scheduled date there; the column is already on every ticket and `parent_id IS NULL` keeps the task UI away.

**R4 — the move window is the plan's tolerance, on a working day, not in the past.** `scheduledOn` must be a real
plant date, `>= plantToday`, a Monday–Saturday (the platform's `pmDays` default `[1..6]`), and inside
`dueOn ± pmToleranceDays(intervalDays)` inclusive, where `dueOn` is the plan's next due at the time of the move.
`pmToleranceDays` is the platform's own scaling, recorded here rather than copied from the page: `15` when the
interval is null or at least 150 days, otherwise `max(1, min(15, round(15 × interval ÷ 182)))`
(`cosmos_platform-2026-11-11.html:7822` as reference). A 182-day plan gets 15 days; a 30-day plan gets 2. A
category plan resolves to the machine and uses that plan's interval. A ticket whose plan was deleted keeps the
default 15-day window and can still be moved; a plan with no interval cannot be moved. **Cost if wrong:** a plant
that works Sundays cannot schedule on one through this screen (it can still close a job that falls there); the
platform's `pmDays` setting is not imported in 49, and changing the rule is a constant in one function.

**R5 — the load-spreading rule: one PM per plant working day, shown and enforced on a move, never bulk-rewritten.**
A day's load is the number of occurrences (projected next dues and open PM tickets) whose scheduled date is that
day. The cap is **1** — the platform's default `pmCap` (`fixtures/answer-key/input.json:2226`), fixed because 49
did not import the setting. The calendar marks every occurrence on a day with load > 1 as **crowded** and computes
`suggestedOn`: the nearest free working day within the plan's tolerance, forward first and then backward, never
before `plantToday`. The page lists crowded occurrences with a "Move to <date>" action; the server refuses
`POST /reschedule` when another occurrence already holds the target day (409), so two planners cannot race into
the same day. The calendar never silently moves a projected plan or rewrites a plan row. **Cost if wrong:** a plant
that genuinely needs two PMs a day must accept the crowded marker and cannot move a second one there (it can leave
two naturally due dates; only moves are refused); the cap becomes a setting in a later slice, and the pure
function already takes it as an argument.

**R6 — PM compliance: PM work orders done inside their tolerance ÷ PM work orders judged.** For the window
`[from, to]` (plant dates), a PM work order is a ticket with `raised_channel = 'pm'` whose **scheduled date** is in
the window. The scheduled date is `task_expected_on` when set (a move, or 49b's due), else the plant date of
`reported_at` (49b raises on the due date). The tolerance is R4's `pmToleranceDays` from the effective plan at
`asOf`; a ticket with no plan uses 15. A work order is:

- **on time** when it is `closed` **by `asOf`** and the close plant date is inside `scheduledOn ± tolerance`
  inclusive;
- **early** when closed by `asOf` before `scheduledOn − tolerance`;
- **late** when closed by `asOf` after `scheduledOn + tolerance`;
- **overdue** when it is not closed by `asOf` and `scheduledOn + tolerance < asOf` (strict: the last tolerance day
  is still a chance to close);
- **cancelled** when its status is `cancelled` and its window has ended;
- **pending** when it is not closed by `asOf` and `scheduledOn + tolerance >= asOf`; pending is not in the
  denominator.

`eligible = onTime + early + late + overdue + cancelled`; `pct = round(1000 × onTime ÷ eligible) / 10`, one decimal,
and `pct` is `null` when `eligible = 0` (the page prints `—`, never 0 %). A PM close with `close_kind =
'no_report'` still counts as done; a cancelled ticket never does. Early is real only because a moved job can be
scheduled ahead and done before its scheduled date. **Cost if wrong:** a nightly run that is late by days raises a
ticket whose `scheduledOn` is the raise date unless 49b/50 set it to the due (R12); 50a sets it, so the window is
the due. A plan whose interval changed after a ticket was raised changes that ticket's tolerance (the plan row has
no history); the fixture uses one interval per plan and records this as the known limit.

**R7 — schedule compliance: planned work orders done by the end of their scheduled week ÷ planned work orders
judged.** A planned work order is a ticket with `isPlannedChannel(raised_channel)` (PM **or** inspection) whose
scheduled date (R6's rule) is in the window. Its scheduled week is the Monday–Sunday week containing that date. A
work order is:

- **done** when it is `closed` by `asOf` and its close plant date is on or before the Sunday of the week (an
  early close counts);
- **missed** when the week has ended (`weekEnd < asOf`, strict) and it is not done — including an open,
  cancelled, or still-future-close work order;
- **pending** when it is not closed by `asOf` and `weekEnd >= asOf`; pending is not in the denominator.

`eligible = done + missed`; `pct = round(1000 × done ÷ eligible) / 10`, one decimal, `null` when `eligible = 0`.
Inspection tickets use the same rule; 52 gets the figure for free. **Cost if wrong:** a PM done on Saturday for a
Friday due is schedule-compliant but may be PM-compliant only if inside the tolerance; a PM done three days late
across a Sunday is PM-compliant but not schedule-compliant. That difference is the point of carrying both figures.

**R8 — both definitions are computed once, in one module, and stored only when a run stores them.**
`packages/domain/src/analytics/pm-compliance.ts` exports
`computePmCompliance(data, { from, to, asOf }) → { value, drillIds }`; the `pm-compliance` figure (screen
`pm-calendar`, owner 50, drill `ticket`) calls it with `from = 1 January of asOf's plant year`, `to = asOf`. The
value is
`{ from, to, pm: {eligible, onTime, early, late, overdue, cancelled, pending, pct}, schedule: {eligible, done,
missed, pending, pct} }` — counts exact, percentages the rounded numbers R6/R7 define, no names, no refs. The
drill ids are the tickets in the window, deduplicated and capped at `MAX_DRILL_IDS` (200); the counts are still
exact. Nothing writes on a read. `POST /analytics/run` stores the figure in `kpi_snapshot` under
`profile = 'standard'` when it stores a run; 53 freezes the month-end row with `from = month start`, `to = month
end` through the same function. No new table, no migration, no column (D17). **Cost if wrong:** a plant that wants
a daily compliance trend has to run the analytics job daily (the page computes on read meanwhile); 53 owns the
frozen period and can change the window without touching this module. The `pct` is one decimal because the
hand-computed fixture pins 25.0 and 27.3; a different rounding is a one-line change and moves the fixture.

**R9 — the machine page's task block is live, from the existing ticket list, split by the shared planned
predicate.** `MachineTasks` (new, `apps/web/src/screens/analytics/machine-tasks.tsx`) reads
`useTicketPages({ machineId, status: 'open,working,waiting', limit: 200 })` and splits with
`isPlannedChannel(ticket.raisedChannel)`: **Open tasks** (breakdown, support, general) and **PM tasks** (planned).
Each row shows the `WR-`/`BD-` reference (a link to `/desk/:id`), the problem, the status pill, and for a PM row
the scheduled date (`taskExpectedOn ?? plantDay(reportedAt)`), with an **Overdue** chip when it is open and the
scheduled date is before the plant today. It renders inside `RecordBody` after the PM visits block
(`machine-summary.tsx:171`). A loading line and a quiet "Tasks are not available right now" line keep the rest of
the page usable; the analytics figures are not blocked by the ticket list. **Cost if wrong:** a machine with more
than 200 open tickets shows the first 200 (the list is one page); the counts on the PM visit block are separate and
exact. The block is a live read, so it can be newer than the as-of analytics record on the same page; the block
labels its date and never feeds a figure.

**R10 — read with `canAnalytics`, write with `canSettingsLists`.** `GET /api/v1/pm/calendar` is for supervisor,
head, plant head and admin, like the PM group (`packages/domain/src/permissions/views.ts:33-39`).
`POST /api/v1/pm/reschedule` is for head and admin, the same gate as the PM plan settings
(`packages/domain/src/permissions/settings.ts:5-7`); the page hides drag and the Move button for anyone else, and
the server refuses regardless of the hidden button. **Cost if wrong:** a plant head who plans PMs cannot drag on
this screen (they can ask a head/admin); opening the write gate is a one-line permission change and a test change.

**R11 — no new module, table, column or migration; `ticket.task_expected_on` is the planned job's scheduled date.**
`pm_plan` owns the recurrence (plant), `ticket` owns the job and its schedule (tickets), `kpi_snapshot` owns a
frozen figure (analytics). 49 R9's no-`pm`-module ruling stands; the two routes live in
`apps/server/src/modules/tickets/pm-routes.ts`, registered by two lines in `routes.ts` (384 → 386, under 400), not
by a new module. The `task_expected_on` column already exists (`0001_schema_v1.sql:255`) and is NULL on every
non-task ticket today; for a planned ticket (`parent_id IS NULL`, planned channel) it is the scheduled date. A
follow-up task's own row keeps its own `task_expected_on`. **Cost if wrong:** an API reader that assumes
`taskExpectedOn` only belongs to tasks sees a date on a PM ticket; the field is documented here and the task UI
filters on `parent_id`, so no task list changes. A later `scheduled_on` column would be a migration and a
backfill; it is not needed for either figure.

**R12 — `raisePlannedTicket` gains one optional field, `scheduledOn`, and `pm.generate` passes the due.** The 46c
input shape stays; the additive field is `scheduledOn?: string` (plant date). The raise sets the ticket's
`task_expected_on` in the same transaction and records `scheduledOn` in the raise event payload; 49b's loop changes
from `{tenantId, machineId, channel:'pm', problem, at: now}` to the same object plus `scheduledOn: due`. 49c's
close and 52's inspection raise are unaffected (the field is optional). **Cost if wrong:** if 49b's `pmDue` returns
a different name than `due`, the one-line call is the only change; a raise made without the field keeps the old
behaviour (scheduled date = reported date), which is why the field is optional.

**R13 — all new copy lives in the `pm` namespace; no shipped catalogue is touched.** The page, the calendar chrome,
the compliance tiles, the spread panel and the machine block add keys to `packages/shared/src/i18n/pm.en.ts`
(22 lines today; the additions keep it far under 250) and its `pm.gu.ts` stays `blank(pmEn)`. `analytics.en.ts` is
248/250 and is not edited; `detail`, `timeline`, `closes` and `floor` are shipped and frozen, so the reschedule
event uses the existing `update` label and text rather than a new event type. `SCREEN_LABELS['pm-calendar']` and
`FIGURE_LABELS['pm-compliance']` point into the `pm` namespace; `groups.test.ts` reads the flat catalogue, so no
`analytics` key is needed. FullCalendar's own chrome is set from the same catalogue (`buttonText.today`) and
`locale="en"`; the product's Gujarati placeholders remain blank, as 49's `pm` namespace already is. **Cost if
wrong:** a Gujarati PM screen shows English calendar month/day names until a locale chunk and translations land;
the PM namespace is not in the shipped set, so that is a later translation sweep, not a freeze break.

**R14 — parity flips only `m4a.pm-plan` to `done`; no row is added.** Evidence:
`packages/domain/test/pm-compliance.test.ts` (the definitions and the hand-computed fixture),
`apps/server/test/pm-calendar.test.ts` (the calendar and the move), and
`apps/web/e2e/pm-calendar.spec.ts` (the page, the drag and the machine block). `m4a.pm-reports` is already `done`
from 49 (`docs/slices/49-pm-plans.md:219-222`); `m4a.pm-plan` stays `ticket: '49'` because 49 owns the plan and
import, and 50 adds the calendar evidence. `pnpm parity` stays 119 rows / 0 problems. **Cost if wrong:** the row
claims the calendar before the E2E lands; the evidence list is the review's check, and 50c is where it flips.

**R15 — the live workbook's PM Plan and PM Reports sheets are wired here, as 49 R11 assigned.** The live export
passes no `pmPlan`/`pmReports` today (`apps/server/src/modules/reports/export-data.ts:1-10`), so both sheets are
header-only. 50b maps the effective plans to `ExportPmPlan` rows — one per plan, `date` = its next due,
`source = 'plan'`, `done` = `last_done_on`, `machineId` = the machine code — and the closed `pm` tickets with a
`pm_report` to `ExportPmReport` rows (`date` = close plant date, `planDate` = scheduled date, `total`, `undone`
as numbers, `measurements` as strings, `comments` a one-element list, `doneBy` the stored person id, `data` the
`pm_report`). The PM Plan sheet therefore has **125 rows**, not the platform's 427; the PM Reports sheet has one row
per live closed PM job, not the two October reports 49 kept in 45's frozen key. **Cost if wrong:** a reader
comparing the sheet to the platform sees the 49 reduction and the two historical reports missing; the live
workbook is the product's data, and 45's key stays the platform's frozen file. The PM Reports sheet prints the
person id (pseudonymous) until a name lookup is added; names in exports are a later decision.

**R16 — the compliance rates are one-decimal numbers and the counts are exact.** `pct` is a number 0–100 rounded to
one decimal (`25`, `27.3`), `null` with no denominator; the page formats with one decimal and a `%`. The fixture
asserts the numbers, not formatted strings. **Cost if wrong:** a plant that wants whole percentages sees `27.3 %`;
changing the rounding is one expression and the fixture has both cases (25.0 exact, 27.3 rounded).

## The compliance definitions, side by side

|                | PM compliance                                        | Schedule compliance                                                |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Population     | tickets with `raised_channel = 'pm'`                 | tickets with `isPlannedChannel(raised_channel)` (pm or inspection) |
| Scheduled date | `task_expected_on`, else plant date of `reported_at` | same                                                               |
| Window         | scheduled date in `[from, to]`                       | scheduled date in `[from, to]`                                     |
| Judged         | closed, or `scheduled + tolerance < asOf`            | closed, or `weekEnd < asOf`                                        |
| Success        | closed inside `scheduled ± tolerance`                | closed on or before the week's Sunday                              |
| Failure kinds  | early, late, overdue, cancelled                      | missed (open past the week, cancelled)                             |
| Not judged     | pending (open inside the tolerance)                  | pending (open in the current week)                                 |
| Denominator    | onTime + early + late + overdue + cancelled          | done + missed                                                      |
| Figure window  | 1 January of `asOf`'s year → `asOf`                  | same                                                               |
| 53's window    | month start → month end, same function               | same                                                               |

The tolerance is the **plan's** (R4/R6), so a 30-day plan is judged at ±2 days while a 182-day plan is judged at
±15. The scheduled week is a plant calendar week (Monday–Sunday), not a shift week; no holiday calendar is
invented (D17 has no table for one).

## Hand-computed fixture (the arithmetic the test asserts)

`asOf = 2026-11-11`, plant zone Asia/Kolkata, window `2026-01-01` to `2026-11-11`. Seven PM plans and nine PM
tickets plus two inspection tickets; `task_expected_on` is the scheduled date; every close time is a plant date.
The fixture is purpose-built because 49's 125 plans carry one next date each, not the visit history the platform
counted.

| Ticket | Channel    | Plan interval | Tolerance | Scheduled  | Closed               | PM outcome                | Schedule week | Schedule outcome       |
| ------ | ---------- | ------------- | --------- | ---------- | -------------------- | ------------------------- | ------------- | ---------------------- |
| A1     | pm         | 182           | 15        | 2026-06-01 | 2026-06-10           | on time (+9)              | Jun 1–7       | missed (closed Jun 10) |
| B1     | pm         | 30            | 2         | 2026-01-19 | 2026-01-14           | early (−5)                | Jan 19–25     | done (closed Jan 14)   |
| B2     | pm         | 30            | 2         | 2026-02-13 | 2026-02-20           | late (+7)                 | Feb 9–15      | missed (closed Feb 20) |
| B3     | pm         | 30            | 2         | 2026-03-22 | open                 | overdue (Mar 24 < Nov 11) | Mar 16–22     | missed                 |
| C1     | pm         | 182           | 15        | 2026-07-02 | 2026-07-20           | late (+18)                | Jun 29–Jul 5  | missed (closed Jul 20) |
| D1     | pm         | 182           | 15        | 2026-04-01 | 2026-04-01           | on time (0)               | Mar 30–Apr 5  | done (closed Apr 1)    |
| D2     | pm         | 182           | 15        | 2026-09-30 | open                 | overdue (Oct 15 < Nov 11) | Sep 28–Oct 4  | missed                 |
| G1     | pm         | 182           | 15        | 2026-10-30 | open                 | pending (Nov 14 ≥ Nov 11) | Oct 26–Nov 1  | missed (week ended)    |
| H1     | pm         | 30            | 2         | 2026-08-31 | cancelled 2026-09-02 | cancelled                 | Aug 31–Sep 6  | missed                 |
| I1     | inspection | —             | —         | 2026-10-01 | 2026-10-03           | not a PM                  | Sep 28–Oct 4  | done (closed Oct 3)    |
| I2     | inspection | —             | —         | 2026-10-05 | open                 | not a PM                  | Oct 5–11      | missed                 |

**PM arithmetic.** On time `A1 + D1 = 2`; early `B1 = 1`; late `B2 + C1 = 2`; overdue `B3 + D2 = 2`; cancelled
`H1 = 1`; pending `G1 = 1` (excluded). `eligible = 2 + 1 + 2 + 2 + 1 = 8`; `pct = round(1000 × 2 ÷ 8) / 10 =
25.0`. The tolerance checks: A1 +9 ≤ 15; B1 −5 < −2; B2 +7 > 2; C1 +18 > 15; D1 0; B3's window ends 2026-03-24;
D2's ends 2026-10-15; H1's ends 2026-09-02; G1's ends 2026-11-14.

**Schedule arithmetic.** Done `B1 + D1 + I1 = 3`; missed `A1 + B2 + B3 + C1 + D2 + G1 + H1 + I2 = 8`; pending 0.
`eligible = 3 + 8 = 11`; `pct = round(1000 × 3 ÷ 11) / 10 = 27.3`. The three cases that prove the definitions are
different: **B1** is a PM early miss but a schedule hit (done before its week); **A1** is a PM hit but a schedule
miss (closed after its week); **G1** is PM-pending but schedule-missed (the tolerance is still open, the week is
not). A test that only checked one figure would pass with the other definition.

**Zero denominator.** A plant with no planned work orders in the window gets `pm.pct = null`, `schedule.pct =
null`; the page prints `—` and "No PM work orders in this window.", never 0 %. The figure is still `ready` (it has
an honest answer), with no drill ids.

## Packet 50a — ADR, dependency, calendar data and the reschedule (server + pure, one PR)

**Files.**

- `docs/adr/0009-fullcalendar.md` (new): context, the prototype result, the decision, the rejected v6/no-dependency
  options, the fallback and the consequences (R1).
- `apps/web/package.json`, `pnpm-lock.yaml`: `@fullcalendar/react` 7.1.5, `temporal-polyfill` 1.0.8; exact pins.
- `THIRD_PARTY.md` (repo root): the FullCalendar row becomes the exact v7.1.5 family (core, headless-calendar,
  temporal-polyfill, all MIT).
- `packages/shared/src/pm.ts`: `pmNextDue(plan, timeZone)`, `pmToleranceDays(intervalDays)`, the calendar query/reply
  schemas and the reschedule body/reply schema; `packages/shared/src/index.ts` already re-exports `pm.ts`.
- `packages/shared/src/replies.ts`: import `pmCalendarReplySchema`/`pmRescheduleReplySchema` from `./pm.js` and add
  the two `REPLY_SCHEMAS` entries for `GET /api/v1/pm/calendar` and `POST /api/v1/pm/reschedule` (the existing
  `pmPlanReplySchema` import line grows by two names).
- `apps/server/test/reply-contract.test.ts`: the count moves by exactly **+2** with the equality assertion kept —
  137 → 139 on the review's baseline; **143 → 145 in this checkout**, which already carries 49a's three generated
  settings routes and 46/47's routes. The route table and `Object.keys(REPLY_SCHEMAS)` stay equal.
- `packages/domain/src/pm-schedule.ts` (new): `pmCalendar(plans, openTickets, {from, to, today, timeZone, cap,
workingDays}) → {items, cap}` with each item `{planId, machineId, machineCode, title, dueOn, scheduledOn,
toleranceDays, ticketId, status: 'planned'|'open', movable, crowded, suggestedOn}`; `pmSuggestDate`; the pure
  `effectivePmPlan` used by 50b. ≤220 lines.
- `packages/domain/test/pm-schedule.test.ts` (new): the projection, the two open-ticket suppression cases, the
  tolerance scale, the crowded suggestion and the Sunday/past refusals.
- `packages/shared/test/pm.test.ts` (new): `pmNextDue` in two zones, `pmToleranceDays` at 182/30/150/null.
- `apps/server/src/modules/tickets/repo/pm.ts` (extend 49b's file): `pmTicketsForCalendar(client, tenantId)` (open
  PM tickets with `task_expected_on`, `reported_at`, `machine_id`, `ref`, `status`) and
  `setPmScheduledOn(client, tenantId, ticketId, day, actor)` (the `UPDATE … updated_at = now()` plus the `update`
  event and `last_event_seq`). It keeps 49b's `latestPmReadings` and open-PM query.
- `apps/server/src/modules/tickets/pm-calendar.ts` (new): maps `pmPlansForScheduling` + `pmTicketsForCalendar` +
  `machinesByIds` to `pmCalendar`; ≤140 lines.
- `apps/server/src/modules/tickets/pm-reschedule.ts` (new): the validation (R4), the load refusal (R5), the
  materialise call (R12) and the move; ≤200 lines.
- `apps/server/src/modules/tickets/pm-routes.ts` (new): `GET /api/v1/pm/calendar` and
  `POST /api/v1/pm/reschedule`, with `requireAuth`, roles (R10) and the `Idempotency-Key` binding for the POST
  (`idem.computeBinding`/`get/storeIdempotent`, like `routes.ts:164-191`); ≤180 lines.
- `apps/server/src/modules/tickets/routes.ts`: two lines (import + `registerPmRoutes(app, pool)`), 384 → 386.
- `apps/server/src/modules/tickets/planned.ts`: the optional `scheduledOn?: string` (R12) and the transactional
  `task_expected_on` write + raise payload.
- `apps/server/src/modules/tickets/pm-generate.ts` (49b's file): one field, `scheduledOn: due`.
- `apps/server/src/modules/plant/index.ts`: no change; 50a imports 49b's already-exported `pmPlansForScheduling`.
- `apps/server/test/pm-calendar.test.ts` (new): the DB/API proof below.
- `apps/server/test/pm-generate.test.ts` (add one case): a late run still records the due in
  `task_expected_on`.
- `changes/50-pm-calendar.md`: the 50a section.

**Build.** `pmCalendar` is pure: effective plans come in with `createdAt`/`lastDoneOn`/`intervalDays`;
`pmNextDue` (shared) gives each plan's due; a machine with an open PM ticket replaces the plan occurrence with
the ticket at `task_expected_on ?? plantDay(reported_at)`; all occurrences are counted by scheduled date for load
and suggestion, then filtered to `[from, to]` for the reply. `pmSuggestDate` searches `+1…+tolerance` then
`−1…−tolerance`, skipping Sundays and dates before `today` and occupied dates. The route maps `PmPlan.createdAt`
to ISO, passes the plant's time zone, and parses the reply. `pm-reschedule` locks the plan row, re-reads the
effective plan and the open ticket, checks R4/R5, then either calls `raisePlannedTicket` (new ticket at `now` with
`scheduledOn`) or `setPmScheduledOn`; both in the caller's `withTenant` transaction. The POST requires an
idempotency key; a replay returns the stored reply, a reused key with a different body is 422. Both replies are
strict shared schemas and are in `REPLY_SCHEMAS` from the first commit, so `reply-contract.test.ts`'s route-table
equality is true when the routes register.

**Given/When/Then.**

1. Given a plan last done 2026-05-01, interval 182, machine VC-1, no open PM ticket, when the calendar is read for
   November 2026, then one item on 2026-10-30 (the next due) has `toleranceDays = 15`, `dueOn = scheduledOn`, no
   ticket id and no drill; a plan with interval 30 gets tolerance 2; a plan with no interval has no item.
2. Given a machine with an open PM ticket whose `task_expected_on` is 2026-11-20 and a plan due 2026-11-18, when
   the calendar is read, then exactly one item is shown, on 2026-11-20, with the ticket id and the plan due
   2026-11-18; the plan's own date is suppressed.
3. Given two plans due on the same day and cap 1, when the calendar is read, then both items are `crowded` and
   each `suggestedOn` is a free Monday–Saturday inside its own tolerance, never before plant today; given only
   one item, it is not crowded and `suggestedOn` is null.
4. Given a head on 2026-11-11, when they POST a move to 2026-11-14 for the plan due 2026-11-10 with tolerance 15,
   then 200, a PM ticket is created with `task_expected_on = 2026-11-14`, `reported_at` is now (not the future),
   `pm_plan.last_done_on`/`created_at` are unchanged, and the new ticket's raise event carries `scheduledOn`; a
   second POST with the same idempotency key returns the same ticket and creates no second one.
5. Given the same ticket open, when a head moves it to 2026-11-16, then `task_expected_on` is 2026-11-16,
   `reported_at`/`started_at` are unchanged, and the ticket's event history has one `update` with
   `changes.scheduledOn` from 14 to 16; when a technician tries, then 403; when an admin tries to move it after it
   has started, then 409.
6. Given a target outside due ± tolerance, on a Sunday, before plant today, or a day that already holds another
   PM, when the POST runs, then 422/422/422/409 and nothing is written; given a target equal to its current
   scheduled date, then 200 and no event when the value is unchanged.
7. Given a plan with a category and two machines of that category, when the calendar is read, then one item per
   machine with the machine code, no duplicate; given a scrapped machine, then no item.
8. Given plant B's plan id from plant A, when the POST runs, then 404 and no row is written; given plant B's
   calendar, then plant A's dates are absent.
9. Given 49b's `runPmGenerate` with a plan due 2026-10-30 and the clock at 2026-11-02, when it raises, then the
   ticket's `task_expected_on` is 2026-10-30 (the due, not the late run's day).
10. Given the GET from a technician, then 403; given a request without `Idempotency-Key` on the POST, then 422
    with the key named.
11. Given the built app, when `routeTable(app)` is compared with `Object.keys(REPLY_SCHEMAS)`, then the two lists
    are equal and the test's count is the baseline plus exactly 2 (137 → 139 on the review baseline; 143 → 145 in
    this checkout) — no route without a schema, no schema without a route.

**Red.**

`pnpm exec vitest run packages/domain/test/pm-schedule.test.ts packages/shared/test/pm.test.ts` — the modules do
not exist (`Cannot find module '../src/pm-schedule.js'`).

`pnpm exec vitest run apps/server/test/pm-calendar.test.ts` — `GET /api/v1/pm/calendar` is 404.

**Green.** The two red commands; `pnpm exec vitest run apps/server/test/pm-generate.test.ts
apps/server/test/m4b-write.test.ts apps/server/test/tickets.test.ts
apps/server/test/reply-contract.test.ts`; `pnpm exec vitest run packages/domain/test packages/shared/test`; rails
`pnpm boundaries`, `pnpm migrations:immutable`, `pnpm deps`, `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run packages/domain/test packages/shared/test apps/server/test` (the server
suite plus the domain suite; no existing assertion is changed). The PR body carries
`Large PR: the calendar contract, the reschedule write, the schedule/tolerance helpers and their API are one user-visible path; splitting would ship a drag with no write or a write with no read.`

## Packet 50b — the two compliance figures, the interim tile and the live PM sheets (engine + server, one PR)

**Files.**

- `packages/domain/src/analytics/pm-compliance.ts` (new):
  `computePmCompliance(data, {from, to, asOf}) → {value, drillIds}` (R6/R7/R8) and
  `pmComplianceFigure: Computer` using the calendar-year window; ≤260 lines.
- `packages/domain/test/pm-compliance.test.ts` and `packages/domain/test/pm-compliance-expected.ts` (new): the
  table above, each row's arithmetic in comments, and the zero-denominator case.
- `packages/domain/src/analytics/types.ts`: `PmPlanRow`; `EngineData.pmPlans?: readonly PmPlanRow[]`;
  `TicketRow.scheduledOn?: string | null` (48's `raisedChannel` is already there; if 48 has not landed, 50 adds
  both optional fields and 48's plan keeps the same name).
- `packages/domain/src/analytics/computers.ts`: one key `'pm-compliance': pmComplianceFigure` in the map.
- `packages/domain/src/analytics/registry.ts`: one figure `{ key: 'pm-compliance', screen: 'pm-calendar', owner:
50, label: 'PM compliance and schedule compliance', drill: 'ticket' }`.
- `apps/web/src/screens/analytics/groups.ts`: the `pm` group gains `screens: ['pm-calendar']`, and
  `SCREEN_LABELS['pm-calendar']` / `FIGURE_LABELS['pm-compliance']` point into the `pm` namespace. The group page
  shows the compliance table from 50b; 50c replaces it with the calendar page.
- `packages/shared/src/i18n/pm.en.ts`: the screen/figure/table keys for 50b (the rest are 50c's).
- `apps/web/src/screens/analytics/figure-content.ts` and its test: `pm-compliance` maps to a one-row `table`
  (period, PM compliance, schedule compliance) so the interim `/analytics/pm` group page is not an "only numbers"
  tile; 50c's page uses its own `StatCard`s.
- `packages/domain/src/index.ts`: export `computePmCompliance` (53 imports it); `packages/domain/test/registry.test.ts`
  gains that name in the D2 pin.
- `packages/domain/test/analytics-engine.test.ts`: the owner bound becomes ≤ 50 and the owner set gains 50 (48's
  change adds 48; whichever lands second rebases the same two lines).
- `apps/server/src/modules/plant/repo/analytics.ts` (extend): `pmPlansForEngine(tx)` selecting every plan's id,
  machine/category, interval, `created_at`, `last_done_on`, active; `plant/index.ts` exports it.
- `apps/server/src/modules/analytics/load.ts`: one read and the `pmPlans` mapping; `ticket()` maps
  `raisedChannel` (48) and `scheduledOn` from `task_expected_on` (the query already selects both).
- `apps/server/src/modules/analytics/snapshot.ts`: the store becomes **per-row** profile:
  `jsonb_to_recordset` rows `{profile, key, value}`, `profileOf(key) = key.startsWith('shift-kpis.') ||
key === 'pm-compliance' ? 'standard' : 'legacy'`; a run now stores both families in one statement (48 R15's
  intent; its single-constant form cannot store two profiles).
- `apps/server/src/modules/tickets/repo/pm.ts` (extend 50a): `pmReportsForExport(client, tenantId)` returning closed
  PM tickets' `pm_report` with the machine code, close date and scheduled date.
- `apps/server/src/modules/reports/export-data.ts`: `exportDataFor` accepts optional `pmPlan`/`pmReports` and
  returns them; the PM Plan rows map from `data.pmPlans` with `pmNextDue`, the PM Reports from
  `pmReportsForExport` (R15).
- `apps/server/src/modules/reports/workbook-route.ts`: one read of `pmReportsForExport`, pass the two arrays.
- `packages/domain/src/exports/plant-sheets.ts`: no change (it already prints both sheets from optional arrays).
- `apps/server/test/analytics-engine.test.ts`: the `pm-compliance` row is stored with profile `standard` while a
  legacy figure is `legacy`; the figure drills to the PM/inspection tickets.
- `apps/server/test/report-export.test.ts` (extend 45's route test): PM Plan has one row per plan with its next
  date; PM Reports has one row per closed PM job; the two sheets are no longer header-only.
- `docs/DATA-MAP.md`: the PM row's status becomes "Built (M4b, 0015); loaded, edited and scheduled (49, 50);
  compliance figures (50)".
- `changes/50-pm-calendar.md`: the 50b section.

**Build.** The compliance function builds the effective plan per machine from `pmPlans` (active machine plan, else
the latest active category plan) and the tolerance per PM ticket. It selects the window's planned tickets, builds
the R6/R7 outcomes, sums the counts, rounds the two percentages, and returns the value plus the unique ticket ids
(first 200 in scheduled order). The figure is a normal `Computer`; `run()` includes it in every reply and every
stored run. The snapshot store's per-row profile is the only change to storage: no migration, no new column,
`kpi_snapshot`'s unique key already includes `profile`.

**Given/When/Then.**

1. Given the fixture above and `asOf = 2026-11-11`, when `computePmCompliance` runs for 2026-01-01..2026-11-11,
   then `pm` is `{eligible:8, onTime:2, early:1, late:2, overdue:2, cancelled:1, pending:1, pct:25}` and
   `schedule` is `{eligible:11, done:3, missed:8, pending:0, pct:27.3}`; the drill has the 11 unique tickets
   (A1, B1, B2, B3, C1, D1, D2, G1, H1, I1, I2), no duplicate.
2. Given the same fixture with G1 closed on 2026-11-14, when the window ends 2026-11-11, then G1 is still pending
   for PM and missed for schedule (the close is after `asOf`); when the window ends 2026-11-30, then G1 is a PM
   on time on the +15 boundary (11-14 is 15 days after 10-30) and a schedule miss;
   the boundary is asserted on both sides.
3. Given a plant with no planned tickets, when the figure runs, then it is `ready`, both `pct` are null, the
   counts are zero and the drill is empty; the page prints "No PM work orders in this window."
4. Given a PM ticket with `close_kind = 'no_report'`, then it is done for both figures; given a cancelled PM
   ticket whose window has ended, then it is a PM cancelled miss and a schedule miss.
5. Given an inspection ticket closed on Saturday of its week, then it is schedule-done and absent from PM counts;
   given one closed on Monday after the week, then it is schedule-missed.
6. Given a 30-day plan, when a ticket closes 3 days after its scheduled date, then tolerance 2 makes it a PM late
   miss and, if its week has ended, a schedule miss; the same close on a 182-day plan is a PM hit.
7. Given a run at 2026-11-11, when `POST /api/v1/analytics/run` stores it, then the `pm-compliance` row has
   `profile = 'standard'`, the `shift-kpis.*` rows (once 48 lands) are `standard`, and a legacy figure is
   `legacy`; the store writes all three in one statement.
8. Given a head opens `/analytics/pm` after 50b and before 50c, then the group page names the `PM calendar` screen
   and its one figure as a two-row table (period, PM compliance, schedule compliance); the page is a working
   interim, not a blank menu group.
9. Given the live workbook, when it is built, then the PM Plan sheet has one data row per effective plan and its
   next due (125 on the seeded Cosmos plant), the PM Reports sheet has one row per closed PM job with its
   `pm_report` JSON, and the two October reports 49 kept in 45's frozen key are not live rows.

**Red.**

`pnpm exec vitest run packages/domain/test/pm-compliance.test.ts` — `Cannot find module
'../src/analytics/pm-compliance.js'`.

`pnpm exec vitest run packages/domain/test/analytics-engine.test.ts` — the owner bound/owners list and the
unregistered figure fail.

**Green.** The red commands; `pnpm exec vitest run packages/domain/test packages/shared/test
apps/server/test/analytics-engine.test.ts apps/server/test/reply-contract.test.ts
apps/server/test/report-export.test.ts`; rails `pnpm boundaries`, `pnpm parity`, `pnpm migrations:immutable`,
`pnpm precheck`.

**Covering suite.** `pnpm exec vitest run packages/domain/test packages/shared/test apps/server/test` (the
compliance fixture, the engine's owner/D2 pins, the stored profiles and the workbook).

## Packet 50c — the PM screen, the machine block, the words (screens + E2E, one PR)

**Files.**

- `apps/web/src/screens/analytics/PmCalendarPage.tsx` (new): the page — the two compliance tiles from the
  `pm-compliance` figure, the calendar, the crowded "Spread the load" panel and the drill; `Stack`/`StatCard`/
  `FigureDrill`/`DrillTable`, no new renderer; ≤280 lines.
- `apps/web/src/screens/analytics/PmCalendar.tsx` (new): the **one door** that imports `@fullcalendar/react`,
  `daygrid`, `interaction`, the classic theme and the CSS; maps the API items to all-day events, sets
  `editable` from the role, `eventDrop` calls `schedulePm`, `datesSet` sets the range; ≤180 lines.
- `apps/web/src/screens/analytics/pm-calendar.css` (new): the FullCalendar theme variables from the design tokens
  (`--fc-classic-primary`, foreground/background/border/muted/today) and the event chip classes; dark values under
  `:root[data-theme='dark']`; no raw colour except through tokens.
- `apps/web/src/screens/analytics/pm-calendar-view.ts` (new) and `.test.ts`: pure `eventsOf(reply)`, `loadOf`,
  `readPmCompliance(value)` and `readMachineTasks(tickets)`; the page and the E2E share them.
- `apps/web/src/screens/analytics/Analytics.tsx`: `const PmCalendarPage = lazy(() => import('./PmCalendarPage.js'))`
  and a `Suspense` branch `found.id === 'pm'`; the group already exists (`groups.ts:75`).
- `apps/web/src/api.ts`: `usePmCalendar(range)` (`useQuery` + `http('/api/v1/pm/calendar?…')` parsed at the
  boundary), `schedulePm(body)` with `Idempotency-Key`, and the `pmCalendarReplySchema` parse; ≤40 lines,
  file stays under 400 (341 → ~381).
- `apps/web/src/screens/analytics/machine-tasks.tsx` (new) and `.test.ts`: the two lists (R9), the status pill, the
  scheduled date and the overdue chip; ≤150 lines.
- `apps/web/src/screens/analytics/machine-summary.tsx`: one import and one `<MachineTasks machineId={machineId} />`
  after `<Pm>` (`:171`); the file stays under 250.
- `packages/shared/src/i18n/pm.en.ts`: the page, calendar, spread and machine keys (R13), building on 50b's
  screen/figure/table keys; ≤70 lines; `pm.gu.ts` remains `blank(pmEn)`.
- `packages/shared/src/i18n/analytics-guide.en.ts`: one `analytics.guide.pm-calendar.body1` paragraph so the built
  entry has a body; `analytics-guide.gu.ts` is already `blank(analyticsGuideEn)`, so the key appears there
  automatically. The 36 headings are untouched.
- `apps/web/src/screens/analytics/guide-entries.ts`: remove `'pm-calendar'` from `UNBUILT` (the set goes from five
  to four; update its comment), and give the entry one body key (`analytics.guide.pm-calendar.body1`) and
  `figures: ['pm-compliance']`. The entry now links to the real `/analytics/pm?screen=pm-calendar` page.
- `apps/web/src/screens/analytics/guide-entries.test.ts`: drop `'31. PM Calendar'` from the test's `UNBUILT`
  heading list (four remain), keep the 36-heading assertion verbatim, and keep the once-per-figure check; the new
  entry's link names the `pm` group.
- `apps/web/src/screens/analytics/pm-calendar-guard.test.ts` (new): the source guard (only `PmCalendar.tsx` names
  `@fullcalendar`, with a planted violation) and the build-chunk guard (no `fc-classic-` in the start-up files; a
  `PmCalendar` chunk has it), mirroring `apps/web/src/ui/chart/chart-guard.test.ts:48-112`.
- `apps/web/e2e/fixtures-pm-calendar.ts` (new): two plans due today (one crowded pair), a third with an open PM
  ticket, an open breakdown ticket and an open PM ticket on `MACHINES[0]`; fixed `scopedId` ids; `current_date`-based
  dates so the spec is not tied to a calendar month.
- `apps/web/e2e/test.ts`: add the fixture's statements to `seedWorkerTenant`.
- `apps/web/e2e/pm-calendar.spec.ts` (new): the page, the drag, the crowded move, the compliance tiles, the
  machine block and the role/refusal cases; stubs `/analytics/figures` with a `pm-compliance` value and `asOf`
  today, uses the real calendar/tickets APIs.
- `docs/spec/parity.yaml`: `m4a.pm-plan` → `done`, evidence added (R14); `pnpm parity` 119/0.
- `docs/DATA-MAP.md`: the PM row's status (same line as 50b; one of the two packets carries it, 50c owns the final
  wording).
- `changes/50-pm-calendar.md`: the 50c section.

**Build.** The page gets `asOf` from the figures reply (the plant day), initializes the calendar on that month,
and lets FullCalendar's `datesSet` set the six-week grid range; `usePmCalendar` fetches the range and returns the
items. The calendar's events are all-day, one per item, titled with the machine code and carrying
`extendedProps: { ticketId, planId, machineId, dueOn, status, movable, crowded }`. `eventDrop` normalizes
`startStr` to a plant date, calls `schedulePm({planId, machineId, ticketId, scheduledOn})`, invalidates the
calendar and ticket keys, and on an error calls `info.revert()` and shows the refusal text. `editable` and
`eventStartEditable` are true only for head/admin (R10). The "Spread the load" panel lists items with
`suggestedOn` and a Move button; it calls the same `schedulePm`. The compliance tiles format the figure's `pct`
with one decimal and print the counts/from/to (R16). The machine block is a live list; its own loading/error lines
never replace the analytics body. The Guide's `31. PM Calendar` entry leaves `UNBUILT`, gets its body paragraph and
names `pm-compliance`; `guide-entries.test.ts` keeps the answer key's 36 headings in order and proves every
registered figure is explained exactly once.

**Given/When/Then.**

1. Given a head opens `/analytics/pm` in November 2026 with two plans due 2026-11-12, when the page renders, then
   the month grid shows both machine codes on 12 November, both marked crowded, the panel offers a free day inside
   each tolerance, and the two compliance tiles show the stubbed `25.0%` / `27.3%` with their counts.
2. Given the same page, when the head drags `VC-1` from 2026-11-12 to 2026-11-13, then the browser sends
   `POST /api/v1/pm/reschedule` with the plan, machine and `scheduledOn`, the target cell shows the event after the
   refetch, and the page's audit note is not duplicated; given the server refuses (full Sunday/outside window),
   then the event snaps back and the refusal is announced.
3. Given a technician opens `/analytics/pm`, then the calendar is read-only (no drag, no Move); given they POST
   directly, then 403.
4. Given `VC-1` has one open breakdown and one open PM ticket, when a head opens
   `/analytics/machines/<VC-1>`, then the Tasks block lists the breakdown under "Open tasks" and the PM job under
   "PM tasks", each with its reference and status; the PM row shows its scheduled date and an Overdue chip when
   the date is past; the existing nameplate/breakdown/PM/completeness/move blocks are unchanged.
5. Given the ticket list fails while the figures are ready, then the Tasks block says "Tasks are not available
   right now" and every analytics block still renders; given the figures fail, the page says so and the calendar
   is not drawn (the page's as-of is the figures').
6. Given the phone viewport (360 px), when the page renders, then the tiles stack, the calendar is one column, the
   targets are at least 44 px and the drag is still usable; a screen-reader reading of the calendar names the
   machine, the date and the status words, not colour alone.
7. Given the build, when the start-up files are inspected, then no `fc-classic-` marker is in them; the
   `PmCalendar` chunk has it and is loaded only by `/analytics/pm`.
8. Given the Guide, when it is rendered, then `31. PM Calendar` is a built entry with a body paragraph and a link
   to `pm-compliance` on the `pm` group; the 36 headings are still the answer key's, in order, and the unbuilt
   headings are the remaining four.

**Red.**

`pnpm exec vitest run apps/web/src/screens/analytics/pm-calendar-view.test.ts` — the module does not exist.

`pnpm exec playwright test apps/web/e2e/pm-calendar.spec.ts` — `/analytics/pm` renders 50b's compliance tile but no
month grid; the drag has no event to grab and no target cell.

**Green.** The red commands; `pnpm exec vitest run apps/web/src/screens/analytics
apps/web/src/screens/settings apps/web/src/screens/analytics/guide-entries.test.ts`; `pnpm exec playwright test apps/web/e2e/pm-calendar.spec.ts
apps/web/e2e/analytics-machines.spec.ts apps/web/e2e/analytics.spec.ts` (the existing analytics journeys rerun
unchanged); `pnpm exec vitest run apps/web/src/ui/chart/chart-guard.test.ts` (the chart chunk stays clean); rails
`pnpm parity`, `pnpm ui:check`, `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run apps/web/src packages/shared/test packages/domain/test` and the PM
journey; the `closes`, `settings-plant`, `floor` and `desk-lists` journeys are re-run unchanged.

## Screens, routes and words

| Surface                                     | Route                     | API                                                                                  | Who                                                           |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| PM calendar and compliance (the `pm` group) | `/analytics/pm`           | `GET /api/v1/pm/calendar?from&to`; `GET /api/v1/analytics/figures` (`pm-compliance`) | supervisor, head, plant head, admin (read); head/admin (move) |
| The move                                    | the same page             | `POST /api/v1/pm/reschedule` (`Idempotency-Key`)                                     | head, admin                                                   |
| The machine page's task block               | `/analytics/machines/:id` | `GET /api/v1/tickets?machineId=…&status=open,working,waiting&limit=200`              | supervisor, head, plant head, admin                           |
| The plan editor remains 49a's               | `/settings/pm-plans`      | the 49a resource                                                                     | head, admin                                                   |

The new `pm` keys (English; `gu` blank) cover: page/screen/figure titles; `today`, loading/empty/error/retry;
the legend (planned, scheduled job, crowded); the crowded count and suggestion; `Move to {{date}}`; the two
compliance labels and their counts; "No PM work orders in this window."; the machine block's Tasks, Open tasks,
PM tasks, none, loading, unavailable, overdue. FullCalendar's built-in strings are reduced to `buttonText.today`
and `locale="en"`; the month and weekday names are its English locale. No string is added to a shipped namespace.

## Parity

- `m4a.pm-plan` → **done** with `packages/domain/test/pm-compliance.test.ts`,
  `apps/server/test/pm-calendar.test.ts`, `apps/web/e2e/pm-calendar.spec.ts` (R14); it stays `ticket: '49'`.
- `m4a.pm-reports` stays **done** from 49 (its evidence is the close and the phone journey).
- No row is added; `pnpm parity` is 119 rows / 0 problems. The workbook has no parity row (45's export is the
  screen).

## Audit

- A move (materialise or reschedule) writes one `ticket_event` of type `update`, with the actor, the from/to
  dates and `planId` in `changes`; the ticket's `updated_at` moves; no `pmPlan.update` line is written because no
  plan row changes.
- A generated PM job is the raise event (`scheduledOn` in its payload); its plan stays untouched.
- A settings edit remains `pmPlan.update` (49a); a close remains the ticket's close/report events and the plan's
  derived `last_done_on` move inside that transaction.
- Compliance writes nothing on a read; a stored run is `kpi_snapshot` only, with ids/figures and no names.

## Rails

- **D17:** no new table; `pm_plan`, `ticket` (its existing `task_expected_on`), `ticket_event`, `breakdown_report`
  and `kpi_snapshot` are the homes. No migration; `pnpm migrations:immutable` and `pnpm migrations:check` stay
  green.
- **No new dependency except the ADR's:** FullCalendar 7.1.5 + its MIT family + `temporal-polyfill` 1.0.8, under
  ADR 0009 and D28's audit gate; no date library, no drag library, no second chart/calendar.
- **No new module:** tickets owns the routes and the written job; plant owns the plans; analytics owns the figure;
  `pnpm boundaries` stays green.
- **Tenancy/RLS:** every repo function takes `tenantId` first and runs under `withTenant`; the calendar/ticket
  queries carry the tenant; a plan/ticket id from another plant is 404 and writes nothing; the tests prove it.
- **Never weaken a test:** the 49a/search filters, the 46/47 close tests and the existing analytics pages keep
  their assertions; 50 adds cases. `closes`, `settings-plant`, `floor`, `desk-lists`, `analytics-*` rerun
  unchanged.
- **Size:** `routes.ts` 384 → 386; `pm-routes.ts` ≤180; `pm-reschedule.ts` ≤200; `pm-calendar.ts` ≤140;
  `pm-schedule.ts` ≤220; `pm-compliance.ts` ≤260; `PmCalendarPage` ≤280; `PmCalendar` ≤180; `machine-tasks` ≤150;
  `api.ts` 341 → ~381; `machine-summary` 182 → ~184; `pm.en.ts` 22 → ≤70; every new test under the test
  exemption but still small. 50a and 50c are over the 800-line hard rail by design; their PR bodies carry the
  `Large PR:` line.
- **D28:** the prototype's `npm audit --omit=dev --audit-level=high` was clean (0 high/critical); the real
  `pnpm audit:deps` runs on the pinned tree.

## The prototype that settled R1 (run 19 Nov 2026, not committed)

`/tmp/fc7-proto` installed `@fullcalendar/react@7.1.5`, `temporal-polyfill@1.0.8`, React 19.3.1, and bundled with
the repo's esbuild 0.28.2. It rendered a `dayGridMonth` for November 2026 with 20 PM events, the classic theme and
the interaction plugin; a Playwright mouse drag of `TC-15` to the 10 November cell fired `eventDrop` and printed
`TC-15 -> 2026-11-10`; there were no page or console errors. Sizes (minified / gzipped, React external): **256,305
B / 73,873 B** for the FullCalendar entry; the same build with React included was 479,368 B / 142,649 B; the
theme CSS 17,103 B / 3,825 B. A 35-line hand-rolled month grid (React external) was 1,419 B / 765 B but had no
month navigation, keyboard movement, touch drag, event stacking or `+N more`; a production version would be
several hundred lines with weaker accessibility. The v7 packages are the current line (v6.1.22 is published as
`legacy` with separate plugin packages); v7 consolidates the plugins into `@fullcalendar/react`, needs the
`temporal-polyfill` peer, and uses hashed CSS class names — the prototype proved `[data-date]`, the event text and
the theme CSS variables are the stable hooks, which is what the E2E and the token styling use. `npm audit` on the
prototype tree reported 0 high/critical. These `/tmp` numbers are a **record of the fork**, not the repository's
proof: the reproducible proof is 50c's source/chunk guard (the library is only in `PmCalendar.tsx` and only in the
lazy `PmCalendar` chunk) and the E2E's real drag (the browser sends the reschedule and the event moves). No
prototype script is committed; if a future reviewer needs to rerun the fork, the ADR's commands are the record and
the 50c guard is the check. If the real page fails the chunk or interaction condition, ADR 0009's fallback is the
hand-rolled month grid; no other library is authorised.

## Not in this ticket

A week/resource/Gantt view and FullCalendar premium views; a full-year 427-visit projection (49 R2's loss); bulk
"spread the whole year" rewriting of plans; PM effectiveness, the control group and interventions (54); technician
ranking (54); the monthly scorecard and its PDF (53); inspection ticket generation (52); an in-app checklist
editor; meter/sensor reading feeds; notifications for a raised PM job; a Gujarati calendar locale (the `pm`
namespace is blank in `gu`, as 49 left it); names in the PM Reports export row (R15 prints the person id).

## Risk the reviewer should focus on

1. **The scheduled-date definition.** R6/R7 turn on `task_expected_on ?? reported_at`; 50a's `pm.generate` change
   (R12) is what makes a late nightly run keep the due. Read the fixture's B1/A1/G1 cases together: B1 is a PM early
   miss and a schedule hit; A1 is the reverse; G1 is PM-pending and schedule-missed. A builder who measures PM
   compliance against the close's week, or schedule compliance against the tolerance, passes one row and fails the
   point.
2. **The move's writes.** R3 must not touch `pm_plan` and must not rewrite `reported_at`; the audit event, the
   idempotency binding, the start/working refusal and the cross-tenant 404 are the four proofs. A future
   integration that reads `task_expected_on` as task-only is the named cost.
3. **The load cap and the suggestion.** The server refuses an over-cap move and the pure suggestion must be
   inside the tolerance and never in the past; the crowded pair in the E2E is the proof. A reviewer should ask
   whether the cap of 1 is a product decision (it is the platform's default, recorded in R5, not a hidden one).
4. **The dependency door and the chunk.** `@fullcalendar` must appear only in `PmCalendar.tsx` and only in a lazy
   chunk; the guard's planted violation and the build check are the proof. v7's hashed classes mean the E2E must
   use `[data-date]` and text, never `.fc-*`; a reviewer who sees a `.fc-` selector has found a future break.
5. **The per-row snapshot profile.** 48 R15's single-constant `PROFILE` cannot store legacy and standard rows in
   one run; 50b's `jsonb_to_recordset` per-row profile is the fix. Read the stored rows, not the constant.
6. **The 125-versus-427 gap.** The workbook's PM Plan sheet now has 125 next-date rows, not the platform's 427
   visits; 49 R2's cost is visible in the export (R15). The reviewer should check that the plan says so rather than
   claiming parity with the platform's visit list.
