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
