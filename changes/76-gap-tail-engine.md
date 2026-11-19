# 76 — Three last figures stop counting a month with no records as observed time

Nothing changes on screen yet: the period picker (tickets 75 and 83) is what hands the engine a span.

- The Forecast Lab's exposure days leave out a month the plant kept no records in. On the two-year test plant a
  machine's exposure at the August 2025 cut is 181 days, not 212.
- The 90 and 180-day health trend in Team Focus and Compare scales each window by the days the plant was observed.
  A no-records month inside the latest 180 days no longer makes a machine read as improving: on the small gap fixture
  the trend part is 6.9, not 8.1.
- A cell's available hours credit a machine that moved cells only for the observed days, so a gap month's days no
  longer tip the share between its two cells.
- A run with no span is unchanged, so the 2026 answer key and every existing test stay as they were.
