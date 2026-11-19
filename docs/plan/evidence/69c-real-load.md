# 69c: the real workbooks through the local load (19 Nov 2026)

Counts and machine codes only. Real converter output stays outside git (D21). Local Postgres 16, Cosmos seed, app role,
`pnpm exec tsx tools/load-legacy.ts --data <folder of the four unzipped sets> --tenant cosmos`. 19 workbooks read
(4 + 5 + 5 + 5); one 2023 set also holds a sixth file with no four-digit year in its name, which the reader skips.

## Load (goals 1, 2, 3, 4, 6)

| Year | Rows read | Tickets | Events (utility rows)  | Batch | Unaccounted | Reports in engine | Downtime h | Fleet availability % | MTTR h |
| ---- | --------: | ------: | ---------------------- | ----- | ----------: | ----------------: | ---------: | -------------------: | -----: |
| 2022 |     1,098 |     892 | 36 (72, 2 merged)      | done  |           0 |               902 |    2,323.8 |                99.12 |   2.58 |
| 2023 |     3,078 |   1,106 | 177 (1,872, 94 merged) | done  |           0 |               998 |    1,586.2 |                99.63 |   1.59 |
| 2024 |     2,327 |   1,045 | 146 (1,277, 68 merged) | done  |           0 |             1,018 |    1,517.4 |                99.68 |   1.49 |
| 2025 |     1,329 |   1,177 | 39 (145, 1 merged)     | done  |           0 |             1,023 |    2,013.1 |                99.44 |   1.97 |

- Rows read match the plan (1,098 / 3,078 / 2,327 / 1,329); the identity holds in every year; a second run loads 0 and skips 928 / 1,283 / 1,191 / 1,216.
- Held out: unknown machine 107 / 93 / 0 / 0 (retired VC-2, VC-3, VC-5, TC-2 and a bare `STAR`), gap month 22 in 2022 (February and March print "no records"), duplicates 0 / 5 / 5 / 5, stray year 5 / 1 / 0 / 2.
- The engine counts every report, including 17 / 4 / 44 / 10 with blank minutes; the sheets count only minutes above 0.

## What the real files broke (fixed, tested on invented grids)

1. A cell reading `Maint. Team <name>` turned the words of the team code into "name words", so the redaction proof refused 2022 (1,539 hits). The team code's words are no longer name words.
2. A machine written twice on one power-cut day made two `utility_loss` lines for one machine, which the importer refuses (2 rows in 2022). Same-machine rows of a date now sum into one line; the identity counts them (`merged`).
3. The summary sheets are one block per month (`Machines` row, then `MTTR` and `MTBF` rows), not months across; the reader now reads blocks, skips quarter blocks and reads `#DIV/0!` as no breakdown. An MTTR within 0.05 h counts as equal (the log's hours column is rounded by hand).

## Goal 5: summary sheets against the load

| Year | Machine-months | Equal | Named | Sheet has more | Loaded has more | Same count, hours differ | Held-out gap |
| ---- | -------------: | ----: | ----: | -------------: | --------------: | -----------------------: | -----------: |
| 2022 |            433 |   297 |   136 |             63 |              48 |                        9 |           16 |
| 2023 |            572 |   505 |    67 |             28 |              34 |                        5 |            0 |
| 2024 |            424 |   362 |    62 |             22 |               8 |                       32 |            0 |
| 2025 |            480 |   437 |    43 |             20 |              15 |                        8 |            0 |

Total 1,909 machine-months: 1,601 equal (83.9 %), 308 named. Loaded months dated outside the workbook's year (not on its sheets): 1 in 2022, 24 in 2023. Labels not in the plant: 8 sheets in all.

Causes found by reading the rows of single machine-months (counts and codes only):

- **Held-out gap (16, 2022):** the sheets count February and March rows; S4 holds them out until Bhavin answers.
- **Sheet counts fewer than the log (HMC-2 July 2022, 4 against 8 rows):** the sheet's total equals the first 4 rows of the month, so the sheet's range stops short.
- **Same count, hours differ (VC-23 October 2022, TC-11 July 2022):** the sheet's hours are not the log's minutes (4 rows of 25-35 min read 6 h), so the log's hours column disagrees with its minutes column.
- **Loaded has more (GRD-5 June 2025, 10 rows of 480 min, sheet 0):** the sheet leaves out rows the log carries; not explained.

## What blocks goal 5

Goal 5 needs 0 unexplained and is not met: 308 named months, of which only the gap months (16) and the cases above are understood. The rest need Bhavin: which rows the sheets count (the hours column against minutes, the sheet range, GRD rows) so each named month can be assigned a cause or a rule.
