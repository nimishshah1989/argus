# 76 — the engine reads many years (plan)

- The plan for ticket 76 is written: how the analytics engine will read five years of history instead of one.
  `docs/slices/76-many-years.md` sorts all 51 figures by how they treat time (27 correct for any period, 5 limited
  to the as-of year, 16 wrong once data spans years, 3 not computed), shows the wrong answers on the real engine
  (for example the dashboard's BD % doubles from 0.54 to 1.03 when the same rows sit in two years), and designs one
  shared period that every figure reads. The work is cut into 23 small changes, two builders at most.
- Nothing a user sees changes in this change.
- 76b: the engine tests now have a two-year plant to measure against: 245 invented breakdown, no-downtime and PM
  rows over 2025 and 2026, July 2025 with no records, one machine that exists in 2026 only, and the figures worked out
  by hand (BD % 0.87, MTBF 185.0, 684 observed days, 42,525 working hours). A test counts the rows and holds them to
  the hand values, so a wrong hand value fails before any figure reads it. Nothing a user sees changes in this change.
