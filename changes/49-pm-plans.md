# 49 — PM plans on the phone

**What changed for a user:** nothing in this PR — it is the frozen plan (`docs/slices/49-pm-plans.md`) and this
fragment. The ticket that follows it makes a plant's PM plans visible on settings, raises a PM job on the phone on its
due date (or at its meter interval), and lets a technician tick the plan's checklist, record readings and close the
job, with the ticked report stored on the ticket.

**Not in this PR:** no product code, no screen, no migration, no dependency. `packages/db/migrations/0015_m4b_schema.sql`
is untouched; `pnpm precheck` is the only check this PR claims.

## Prerequisite

Ticket 46's packet 46b is not merged. 49 consumes two published things from it — `tickets.raisePlannedTicket` (a
`pm`/`inspection` raise with no SLA clock) and the close's `pm_report` storage — plus the plant PM repo it lands. If
46b's names differ, 49a's first commit renames one import and one schema key; no behaviour changes.

## The three packets

- **49a — the workbook load and the PM plans screen.** A pure mapper from `fixtures/answer-key/input.json` (427 PM
  Plan rows, 125 machines, 2 PM Reports) and the Cosmos seed write 125 `pm_plan` rows; the generated settings page at
  `/settings/pm-plans` edits them (audited). No historical tickets are created for the two PM reports.
- **49b — `pm.generate`.** A daily per-tenant job that raises one `general`/`pm` ticket per due machine, by
  `last_done_on + interval_days` or by `last_meter_reading − the last PM's reading ≥ meter_interval`, with no
  duplicate while a PM job is open. Fake-clock tested.
- **49c — the phone checklist and the close.** `/floor/pm` lists the open PM jobs; the existing ticket page gains a
  PM close that ticks the plan's checklist, records readings and the meter, and closes with `kind: 'report'`; the
  server stores `breakdown_report.pm_report = { total, undone, readings, comments, doneBy }` and moves the plan's
  `last_done_on`/`last_meter_reading` in the same transaction. The floor and desk stop treating planned tickets as
  live breakdowns; parity `m4a.pm-reports` is done here and `m4a.pm-plan` is in progress until 50.

## The rulings (full argument and cost in the plan)

1. **Loader:** a seed/import step, not a migration and not a settings import. Cost: no product upload of the PM Plan
   sheet until M5; the settings screen is the manual path.
2. **A plan is a machine's recurring plan, not a visit:** 427 source rows → 125 plans; the next planned date per
   machine is preserved through the clock anchor (110 exact, 15 within 14 days). Cost: the 2027 visit list and the
   platform's 154 overdue visits are not stored; 50 projects the calendar.
3. **One effective plan per machine** (machine over category, latest updated on a tie); a second active machine plan
   is 409.
4. **A PM job is `general`, channel `pm`, ref `WR-…`** — planned work, no breakdown counts, clock, drift, escalation
   or sign-off.
5. **The checklist is a numbered list** on `pm_plan.checklist`, imported only for the two machines the workbook has
   reports for; labels come from the platform's measurement names, tick points are rendered through i18n; no invented
   work orders and no list editor (no approved mockup).
6. **Meter due is measured from the last PM's reading**, not from the plan's current reading; `meter_tolerance` marks
   overdue, it does not delay the raise; no baseline means the meter rule is inert.
7. **Time due is anchor + interval**, raised at the due date; the ±15-day late window is 50's.
8. **The stored report is 46's five keys**, with `total`/`doneBy` derived by the server, never trusted from the body.
9. **No new `pm` module:** the plans are plant's, the job and the close are tickets'.
10. **Planned channels are not live breakdowns on the floor or desk** (`isPlannedChannel`); 52 reuses it.
11. **The two historical PM reports are not recreated as tickets**; they set the plans' checklist shapes and done
    dates.
12. **Parity:** `m4a.pm-reports` done at 49; `m4a.pm-plan` in progress at 49 and done at 50.

## Risk the reviewer should focus on

The 427 → 125 reduction and the `created_at` clock anchor (R2), the meter baseline (R6), and the close's
`pm_report` enrichment/47 exemption (R8). The plan's acceptance pins each with a derived count or a fake-clock
boundary rather than a pasted number.
