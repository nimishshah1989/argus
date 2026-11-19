# 50 — PM calendar and compliance

**What changed for a user:** nothing in this PR — it is the frozen plan (`docs/slices/50-pm-calendar.md`), the
calendar decision (`docs/adr/0009-fullcalendar.md`) and this fragment. The packet that follows makes the PM group a
real screen: a lazy FullCalendar month of each machine's next PM, a daily load with a one-PM cap and a nearest-free-day
suggestion, a drag that creates or reschedules the job's ticket (never the plan), two compliance figures defined once,
and a live open/PM task block on the machine page. It also wires the live workbook's PM Plan and PM Reports sheets.

**Not in this PR:** no product code, no dependency install, no migration, no table. `pnpm-lock.yaml`,
`apps/web/package.json`, `THIRD_PARTY.md`, `packages/db/migrations/` and every `apps/`/`packages/` source file are
untouched; `pnpm precheck` and `pnpm parity` are the only checks this PR claims.

## Review fixes (19 November 2026)

- **50a** now assigns the two reply schemas: `packages/shared/src/replies.ts` gains `GET /api/v1/pm/calendar` and
  `POST /api/v1/pm/reschedule`, and `apps/server/test/reply-contract.test.ts` moves by exactly +2 with the route-table
  equality assertion kept (137 → 139 on the review baseline; 143 → 145 in this checkout, which already carries 49a's
  three settings routes and 46/47's routes).
- **50c** now owns the Guide: `pm-calendar` leaves `UNBUILT` (the set is four), gets a body paragraph and
  `figures: ['pm-compliance']`, the test's unbuilt heading list drops `31. PM Calendar`, and the 36 headings stay
  verbatim.
- **ADR 0009** says plainly that the `/tmp` prototype numbers are a record; the reproducible proof is 50c's
  source/chunk guard plus the E2E drag. It also names `THIRD_PARTY.md` as the repo-root file.

## Known limits of 50c (second review, 19 November 2026)

- There is no keyboard way to move every job yet: only crowded jobs get a Move button, and only to the suggested day.
  Ticket 87 gives every movable job a keyboard "Move to date".
- The page's cards, spacing and pixel sizes (`pm-calendar-parts.tsx`, `PmCalendar.tsx`, `machine-tasks.tsx`,
  `pm-calendar.css`) are hand-written, not the kit's. Ticket 87 restyles them.

## Prerequisites

49a is merged (`e10b5bb2`): 125 `pm_plan` rows and the generated `/settings/pm-plans` screen. 49b/49c land first and
are consumed by name: `pmPlansForScheduling`/`pmPlanForMachine`/`recordPmCompletion` (plant), `pm.generate` and
`pmDue` (tickets), `raisePlannedTicket` (46c's `general`/`WR-` raise and shared `isPlannedChannel`), and the stored
`pm_report` with its optional `planId`. 48's shift-calendar plan supplies the working-hours context and the
`kpi_snapshot` profile change this plan extends; 46 is merged.

## The calendar decision

FullCalendar **7.1.5** (MIT) with the `daygrid`, `interaction` and classic-theme subpaths and the `temporal-polyfill`
1.0.8 peer, under ADR 0009. The fork was settled by a prototype, not a preference: a month grid with 20 events and a
Playwright drag worked with no errors; the library-only bundle is 73,873 B gzipped (plus 3,825 B of CSS) and loads
only with the lazy `/analytics/pm` page. A hand-rolled 5×7 grid is far smaller but would own keyboard movement, touch
drag, stacking and `+N more` and still be less accessible; it is ADR 0009's fallback only if the real page fails the
chunk or drag condition. The v6 line is `legacy`; v7's hashed classes mean our CSS uses the theme variables and the
E2E uses `[data-date]` and text.

## The three packets

- **50a — the calendar data and the reschedule.** The shared `pmNextDue`/`pmToleranceDays` and the calendar query /
  reschedule schemas; the pure `pmCalendar` (effective plans' next dues, an open PM ticket replacing its plan, load,
  crowded, nearest free day) and `pmSuggestDate`; `GET /api/v1/pm/calendar` and an idempotent
  `POST /api/v1/pm/reschedule`. A move never edits `pm_plan`: it calls `raisePlannedTicket` at **now** with
  `scheduledOn` (a new optional field, written to the ticket's existing `task_expected_on`) or updates an open ticket's
  `task_expected_on`, and writes one `update` event with the from/to dates and actor. The window is the plan's
  tolerance, Monday–Saturday, never in the past, and never a day that already holds a PM. `pm.generate` passes the
  due as `scheduledOn`, so a late nightly run still records the right window.
- **50b — the two compliance figures and the live sheets.** `computePmCompliance` in `packages/domain` defines both
  once. **PM compliance** = PM work orders closed inside their scheduled ± tolerance ÷ PM work orders judged
  (closed, or past the tolerance); **schedule compliance** = planned work orders (PM or inspection) closed by the
  Sunday of their scheduled Monday–Sunday week ÷ planned work orders judged (closed, or past the week). The
  hand-computed fixture is in the plan: 2 on time / 8 judged = **25.0 %** and 3 done / 11 judged = **27.3 %**, with
  B1 proving early-vs-schedule, A1 late-vs-PM and G1 pending-vs-missed. The figure is computed on read and stored by
  an analytics run under `kpi_snapshot` profile `standard` (53 freezes the month end); no new table, no migration.
  The live workbook's PM Plan sheet gets one row per plan's next due and PM Reports one row per closed `pm_report`.
- **50c — the screens, the words and the journey.** `/analytics/pm` gets the lazy calendar, the two compliance tiles
  and the "Spread the load" panel; the machine page gets the live Tasks block (open non-PM and open PM tickets from
  the existing `/tickets?machineId` list, linked to `/desk/:id`, with a scheduled date and an Overdue chip). New copy
  lives only in the `pm` namespace (English; `gu` stays blank); `analytics.en.ts` is not touched. Parity flips
  `m4a.pm-plan` to **done**; `m4a.pm-reports` stays done from 49; no row is added.

## The rulings (full argument and cost in the plan)

1. FullCalendar 7.1.5, lazy one-door chunk, ADR 0009; no v6, no second library, no premium views.
2. The calendar shows each machine's **next due** plus its open PM ticket; it does not reconstruct the platform's
   427 visits (49 R2's loss). Cost: one PM per machine, not a year series.
3. A drag writes the **ticket**, not the plan: a new ticket at the target or an open ticket's `task_expected_on`;
   `pm_plan.last_done_on`/`created_at` only move on a close. Cost: moving the recurrence itself is a settings edit.
4. The move window is the plan's tolerance (15 days at 182, 2 at 30), Monday–Saturday, never past, never a started
   ticket. Cost: no Sunday scheduling and a changed interval changes a history's tolerance (the plan has no history).
5. Load spreading is a **cap of one PM per working day**, shown as crowded, suggested to the nearest free day inside
   tolerance and enforced by the server on a move; it never bulk-rewrites plans. Cost: two genuinely due PMs on one
   day stay crowded and cannot be moved there (they can be left).
6. PM compliance is **on-time closes / judged PM work orders**, using the scheduled date and tolerance; early, late,
   overdue and cancelled are misses; pending is excluded; one decimal, `null` with no denominator.
7. Schedule compliance is **done by the scheduled week's Sunday / judged planned work orders**, including inspection
   tickets; early counts, open after the week and cancelled are misses; pending is excluded.
8. Both are defined once in `packages/domain/src/analytics/pm-compliance.ts`; the figure is computed on read, stored
   only by a run (`profile: 'standard'`), and 53 freezes the month end. No new table (D17).
9. The machine page's Tasks block is a live read of the existing ticket list, split by `isPlannedChannel`; no new
   route and no new endpoint. Cost: the first 200 open tickets only.
10. Read `canAnalytics`, write `canSettingsLists`; the UI hides what the server refuses.
11. No new module, table, column or migration; `ticket.task_expected_on` is the planned job's scheduled date.
12. `raisePlannedTicket` gains the optional `scheduledOn`; `pm.generate` passes the due (one field).
13. New copy only in `pm`; no shipped catalogue is touched.
14. Parity: only `m4a.pm-plan` → done; 119 rows / 0 problems.
15. The live workbook's two PM sheets are wired here (49 R11): 125 next-date rows, not 427 visits.
16. Percentages are one-decimal numbers; counts are exact.

## Risk the reviewer should focus on

The scheduled-date definition (R6/R7) is the whole of compliance: B1 is a PM early miss and a schedule hit, A1 is the
opposite, G1 is PM-pending and schedule-missed. A builder who judges PM compliance by the close's week or schedule
compliance by the tolerance passes one row and fails the point. The move's writes are the second: `pm_plan` untouched,
`reported_at` untouched, one audit event, an idempotency key, a started-ticket 409 and a cross-tenant 404. The third is
the dependency door: `@fullcalendar` only in `PmCalendar.tsx`, only in a lazy chunk, never a `.fc-*` selector in our
tests. 50b's per-row `kpi_snapshot` profile is the fourth: 48 R15's single constant cannot store legacy and standard
rows in one run.

## Checks this PR claims

`pnpm precheck` (format, lint, typecheck, the fast suite and the docs checks) and `pnpm parity` (119 rows, 0
problems). No product code means no red/green packet command is claimed here; each packet's commands are in the
plan and are claimed by its PR.

## 50a — the calendar's data and its move (built)

**What changed for a user:** nothing on a screen yet (50c draws it), but the two APIs the calendar stands on are
live. `GET /api/v1/pm/calendar?from&to` answers one occurrence per machine — the effective plan's next due, or the
open PM ticket that replaces it — with the day's load, a crowded flag and the nearest free working day. A head or
admin can `POST /api/v1/pm/reschedule` to create the PM job at a new date or move an open one; the plan row never
changes. The PM group still shows 50b's interim page.

**Dependency (ADR 0009 R1):** `@fullcalendar/react` **7.1.5** and `temporal-polyfill` **1.0.8**, exact pins in
`apps/web/package.json`; the transitive `@fullcalendar/core` 7.1.5 and `@full-ui/headless-calendar` 7.1.5 (MIT)
are recorded in `THIRD_PARTY.md` with the peer. Nothing imports the library yet; 50c adds the one door.

**The pure core.** `packages/shared/src/pm.ts` gains the one `pmNextDue` (the settings screen now aliases it),
`pmToleranceDays` (15 / `max(1, min(15, round(15 × interval ÷ 182)))`), `pmWithinWindow`, and the calendar query,
calendar reply and reschedule body/reply schemas. `packages/domain/src/pm-schedule.ts` adds `pmCalendar` (one
occurrence per machine, the open ticket suppression, load, crowded, `suggestedOn`), `pmSuggestDate` (forward then
backward, Monday–Saturday, inside the tolerance, never before today) and `effectivePmPlan` (50b's pure twin of
`pmPlansForScheduling`). It is exported through the domain index, so the D2 pin names the new API.

**The routes.** `GET` is `canAnalytics`; `POST` is `canSettingsLists` and requires `Idempotency-Key` (`runOutcome`
plus `computeBinding`, a replay returns the stored reply, a reused key is 422). Both run under `withTenant`. A move
materialises through 46c's `raisePlannedTicket` with the new optional `scheduledOn` (the ticket's
`task_expected_on`; the raise event carries it), or runs `setPmScheduledOn` (the date, `updated_at`, one `update`
event with `changes: [{ field: 'scheduledOn', from, to }]` and the plan id). `reported_at`, `started_at` and every
`pm_plan` column stay as they were. Refusals: 404 for another plant's plan/machine/ticket, 409 for a started job
(working/waiting or `started_at`) and for a day that already holds a PM, 422 for a bad body, a past day, a Sunday
or a date outside the plan's tolerance. The plan row is read `FOR UPDATE` and a plant-scoped advisory lock
serialises reschedules, so two planners cannot both claim the same free day; a no-op move answers 200 and writes
no event. `pm.generate` now passes the plan's due
as `scheduledOn`, so a late nightly run keeps the right window.

**Guard (ADR 0009 R1/R3).** `apps/web/src/screens/analytics/pm-calendar-guard.test.ts` mirrors the ECharts guard:
only `PmCalendar.tsx` may name `@fullcalendar`/`@full-ui`, the page must be reached through `import()`, our source,
CSS and E2E never use `.fc-*` selectors, and a production build keeps the theme's `fc-classic-` marker out of the
start-up files (the door and its chunk land in 50c; the guard is in place first, with a planted violation proving
each check). The pins and the expanded `THIRD_PARTY.md` row are asserted too.

**Tests.** `packages/shared/test/pm.test.ts` (zone-aware next due, the tolerance scale, the window, the contracts),
`packages/domain/test/pm-schedule.test.ts` (projection, suppression, no-interval and plan-less tickets, the
category/one-per-machine rules, crowded days, the Sunday/past refusals, `effectivePmPlan`),
`apps/server/test/pm-calendar.test.ts` (17 DB/API cases: the read, the category expansion, the tenancy and role
gates, the materialise and move writes, the replay, the 409/422 refusals, the plan and timestamps untouched),
`apps/server/test/reply-contract.test.ts` (146 → 148 with the route-table equality kept) and one
`apps/server/test/pm-generate.test.ts` case (a late run records the due). `pnpm exec vitest run apps/server/test
packages/domain/test`, the shared and web-guard suites, `pnpm precheck`, `pnpm boundaries`, `pnpm deps`,
`pnpm licences` and `pnpm exec tsc --noEmit` are the checks.

**Deviations.** The plan's file list puts the FullCalendar guard in 50c; it is here, ahead of the door, by the
packet order requested for this build, and passes vacuously until 50c's `PmCalendar.tsx` exists. `pm-reschedule.ts`
is 259 lines against the plan's ≤200 because the repo's 60-line/complexity rule forces the validation, window and
write steps into separate functions; no behaviour is split across modules. The ticket audit uses the history
contract's existing `changes` array, not the plan's shorthand object, because `ticketEventSchema` has always
defined `changes` as `{ field, from, to }[]`.

## 50b — the two compliance figures, the interim page and the live PM sheets (built)

**What changed for a user:** the `PM` group on the analytics face is no longer an empty menu. `/analytics/pm` shows
the `PM calendar` screen with one figure — a one-row table of the **period, PM compliance and schedule compliance**,
with the counts behind it (`2 of 8 PM jobs on time; 3 of 11 planned jobs done by their week`) and a dash, never 0 %,
when a denominator is empty. A plant with no planned work order in the window reads "No PM work orders in this
window." The same figure is what an analytics run stores, and the workbook's PM Plan and PM Reports sheets now carry
the plant's own rows: one next due per plan and one row per closed PM job, instead of two header-only sheets.

**The definitions, once.** `packages/domain/src/analytics/pm-compliance.ts` exports
`computePmCompliance(data, { from, to, asOf }) → { value, drillIds }`. **PM compliance** counts PM work orders
(`raised_channel = 'pm'`) whose scheduled date is in the window: on time when closed inside `scheduled ± tolerance`,
early before it, late after it, overdue when still open past it, cancelled when cancelled past it, pending while
still inside it (not judged). **Schedule compliance** counts planned work orders (PM or inspection) whose scheduled
date is in the window: done when closed on or before the Sunday of its Monday–Sunday week, missed when the week has
ended otherwise, pending inside the week (not judged). The scheduled date is `task_expected_on`, else the plant day
of `reported_at`; the tolerance is the machine's effective plan's (`pmToleranceDays`, 15 with no plan), resolved with
50a's `effectivePmPlan`, so a category plan answers for every machine it covers. Percentages are one-decimal numbers
(`25`, `27.3`) or `null`; the drill is the window's planned work orders in scheduled order, deduplicated and capped
at 200.

**The figure.** `pm-compliance` is registered with `screen: 'pm-calendar'`, `owner: 50` and `drill: 'ticket'`; its
computer reads the calendar year of the run's as-of day to that day, so the same function is what 53 will freeze at
month end. `computePmCompliance` is exported through `@uptimo/domain` for 53; `packages/domain/test/registry.test.ts`
names it in the D2 pin and the engine's owner set gains 50 (the ≤ bound stays 67, which 67a already raised).

**The per-row snapshot profile.** 48b had already landed the store this packet needed: `profileOfKey(key)` is
`standard` for `shift-kpis.*` and `pm-compliance`, `legacy` for everything else, and the store writes one statement
per run with each row's own profile. 50b changes no line of `snapshot.ts`; it extends the server tests to store
`pm-compliance` beside a `shift-kpis` and a legacy figure and to assert one `run_id` for the batch, and to assert the
stored `pm-compliance` row's `profile` and its true-zero value on this fixture (no planned work order).

**The live workbook (R15).** `apps/server/src/modules/plant/repo/analytics.ts` gains `pmPlansForEngine` (every plan,
switched-off ones too) so `loadEngineData` carries `pmPlans`; `apps/server/src/modules/tickets/repo/pm.ts` gains
`pmReportsForExport` (closed PM jobs with a stored `pm_report`). `exportDataFor` maps each machine's effective plan to
an `ExportPmPlan` row (`date` = its next due, `source = 'plan'`, `done` = `last_done_on`, `machineId` = the machine
code) and each stored report to an `ExportPmReport` row (`date` = close plant day, `planDate` = scheduled day,
`total`, `undone`, `measurements` as text, one comment, `doneBy` the stored person id, `data` the `pm_report`);
`workbook-route.ts` reads the reports once and passes both. The PM Plan sheet therefore prints the product's 125 next
dates, not the platform's 427 visits (49 R2), and the PM Reports sheet prints the live closed jobs, not the two
October reports that stay in 45's frozen key.

**Tests.** `packages/domain/test/pm-compliance.test.ts` (10 cases: the plan's 11-row fixture and the 2/8 = **25.0 %**,
3/11 = **27.3 %** arithmetic; the 11 drilled tickets once in scheduled order; the G1 close on both sides of the +15
boundary; the no-report close; the cancelled job; a window with no planned work order; an inspection ticket closed
Saturday vs the Monday after its week; a 30-day plan's ±2 against a 182-day plan's ±15 on the same three-day-late
close; the category plan and the plan-less default; the figure's registration and calendar-year window) with
`pm-compliance-expected.ts` holding the arithmetic. `apps/server/test/analytics-engine.test.ts` gains the loader's
`raisedChannel`/`scheduledOn`, the per-row stored profile and the one-run assertion; `apps/server/test/report-export.test.ts`
builds a PM plan and a closed PM job and asserts both sheets' exact rows; `apps/server/test/cosmos-seed.test.ts`
asserts the 125 seeded plans are each machine-scoped and dated (the export test proves the per-machine mapping);
`apps/web/src/screens/analytics/figure-content.test.ts` asserts the table, the dash with one null rate and the
"no PM work orders" line; `groups.test.ts` and `guide-entries.test.ts` prove the new screen's labels and that the
`pm-compliance` figure is explained exactly once.

**Deviations.** (1) 48b, not 50b, landed the per-row `kpi_snapshot` store; this packet consumes it and adds no code
there. (2) The figure carries `mixed: true`: the engine refuses a ready value with no drill ids unless the value is
empty, and a zero-denominator window is a true answer with no ticket behind it. `FigureDef.mixed`'s comment now
documents that second reason; the alternative (empty `from`/`to`) was rejected because 53 stores the window's own
value. (3) The mapper is `apps/web/src/screens/analytics/pm-compliance-content.ts`, not inline in
`figure-content.ts`, which is at 385/400 lines — the same split `page-content.ts` already uses. (4)
`pmReportsForExport` returns the machine's id, not its code: the tickets module may not name the plant's `machine`
table (`pnpm boundaries`), so `export-data.ts` resolves the code from the machines the load already carries. (5)
`ExportPmReport.undone` is widened to `(string | number)[]`: 49c stores each point's id, and the sheet joins them as
text. (6) The ticket drill reply strips `raisedChannel`/`scheduledOn` at the analytics boundary, so the strict
ticket-row schema (11 keys) is unchanged. (7) The Guide's `pm-calendar` entry now names `figures: ['pm-compliance']`
(the once-per-figure test); 50c adds its body paragraph and takes it out of `UNBUILT`. (8) `m4a.pm-plan` keeps
`status: in-progress` and gains the two test evidence lines: per R14 50c flips it with the calendar journey.
`pnpm parity` is 120 rows / 0 problems in this checkout (the plan's 119 predates one row that has since landed).
(9) The export test's fixture gained a PM job, so the Breakdown Log sheet prints its report too (the log keeps PM
rows); the test now finds the breakdown row by its spare cost and asserts the new row count instead of a fixed index.
(10) The report-export test proves the sheet's per-machine mapping on a two-machine plant while the Cosmos seed test
proves 125 dated machine plans; the seeded plant is not built into the export test, which runs on the small fixture.

## 50c — the PM screen, the machine block and the words (built)

**What changed for a user:** the `PM` group is now the calendar. `/analytics/pm` shows the two compliance rates as
tiles (one decimal and a `%`, or `—` with no denominator), a Monday–Saturday month grid of each machine's next PM,
the "Spread the load" panel for any day holding more than one, and the rows behind the rates when the figure names
them. A head or admin drags an occurrence to another day; the server writes the job (never the plan), the month
redraws, and a reload finds the job on its new day. A refused day (a Sunday, a day outside the plan's tolerance, a
day that already has a PM, a started job) snaps back and prints the server's own 422/409 message. Everyone else sees
the grid read-only; the server refuses the write regardless. The machine page gains a live **Tasks** block: its open
(non-PM) tickets and its open PM jobs, each with its reference linking to the desk, its status, and on a PM row its
scheduled day and an **Overdue** chip.

**The one lazy door (ADR 0009 R1).** `apps/web/src/screens/analytics/PmCalendar.tsx` is the only file that names
`@fullcalendar`; it imports the `daygrid`, `interaction` and classic-theme subpaths and the three stylesheets, maps
the API's occurrences to all-day events and reverts a refused drop. `Analytics.tsx` reaches its page only through
`lazy(() => import('./PmCalendarPage.js'))`, so the library and its theme are a `PmCalendarPage` chunk and never a
start-up file. 50a's guard now proves it for real: the source check finds no `@fullcalendar` outside the door, the
lazy check finds the one `import()`, no file or test targets a hashed `.fc-*` name, and the production build finds
the `fc-classic-` marker only in assets named `PmCalendar*`.

**The screen and the words.** `PmCalendarPage.tsx` reads `pm-compliance` from the figures reply (its `asOf` is the
month the grid opens on), draws the tiles and the panel, and mounts the lazy grid; `datesSet` drives the fetched
six-week range through `usePmCalendar`. `usePmCalendar` parses `GET /api/v1/pm/calendar` at the boundary and
`schedulePm` posts `POST /api/v1/pm/reschedule` with one idempotency key per move (the page's `machineCode` is for
the status line only and is stripped before the strict body). `pm-calendar-view.ts` is the pure mapping (events,
day load, tiles, the machine split) with `pm-calendar-view.test.ts`; `pm-calendar.css` sets the classic theme's
variables from the design tokens in light and dark and adds our event chips, never a raw colour and never a `.fc-*`
selector. Every new word is in `packages/shared/src/i18n/pm.en.ts` (`gu` stays blank); no shipped namespace moved.
The Guide's `31. PM Calendar` leaves `UNBUILT` (four remain) with one body paragraph and `figures:
['pm-compliance']`; `analytics-guide.en.ts` gains its `body1` and the 36 headings stay the key's.

**The machine block (R9).** `machine-tasks.tsx` reads `useTicketPages({ machineId, status: open/working/waiting,
limit: 200 })`, splits with `isPlannedChannel`, and renders inside `RecordBody` after the PM visits block. Its own
loading line and its quiet "Tasks are not available right now" never replace the analytics body. The split and the
overdue rule (`task_expected_on`, else the plant day of `reported_at`, against the page's as-of) are proved in
`pm-calendar-view.test.ts` without a DOM.

**The journey.** `apps/web/e2e/pm-calendar.spec.ts` (chromium and phone, `--workers=1`) stubs `/analytics/figures`
with a `25.0 % / 27.3 %` `pm-compliance` value and runs the real calendar, reschedule and ticket list: the two crowded
plans, the two tiles, the drag to a free working day, the reload that keeps it, a drop on a Sunday that shows the
422 and snaps back, the machine page's Tasks block with the open breakdown and overdue PM job, and an operator
refused both the screen and the write (403). `fixtures-pm-calendar.ts` seeds three machines of its own, two plans
due the plant's today and a third machine with an open PM job and an open breakdown, every date relative to the
plant day.

**Tests.** `apps/web/src/screens/analytics/pm-calendar-view.test.ts` (9 cases: the event mapping and ids, the day's
load, the inclusive month/grid ranges, both tiles at `25.0`/`27.3` and the dash with no denominator, malformed
values, the machine split, the plant-day fallback and the overdue rule); `pm-calendar-guard.test.ts` (5 cases,
including the build); `guide-entries.test.ts` keeps the 36 headings, the four unbuilt ones and the once-per-figure
check; `pnpm exec vitest run apps/web/src/screens/analytics` is 142 passed; the both-project PM journey is 4 passed;
`analytics-machines.spec.ts` and `analytics.spec.ts` rerun unchanged. `docs/spec/parity.yaml` flips `m4a.pm-plan` to
`done` with the compliance, calendar and E2E evidence added (it stays `ticket: '49'`); `m4a.pm-reports` stays `done`;
`pnpm parity` is 120 rows / 0 problems in this checkout.

**Deviations.** (1) The machine page's Tasks fixture lives on the calendar's own third machine (`PMC-3`), not on
`MACHINES[0]`: the first machine is one of the crowded pair, so an open PM job there would suppress the plan and
remove the crowded case, and `MACHINES[0]` is shared by the desk and floor suites. (2) The machine split is tested in
`pm-calendar-view.test.ts`, not in a separate `machine-tasks.test.ts`: the vitest environment is `node`, and the
component has no mapping of its own beyond the pure module. (3) The drag helper scrolls the event into view and
nudges it inside its own box before crossing to the target: with the two tiles above a 1440×900 viewport the month's
last rows begin below the fold, and FullCalendar needs the first pointermove on the event to start its drag. (4)
FullCalendar 7 has no top-level `buttonText`; the Today label is the v7 `buttons.today.text` form (ADR 0009 R4's
intent). (5) `pnpm parity` reports 120 rows, as 50b recorded; the slice's 119 predates a row that has since landed.
