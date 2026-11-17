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

## Revision — the fresh plan review's findings (17 Nov; incorporate before dispatch)

The plan is **not dispatchable as written**; a fresh reviewer verified every point below against the keys, input.json and
the discovery JS. These are the rulings, not suggestions:

1. **The log includes PM.** `breakdown-log.json`'s `rowCount` is 1,343 = all history rows including the 64 PM rows
   (1,279 non-PM). PM-exclusion belongs only to A1–A3.
2. **The log's value is the standard page shape**, not a bespoke `{rows,totalHours,…}`: `{ screen, asOf, pages:[{ page:
   'breakdowns', title:'Breakdown Log', kpis:[], tables:[{ title:'', header:['','Sr No','Ticket No.','Date','Shift',
   'Machine','Problem','Done By','Downtime (Hrs)','Code'], rows:[3 display-string rows with the leading eye column],
   rowCount:1343, truncated:true }], charts:[] } }`. `totalHours`/`noDowntimeHours` exist in no key — derive them in the
   test from input.json (NO-DT cross-check against dashboard's 209.1; do NOT use dashboard's 3,060.1 total, it is
   PM-exclusive and live-inclusive).
3. **a3 has 6 tables** (By Category 14, By Cell 9, MoM Cell-wise/Plant-wide 20, MoM Age Band-wise/Plant-wide 12, By
   Machine Age Band 5, By Individual Machine 125) **and 7 charts** (ch-a3-catmttr/catmtbf/cellmttr/cellmtbf/agemttr/
   agemttf + ch-a3-planttrend, the mixed convention).
4. **a2 has 14 per-category Machine-Level Detail tables** (16 tables total), not 15.
5. **MTBF has four bases**: summary tables and the MoM Total use the days-so-far window (plant (565,692.47−3,060.11)/1,279
   = 439.9002 → "439.9"); monthly cells use that month's own window; Q columns average the **unrounded** monthly values
   (Q4 = 352.848 → "352.8"); a zero-breakdown group prints MTTR 0.00 and MTBF = its available hours (only MoM months
   with no entries print "—").
6. **A1 rules the plan omitted**: hours are the recorded downHrs (NO DT = 0), not minutes; By Cell BD attribution uses
   the machine's **effective cell at the breakdown date** and cell availability is **time-weighted by cellFrac** (a
   discovery-JS rule not in availability.ts); machine-level tables print the machine's **current** cell; numbers use
   **Indian grouping** (5,65,692.47) — a formatter must be added; category labels are the key's **raw** text
   ("Cnc Sliding Head  Automatic Lathe"); chart precision is per-key (ch-a1-trend raw floats, a2/a3 2 dp); and ticket
   38's **S2 follow-up** (align dashboard.total-breakdowns with the production filter) is a named deliverable of this
   ticket.
7. **40e splits**: four screens + four new object→content mappings in `figure-content.ts` + i18n keys + e2e specs;
   split the log+A1 screens from A2+A3 (and the e2e), and name the files. No phone project (not a 40 surface); "the
   export" needs a named pattern or is an open decision.
8. **Write scope corrected**: registry.ts/groups.ts/FIGURE_LABELS need no edit (all four figures already registered);
   the engine packets list the module + `analytics-breakdown.test.ts` + the `computers.ts` spread + the fragment, and the
   **test seam** `packages/domain/test/answer-key/fixture.ts` needs A1/A2/A3/BREAKDOWN_LOG readers. Each engine packet is
   one assertion but 180–600 changed lines: state that, and land the shared helpers (effective-cell/cellFrac,
   recorded-hours selection, en-IN format) in 40a/40b so c/d reuse them.
9. Drill types: the registry pins **ticket** for all four; the log names its row-order ticket ids, A1/A2/A3 name the
   tickets their numerator read (state one line each).
10. Keep the honesty rules from 38/39: figure values are the key's own printed page (English strings as data); catalogue
    keys cover chrome; no fabricated zero; empty plant → `null`. Parity: "No parity: <reason>" or add rows.

