# 76 — Team Focus and Compare leave out a month the plant kept no records in

Nothing changes on screen yet: the period picker (tickets 75 and 83) is what hands the engine a span.

- When a run names a span, Team Focus no longer counts a month with no records as a month without a failure. On the
  two-year test plant its "hours a month at stake" divide by the 687 days between the first and last record (719 less
  July 2025's 31, less one), and each machine's health row counts its own observed days (688, and 354 for the newer one).
- Compare counts each machine's days the same way, so its availability, MTBF and per-month rows read 688 observed days
  for the three older machines and 354 for the newer one, not 719.
- A run with no span is unchanged, so the 2026 answer key and every existing test stay as they were.
- Known limit: the "last 90 days" and "90 days before" trend windows of the health score still count a gap month's
  calendar days when the gap falls inside them (`team-focus-health.ts`, `compare-score.ts`); a gap that old does not
  reach a plant's latest 180 days in the test plant.
