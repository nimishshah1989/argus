# 69 — legacy history re-planned (docs only)

- `docs/slices/69-legacy-history.md` is rewritten for all four years, 2022 to 2025 (19 workbooks), from measured
  counts: rows with a date 1,098 / 3,078 / 2,327 / 1,329; utility rows become one plant event per day (38 / 183 /
  139 / 40 event-days).
- A power or air failure becomes one closed general ticket with one history line per machine and its hours. No new
  table, no migration. It adds nothing to any breakdown figure, and the existing import undo removes it.
- Each year is one import file, one batch and one undo. A row loads under its own date unless that year's workbook
  already holds it. Codes are kept as the legends define them.
- Bhavin's open answers are switches with defaults: the Star sheets and the retired machines stay out, February and
  March 2022 show as a gap, and codes are kept as written. Flipping a switch later adds only the new rows.
- Four packets: 69a (importer, plus a test harness that runs on a local Postgres) and 69b (converter) can run in
  parallel now; 69c is the local load and the summary-sheet check; 69d is the staging job, which runs after 79.
