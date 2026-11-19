# 76 — the forecasts and Money Matters leave out a month the plant kept no records in

Nothing changes on screen yet: the period picker (tickets 75 and 83) is what hands the engine a span.

- When a run names a span, the Bottleneck page, the Forecast Lab and Money Matters no longer count a month with no
  records as a month without a failure. On the two-year test plant the three older machines are watched 688 days
  (719 less July 2025's 31) and the newer one 354, so plant availability reads 99.11% and "Past months averaged" 16 hrs.
- The Forecast Lab does not test a month with no records (19 months tested, not 20). Money Matters divides by the
  688 days, so its money per year and per month follow.
- A run with no span is unchanged, so the 2026 answer key and every existing test stay as they were.
- Known limit: the Forecast Lab still counts a gap month's days in each machine's exposure (`forecast-lab-sim.ts`,
  which this ticket leaves alone); the months it tests and the actuals it prints are right.
