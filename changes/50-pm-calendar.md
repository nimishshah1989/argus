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
