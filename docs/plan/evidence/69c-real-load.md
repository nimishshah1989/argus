# 69c: the real workbooks through the local load (19 Nov 2026)

Counts and machine codes only. Real converter output stays outside git (D21). Local Postgres 16, Cosmos seed, app role,
`pnpm exec tsx tools/load-legacy.ts --data <folder of the four unzipped sets> --tenant cosmos`. 19 workbooks read
(4 + 5 + 5 + 5); one 2023 set also holds a file with no four-digit year in its name, which the reader skips.

## Load: every row accounted for (identity: read = tickets + utility rows + the five held-out columns)

| Year |  Read | Tickets | Utility rows (events, merged) | Dup | Stray | Unknown machine | Gap |   Sum | Engine reports | Downtime h | Fleet avail. % | MTTR h |
| ---- | ----: | ------: | ----------------------------- | --: | ----: | --------------: | --: | ----: | -------------: | ---------: | -------------: | -----: |
| 2022 | 1,098 |     892 | 72 (36, 2)                    |   0 |     5 |             107 |  22 | 1,098 |            902 |    2,323.8 |          99.12 |   2.58 |
| 2023 | 3,078 |   1,106 | 1,872 (177, 94)               |   5 |     1 |              93 |   1 | 3,078 |            998 |    1,586.2 |          99.63 |   1.59 |
| 2024 | 2,327 |   1,045 | 1,277 (146, 68)               |   5 |     0 |               0 |   0 | 2,327 |          1,018 |    1,517.4 |          99.68 |   1.49 |
| 2025 | 1,329 |   1,177 | 145 (39, 1)                   |   5 |     2 |               0 |   0 | 1,329 |          1,023 |    2,013.1 |          99.44 |   1.97 |

Four batches `done` (928 / 1,283 / 1,191 / 1,216 rows imported, 0 errors); a second run loads 0. Feb and Mar 2022 print "no records". Unknown machine = retired VC-2, VC-3, VC-5, TC-2 and a bare `STAR`. Bad dates (5 / 2 / 0 / 2) are counted apart. The engine counts every report, blank-minute ones included; MTTR = downtime h / reports. MTBF is not printed (no plant-level figure).

## What the real files broke (fixed, each tested on invented grids)

1. `Maint. Team <name>` cells put the team code's words into the name set, so the redaction proof refused 2022 (1,539 hits). Only that prefix is now left out and the fixed code `Maint. Team` is not a leak; a person's own "Team" or "Maint" is still redacted.
2. A machine written twice on one power-cut day made two lines for one machine (refused by the importer). Minutes are now summed, the first non-blank code kept (2 conflicts, 2023), and the merged rows are counted from the input so the identity still sees a lost line.
3. The summary sheets are one block per month (`Machines`, `MTTR`, `MTBF` rows), not months across. The reader reads blocks, bare-number machine headers and `#DIV/0!`; a block with no machine column counts as unreadable. Two 2024 and 2025 sets keep only quarter blocks and are compared by quarter (three months, 1,500 h).

## Goal 5: summary sheets against the load (2,084 machine-months)

The monthly cells are typed numbers, not formulas (568 of the cells read are constants; the formulas only add months into quarters), so no formula says which rows a month counts. Each difference is tried against the rows by counting rule (`tools/legacy-explain.ts`).

| Year | Compared | Raw equal | Within 0.05 h (typed hours) | Explained by a rule | Unexplained | Rule-aware match |
| ---- | -------: | --------: | --------------------------: | ------------------: | ----------: | ---------------: |
| 2022 |      433 |       250 |                          47 |                  44 |          92 |     341 (78.8 %) |
| 2023 |      572 |       432 |                          73 |                  29 |          38 |     534 (93.4 %) |
| 2024 |      502 |       387 |                          14 |                  46 |          55 |     447 (89.0 %) |
| 2025 |      577 |       492 |                           7 |                  34 |          44 |     533 (92.4 %) |

Total: 1,561 raw equal, 1,855 rule-aware (89.0 %), 229 unexplained. Loaded months dated outside a workbook's year, on no sheet: 1 in 2022, 24 in 2023.

Explained, by rule (counts over the four years): the sheet counts only blank-minute rows 60 (a count with 0 h); loaded breakdowns plus PM rows 9, plus utility rows 8, plus blank-minute rows 4 (one also with gap rows); range stops short 19, starts late 12; hours differ by more than 0.05 h and up to 0.1 h 38 (mostly the quarter sets); leaves out code NI 1; only PM rows 2. The 16 gap-month cases of 2022 fall under blank-minute and gap-row rules.

Plant-event tickets' 3,201 `utility_loss` events and their downtime are loaded but counted by no figure yet (found by `validate:full`, #465; ticket 91), so the plant-level downtime above comes from breakdown tickets only.

## Left for Bhavin (the 229 unexplained, 21 of them with the same count and hours that no rule gives)

1. Does a sheet count a row with blank or 0 minutes as a breakdown (60 months say yes, 3 more with the loaded ones)? Which is the rule?
2. Are PM-coded and UTI-coded rows meant to be in a breakdown count (9 and 8 months say yes)?
3. Some sheets stop at a fixed row (19 months count only the first rows, 12 only the last): is the sheet or the log right?
4. Hours: is the typed hours column or the minutes column the truth (141 months differ by up to 0.05 h and 38 by up to 0.1 h; others by more)?
5. Months 2022-02 and 2022-03 (S4): the sheets count them; load them?
