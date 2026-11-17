# M4a-40 — Breakdown analyses (ticket 40)

Ticket 40: goal 1 [Engine] "Breakdown log (NO DT and conversions included), A1 BD % and PM split, A2 category and cell,
A3 MTTR and MTBF match exactly." Goal 2 [Browser] "Their screens show them with drill-downs."
Acceptance: `fixtures/answer-key/{breakdown-log,a1-bd-pm,a2-category-cell,a3-mttr-mtbf}.json`, whole figure, no tolerance.

The formulas are already extracted and proven by ticket 38 (the same family): `docs/slices/38-dashboard.md` Revision 4 —
available hours per machine = `prodHrsPerDay × workDaysPerYear` "days so far" (month by month from 1 January to asOf; a
machine counts from its purchase date, an unknown date from the period start); production machines = CNC not excluded;
**Plant BD % = BD hours ÷ Σ available**, **PM % = PM hours ÷ Σ available**, fleet availability = 1 − BD − PM; breakdown
selection = history rows, PM excluded, **NO DT counts as a breakdown with 0 hours**, `otherBD` is not the workbook log.
MTTR = BD hours ÷ breakdowns; MTBF = (available − BD hours) ÷ breakdowns. Reuse `packages/domain/src/analytics/rows.ts`,
`availability.ts`, `machine-facts.ts` and `format.ts` — do not re-derive them.

## Packet 40a — the breakdown log figure (one PR, one writer)

`packages/domain/src/analytics/breakdown-log.ts`, registered as `breakdown-log` (drill ticket): the log's rows in the
key's shape `{ rows: [{ date, shift, machine, problem, doneBy, hours, code, ticketId }], rowCount, totalHours,
noDowntimeHours }` — the platform's columns (Sr No, Ticket No, Date, Shift, Machine, Problem, Done By, Downtime (Hrs),
Code), hours printed as the platform prints them (1.83, 4, — for NO DT), NO DT rows included with 0 hours, drill ids =
the ticket ids in row order. The fixture's table is truncated to 3 rows + `rowCount: 1343`, so the test asserts the
rowCount, the total hours, the NO-DT hours, the 3 printed sample rows **and** that every row's ticket id is a real
ticket (the whole source is in `input.json`).
**Files:** the module, `packages/domain/test/analytics-breakdown.test.ts` (new), `computers.ts` + `registry.ts` wiring,
`changes/40-breakdowns.md`.

## Packet 40b — A1 BD % and PM split (one PR, one writer)

`a1-bd-pm` figure: the 6 KPIs (Avg Available Hrs / Machine 4,525.54; Total Machines 125; Total Available Hrs 5,65,692.47;
Actual Breakdown 3,060.1 hrs; PM Downtime 759.3 hrs; Fleet Availability 99.32 %) and its four tables (By Cell — Detail 9
rows; Month-on-Month BD % and PM % 2026, 20 rows; MoM BD Hours by Cell 9; MoM PM Hours by Cell 9) plus its two charts'
data (`ch-a1-cell`, `ch-a1-trend`) in the `{ pages: [{ page, title, kpis, tables, charts }] }` shape (ticket 38's chart
value convention). Exact against `a1-bd-pm.json`.
**Files:** `packages/domain/src/analytics/a1-bd-pm.ts` (or extend `availability.ts` where the shared helpers live),
the test in `analytics-breakdown.test.ts`, wiring, fragment.

## Packet 40c — A2 category and cell (one PR, one writer)

`a2-category-cell`: By Category — Detail (14), By Cell — Detail (9), the 15 per-category Machine-Level Detail tables, and
the 8 charts (`ch-a2-cathrs`, `ch-a2-catcnt`, `ch-a2-cellhrs`, `ch-a2-cellcnt`, `ch-a2-catavghrs`, `ch-a2-catavgcnt`,
`ch-a2-cellavghrs`, `ch-a2-cellavgcnt`) — exact against `a2-category-cell.json`.

## Packet 40d — A3 MTTR and MTBF (one PR, one writer)

`a3-mttr-mtbf`: By Category (14), By Cell (9), Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide — exact against
`a3-mttr-mtbf.json`, with MTTR/MTBF the two formulas above (a machine/category with no breakdown prints the key's own
empty text, never a fabricated 0).

## Packet 40e — the screens (one PR, one writer, after 40a-d)

The Breakdowns group's four screens, kit-only, charts drawn with the kit's bar/line (38.5 added scatter/mixed):
- **Breakdown Log** (filters by date/shift/machine/code, the platform's columns, NO DT shown as no hours, the export),
  rows drill to the ticket.
- **A1 BD % & PM split**: the KPIs, the by-cell table, the month-on-month tables, the two charts.
- **A2 Category & cell**: the tables and the eight charts.
- **A3 MTTR & MTBF**: the three tables.
Every figure drillable; every string a catalogue key; money rules untouched (none here). An e2e journey on the seeded
stack, one per screen group, plus the phone project.

## Rails

Red first; never delete/skip/weaken a test; one writer per packet; file ≤ 400, function ≤ 60, screen ≤ 300; no new
dependency; engine values whole-figure equal to the key (no tolerance, no re-rounding); every figure drilled; honesty
(`null` for an empty plant, never 0). R1 (pure engine) / R1 for screens → one fresh reviewer plus the covering suite.
Commit locally, no push; report red, green, deviations.

## Acceptance

The four figures equal their key files exactly (the log's truncated table compared by rowCount + totals + sample, the
whole source's ids asserted); the four screens show them with their drills; a fresh reviewer runs the covering suite; CI
green; `main:check` green after each merge.
