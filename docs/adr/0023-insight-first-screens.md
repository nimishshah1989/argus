# ADR 0023 — Insight first: every table and chart says what to notice

Date: 2026-11-24 · Status: accepted (Nimish, 24 Nov 10:09 IST)

## Why

Nimish on the v2 screens and the S20–S26 wireframes: "too much text… plain text tables and numbers… barely any colours or tags… very flat. It does not bring out what needs to be brought out. Three shifts — what do I do with these numbers? What is glaringly visible?" UX-RULES already ask rows to tell their story (rule 17) and colour to carry meaning (20–24), but nothing required a takeaway and no check enforced it, so screens came out as monochrome number grids.

## Decision — new UX rules 60–67 (in `docs/design/v2/UX-RULES.md`), binding on every v2 screen

60. **Every table, chart and section opens with a one-line takeaway** in plain words that names the outlier and its size: "Shift C loses 2.4× the hours of Shift A — mostly Cell 4 spindles." Computed from the data, never hard-coded text.
61. **The outlier is marked, not hidden in a cell:** the row/cell that breaks the pattern (worst vs target, vs plant average, vs last period, vs peers) gets a tone tag (loss/risk/gain) with icon + word; the rest stays quiet. Colour still ≤ ~20 % of cells (rule 24) — colour is spent on what matters.
62. **Numbers come with a yardstick:** every key number shows its comparison inline — a delta tag vs last period, a bullet bar vs target, or a cell bar vs the row's peers. A bare number with no yardstick is not allowed in a key column.
63. **Rank by what matters:** default sort = worst/biggest first; the top 3 are visually distinct; the long tail collapses ("+ 9 more, all within target").
64. **Detail on demand:** rows expand in place (or open the drawer) for the breakdown; the default view shows ≤ 5 columns: identity, status tag, key number + yardstick, trend, action.
65. **Small multiples over grids:** a table of the same measure across a few groups (shifts, cells, months) is drawn as compared bars/heat cells with the numbers beside them, not as a plain grid. "Show the numbers" keeps the exact table one click away.
66. **Tags and icons for categories:** machine type, cell, shift, severity are chips/tags with their fixed colour (rule 22), not plain text.
67. **Review check:** the reviewer fails a screen PR where any table or chart lacks a takeaway line, a marked outlier or a yardstick on its key number.

## Consequences

- S20–S26 are **redrawn** under these rules before Nimish approves them.
- New milestone **M2b — Insight pass** (after Compare goes live, before the rest of M2): one ticket per live v2 screen (Dashboard, Action Center, Machines register, Footprint, Age, Breakdown Log, BD % and PM, Category and cell, MTTR/MTBF, Manpower, Why-Why, Problem Analysis, Fix Finder, PM Calendar, Machine page, Cell change log, Energy, Shift KPIs, Bottleneck, Forecast Lab, Data Checklist, Team Focus, Compare). Each: takeaway lines, outlier marking, yardsticks, ranking, expand rows. Figures never change.
- Kit: add `Takeaway` (one-line insight with tone) and an expandable row to `ui/v2/` if missing; reuse `bullet-bar`, `cellbar`, `key-pill`, `sparkline`, `kpi-tone`.
