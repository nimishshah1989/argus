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
