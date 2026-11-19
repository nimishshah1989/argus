# 49 — PM plans on the phone

**What changed for a user:** nothing in this PR — it is the frozen plan (`docs/slices/49-pm-plans.md`) and this
fragment. The ticket that follows it makes a plant's PM plans visible on settings, raises a PM job on the phone on its
due date (or at its meter interval), and lets a technician tick the plan's checklist, record readings and close the
job, with the ticked report stored on the ticket.

**Not in this PR:** no product code, no screen, no migration, no dependency. `packages/db/migrations/0015_m4b_schema.sql`
is untouched; `pnpm precheck` is the only check this PR claims.

## Revision (19 Nov, after the fresh plan review)

Re-frozen against the merged 46b (`b06e888f`) and the in-flight 46c: the raise input (`at`, no `workType`/`location`),
the shared `PLANNED_CHANNELS` move, the `records.ts` repo, the stored `pm_report` shape (`undone` strings, `readings`
numbers, `comments` a single string, `doneBy` a person id, plus 49c's optional `planId`), the build-before-store close,
R2's 110 exact / 15 re-derived counts, the seed's five reconciliation keys and pre-0015 guard, the `source` rule, the
`pm_plan.title`/future `created_at` wording, the 45 live PM sheets moved to 50, and the packet `Large PR:` lines.

## Prerequisites

46a and 46b are merged. 49a starts on 46b's `records.ts` repo (`insertPmPlan`/`pmPlanById`) and does not duplicate it;
its contract is 0015's. **46c is in flight and lands before 49b**: it changes `raisePlannedTicket` from
`kind:'stopped'`/`BD-` to `kind:'general'`/`WR-` (same input) and moves `PLANNED_CHANNELS`/`isPlannedChannel` into
`packages/shared/src/channel.ts`. 49c extends the shared `pmReportSchema` additively with an optional `planId` so the
close can find its plan.

## The three packets

- **49a — the workbook load and the PM plans screen.** A pure mapper from `fixtures/answer-key/input.json` (427 PM
  Plan rows, 125 machines, 2 PM Reports) and the Cosmos seed write 125 `pm_plan` rows (one recurring plan per
  machine, `created_at` as the clock anchor, keys `pm_plan_source_rows: 427`, `pm_plan_visits: 427`, `pm_plans: 125`,
  `pm_plan_done: 15`, `pm_plan_checklists: 2`); the generated settings page at `/settings/pm-plans` edits them
  (audited). The seed no-ops on a pre-0015 schema; the three migration tests stay green. No historical tickets are
  created for the two PM reports.
- **49b — `pm.generate`.** A daily per-tenant job that raises one `general`/`pm` ticket per due machine, by
  `last_done_on`/`created_at` + `interval_days` or by `last_meter_reading − the last PM's reading ≥ meter_interval`,
  with no duplicate while a PM job is open. Fake-clock tested; it calls 46c's `raisePlannedTicket` with
  `{tenantId, machineId, channel, problem, at}` only.
- **49c — the phone checklist and the close.** `/floor/pm` lists the open PM jobs; the existing ticket page gains a
  PM close that ticks the plan's checklist, records readings and the meter, and closes with `kind:'report'`; the
  route builds the stored `pm_report` before `storeReportForTransition`, and the close moves the active plan's
  `last_done_on`/`last_meter_reading` in the same transaction (a switched-off plan is not moved). The floor and desk
  stop treating planned tickets as live breakdowns; parity `m4a.pm-reports` is done here and `m4a.pm-plan` is in
  progress until 50. The 45 live workbook's PM sheets move to 50.

## The rulings (full argument and cost in the plan)

1. **Loader:** a seed/import step, not a migration and not a settings import. Cost: no product upload of the PM Plan
   sheet until M5; the settings screen is the manual path.
2. **A plan is a machine's recurring plan, not a visit:** 427 source rows → 125 plans; "counts match" is every row
   accounted for (427/427/125/15/2 in the seed report); the next planned date is preserved exactly for 110 plans and
   re-derived for the 15 done ones (VC-6 14 days late, the rest 1–10 early). Every date, whatever its `source` (169
   plan / 58 rule / 38 manual / 162 auto), is a cadence anchor, so a suggested date can raise a job. Cost: the 2027
   visit list and the platform's 154 overdue visits are not stored; 50 projects the calendar.
3. **One effective plan per machine** (machine over category, latest updated on a tie); a second active machine plan
   is 409.
4. **A PM job is `general`, channel `pm`, ref `WR-…`** — planned work, no breakdown counts, clock, drift, escalation
   or sign-off. 46c's raise is the one that makes it `general`; 49b does not run on 46b's `stopped`/`BD-` version.
5. **The checklist is a numbered list** on `pm_plan.checklist`, imported only for the two machines the workbook has
   reports for; labels come from the platform's measurement names, tick points are rendered through i18n; no invented
   work orders and no list editor (no approved mockup).
6. **Meter due is measured from the last PM's reading**, not from the plan's current reading; `meter_tolerance` marks
   overdue, it does not delay the raise; every plan has a time interval, so no plan is born inert.
7. **Time due is anchor + interval**, raised at the due date; the ±15-day late window is 50's.
8. **The stored `pm_report` is built before the store:** 46b writes the body's `pmReport` verbatim; the close route
   derives `total`/`doneBy`, validates `undone`/readings against the plan, and adds the optional `planId`. A
   switched-off plan closes but is not moved; a category plan is allowed when its category is the machine's; a
   non-effective `planId` is refused.
9. **No new `pm` module:** the plans are plant's, the job and the close are tickets'.
10. **Planned channels are not live breakdowns on the floor or desk** (`isPlannedChannel`, 46c's shared home); 52
    reuses it.
11. **The two historical PM reports are not recreated as tickets**; they set the plans' checklist shapes and done
    dates. The live workbook's PM Plan/PM Reports sheets are header-only today and are 50's to wire.
12. **Parity:** `m4a.pm-reports` done at 49; `m4a.pm-plan` in progress at 49 and done at 50.

## Risk the reviewer should focus on

The 427 → 125 reduction, the source rule and the future `created_at` (R2); the build-before-store `pm_report` and its
exact shape (R8); the meter baseline (R6); and the floor/desk filters (R10). The plan's acceptance pins each with a
derived count, a fake-clock boundary or an exact stored object rather than a pasted number.

## 49a — the workbook load and the PM plans screen (this PR)

**What changed for a user:** a head or admin now has a **PM plans** page at `/settings/pm-plans` (Plant settings,
`CalendarCheck`). It lists the plant's 125 recurring plans, shows each machine's next due, and edits the title,
machine/category, interval, meter interval, tolerance, last reading and last done date; changes are audited. The
Cosmos seed loads the workbook's 427 PM Plan visit rows as those 125 plans, with the two PM Reports' checklists.

**The reduction (R2).** One row per distinct machine, `title = '<machine code> preventive maintenance'`,
`intervalDays = 182` from `pmFreq = 2` (`round(max(1, round(12 / 2)) × 30.4)`), `last_done_on` = the latest done date,
else NULL. `created_at` is the plan's clock anchor: `last_done_on ?? (next visit − interval)` at the plant's local
midnight; it may be in the future and no due date is before anchor + interval. Every date is a cadence anchor whatever
its source (169 plan, 58 rule, 38 manual, 162 auto); no confirmation column exists (D17). The next date is exact for
the 110 never-done plans and re-derived for the 15 done ones (VC-6 14 days late, the rest 1–10 days early).

**The checklist (R5).** Only the two machines with a report get one: TC-31 has 32 items (26 tick + 6 readings),
VC-6 has 47 (38 + 9); the other 123 plans get `[]`. Tick ids are the point numbers as strings; reading ids are
`<point>.<metric>`, with the platform's measurement names as data in `packages/shared/src/pm.ts` and `unit: 'mm'`.
The settings page shows the item count and does not edit the list (no list editor, no approved mockup).

**The seed report carries the reconciliation**, not a pasted table count: `pm_plan_source_rows: 427`,
`pm_plan_visits: 427`, `pm_plans: 125`, `pm_plan_done: 15`, `pm_plan_checklists: 2`. A second seed replaces the
plans (same count). No ticket or `breakdown_report` is created for the two historical reports. The three pre-0015
migration tests still seed an older schema: `insertPmPlans` checks `to_regclass('public.pm_plan')` and writes nothing
when the table is absent.

**Evidence.** `apps/server/src/seed/pm-plans.test.ts` (the 427 → 125 derivation, the 125 next dates, the source
spread, the two checklist shapes, the custom frequency); `apps/server/test/cosmos-seed.test.ts` (the five counts,
the 125 rows, the plant-local anchor, the replace re-run); `apps/server/test/pm-plans.test.ts` (list, create, edit,
409 for a second active machine plan, 422 for no interval/future last done, 404 for another plant's machine, the
category plan, switch-off, audit lines and the settings refusal); `apps/web/src/screens/settings/pm-plans-spec.test.ts`
(D05 and the next-due zone). `pnpm boundaries` stays green: no new table, no new dependency, no migration; the screen
uses the existing `CrudPage` and its one new field kind (`date`).

**Deviation recorded for review:** the packet's build path needs only `records.ts`'s `createdAt` write and
`activePlanForMachine` (the 409). `pmPlansForScheduling`, `pmPlanForMachine` and `recordPmCompletion` are not added
here because 49a has no caller for them; they land with 49b/49c and their own tests, which keeps this packet's code
tested rather than speculative. The 404 on another plant's machine id uses the generic resource `Problem.missing`
flag (two lines in `settings-routes.ts`); `plantToday` moved to `repo/reads.ts` to keep the resource import acyclic.

## 49b — `pm.generate` raises the PM jobs (this PR)

**What changed for a user:** nothing visible yet on its own — every night at 00:05 UTC the server now works out
which PM plans are due and raises the PM job on the machine's floor list for the technician (49c builds that list and
the phone close). A machine gets one job, never a second while one is open.

**By the calendar (R7).** `anchor = last_done_on ?? the plant-local date of created_at`; due is `anchor +
interval_days`, raised when `due <= today + horizonDays` (the daily job's horizon is 0). The ±15-day late window is
50's. A direct-SQL plan with no interval raises nothing (R6).

**By the meter (R6).** The baseline is `readings.meter` of the machine's most recent closed PM job; due when
`last_meter_reading − baseline >= meter_interval`, raising at the interval. `meter_tolerance` only marks the plan
`overdue` past `meter_interval + meter_tolerance`; it never delays or repeats the raise. With no baseline the meter
rule is inert and the time rule still raises the first PM.

**The number and the shape.** One effective plan per machine (R3: an active machine plan, else the most recently
updated active category plan; scrapped machines out), one ticket per due machine through 46c's
`raisePlannedTicket` with only `{ tenantId, machineId, channel: 'pm', problem: 'PM due: <title>', at }`, so the job is
`kind: 'general'`, ref `WR-…`, channel `pm` and takes no SLA clock, drift line or escalation (R4). A machine with an
open/working/waiting PM job is skipped, so a re-run is a no-op and a cancelled job frees the next run.

**Wiring.** `apps/server/src/modules/tickets/pm-generate.ts` (the per-tenant run, the clock guard, the local day),
`pm-due.ts` (the pure decision), `repo/pm.ts` (open PM jobs, meter baselines), `pm-jobs.ts` (`pm.generate` queue for
every role; worker and the daily `5 0 * * *` UTC schedule, `{ v: 1, horizonDays: 0 }`, `singletonKey: 'all'`,
`missed: 'once'` for non-api roles; no boot enqueue), `records.ts`'s `pmPlansForScheduling`/`pmPlanForMachine`, and
`packages/shared/src/pm.ts`'s `pmGeneratePayloadSchema`. The worker fans out over `jobTenantIds()` under `withTenant`,
like the retention jobs.

**Evidence.** `apps/server/test/pm-generate.test.ts`: not due the day before, one job on the due date with only the
merged input, no second job on a re-run (same day or next), no `sla_timer`/`sla.escalate` job and no drift line, a
cancelled job raising a fresh one, the next period after a report close moving the plan, the meter 1499/1500/1549/1550 boundaries (tolerance moves only `overdue`), the
no-baseline inert case, switched-off/scrapped/no-interval/open-job skips, machine-over-category, two plants each
raising only their own, and the clock guard. `pnpm boundaries` is green (tickets → plant was already allowed);
`pnpm precheck` is the rail.

**Deviations recorded for review:** (1) the slice names `docs/decisions/D06-jobs.md` as the job pattern; this
checkout has no such file (it runs D01–D32 without a D06-jobs), so the job follows `retention.ts` and the
notifications jobs and D18's one-process rule. (2) `pmPlansForScheduling` does not return `anchorOn`: plant's repo may
not name `tenant` (the table is identity's), so the job reads the tenant zone through `tenantInfo` and passes the local
day into the pure `pmDue`. (3) The queue adds `retryDelay: 60`, the same as the retention queues, which the slice did
not name. No new table, dependency or migration; no test weakened.

## 49c — the phone checklist and the PM close (this PR)

**What changed for a user:** a technician now has a **PM jobs** tab on the floor (`/floor/pm`, maintenance only)
that lists the open PM jobs with the machine, the reference and the plan's title. Opening a job and tapping
**Finish PM** opens the plan's numbered checklist — every point ticked at first, untick what could not be done —
its reading boxes, the machine's meter and one comment. Finishing closes the ticket `kind: 'report'` with the
plan's `pm_report` and moves the plan's last-done date and meter reading; the ticket page then shows the report
("2 of 3 points ticked", the points left undone, the readings with their names and the comment) and the closed job
leaves the list. A PM job no longer makes its machine look "already reported" on the floor, and it is not a work
request on the desk.

**The stored report is built before the store (R8).** 46b writes the close's `pmReport` verbatim, so
`apps/server/src/modules/tickets/pm-close.ts`'s `preparePmClose` runs in `executeCommand` **before**
`storeReportForTransition`: it resolves the job's effective plan (or the one the body names), validates every
`undone` id and reading key against the plan's checklist, derives `total` from the tick items and `doneBy` from the
acting person, and sets `tx.body.report.pmReport`. The shared `pmReportSchema` gains an **optional** `planId`, so
46b's close test and older clients still parse. A switched-off plan closes from its own checklist and is **not**
moved; a category plan is accepted only when it is the machine's effective plan; a `planId` from another plant is
404, another machine's plan is 422, and a plan row that is gone closes with `total: 0` and no entries rather than a
dead end. A non-PM report keeps `pm_report` NULL even when a body smuggles one. A PM job whose machine has no plan at all
(direct SQL only; every real job comes from a plan) keeps what the caller recorded — 46b's contract, which the
existing close test pins — while its `doneBy` still comes from the session, so no body can claim who closed it.

**The plan moves in the same transaction.** `afterClose` calls plant's `recordPmCompletion` (active plans only,
`GREATEST` on both dates), so a re-run of `pm.generate` owes no second job for the period. An API mark-done close
(no report) moves the plan too; a cancelled job moves nothing.

**The phone and the lists.** `apps/web/src/faces/floor/pm-jobs.tsx` is the `/floor/pm` list (a `QueuePage` over
`GET /tickets?channel=pm&status=open,working`, so the list filter is the new `channel` query); `PmClose.tsx` is the
close screen and `CloseFlow.tsx` renders it for a `pm` ticket instead of the breakdown report; `actionSpecs.ts`
labels its close **Finish PM** (preset `report`), not "Mark done". The floor's `openOnMachines` counts only
`isBreakdownChannel` tickets (and the 409 "already open" path picks the breakdown, not a PM job), and the desk's
`workRequests` excludes `isPlannedChannel` ones (R10). The detail reply
always carries `pmPlan` — the machine's effective plan and checklist, `null` on any other ticket. All copy is in the
existing `pm` namespace (English; Gujarati stays blank like the other M4b area namespaces).

**Evidence.** `apps/server/test/pm-close.test.ts`: the stored object with the derived `total`/`doneBy`/`planId` and
the plan moved to the close's plant day, the placeholders ignored, a non-PM report NULL, another plant's plan (404),
another machine's plan (422), an unknown reading key and a meter plan with no meter reading (422) writing nothing,
a switched-off plan closing unmoved, a category plan accepted and moved, a deleted plan row closing empty, a
mark-done close moving the plan, and the list's `channel` filter. `apps/web/src/components/pmDraft.test.ts` (the
draft, the numbers, readiness, the close body), `apps/web/src/faces/floor/use-floor.test.ts` (R10),
`apps/web/src/screens/desk/openLists.test.ts` and `apps/web/src/components/actionSpecs.test.ts` (added cases, no
existing assertion changed). `apps/web/e2e/pm-plans.spec.ts` runs the phone journey (open `/floor/pm`, start,
untick point 2, `0.01` for Backlash X, meter `1200`, comment, finish, reload, see the report and the moved plan) and
the settings journey, on chromium and the phone project. Parity: `m4a.pm-reports` → **done**,
`m4a.pm-plan` → **in-progress** (the calendar is 50).

**Deviations recorded for review:** (1) the slice names `apps/web/src/components/PmClose.test.tsx`, but this repo
has no DOM test harness (no jsdom/@testing-library; adding one is a dependency) and every web unit test is a pure
`.ts` file — the screen's decisions live in `pmDraft.ts` and are tested there, and the screen itself is covered by
the Playwright journey. (2) `pm-close.ts` handles the late `report` action as well as `close` (the same build, no
plan move), so a PM ticket closed without a report cannot later store a client-written one. (3) The journey's
settings leg checks the page, the edit sheet and that the interval persists; the audit-screen leg of the slice's
GWT 6 is 49a's screen and is covered by `apps/server/test/pm-plans.test.ts`'s audit assertions, not here. (4) 49a
did not add `recordPmCompletion` (it had no caller); 49c adds it with the close that uses it, as the slice's
deviation note allowed.
