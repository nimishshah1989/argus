# M4a-40 — Breakdown analyses (ticket 40)

Ticket 40: [Engine] "Breakdown log (NO DT and conversions included), A1 BD % and PM split, A2 category and cell, A3
MTTR and MTBF match exactly." [Browser] "Their screens show them with drill-downs." Acceptance:
`fixtures/answer-key/{breakdown-log,a1-bd-pm,a2-category-cell,a3-mttr-mtbf}.json`, whole figure, no tolerance.
A fresh plan review verified every rule below against the keys, `input.json` and the discovery JS; its ten rulings are
incorporated here. The evidence, per rule, is in the Revision section at the end (discovery file and functions cited).

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
- **Formatting**: `formatInr` — Indian grouping (5,65,692.47) — added beside `formatNumber`; **table cells group by the raw
  category and print the key's whitespace-normalised single-space label; chart labels carry the raw double space**; chart
  precision is per key (ch-a1-trend raw floats, a2/a3 charts 2 dp), compared with `toEqual` via a `chartById` helper.
- **Done By display seam** (settled in 40h): the fixture slugs doneBy to `person-41` and the engine has no display form, so
  `PersonRow` gains a **`displayName`** (the workbook's coded name: Person 41, Maint. Team) and the log prints it; the
  fixture reader keeps that name instead of discarding it. No prettifier guesses.
- **Drill type is ticket** for all four (registry): the log names its row-order ticket ids; A1 names the BD + PM tickets
  its numerator read; A2/A3 name the breakdown tickets they read.
- Honesty: figure values are the key's own printed page (English strings are data); catalogue keys cover chrome; an
  empty plant → `null`; never a fabricated number.

## Packet 40h — the shared helpers (one PR, one writer, first)

`packages/domain/src/analytics/hours.ts` (**composes** `rows.ts`'s `effectiveHours`, which already selects recorded hours
and NO DT→0 — plus the availability window/bases and the cellAt + cellFrac port), `format.ts` (`formatInr`),
`packages/domain/src/analytics/types.ts` (`PersonRow.displayName`), `packages/domain/test/answer-key/fixture.ts`
(A1/A2/A3/BREAKDOWN_LOG readers, keeping the coded doneBy name),
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
column, dates DD-MM-YYYY, hours printed as the platform does (1.83, 4, — for NO DT), **Ticket No. = the workbook's
`ticketRef` where present, else the row's own legacy id** (only 60 rows carry a ref; the key pins the three newest, which
do). Drill = ticket ids in row order.
**Acceptance**: `rowCount` **derived** from input.json (**not a constant**); the value's `rowCount` equals the number of
rows built; the key's three sample rows equal the figure's first three; every drill id is a real ticket and the count
equals rowCount; `totalHours` and `noDowntimeHours` derived in the test from input.json (NO-DT cross-checked against
dashboard's 209.1; **not** the dashboard's 3,060.1).
**Files:** `breakdown-log.ts` (new), the test in `analytics-breakdown.test.ts`, `computers.ts` spread, fragment.

## Packet 40b — A1 BD % and PM split (one PR)

`a1-bd-pm`: the 6 KPIs (4,525.54; 125; 5,65,692.47; 3,060.1 hrs; 759.3 hrs; 99.32 %), the 4 tables (By Cell — Detail 9;
MoM BD %/PM % 20 rows; MoM BD Hours by Cell 9; MoM PM Hours by Cell 9), the 2 charts (ch-a1-cell, ch-a1-trend) — exact
against the key, including the print quirks (concatenated hour+percent cells, the pair labels with the empty second
label, "PLANT TOTAL" prefixes, the Q/Total bases above). **S2 lands here**: dashboard.total-breakdowns aligned to the
production filter. That **inverts an existing guard test** whose control is `total-breakdowns` moving +1 when an excluded
machine's row is added (analytics-dashboard.test.ts): the control moves to an unfiltered figure (e.g.
total-downtime-hours) and total-breakdowns joins the never-moves set. The inversion is named in the PR; no assertion is
deleted.
**Files:** `a1-bd-pm.ts` (new), `analytics-breakdown.test.ts`, `computers.ts`, the dashboard figure's filter change +
its test, fragment.

## Packet 40c — A2 category and cell (one PR)

`a2-category-cell`: **16 tables** (By Category — Detail 14, By Cell — Detail 9, **14** per-category Machine-Level Detail
tables) and **8 charts** (ch-a2-cathrs, ch-a2-catcnt, ch-a2-cellhrs, ch-a2-cellcnt, ch-a2-catavghrs, ch-a2-catavgcnt,
ch-a2-cellavghrs, ch-a2-cellavgcnt) — exact against the key.
**Files:** `a2-category-cell.ts` (new), `analytics-breakdown.test.ts`, `computers.ts` spread, `changes/40-breakdowns.md`.

## Packet 40d — A3 MTTR and MTBF (one PR)

`a3-mttr-mtbf`: **6 tables** (By Category 14; By Cell 9; MoM Cell-wise/Plant-wide 20; MoM Age Band-wise/Plant-wide 12;
By Machine Age Band 5; By Individual Machine 125) and **7 charts** (ch-a3-catmttr, catmtbf, cellmttr, cellmtbf, agemttr,
agemtbf, ch-a3-planttrend — the mixed convention) — exact against the key, the four MTBF bases and the zero rules
(including the quarters: a1 MoM Cell 9 Q1/Q2 and a3 cell-wise Cell 5 Q1, Cell 9 Q1/Q2 print the key's dash).
**Files:** `a3-mttr-mtbf.ts` (new), `analytics-breakdown.test.ts`, `computers.ts` spread, `changes/40-breakdowns.md`.

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

## Revision — the evidence for the ten rulings (fresh plan reviews, 17–18 Nov)

Every number above was recomputed by the reviewers against the keys, `input.json` and
`docs/discovery/source/cosmos_platform-2026-11-11.html`: the log's 1,343 rows (64 PM, 140 NO DT with 209.11 recorded hours
and 0 effective), BD effective hours 3,060.11 → 3,060.1 over 1,279 rows (matching the dashboard KPIs), plant Σ available
565,692.47 with Jan 50,548.39 and Cell 1 36,272.45 via `cellFrac`/`getEffectiveCell`/`cellAvail` (~line 830 of the
discovery file), the a2 table/chart counts, the a3 6 tables + 7 charts, the four MTBF bases (Cell 1 MTBF Q3 501.4 vs the
naive 501.5 pins the unrounded average), the zero-breakdown MTBF = available hours (5,183.33), and the en-IN grouping.
The plan's first draft was refused for contradicting several of these; this file is the corrected version.
