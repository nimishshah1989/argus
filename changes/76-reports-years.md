- Nothing changes for a user yet: the annual and monthly reports still print the 2026 pages they printed before.
- The reports can now read a span that has a month with no records (July 2025 in the hand-computed two-year plant):
  the hours and days of that month are left out of every rate, so 2025's available hours are 16,500, not 18,000.
- The annual report's month table and its PM table print `no records` for that month instead of zeros, the quarter
  that holds it averages over its two recorded months, and the page's cell and category tables use the same hours.
- The monthly report's twelve-month chart leaves that month blank (`null`) instead of drawing a zero.
