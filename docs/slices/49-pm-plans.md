# M4b-49 — PM plans on the phone (ticket 49)

Ticket 49: PM plans and checklists come from the workbook (PM Plan, PM Reports) into `pm_plan`; `pm.generate` raises
PM jobs as tickets by time and by meter reading; a technician ticks the checklist on the phone and closes the job.
Blocked by 46. Authority: **D17** (`pm_task`, `pm_execution`, `pm_checklist`/`pm_checklist_item` do not exist; the
checklist is a list on `pm_plan`, the completion is the ticket's `breakdown_report.pm_report`, the job is a ticket with
channel `pm`), the 0015 migration, `docs/DATA-MAP.md`'s PM row, and `docs/plan/MILESTONES.md` ticket 49 (lines
435–441). This plan is frozen: every fork below is a numbered ruling with its cost if wrong; there is no open question
left for a builder.

**Revision (19 Nov, after the fresh plan review).** Re-frozen against the merged 46b and the in-flight 46c: the raise
contract, the shared channel home, the `records.ts` repo and the stored `pm_report` shape; 49b's input corrected to `at`
and no extra fields; 49c builds the stored report **before** the store; R2's done-plan counts corrected; the seed's
reconciliation keys, the pre-0015 guard and the three migration tests added; the `source` rule; `pm_plan.title` and the
future `created_at` named; the 45 live PM sheets moved to 50; the packet Large-PR lines added; the stale
ARCHITECTURE/E2E/46b claims fixed.

## Current state and prerequisites

**46a and 46b are merged** on `main` (`b06e888f`). 46b gives ticket 49:

1. **A published planned raise.** `apps/server/src/modules/tickets/planned.ts` exports
   `raisePlannedTicket(client, input)` with
   `input = { tenantId; machineId; channel: 'pm' | 'inspection'; problem; reportedByPersonId?; raisedLoginId?; at? }`.
   It fetches the machine, refuses a scrapped one, raises in the caller's transaction and writes no reply parts. As
   merged it raises `kind: 'stopped'` with a `BD-` reference.
2. **The PM report on a close.** `packages/shared/src/ticket.ts` has the strict
   `pmReportSchema = { total: number; undone: string[]; readings: Record<string, number>; comments: string | null;
doneBy: string | null }` and `breakdownReportSchema.pmReport`; `storedReportSchema.pmReport` carries it back. The
   close stores `input.body.pmReport` **verbatim** in `breakdown_report.pm_report` — it does not enrich it.
3. **The plant PM repo.** `apps/server/src/modules/plant/repo/records.ts` has `insertPmPlan` / `pmPlanById`, the
   `PmPlan` / `PmPlanDraftInput` types, exported from `plant/index.ts`; `manifest.ts` gives the plant module the two
   tables. There is no `repo/pm-plans.ts`.
4. **The planned-channel list.** `PLANNED_CHANNELS` lives in `tickets/planned.ts` today.

**46c is in flight and lands before 49b.** It changes exactly two things:
`raisePlannedTicket` raises `kind: 'general'` with a `WR-` reference (the input is unchanged, above), and
`PLANNED_CHANNELS`/`isPlannedChannel` move to `packages/shared/src/channel.ts` (one home), with `tickets/planned.ts`
importing them from there. 49b consumes that contract; 49a starts on the merged 46b repo and does not duplicate it (a
second repo is the only reason it would wait); its contract is 0015's.

49c adds `planId` to the shared `pmReportSchema` **additively** (optional, so 46b's existing close test and older
callers still parse) and builds the stored object before the store (R8).

## The shape in one paragraph

`pm_plan` holds **one recurring plan per machine** (a category plan is the fallback for machines without a machine
plan): its `title`, interval in days, meter interval/tolerance and last reading, the last date it was done, and the
numbered checklist as a JSON list. `pm.generate` runs once a day per tenant, works out which effective plans are due
by the calendar (`last_done_on` else the `created_at` clock anchor, plus the interval) or by the meter (the latest
reading minus the reading at the last PM), and raises one `general`/`pm` ticket per due machine through 46c's
`raisePlannedTicket`, unless the machine already has an open PM job. The technician opens PM jobs in a new floor list,
ticks the plan's checklist on the ticket, records the readings and (for a meter plan) the machine meter, and closes
with `kind: 'report'`. The route builds the stored `pm_report` before the close stores it, and the close moves the
plan's `last_done_on`/`last_meter_reading` in the same transaction. The PM plan screen is a generated settings page
(`CrudPage`) over the same rows. No new table, no new module, no new dependency, no migration.

## Facts it rests on (verified in this checkout, 19 Nov 2026)

| Fact                                                    | Evidence                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ticket and its blocker                              | `docs/plan/MILESTONES.md:416` (46), `:435-441` (49), `:440` (50 blocked by 49)                                                                                                                                                                                                                                                                                       |
| `pm_plan` columns and the 0015 grants                   | `packages/db/migrations/0015_m4b_schema.sql:105-130`; the `pm`/`inspection` channel CHECK at `:29-31`; `breakdown_report.pm_report` at `:34-39`                                                                                                                                                                                                                      |
| The plan shape D17 intends                              | `docs/decisions/D17-table-budget.md:19` ("plan per machine or category: interval, meter, tolerance, checklist items as a list on the row"); the removed tables at `:40`; `docs/DATA-MAP.md:109`                                                                                                                                                                      |
| The PM row of the triage                                | `docs/plan/m4a-triage.md:23` (pm-plan: 427 planned dates, calendar is 50) and `:24` (pm-reports: 2 real reports)                                                                                                                                                                                                                                                     |
| The workbook export's PM counts                         | `docs/slices/45-reports-guide.md:267-269` (PM Plan 427 on the fixture, PM Reports 2)                                                                                                                                                                                                                                                                                 |
| The fixture shapes                                      | `fixtures/answer-key/input.json`: `pmPlan` 427 rows `{id, machineId, date, source, done?, viaMove?, target?}`; `pmReports` 2 rows `{total, undone[], meas{"<point>.<metric>": value}, comments[], doneBy, …}`; `settings.pmFreq=2`, `pmTolDays=15`                                                                                                                   |
| The platform page                                       | `fixtures/answer-key/pm-plan.json`: asOf 2026-11-11, "125 CNC machines", the status extra `{od:154, ok:15, late:1, up:257}`                                                                                                                                                                                                                                          |
| The platform's own rules (reference only, never copied) | `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html:7814-7823` (`pmFreqSpecFrom`, `pmTolForSpec`), `:8979-9030` (`pmSeed`, `pmStepMonths`, `pmHorizonEnd`), `:9087-9098` (`pmStat`), `:9176-9216` (the PM report payload, `PM_MEAS`)                                                                                                                     |
| The workbook itself                                     | `docs/discovery/real-2026-11-13/cosmos-export-2026-11-11.xlsx`: `PM Plan` sheet `max_row=431` (three title rows, a header at row 4, 427 data rows), `PM Reports` sheet 3 rows (header + 2)                                                                                                                                                                           |
| The merged planned raise                                | `apps/server/src/modules/tickets/planned.ts` (input, `kind: 'stopped'` as merged); `changes/46-m4b-schema.md`'s 46b section                                                                                                                                                                                                                                          |
| The merged PM report shape                              | `packages/shared/src/ticket.ts:142-151` (`pmReportSchema`), `apps/server/src/modules/tickets/repo/report.ts` (the store writes `b.pmReport` verbatim)                                                                                                                                                                                                                |
| The merged plant PM repo                                | `apps/server/src/modules/plant/repo/records.ts` (`insertPmPlan`, `pmPlanById`, `PmPlan`); `plant/index.ts:47-56`                                                                                                                                                                                                                                                     |
| The pre-0015 seed paths                                 | `apps/server/test/batch1-migration.test.ts:41`, `m4a-migration.test.ts:45` (`through: '0013_batch1.sql'`), `m2-schema-migration.test.ts:68` (`through: '0011_tenant_profile.sql'`) all call `seedCosmos`                                                                                                                                                             |
| The live workbook's PM sheets                           | `apps/server/src/modules/reports/export-data.ts` passes no `pmPlan`/`pmReports`, so `packages/domain/src/exports/plant-sheets.ts`'s two PM sheets are header-only in the live export; only the 45 key test passes the fixture                                                                                                                                        |
| The existing job / fake-clock patterns                  | `apps/server/src/retention.ts:120-163` (create queue, worker, UTC schedule, `jobTenantIds`, `withTenant`, clock guard, `allowFakeClock`); `apps/server/test/sla-timers.test.ts:99-140` (harness + `buildApp` + boss)                                                                                                                                                 |
| The close and report paths                              | `apps/server/src/modules/tickets/repo/report.ts` (a report is stored only on `close` with `kind: 'report'` and a `report` body; `pmReport` is written verbatim); `packages/domain/src/signoff.ts:18-24` (`asksSignoff` is false for `general`); `packages/domain/src/actions.ts` (Close is offered only when working)                                                |
| A PM ticket would currently block the floor             | `apps/web/src/faces/floor/use-floor.ts:46-47` (`openOnMachines` maps every open ticket by machine), `apps/web/src/faces/floor/report-state.ts:38-50` (`pick` opens any open non-support ticket); `apps/web/src/screens/desk/openLists.ts:75-81` (`workRequests` takes every open general ticket)                                                                     |
| The settings framework                                  | `apps/server/src/modules/plant/settings-resources.ts:350` (`RESOURCES`), `settings-routes.ts:290-333` (list/create/edit/audit), `repo/plant-settings.ts:7-8` (`SettingsTable`) and `:167-182` (`Store`/`tableStore`), `apps/web/src/patterns/crud-spec.ts` (`CrudField` has text/time/choice only), `apps/web/src/screens/settings/Plant.tsx:72-108` (`PLANT_PAGES`) |
| Parity rows                                             | `docs/spec/parity.yaml:1270-1295` (`m4a.pm-plan`, `m4a.pm-reports`, both `todo`, ticket 49)                                                                                                                                                                                                                                                                          |
| The journey to mirror                                   | `apps/web/e2e/closes.spec.ts` (report close) and `apps/web/e2e/settings-plant.spec.ts` (a generated settings page); the PM job list is the `QueuePage` shape of `apps/web/src/faces/floor/my-complaints.tsx`                                                                                                                                                         |

### Derived counts (not pasted from the ticket)

With `pmFreq = 2`, `pmStepMonths = max(1, round(12 / 2)) = 6`, and `intervalDays = round(6 × 30.4) = 182`:

| What                            | Derived from                                                                                           | Count                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Workbook sheet rows             | `PM Plan` `max_row`                                                                                    | **431** = 3 title rows + 1 header + **427 data rows** |
| PM Plan source rows             | `pmPlan.length` (equal to the sheet's data rows)                                                       | **427**                                               |
| Distinct machines               | `new Set(pmPlan.map(r => r.machineId))`                                                                | **125**                                               |
| Plans written                   | one per distinct machine                                                                               | **125**                                               |
| Plans with a done date          | latest `done` per machine (VC-6 has two, so 16 done rows → 15 machines)                                | **15**                                                |
| Plans with no done date         | 125 − 15; anchored (R2)                                                                                | **110**                                               |
| PM Reports                      | `pmReports.length`                                                                                     | **2** (TC-31, VC-6)                                   |
| Tick points per report          | `total`                                                                                                | **26, 38**                                            |
| Measurement readings per report | `Object.keys(meas).length`                                                                             | **6, 9**                                              |
| Checklist items per report      | `total + readings`                                                                                     | **32, 47**                                            |
| Plan date sources               | `pmPlan[].source`                                                                                      | **169 plan, 58 rule, 38 manual, 162 auto**            |
| Next due preserved              | 110 never-done plans exact; 15 done plans re-derived (VC-6 14 days late, the other 14 1–10 days early) | **125 of 125**                                        |

`pm-plan.json`'s `extra.status` sums to 427 (`154 + 15 + 1 + 257`), so the fixture and the page are the same plan. The
platform's 154 "overdue" visits are past visits, not the next ones; every machine has a next date after 2026-11-11,
which is why the import produces no immediate overdue job (R2's cost records the loss).

## Rulings

**R1 — the loader is a seed/import step, not a migration and not a settings import.** `apps/server/src/seed/` gains a
pure mapper (`apps/server/src/seed/pm-plans.ts`) and the Cosmos seed calls it, then `plant.seed.ts`'s
`insertPmPlans` writes the rows through `records.ts`'s `insertPmPlan`. Migrations are schema, immutable and apply to
every environment (0015 is the one M4b migration; no data in it). A settings import would need an xlsx reader and a
screen no mockup approves. The mapper is the reusable part for M5's general import. **Cost if wrong:** staging/dev have
plans and a real plant onboards through the settings screen (one plan at a time) or waits for M5; no product path
uploads the PM Plan sheet in 49.

**R2 — a `pm_plan` row is a machine's recurring plan, not a visit, and "counts match" means every row is accounted
for.** 0015 has no scheduled-date column and D17 defines the row as the plan. The 427 workbook rows are the platform's
projected visits for 125 machines; the import reduces them to 125 plans, keeping each machine's cadence and its **next
planned date** through the plan's clock anchor. `last_done_on` = the latest done date, else NULL; `created_at` = the
machine's next planned date − `interval_days`, **at local midnight** — this is the plan's clock anchor, not its
insertion time, and it **may be in the future** (a plan whose next visit is in 2027 starts its clock in 2027; no due
before anchor + interval). `title = '<machine code> preventive maintenance'`; a category plan the screen creates uses
the planner's title. The 15 done plans re-anchor on the done date and are **re-derived**, not preserved: VC-6 is 14
days late against the source's next date, the other 14 are 1–10 days early; the 110 never-done plans are exact.
"Counts match" is the reconciliation, not a 1:1 table count: `pm_plan_source_rows` 427, `pm_plan_visits` 427,
`pm_plans` 125, `pm_plan_done` 15, `pm_plan_checklists` 2, carried by the seed report and asserted by the seed test.
**Source rule:** every date is a cadence anchor, whatever its `source` (169 plan, 58 rule, 38 manual, 162 auto): there
is no confirmation column and D17 forbids a table for one, so a suggested (`auto`) next date can raise a real job. The
plan's active switch and 50's calendar/move are the confirmation surfaces. **Cost if wrong:** the platform's full 2027
visit list and its 154 overdue visits are not stored; ticket 50 projects the calendar from the plans and cannot
reproduce that exact list, though every machine's next date is preserved exactly or within 14 days; a suggested date
can raise a job the planner would have moved. The alternative (427 plan rows, one per visit) was rejected: a visit has
no date column, `pm.generate` would have no due date, and intervention (54) and the plan screen would point at visits
instead of plans.

**R3 — one effective plan per machine, machine over category.** The effective plan for a machine is an active machine
plan; otherwise an active category plan for the machine's category (the most recently updated if several).
`pm.generate`, the ticket detail and the close all resolve the plan by this one rule. The settings screen refuses a
second **active** machine plan for the same machine (409). **Cost if wrong:** two plans with the same specificity would
have no deterministic target; the 409 and the latest-updated fallback are the guards.

**R4 — a PM job is `kind: 'general'`, channel `pm`, reference `WR-…`.** It is planned work, not a breakdown: it is
excluded from breakdown counts, SLA clocks, drift, escalation and analytics by 46a's predicate; `asksSignoff` is false
for `general`, so no hand-back is asked; `kind: 'support'` was rejected because it gets a `BD-` reference and would be
read as a breakdown in the desk's lists. 46b's merged raise still makes `stopped`/`BD`; **46c, in flight, makes it
`general`/`WR` before 49b** — 49b must not run on 46b's version. **Cost if wrong:** a PM job prints a work-request
reference where an operations team might expect a PM- prefix; a later ref-prefix change is a small display/sequence
change, not a schema change.

**R5 — the checklist is a numbered list, imported only where the workbook has a report.** `checklist` items are
`{ id, kind: 'tick', point }` or `{ id, kind: 'reading', point, metric, label, unit: 'mm' }`. Tick item `id` is the
point number as a string; reading item `id` is `<point>.<metric>`, the same key the platform's report uses. Tick item
labels are **not stored** — the phone renders "Point N" through i18n; reading labels are the platform's measurement
names (its `PM_MEAS` names, recorded as data in `packages/shared/src/pm.ts`, not code copied from the platform). The
two imported reports give the only checklists (TC-31: 26 tick + 6 readings = 32; VC-6: 38 + 9 = 47); the other 123
plans get `[]`. The workbook holds no item text, and inventing a 26/38-point work order for every machine would be
false work. The settings screen shows the item count and does not edit the list: `CrudField` has no list editor and a
checklist editor has no approved mockup. **Cost if wrong:** a planner cannot add a checklist to the other machines in
49; the phone shows "No checklist" and still closes with a comment, and a later designed editor/import fills the gap.

**R6 — meter due is measured from the reading at the last PM.** Every plan the screen or the import creates has a time
interval (`intervalDays`); the meter is an **additional** trigger, never the only one, so no plan is born inert.
`pm_plan.last_meter_reading` is the **latest known reading** (editable on the plan screen, written by a PM close); the
**baseline** is the reading in the most recent closed `pm` ticket's `pm_report.readings.meter` (reserved key). Meter
due when `last_meter_reading − baseline ≥ meter_interval`. `meter_tolerance` does not delay the raise: it is the
window after the interval at which the plan reads **overdue** (50's compliance); the raise moment is the interval, as
it is for time. With no baseline (no completed meter PM yet) the meter rule is inert and the time rule still raises
the first PM. A direct-SQL row with no `interval_days` is skipped by the job (the DDL allows it; the screen does not).
**Cost if wrong:** a meter plan whose readings are never recorded between PMs never triggers by meter; the plan's time
interval is the safety net, and a later meter-log feed (M4b/M5) reuses the same rule.

**R7 — time due is the plan's anchor plus its interval.** `anchor = last_done_on ?? the plant-local date of created_at`;
`due = anchor + interval_days`; raise when `due ≤ plant today + horizonDays` (the daily job's horizon is 0). Time
tolerance is not stored in 0015 and is not invented here: 49 raises at the due date; marking "late" within ±15 days is
50's status work. Dates are plant calendar dates (`plantToday`), never UTC. **Cost if wrong:** a plan raises on its
due date even if the platform would have shown a ±15-day window; 50 adds the window without changing the raise.

**R8 — 49c builds the stored report before the close stores it, and 46's store is verbatim.** The shared
`pmReportSchema` gains an **optional** `planId: uuid` (additive: 46b's close test and older callers still parse). The
stored object is 46b's shape plus that field:
`{ total: number; undone: string[]; readings: Record<string, number>; comments: string | null; doneBy: string | null;
planId?: uuid }`. `undone` holds the checklist tick item ids; `readings` holds the reading item ids → numbers plus the
reserved `meter`; `doneBy` is the acting person's **id** (46b's shape; the screen prints the name from the plant's
people); `comments` is the one text box (string or null); `total` is the checklist's tick-item count. The phone sends
`planId, undone, readings, comments` and the placeholders `total: 0, doneBy: null`. The close route (49c's
`preparePmClose`, called in `executeCommand` **before** `storeReportForTransition`) resolves the plan, derives
`total`/`doneBy`, validates every `undone` id and reading key against the plan's checklist, and sets
`tx.body.report.pmReport` to the stored object; `repo/report.ts` then writes it verbatim. A switched-off plan still
closes with its stored object and is **not moved**; a category-plan close is allowed when
`plan.category = machine.category`; a `planId` that is not the ticket's effective plan is refused (the effective
plan is the active machine plan, else the active category plan; if the effective plan is now switched off, the
ticket's own plan that targets its machine is the one accepted, and it is not moved). **Cost if wrong:** a client
cannot lie about how many points a plan has or who did the job; if a future field is needed (photos, signatures) the
JSON object grows, the columns do not.

**R9 — no new `pm` module.** D17 removed the pm module's tables: the plans are plant's (`pm_plan`), the job and the
close are tickets' (the job is a ticket). A `pm` module with no tables would only add a boundary and an owner for
nothing. `pm.generate` lives in tickets (which may read plant), the plan reads/writes in plant, the close update in
tickets → plant. ARCHITECTURE's `pm` module (line 88) predates D17's table removal; this is the recorded deviation.
**Cost if wrong:** ticket 50 may want a `pm` home for the calendar; moving one job file and its registration is the
whole change.

**R10 — planned channels are not live breakdowns anywhere the floor reads.** 46c moves `PLANNED_CHANNELS` and
`isPlannedChannel` into `packages/shared/src/channel.ts` (one home); 49b/49c import them from there. The floor's
`openOnMachines` counts only `isBreakdownChannel` tickets (so a PM job does not read "already reported" or block a
breakdown report); the desk's `workRequests` excludes planned channels; the board already ignores non-`stopped`
tickets. 52 inherits the filter. **Cost if wrong:** a PM job would make a machine look occupied on the floor and the
desk's work-request list; the test pins both.

**R11 — the two historical PM reports are not recreated as tickets; the live workbook sheets move to 50.** The reports
set the two plans' checklist shapes and confirm the done dates; their readings, comments and names are not written into
live `breakdown_report` rows, so the 1,279-breakdown analytics and the cutover history rules are untouched. The 45
workbook's live PM Plan and PM Reports sheets are header-only today (the live export passes no `pmPlan`/`pmReports`);
**50 owns wiring them** from the plans and the live reports. 49 does not touch the export; the frozen two stay in 45's
answer-key test. **Cost if wrong:** the live workbook under-reports PM until 50; the machine page (50) will not show
the two October reports until a later import/report slice; the two plans' last-done dates are still right, and no
analytics number moves.

**R12 — parity flips exactly here.** `m4a.pm-reports` → **done** in 49 with the close/phone evidence (the whole v3
behaviour — ticked points and readings per PM — is covered); `m4a.pm-plan` → **in-progress** in 49 (plans imported and
editable, the calendar is 50) and **done** in 50. **Cost if wrong:** the parity row would claim the calendar before 50
builds it; the plan's evidence strings name only 49 tests.

## Packet 49a — the workbook load and the PM plans screen (one PR)

**Files.**

- `apps/server/src/seed/pm-plans.ts` (new): the pure mapper
  `mapPmPlans({ pmPlan, pmReports, settings }, { asOf }) → { plans, sourceRows, visits, reports }` and its
  `PM_MEASUREMENT_LABELS` fallback. ≤250 lines.
- `apps/server/src/seed/pm-plans.test.ts` (new): the counts, checklist shapes, the 125 next dates, the source spread
  and the measured readings.
- `apps/server/src/seed/cosmos.ts` (`Paths.pmPath?` defaulted to `SEED_FILES.pm`; read the fixture, call the mapper
  with the workbook's `2026-11-11` as-of, pass the plans and the tenant zone to the insert; the seed report gains the
  five PM counts).
- `apps/server/src/seed/cosmos-data.ts` (`SeedResult.pmPlans` and the five counts keys).
- `apps/server/src/modules/plant/seed.ts` (`insertPmPlans(client, tenantId, plans, timeZone)`: resolves the machine
  codes to ids, calls `records.ts`'s `insertPmPlan` with `createdAt = local midnight of the anchor`, one row per plan;
  **guarded on `to_regclass('public.pm_plan')`** so the three pre-0015 seed tests no-op instead of failing).
- `apps/server/src/modules/plant/repo/records.ts` (extend: `PmPlanDraftInput.createdAt?`, `insertPmPlan` writes it;
  add `pmPlansForScheduling`, `pmPlanForMachine`, `activePlanForMachine`, `recordPmCompletion`; exported through
  `plant/index.ts`). ≤300 lines after the additions.
- `packages/shared/src/pm.ts` (new): `pmChecklistItemSchema`, `pmPlanReplySchema`, `pmPlanCreateSchema`,
  `pmPlanPatchSchema`, `pmPlanForJobSchema`, the 17 measurement labels; exported from `packages/shared/src/index.ts`.
- `apps/server/src/modules/plant/settings-pm.ts` (new): the `Resource` for `/settings/pm-plans` — `table: 'pm_plan'`,
  `kind: 'pmPlan'`, `order: 'title'`, the column map, the reply (numeric coercion, ISO `createdAt`), `create`/`patch`,
  the checks (a machine or category; a positive `intervalDays` always; a positive `meterInterval` when set; a
  non-negative meter tolerance; a last done that is a real day not after the plant's today; no second active machine
  plan via `records.ts`'s `activePlanForMachine`) and `switchTo: active`. The generic plant store does the CRUD, as
  machines/shifts do; `records.ts` remains the published repo for the seed/scheduler/close.
- `apps/server/src/modules/plant/settings-resources.ts` (append the PM resource to `RESOURCES` and nothing else).
- `apps/server/src/modules/plant/repo/plant-settings.ts` (`'pm_plan'` in the `SettingsTable` union).
- `apps/web/src/patterns/crud-spec.ts` (`CrudField.kind` gains `'date'`; `FormSheet`'s control already renders a date
  input, so no other pattern change).
- `apps/web/src/screens/settings/pm-plans-spec.tsx` (new): the `CrudSpec` — title, machine (choice from the settings
  machines resource), category, interval days, meter interval, meter tolerance, last meter reading, last done (a date
  field, so a planner can anchor a plan to the machine's real last PM); `createdAt` read-only with its reason ("the
  plan's clock anchor; imported plans may start in the future"); `checklist` hidden with its reason; a "next due"
  column computed in the plant zone; the active switch.
- `apps/web/src/screens/settings/pm-plans-spec.test.ts` (new): the D05 rule (every reply key is a field, read-only or
  hidden with a reason).
- `apps/web/src/screens/settings/Plant.tsx` (`pm-plans` page, `CalendarCheck`, `pm.menu.plans` and its `.sub`).
- `apps/web/src/App.tsx` — no change (the page list drives the routes).
- `packages/shared/src/i18n/pm.en.ts`, `pm.gu.ts` (new namespace; `blank(pmEn)` for gu), `i18n/index.ts`
  (`NAMESPACES`, `en`, `gu`).
- `docs/DATA-MAP.md`: the PM row's status becomes "Built (M4b, 0015); loaded and edited (49); calendar 50".
- `changes/49-pm-plans.md` (the shared fragment; this packet adds its section).
- The PR body carries `Large PR: the workbook load, the PM plan resource and its screen, the shared PM schemas and the
new pm namespace are one vertical slice; splitting would leave the screen without data or the seed without a
schema.`

**Build.** Read the fixture's `pmPlan`, `pmReports` and the PM settings; group by machine; compute `intervalDays`
from `pmFreq` (and `pmMach` when a fixture ever carries it, using the platform's own `pmFreqSpecFrom` semantics:
default, weeks, months, custom days); pick the latest `done`; pick the earliest date after `asOf`; anchor as R2 (title,
`created_at` may be future); attach the report's checklist (R5); write through `insertPmPlans`. The seed keeps its
current replace-only rule, so a re-run replaces the plans and no import batch/audit row is created. The settings
resource is the manual path. The seed report's counts are the reconciliation: `pm_plan_source_rows: 427`,
`pm_plan_visits: 427`, `pm_plans: 125`, `pm_plan_done: 15`, `pm_plan_checklists: 2`.

**Given/When/Then.**

1. Given `fixtures/answer-key/input.json`, when the mapper runs with `asOf = 2026-11-11`, then `sourceRows = 427`,
   the visits sum to 427, the distinct machines and the plans are 125, 15 plans carry the latest done date, 2 carry a
   checklist (32 and 47 items; 26/38 tick, 6/9 readings), the source spread is 169/58/38/162, and every plan's next
   due equals its source next date (110 exact) or is re-derived (15: VC-6 14 days late, the other 14 1–10 days early).
2. Given the seed on a seed-only Cosmos tenant, when it runs, then the tenant holds 125 `pm_plan` rows, the seed
   report carries the five counts above, no ticket or report was created for the two historical reports, and running
   the seed again replaces the plans (same count).
3. Given a pre-0015 schema (the three migration tests), when the seed runs, then `insertPmPlans` sees no `pm_plan`
   table and writes nothing; the plant seed and those tests still pass.
4. Given an admin on `/settings/pm-plans`, when they change a plan's interval and save, then the list shows the new
   value after reload and the audit screen has one `pmPlan.update` line naming the plan and only the changed key.
5. Given the same screen, when a second active plan is created for a machine that already has one, then 409; a plan
   without an interval, then 422; another tenant's machine id, then 404; a technician or operator opening the screen,
   then the settings refusal.
6. Given the settings screen on a phone, when it lists 125 plans, then every reply key is accounted for (D05) and the
   next-due column is computed in the plant's zone.

**Red/green commands.**

- Red: `pnpm exec vitest run apps/server/src/seed/pm-plans.test.ts` — `Test Files 1 failed`,
  `Cannot find module '../pm-plans.js'`.
- Green: the same file; `pnpm exec vitest run apps/server/test/pm-plans.test.ts` (the resource, audit, tenancy);
  `pnpm exec vitest run apps/web/src/screens/settings/pm-plans-spec.test.ts`;
  `pnpm exec vitest run apps/server/test/cosmos-seed.test.ts apps/server/test/batch1-migration.test.ts
apps/server/test/m2-schema-migration.test.ts apps/server/test/m4a-migration.test.ts` (the seed and the three
  pre-0015 paths).
- Rails: `pnpm boundaries`, `pnpm migrations:immutable`, `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run apps/server/src/seed apps/server/test apps/web/src/screens/settings
packages/shared/test` (the server suite is 2,171 tests on main after 46b; the three migration tests are named above).

## Packet 49b — `pm.generate` (one PR, after 46c)

**Files.**

- `apps/server/src/modules/tickets/pm-due.ts` (new): the pure decision
  `pmDue(plan, { today, horizonDays, openPm, baseline }) → { due, nextDue, rule, overdue }` — time (R7) and meter
  (R6), one result per plan; `overdue` is the meter window past `meter_interval + meter_tolerance` (50's status).
  ≤150 lines.
- `apps/server/src/modules/tickets/repo/pm.ts` (new): the ticket-side queries — open PM tickets by machine and
  `latestPmReadings(tenantId, machineIds)` (the last closed PM's `readings.meter`); the plans themselves come from
  plant's `pmPlansForScheduling`.
- `apps/server/src/modules/tickets/pm-generate.ts` (new): `runPmGenerate(pool, { now, tenantId?, horizonDays?,
allowFakeClock? })`; iterates `jobTenantIds` under `withTenant`, asserts the clock is within a day of the database
  unless the fake clock is allowed, and calls 46c's `raisePlannedTicket` once per due machine with
  `input = { tenantId, machineId, channel: 'pm', problem: 'PM due: ' + plan.title, at: now }` — **only the merged
  input fields**; 46c does not add `workType`, `location` or `reportedAt`, and 46c's general raise owns the
  general-kind fields inside tickets.
- `apps/server/src/modules/tickets/pm-jobs.ts` (new): `startPmJobs(boss, { pool, now }, role)` — create the
  `pm.generate` queue for every role (`retryLimit: 1`, `expireInSeconds: 600`), the worker and a daily UTC schedule
  `5 0 * * *` with `{ v: 1, horizonDays: 0 }`, `singletonKey: 'all'`, `missed: 'once'` for non-api roles. No boot
  enqueue (unlike SLA consistency): a plan is not due at creation.
- `apps/server/src/modules/tickets/index.ts` (export `startPmJobs`, `runPmGenerate`).
- `apps/server/src/index.ts` (`await startPmJobs(jobs.boss, { pool }, role)` after the notify jobs).
- `packages/shared/src/pm.ts` (`pmGeneratePayloadSchema`).
- `apps/server/test/pm-generate.test.ts` (new): the fake clock and the selection rules.
- `changes/49-pm-plans.md` (the 49b section).

**Build.** The schedule's payload is tenant-agnostic; the worker loops the customers from `jobTenantIds()` exactly
like retention. The effective-plan read is plant's `pmPlansForScheduling` (one row per machine: machine plans, and
category plans for machines with no active machine plan, scrapped machines out); the open-ticket query suppresses a
machine with any open/working/waiting PM ticket; the baseline map is one query, `DISTINCT ON (machine)` ordered by
`closed_at` descending. `pmDue` is pure and takes the local dates, so the DB test and the unit test share it.

**Given/When/Then.**

1. Given a plan last done 2026-05-01, interval 182, no open PM ticket, when `runPmGenerate` runs with the fake clock
   at 2026-10-29 (plant day), then no ticket; at 2026-10-30, then one ticket raised with the merged input (channel
   `pm`, problem `PM due: …`, `at` the clock), kind `general`/`WR-` from 46c, no `sla_timer`, no drift row and no
   escalation; a second run the same day raises none.
2. Given that ticket closed with a PM report, when the clock advances 182 days, then exactly one new PM ticket;
   given the first ticket cancelled instead, then the next run raises a fresh one (the work is still due).
3. Given a meter plan whose last closed PM report reading is 1000, current reading 1499, interval 500, then none;
   at 1500 exactly, then one ticket and `overdue` false; at 1549 still not overdue and at 1550 overdue, with the same
   single ticket (the tolerance moves only the status, never the raise); with no baseline, the meter rule is inert and
   the time rule still applies.
4. Given two plants with due plans, when the job runs for both, then each plant's tickets are its own (a plan id from
   the other plant never resolves); a machine with an open PM job gets no second job even if both rules are due.
5. Given a plan switched off, a plan whose machine is scrapped, and a plan with no interval at all, when the job
   runs, then none of them raises; given a `pm` ticket on the machine, the job skips it.
6. Given the job's input, then it names only the merged fields (`tenantId, machineId, channel, problem, at`) and never
   `workType`, `location` or `reportedAt`.

**Red/green commands.**

- Red: `pnpm exec vitest run apps/server/test/pm-generate.test.ts` — `Cannot find module '../src/modules/tickets/pm-generate.js'`.
- Green: the same file; `pnpm exec vitest run apps/server/test/figures-drift.test.ts apps/server/test/sla-timers.test.ts`
  (the `pm` channel still takes no clock/drift, the `floor` control still does);
  `pnpm exec vitest run apps/server/test/pm-generate.test.ts apps/server/test/tickets.test.ts`.
- Rails: `pnpm boundaries` (tickets → plant is already allowed), `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run apps/server/test packages/domain/test` (the server suite plus the domain
suite; no domain change expected).

## Packet 49c — the phone checklist, the close and the report (one PR)

**Files.**

- `packages/shared/src/ticket.ts` (`pmReportSchema.planId?`; `listTicketsQuerySchema.channel`),
  `packages/shared/src/replies.ts` (`ticketDetailSchema.pmPlan`).
- `apps/server/src/modules/tickets/repo/list.ts` (the `channel` filter; `openTicketOn` already ignores `general`).
- `apps/server/src/modules/tickets/list.ts` (parse `channel`; attach `pmPlan` to the detail through plant's
  `pmPlanForMachine`; the strict detail reply always carries the key, `null` for a non-PM ticket).
- `apps/server/src/modules/tickets/pm-close.ts` (new): `preparePmClose(client, tx, loaded)` — resolve the body's
  `planId`/effective plan, validate `undone`/readings against the checklist, derive `total`/`doneBy`, and set
  `tx.body.report.pmReport` to the stored object **before** `storeReportForTransition`; plus the plan-move helper
  called from `afterClose` (`recordPmCompletion`).
- `apps/server/src/modules/tickets/routes.ts` (call `preparePmClose` in `executeCommand` before the transition; the
  file grows a few lines and stays under 400).
- `apps/server/src/modules/tickets/tasks.ts` (`afterClose` records the plan completion when the loaded row's channel
  is `pm`: an active plan's `last_done_on`/`last_meter_reading`; a switched-off plan is not moved).
- `apps/web/src/components/PmClose.tsx` (new): the single PM close screen — the machine and plan title, tick items
  (all ticked by default, untick what was not done; `undone` is the tick item ids), reading inputs (numbers), one
  comment, the meter reading when the plan has a meter interval; submits `close` with
  `{ kind: 'report', at: now, report: { pmReport: { planId, total: 0, undone, readings, comments, doneBy: null } } }`;
  offline through the existing command queue; a "no checklist" state still allows a comment/meter.
- `apps/web/src/components/CloseFlow.tsx` (a `raisedChannel === 'pm'` branch that renders `PmClose`; no finish step
  and no breakdown report for a PM job).
- `apps/web/src/components/actionSpecs.ts` (a `pm` close is `{ action: 'close', label: 'pm.closeAction',
preset: 'report' }`, not the general "Mark done").
- `apps/web/src/components/PmReport.tsx` (new) and `apps/web/src/components/TicketFacts.tsx` (`ReportCard` branches
  on a PM report: "N of M points ticked", the undone item ids, the readings with their labels, the comment, the
  person's name resolved from `doneBy`).
- `apps/web/src/faces/floor/pm-jobs.tsx` (new): the maintenance list at `/floor/pm` — a `QueuePage` over
  `/api/v1/tickets?channel=pm&status=open,working`, each row linking to `/desk/:id`, with the machine, reference,
  title and status.
- `apps/web/src/faces/floor/floor-shell.tsx`, `report.tsx`, `other-work.tsx`, `my-complaints.tsx` (the PM tab shown
  only when `FloorData.maintenance`).
- `apps/web/src/faces/floor/use-floor.ts` (`openOnMachines` uses `isBreakdownChannel` from shared) and a new
  `apps/web/src/faces/floor/use-floor.test.ts`; `apps/web/src/screens/desk/openLists.ts` (`workRequests` excludes
  `isPlannedChannel`) and a case in `openLists.test.ts`.
- `apps/web/src/App.tsx` (`/floor/pm`).
- `packages/shared/src/i18n/pm.en.ts` (the phone report/close/job keys), `pm.gu.ts` blank.
- `apps/web/e2e/fixtures-pm.ts` (new): one PM machine, its plan with a 4-item checklist (3 tick + 1 reading) and a
  500-unit meter, and one open PM ticket; `apps/web/e2e/test.ts` includes the statements.
- `apps/web/e2e/pm-plans.spec.ts` (new): the phone journey and the settings journey.
- `docs/spec/parity.yaml` (R12), `changes/49-pm-plans.md` (the 49c section).
- The PR body carries `Large PR: the PM close, the phone checklist, the report card, the floor/desk filters and the
journey are one user-visible path; splitting would ship a close with no list or a list with no close.`

**Build.** The detail's `pmPlan` is the effective plan (R3) with its checklist; a PM ticket with no plan (the plan was
deleted or switched off) gets `null` and the screen says so. The close route reads `tx.body.report.pmReport`
(`planId` + entries), resolves the plan and builds the stored object **before** the store (R8). The plan move is
inside the close transaction, after the transition: an **active** effective plan moves (`last_done_on =
GREATEST(last_done_on, doneOn)`, `last_meter_reading = GREATEST(last_meter_reading, meter)` when the report carries
one); a switched-off plan is not moved. A mark-done close (no report) still moves the active plan's `last_done_on`, so
no close can make the next nightly run raise the same period again. A deleted plan row closes with an empty checklist
(`total: 0`, no entries stored), so the ticket is never a dead end; the plan row is not deletable from the screen
(switch off only).

**Given/When/Then.**

1. Given the seeded open PM job with a 3-tick/1-reading checklist and a meter plan, when the technician signs in on a
   phone, opens `/floor/pm`, taps the job, starts it, unticks item `'2'`, enters `0.01` for Backlash X, enters meter
   `1200`, writes a comment and taps Finish PM, then the ticket closes with `closeKind = 'report'`, the detail shows
   "2 of 3 points ticked", item `'2'` undone, the reading and the comment, and `breakdown_report.pm_report` equals
   `{ total: 3, undone: ['2'], readings: { '4.bx': 0.01, meter: 1200 }, comments: '<comment>', doneBy: '<Asha person
id>', planId: '<plan id>' }`; no failure code is sent or required, no sign-off is asked, and the plan's
   `last_done_on` is the plant day and `last_meter_reading` is 1200.
2. Given the same close body with a `planId` of another tenant or a plan that is not the ticket's effective plan, or
   a reading key not on the checklist, or no meter reading on a meter plan, then 422/404 and nothing is written; a
   body that also carries `total`/`doneBy` placeholders cannot change the stored values (the server's derivation
   wins).
3. Given a plan switched off after the job opened, when the technician closes, then the stored report is built from
   that plan's checklist and the plan's `last_done_on` is **not** moved; given a category plan whose
   `category = machine.category`, then the close is allowed; given a plan row deleted, then the close still closes
   with `total: 0` and no entries; given an API mark-done close (no report), then the active plan's `last_done_on`
   still moves and the next run raises nothing for that period.
4. Given a PM ticket open on a machine, when the floor loads that machine, then it does not say "already reported" and
   a breakdown can still be raised on it; the desk's work-request list does not show the PM job; a `floor` ticket on
   the same machine still shows and still blocks.
5. Given the repair of a closed PM job, when the list is read again, then the job is gone from `/floor/pm` (status
   filter) and the ticket's report card still shows it; the settings screen's next-due column has moved by the
   interval.
6. Given the settings journey, when an admin opens `/settings/pm-plans` on chromium and a phone, then the page renders
   its plan rows and the edit sheet, the interval save persists, and the audit line is on the audit screen.

**Red/green commands.**

- Red: `pnpm exec vitest run apps/server/test/pm-close.test.ts` — the close stores no `pm_report` / the plan is not
  moved; the web `PmClose` tests fail on the missing component.
- Green: the same file; `pnpm exec vitest run apps/server/test/tickets.test.ts apps/server/test/reply-contract.test.ts`
  (the detail's new key and the list's channel filter keep the reply contract green);
  `pnpm exec vitest run apps/web/src/components/PmClose.test.tsx apps/web/src/faces/floor/use-floor.test.ts
apps/web/src/screens/desk/openLists.test.ts apps/web/src/components/actionSpecs.test.ts`;
  `pnpm exec playwright test apps/web/e2e/pm-plans.spec.ts` (chromium + phone).
- Rails: `pnpm boundaries`, `pnpm parity`, `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run apps/server/test packages/domain/test apps/web/src` and the PM journey; the
`closes`, `settings-plant`, `floor` and `desk-lists` journeys are re-run unchanged.

## Screens, routes and words

| Surface                                         | Route                | API                                                                         | Who                                        |
| ----------------------------------------------- | -------------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| PM plans (generated settings page)              | `/settings/pm-plans` | `GET/POST /api/v1/settings/pm-plans`, `PUT /:id`                            | head/admin (`canSettingsLists`)            |
| Technician's PM job list                        | `/floor/pm`          | `GET /api/v1/tickets?channel=pm&status=open,working`                        | maintenance (the tab is hidden otherwise)  |
| The job (existing ticket page, PM close branch) | `/desk/:id`          | `GET /api/v1/tickets/:id` (adds `pmPlan`), `POST /api/v1/tickets/:id/close` | the ticket's crew/lead and the close rules |
| The closed PM report                            | the same detail      | the stored report's `pmReport`                                              | anyone who can read the ticket             |

A new **`pm` i18n namespace** (English + `blank()` Gujarati, like the M4a namespaces) holds the job list, the checklist
("Point {{n}}", "Not done", "Reading", "Comments", "Meter reading", "Finish PM", "N of M points ticked", "No checklist
for this plan") and the settings menu/columns. `pm.menu.plans` and `.sub` live there too; `Plant.tsx`'s `Key` union
gains the literal. Nothing is added to a shipped namespace (`floor`, `closes`, `detail`), so the catalogue freeze test
does not need a new `NEW_KEYS` entry; the file-length guard (250 lines) holds because `pm` is its own namespace.

## Parity

- `m4a.pm-reports` → `done`: evidence `apps/server/test/pm-close.test.ts` (the stored report),
  `apps/web/e2e/pm-plans.spec.ts` (the phone tick/readings/close), `apps/server/src/seed/pm-plans.test.ts` (the
  workbook's two reports' shapes).
- `m4a.pm-plan` → `in-progress`: evidence the import counts test and `apps/web/e2e/pm-plans.spec.ts` (the plan
  screen); ticket 49. It becomes `done` in 50 when the calendar and the compliance figures land. No other row moves;
  `pnpm parity` stays 119 rows / 0 problems.

## Audit

- Every settings create/update/switch goes through the generic resource route and writes `pmPlan.create` /
  `pmPlan.update` with before/after of the changed keys; the seed writes no audit line (seed-only tenant).
- A PM close is audited by the ticket's event log and the stored report (who closed it and when); the plan's derived
  `last_done_on`/`last_meter_reading` move inside that transaction and are not a second audit line — the close event
  is the authority, and D17 gives no table for a plan history.
- A generated PM job is recorded by the ticket's raise event with channel `pm`; the job does not write an audit row.
  The ticket's channel and its resolved plan on the detail are how a person tells where it came from (DATA-MAP).

## Rails

- **D17:** no new table; the checklist is `pm_plan.checklist`, the completion is the ticket's
  `breakdown_report.pm_report`, the job is a `pm` ticket. `pm_task`, `pm_execution`, `pm_checklist` and
  `pm_checklist_item` are not created.
- **No new dependency:** no FullCalendar (50), no xlsx reader (the JSON fixture), no cron library (pg-boss's
  `schedule`); the measurement labels and `Intl` date maths are in-repo.
- **No migration:** 0015 is untouched; `pnpm migrations:immutable` and `pnpm migrations:check` stay green.
- **Tenancy/RLS:** every repo function takes `tenantId` first and runs under `withTenant`; the scheduler loops
  `jobTenantIds()`; the close's `planId` is resolved with the tenant predicate; tests prove cross-tenant reads see
  nothing and another tenant's plan id cannot be closed or edited.
- **Never weaken a test:** the two web filters and the detail/list contract get added cases; no existing assertion is
  changed or removed. `closes`, `settings-plant`, `floor`, `desk-lists` and `sla-timers` are re-run unchanged; 46b's
  existing close test keeps parsing the shared `pmReportSchema` because `planId` is optional.
- **Size:** the hard 400-line file / 60-line function limits; `routes.ts` grows a few lines from 384 and stays under
  400 (the bulk is in `pm-close.ts`); `records.ts` grows to about 300; `settings-resources.ts` grows by one line; the
  `CrudField` type grows by one literal; the new files are split so none approaches 400; the i18n namespace files stay
  under 250.
- **Large PR:** 49a and 49c are over the 800-line hard rail by design; their PR bodies carry the `Large PR:` line
  above. 49b is under it.
- **Fragment:** one `changes/49-pm-plans.md` across the three packets (each merge keeps the earlier sections, as 45
  did).

## Not in this ticket

The PM calendar and load spreading, PM compliance/schedule compliance and the ±15-day late judgement (50); PM
effectiveness/interventions and the control group (54); an in-app checklist editor (no approved mockup, `CrudField`
has no list editor); PM report PDF/QR upload from the platform's separate tool; **the live workbook's PM Plan/PM
Reports sheets (header-only today; 50 wires them)**; meter readings from a machine/sensor feed (the plan screen and
the PM close are the entry points); notifications for a raised PM job (the list is the home).

## For 47, 50 and 52

- **47:** the coded-close rule applies to **breakdown-channel closes only** (`isBreakdownChannel`). A `pm` ticket is
  `general` and its report has NULL failure columns; 47's API and screen must not demand a code from it. 49c's
  acceptance proves a PM close with no codes succeeds.
- **50:** wire the live workbook's PM Plan and PM Reports sheets (from the plans and the live `pm_report`s) and the
  calendar/compliance; 49 leaves the export untouched and the frozen 45 key rows in the test.
- **52:** an inspection ticket is planned work too; reuse `PLANNED_CHANNELS`/`isPlannedChannel` from shared (46c) for
  the floor and desk filters, and the same `raisePlannedTicket` path for the Hot-machine inspection; the report data
  shape is 52's own.

## Risk the reviewer should focus on

1. **R2's reduction, the source rule and the future `created_at`.** The next date is exact for 110 plans and within
   14 days for the 15 done ones (VC-6 late, the rest early), but the 427 visits, the 154 overdue visits and the
   suggested (`auto`) dates are not distinguished: a suggested date can raise a real job. Read the mapper's
   next-date assertion and the seed's five reconciliation counts together.
2. **R8's build-before-store and the shape.** 46b writes `input.body.pmReport` verbatim and its `doneBy` is a person
   id, `undone` strings, `readings` numbers, `comments` a single string. 49c must set the stored object before
   `storeReportForTransition`; a switched-off plan closes but is not moved, a category plan is allowed, and a
   non-effective `planId` is refused.
3. **R6's meter baseline.** The due test uses the last closed PM's `readings.meter`, not the plan's current reading;
   a meter plan with no history is inert by meter. The fake-clock test must prove the 1499/1500 boundary and the
   inert case.
4. **R10's floor/desk filters.** A PM ticket leaking into `openOnMachines` or `workRequests` would make a machine look
   occupied or clutter the desk; the two added cases are the regression proof.
5. **The 46c dependency.** 49a starts on 46b's merged repo; 49b waits for 46c's `general`/`WR` raise and the shared
   `PLANNED_CHANNELS`; 49c waits for 49b. 49b passes the merged input only (`tenantId, machineId, channel, problem,
at`); 46c does not add fields to it.
