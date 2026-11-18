- The Breakdown analyses now answer the platform's own numbers exactly: the breakdown log (NO DT included), A1's BD % and
  PM split with its month-on-month tables, A2's category and cell detail with its machine tables, and A3's MTTR and
  MTBF — each on screen with its rows behind a drill. The shared numbers those figures stand on were proven first
  against the platform's own workbook: the plant's 5,65,692.47 available hours to 11 November, each cell's
  time-weighted availability (Cell 1 at 36,272.45), the quarter averages and the Indian grouping. A NO-DT entry counts
  as a breakdown with no downtime hours, and "Done By" prints the platform's coded names (Person 41, Maint. Team).
- The Breakdown Log figure now answers the platform's own log from the 11 November workbook: every one of its 1,343
  history entries (the 64 PM rows included, the seven live-app rows excluded), newest first, with the eye column, the
  ticket number (the workbook's ref where it has one, the legacy row id otherwise), DD-MM-YYYY dates, the coded Done By
  name, the platform's own hours (a dash for NO DT) and the maintenance code. Every row drills to its real ticket.
- The figure's row count is the rows it built, never a constant: the tests derive it, the order, the ticket fallback and
  the totals from `input.json` — 3,819.38 hours across the log, 209.1 NO-DT (the Dashboard's own figure, not its
  3,060.1 downtime) — and compare the key's three newest rows with the figure's first three exactly.
- The workbook fixture now keeps the platform's stable Sr No, so the log prints its permanent numbers (gaps and all)
  instead of renumbering from the row's position; a log the platform numbered itself falls back to that date order.
- Deliberate: a report the snapshot does not link to a ticket is not in the log, because the engine refuses a value
  that names no row to drill. The 37c import links every loaded row, so no real entry is hidden.

- A1 (packet 40b) now answers the platform's whole page exactly: the six KPIs (4,525.54; 125; 5,65,692.47; 3,060.1 hrs;
  759.3 hrs; 99.32%), the four tables (By Cell — Detail 9 rows; MoM BD %/PM % 20; MoM BD Hours by Cell 9; MoM PM
  Hours by Cell 9) and the two charts (ch-a1-cell, ch-a1-trend), compared whole against the key with no tolerance. The
  print quirks are deliberate data: the concatenated hour+share cells, the empty second label of each BD/PM pair, the
  PLANT TOTAL prefixes, Q as the unrounded monthly average, Total as the recomputed aggregate, and the dash for a month
  with no entries. The drill names the production-filtered BD + PM tickets the numerator read.
- S2 lands with A1: `dashboard.total-breakdowns` now uses the same production filter as A1 and the daily averages, so
  an excluded machine's breakdown row no longer counts. This inverts one guard assertion rather than deleting it: the
  positive control moved from total-breakdowns (+1) to the unfiltered total-downtime-hours (+8 hrs), and
  total-breakdowns joined the never-moves set beside the four Guide figures. The key value stays 1,279 because no real
  history row sits on an excluded machine.

- A2 (packet 40c) now answers the platform's whole page exactly: the 16 tables (By Category — Detail 14 rows, By Cell —
  Detail 9, the 14 per-category Machine-Level Detail tables) and the eight charts (ch-a2-cathrs, ch-a2-catcnt,
  ch-a2-cellhrs, ch-a2-cellcnt, ch-a2-catavghrs, ch-a2-catavgcnt, ch-a2-cellavghrs, ch-a2-cellavgcnt), compared whole
  against the key with no tolerance. A breakdown counts in the cell the machine was in on its date (cellAt), while a
  machine-level row prints the machine's current cell; tables print the key's normalised category label and charts keep
  the workbook's raw double space, 2 dp chart values included. The drill names the production breakdown tickets the
  figure read.

- The Breakdowns group now opens on the Breakdown Log (packet 40e-1): the platform's own page, PM rows included,
  newest first, with the eye column, Sr No, ticket, date, shift, machine, problem, Done By, downtime hours (a dash for
  NO DT) and code. Filters by date, shift, machine and code narrow the printed rows only; the figure's rowCount is
  always printed (1,343 on the key) and "showing the newest N" says when the engine page was truncated. The export is
  the existing client Blob/CSV pattern, with no new dependency, and writes the filtered table without the eye column.
  Every row's eye opens its own ticket.
- A1 now shows its whole key page: the six KPIs, the four tables and the two charts (the chart kit's bar and line, with
  the two BD/PM series the engine sends). Its one drill names the ticket rows; when the engine names more than the drill
  endpoint's 200-id cap, the page links to the Breakdown Log, where each of those tickets is a row, instead of asking
  the server for a query it refuses.
- The two figures map through one new key-shaped `page` content kind in `figure-content.ts`, rendered by the group
  screen with the kit's `StatCard`, `DataTable` and `Chart`; no per-screen table renderer. Chrome is catalogue copy
  in its own `analytics-breakdowns` namespace; the engine's titles, KPI labels and cells stay data. The journey pins a
  head filtering and exporting the log and opening a ticket from a row, then A1's KPIs, tables, charts and drill; an
  operator is refused.
- Red first (packet 40e-1): on base 5c4e2cc9 the mapping module `log-values.ts` is absent, `figure-content.ts` has no
  `page` content kind, and `Analytics.tsx` has no Breakdowns route, so the new journey failed at the missing
  "Breakdown Log" heading. Green: the page-content suite (the page mapping, the log filters and all six A1 KPIs), the
  analytics-breakdowns journey (filter, count, export, ticket drill, six KPIs, four tables, two charts, drill, the
  over-cap fallback and the operator refusal) and the chart kit's two-series bar case.
- Deliberate deviations (packet 40e-1): the group's two screens switch on a `?screen=` query in `BreakdownsPage`
  rather than nested routes, keeping the group's one `/analytics/breakdowns` route; the shared chart kit's bar spec
  grew from one series to two (the `BarSpec` tuple and `barOption`'s per-series colour) so A1's BD/PM bars draw
  together; and A1's drill — its 1,343 ids exceed the endpoint's 200-id cap — links to the Breakdown Log instead of
  asking for a query the server refuses. That fallback is now pinned by an e2e stub of 201 ids: the note and the log
  link are asserted, the drill link is absent and no drill request is made.
- A3 (packet 40d) now answers the platform's whole page exactly: the six tables (By Category 14 rows, By Cell 9,
  Month-on-Month Cell-wise/Plant-wide 20, Month-on-Month Age Band-wise/Plant-wide 12, By Machine Age Band 5, By
  Individual Machine 125) and the seven charts (ch-a3-catmttr, ch-a3-catmtbf, ch-a3-cellmttr, ch-a3-cellmtbf,
  ch-a3-agemttr, ch-a3-agemtbf, and ch-a3-planttrend in the platform's mixed dual-axis convention), compared whole
  against the key with no tolerance. MTTR is BD hours / breakdowns; MTBF is (available hours - BD hours) / breakdowns.
  The four bases are the key's own: the days-so-far window for the summary tables and the Total column, each month's
  own window for its cell, and the average of the unrounded monthly values for a quarter. A group with no breakdowns
  prints MTTR 0.00 and MTBF its available hours; only an empty month prints the dash. Age bands use the machine's age
  at asOf, and the machine table prints its current cell. The paired month-on-month rows reproduce the key's print
  shape: the first row carries the label and MTTR, the second row no label and its MTBF cells one column left. The
  drill names the production breakdown tickets the figure read.

- A2 and A3 now have their screens (packet 40e-2): each renders the engine's key-shaped page whole through the same
  `page` kind and the kit — A2's 16 tables and 8 bar charts, A3's 6 tables and 7 charts (the six bar charts and the
  plant-trend two-line, dual-axis chart, with a month the plant did not reach kept as a gap, never a zero). The page
  title, table titles, cells and dataset labels are the engine's data; the fifteen chart titles and four axes are
  catalogue copy in `analytics-breakdowns`. Both screens carry the engine's one drill; over the 200-id cap they link to
  the Breakdown Log like A1. The screen module's `A1Page` became the shared `KeyPage`, so A1, A2 and A3 have one page
  renderer and one drill fallback.
- A2/A3 chart chrome grew in `analytics-breakdowns.en.ts`; the page mapping split out of `figure-content.ts` into
  `page-content.ts` as the two keys took the mapper near the 400-line hard limit, and the chart kit's line spec gained
  its optional second axis and gap values (the platform's `spanGaps:false` plant trend) beside 40e-1's two-series bar.
  No new dependency.
- Red first (packet 40e-2): the A2/A3 mapping cases failed with no page kind, the two-line chart had one axis, and the
  journey found no "A2 category and cell" link. Green: the page-content suite (A2 16 tables/8 charts, A3 6 tables/7
  charts, the raw double space, the dash and the plant-trend gap), the chart kit case, and the journey opening both
  screens, their charts and drills, with an operator still refused.
