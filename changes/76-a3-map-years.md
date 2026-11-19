# 76j-76l — A3, the breakdown map and A4 read the span

- Nothing a user sees changes yet: no screen names a span until ticket 75.
- A3 (MTTR and MTBF) now reads the span a run names. On the two-year test plant, the 2025 page leaves July out of the
  available hours (MTBF 238.2, not 259.9) and prints `no records` for it; across both years it prints 24 months
  (`Jan 25` to `Dec 26`), quarters that keep their year, and MTBF 185.0.
- The breakdown map and A4 (manpower) read the whole span too: their month columns carry the year, 2025's failures and
  PM jobs count with 2026's, and July 2025 prints `no records` in every table.
- A run that names no span is unchanged, so the 2026 answer key and every existing test stay as they were.
