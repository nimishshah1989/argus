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
