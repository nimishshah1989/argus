# M4a-40 — Breakdown analyses (ticket 40)

Ticket 40: [Engine] "Breakdown log (NO DT and conversions included), A1 BD % and PM split, A2 category and cell, A3
MTTR and MTBF match exactly." [Browser] "Their screens show them with drill-downs." Acceptance:
`fixtures/answer-key/{breakdown-log,a1-bd-pm,a2-category-cell,a3-mttr-mtbf}.json`, whole figure, no tolerance.
A fresh plan review verified every rule below against the keys, `input.json` and the discovery JS; its ten rulings are
incorporated here (see the Revision section at the end for the evidence).

## Shared rules (settle once, in packet 40h, reuse everywhere)

- **Hours are recorded hours**: `rows.ts` `effectiveHours` (recorded `downHrs`; NO DT counts as a breakdown with **0**
  hours; PM rows are excluded from the analysis figures but **included in the log**).
- **Production filter** (A1–A3): CNC machines not excluded from production data. **S2 (ticket 38's filed follow-up)**:
  align `dashboard.total-breakdowns` with this same production filter in the same PR that lands A1 — say it in that PR.
- **Availability bases**: summary tables + MoM `Total` use the days-so-far window (1 Jan → asOf, machine entered on its
  purchase date; plant Σ = 565,692.47 h on 11 Nov); **monthly cells use that month's own window**; **Q columns are the
  average of the unrounded monthly values** (Q4 = 352.848 → "352.8"), **Total is the recomputed aggregate**; a
  zero-breakdown group prints MTTR **0.00** and MTBF = its available hours; only a MoM month with no entries prints "—".
- **By Cell BD attribution** uses the machine's **effective cell at the breakdown date** (`cellAt` walking `machine_move`
  from the first move's `fromCell`) and **cell availability is time-weighted by `cellFrac`** — a discovery-JS rule, ported
  (not in `availability.ts`). Machine-level detail tables print the machine's **current** cell.
- **Formatting**: `formatInr` — Indian grouping (5,65,692.47) — added beside `formatNumber`; category labels are the key's
  **raw** text (including the double space); chart precision is per key (ch-a1-trend raw floats, a2/a3 charts 2 dp),
  compared with `toEqual` via a `chartById` helper.
- **Drill type is ticket** for all four (registry): the log names its row-order ticket ids; A1 names the BD + PM tickets
  its numerator read; A2/A3 name the breakdown tickets they read.
- Honesty: figure values are the key's own printed page (English strings are data); catalogue keys cover chrome; an
  empty plant → `null`; never a fabricated number.

## Packet 40h — the shared helpers (one PR, one writer, first)

`packages/domain/src/analytics/hours.ts` (effective recorded hours selection + the availability window/bases + cellAt +
cellFrac port), `format.ts` (`formatInr`), `packages/domain/test/answer-key/fixture.ts` (A1/A2/A3/BREAKDOWN_LOG readers),
`analytics-breakdown.test.ts` (new: the helper-level cases — 11 Nov plant Σ 565,692.47, Jan window 50,548.4, Cell 1
36,272.45 by cellFrac, the Q-average vs printed-monthly distinction, en-IN grouping). Red first: the fixture readers and
the computed windows do not exist.
**Files:** `hours.ts` (new), `format.ts`, `fixture.ts`, `analytics-breakdown.test.ts` (new), the fragment. (One coherent
seam; recorded as the D31 work unit, >150 lines.)

## Packet 40a — the breakdown log (one PR)

`breakdown-log` figure, **the key's page shape**: `{ screen, asOf, pages: [{ page: 'breakdowns', title: 'Breakdown Log',
kpis: [], tables: [{ title: '', header: ['','Sr No','Ticket No.','Date','Shift','Machine','Problem','Done By','Downtime
(Hrs)','Code'], rows: display-string rows, rowCount: 1343, truncated: true }], charts: [] } }` — **all history rows
including the 64 PM rows** (the key's 1,343), newest first (srNo 1357…) so the truncation is head-truncation, the eye
column, dates DD-MM-YYYY, hours printed as the platform does (1.83, 4, — for NO DT). Drill = ticket ids in row order.
**Acceptance**: `rowCount` **derived** from input.json (**not a constant**); the value's `rowCount` equals the number of
rows built; the key's three sample rows equal the figure's first three; every drill id is a real ticket and the count
equals rowCount; `totalHours` and `noDowntimeHours` derived in the test from input.json (NO-DT cross-checked against
dashboard's 209.1; **not** the dashboard's 3,060.1).
**Files:** `breakdown-log.ts` (new), the test in `analytics-breakdown.test.ts`, `computers.ts` spread, fragment.

## Packet 40b — A1 BD % and PM split (one PR)

`a1-bd-pm`: the 6 KPIs (4,525.54; 125; 5,65,692.47; 3,060.1 hrs; 759.3 hrs; 99.32 %), the 4 tables (By Cell — Detail 9;
MoM BD %/PM % 20 rows; MoM BD Hours by Cell 9; MoM PM Hours by Cell 9), the 2 charts (ch-a1-cell, ch-a1-trend) — exact
against the key, including the print quirks (concatenated hour+percent cells, the pair labels with the empty second
label, "PLANT TOTAL" prefixes, the Q/Total bases above). **S2 lands here** (dashboard.total-breakdowns aligned to the
production filter; the dashboard test's expected 1,279 stays, the filter now shared).
**Files:** `a1-bd-pm.ts` (new), `analytics-breakdown.test.ts`, `computers.ts`, the dashboard figure's filter change +
its test, fragment.

## Packet 40c — A2 category and cell (one PR)

`a2-category-cell`: **16 tables** (By Category — Detail 14, By Cell — Detail 9, **14** per-category Machine-Level Detail
tables) and **8 charts** (ch-a2-cathrs, ch-a2-catcnt, ch-a2-cellhrs, ch-a2-cellcnt, ch-a2-catavghrs, ch-a2-catavgcnt,
ch-a2-cellavghrs, ch-a2-cellavgcnt) — exact against the key.

## Packet 40d — A3 MTTR and MTBF (one PR)

`a3-mttr-mtbf`: **6 tables** (By Category 14; By Cell 9; MoM Cell-wise/Plant-wide 20; MoM Age Band-wise/Plant-wide 12;
By Machine Age Band 5; By Individual Machine 125) and **7 charts** (ch-a3-catmttr, catmtbf, cellmttr, cellmtbf, agemttr,
agemtbf, ch-a3-planttrend — the mixed convention) — exact against the key, the four MTBF bases and the zero rules above.

## Packet 40e — the screens (two PRs, after 40a–d)

- **40e-1 the log + A1**: the Breakdown Log screen (the platform's columns, NO DT shown as no hours, filters by
  date/shift/machine/code, the export under the existing client-export pattern) and A1's KPIs/tables/charts; rows drill
  to the ticket. Adds the two new object→content mappings to `figure-content.ts` (the key-shaped page → table/chart),
  the catalogue keys, and the e2e journey for both.
- **40e-2 A2 + A3**: the two screens with their tables and charts (reusing 38.5's bar/mixed kit), the mappings, the
  catalogue keys, the e2e journey.
  **Files each:** the screen module(s), `figure-content.ts`, `analytics.en.ts` (+ the gu convention), the e2e spec,
  `docs/spec/parity.yaml` (the breakdown rows' evidence), the fragment. No phone project (not a ticket-40 surface).

## Rails

Red first; never delete/skip/weaken a test; one writer per packet; file ≤ 400, function ≤ 60, screen ≤ 300; no new
dependency; whole-figure equality (no tolerance, no re-rounding); every figure drilled; empty plant → `null`. R1 (pure
engine) / R1 (screens) → one fresh reviewer running the covering suite. Commit locally, no push; report red, green,
deviations (each engine packet is 180–600 lines: state it; the shared seam is 40h).

## Acceptance

The four figures equal their keys in every checkable dimension (the log by derived rowCount + head rows + order + drill
ids + derived totals; A1/A2/A3 whole page); the four screens show them with drills; a fresh reviewer runs the covering
suite; CI green; `main:check` green after each merge.
