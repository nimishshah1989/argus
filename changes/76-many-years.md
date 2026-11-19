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
  24,000 in 2026, 40,500 across both), and list the months with no report, ticket or task. Two whole years now add up to
  exactly two years of hours instead of a rounding short of it. Nothing is wired in yet: every existing figure reads
  the same window as before and returns the same numbers, so the 2026 answer key is untouched. No screen changes.
- Known edge for 76d: `gapMonths` treats the as-of month as a gap until its first record arrives, so on the 1st of a
  month a span covering only that month has 0 available hours. 76d must handle it when it wires the span in.

## 76b — the two-year test plant

- The engine tests now have a two-year plant to measure against: 245 invented breakdown, no-downtime and PM
  rows over 2025 and 2026, July 2025 with no records, one machine that exists in 2026 only, and the figures worked out
  by hand (BD % 0.87, MTBF 185.0, 684 observed days, 42,525 working hours). A test counts the rows and holds them to
  the hand values, so a wrong hand value fails before any figure reads it. Nothing a user sees changes in this change.

## 76c — the period's months, labels and observed days

- The analytics engine can now lay out a span as calendar months (twelve for 2025, twelve for 2026, twenty-four across
  both, July 2025 marked as having no records), label them `Jan` inside one year and `Jan 25` across years, title the
  span `2025`, `2026` or `2025–2026`, and count the days between two records with a no-records month left out (319, 350
  and 684 on the two-year plant). It can also name the window of a figure that learns from all history, 1 January of the
  first record's year to the run date. Nothing is wired in yet, so every existing figure returns the same numbers and
  the 2026 answer key is untouched. No screen changes.

## 76d — the engine runs on a named span

- The analytics engine can now be run for one span of plant dates. Run on the two-year test plant at 31 January 2027,
  2025 gives 69 breakdowns, 66.0 downtime hours, 36.0 PM hours and 1.5 no-downtime hours, 2026 gives 148, 288.0, 48.0
  and 2.0, and both years give their sum (217, 354.0, 84.0, 3.5). The machine counts, the registers and the figures
  that learn from all the history read the same in every span. A run that names no span is unchanged: it reads the
  as-of year to date with no gap month, so the 2026 answer key and every existing test stay as they were. No screen
  changes yet: most figures still need their own edit to read the span (the packets that follow).
- Every figure now says what it reads: 24 the span, 18 the run date, 9 the whole history.
- Rulings: a span cannot run past the run date (2026 asked for on 11 November is read to 11 November), and a span that
  starts after it is refused. The month still running is never a gap, so on the 1st a span of that month has its first
  day of hours and no "no records"; the month is a gap only if it is over (the run date is its last day) with no record.
- A span that starts before the plant's first recorded month is moved up to that month: the empty years before the first
  record are not available hours (2020 to 2025 on a plant whose log starts in 2025 reads exactly as 2025). The result's
  period carries the moved `from` and, as `requestedFrom`, what was asked, so a screen can say so. A span wholly before
  the first record has no hours and no rows. A span with a date the calendar does not have (30 February) is refused.
- Known edge for later: `cellFrac` (`hours.ts`) is a day share inside the window and still counts a gap month's days
  for a machine that moved cells mid-window. The two-year plant has no move, so no 76 hand value meets it; 76n or
  the first packet that reads a moved machine over a gap fixes it.

## 76f — the plant-wide rates read the span

- The dashboard's breakdown %, fleet availability and the two per-day averages now divide by the hours and days of the
  span, not by one year. On the two-year test plant at 31 January 2027, 2025 reads 0.40 % and 99.38 % (it was 0.37 %
  and 99.43 %), a day averaging 0.22 breakdowns and 0.21 downtime hours; both years read 0.87 % and 98.92 % (they
  read 1.48 % and 98.18 %), 0.32 breakdowns and 0.52 hours a day. 2026 is unchanged at 1.20 % and 98.60 %. Downtime per
  CNC machine (22, 72, 88.5) was already right. A month with no records adds no available hours and no days.
- A run that names no span now reads the as-of year to date for the breakdown % and availability. Nothing changes at
  the 2026 answer-key date, because that plant's data is all in 2026. On a plant with earlier years the two rates
  change to this year's (they used to put every year's downtime over one year's hours), and in early January before the
  year's first breakdown they print 0 and 100: on 2 January 2027 on the test plant, where they used to print 2026 in
  full. This is what Nimish chose: analytics opens on this calendar year so far.
- Tests pin the first and last day of a span (1 January and 31 December count, the next day's report does not), and,
  with no span, that 1 January counts and the last day of the year before does not.
