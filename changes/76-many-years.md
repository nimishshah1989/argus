# 76 — the engine reads many years (plan)

- The plan for ticket 76 is written: how the analytics engine will read five years of history instead of one.
  `docs/slices/76-many-years.md` sorts all 51 figures by how they treat time (27 correct for any period, 5 limited
  to the as-of year, 16 wrong once data spans years, 3 not computed), shows the wrong answers on the real engine
  (for example the dashboard's BD % doubles from 0.54 to 1.03 when the same rows sit in two years), and designs one
  shared period that every figure reads. The work is cut into 23 small changes, two builders at most.
- Nothing a user sees changes in this change.

## 76a — the period seam

- The analytics engine can now describe a span of plant dates and the months inside it the plant never recorded
  (July 2025 in the hand-computed two-year plant), count a machine's available hours over that span (16,500 in 2025,
  24,000 in 2026, 40,500 across both), and list the months with no report and no ticket. Two whole years now add up to
  exactly two years of hours instead of a rounding short of it. Nothing is wired in yet: every existing figure reads
  the same window as before and returns the same numbers, so the 2026 answer key is untouched. No screen changes.
