# 45 — Reports, export and the Guide

## 45c-2 — the 17 sheets

**What changed for a user:** nothing on screen yet — the whole data set now has the platform's workbook shape in the
domain. `workbookSheets(EXPORT_DATA)` returns the key's 17 sheets (all but `App Settings`), each with the frozen key's
exact header row and data-row count, built from the plant rows and the A1-A4 figures rather than pasted literals.
45c-1's writer turns this into the `.xlsx`; 45d's route exposes the download.

**Acceptance, exactly as the plan states it.** The sheet names in order are the key's 17 (`App Settings` excluded);
for every sheet the row equal to the key's `header` is found and the rows after it equal the key's `dataRows`; the
four Analytics sheets equal the A1-A4 key figures' rows; the Breakdown Log carries 1,350 rows and its 30 header
cells are the key's. All 17 match: 126/16/17/3/30/1,350/15/0/35/427/2/1/2/9/25/159/14 data rows.

**Red first.** `pnpm exec vitest run packages/domain/test/analytics-workbook.test.ts` failed with
`Test Files 1 failed (1)`, `Tests 9 failed (9)`, `TypeError: workbookSheets is not a function` (the module did not
exist). **Green:** the named file 9/9, then `pnpm exec vitest run packages/domain/test` 41 files / 462 tests, and
`pnpm exec tsc --noEmit` clean.

**The one plan deviation — Settings.** The plan says the team table is last and "nothing may follow it", but the
frozen key's Settings header is the team header and its 35 data rows are the real workbook's rows after it:
14 team rows + one blank + the `Maintenance Codes` label + 19 code rows. A team table literally last can only carry
the 14 plant team members, so it would fail the key's `dataRows: 35`; inventing 21 members is out of the question.
The key is the authority (the plan says so for a cell-level conflict), so the platform's section order stays and the
test pins **both** the 35 rows after the team header and the 14 team rows. A deviation from the plan sentence, not
from the key.

**A structural note.** To keep every file under the 400-line rail, `exports/workbook.ts` is the public assembly
(`workbookSheets`, the five registers and the machine rows); the exact headers live in `exports/headers.ts`, the
plant sheets (Breakdown Log, cell log, Why-Why, Settings, PM registers) in `exports/plant-sheets.ts`, and the four
Analytics sheets in `exports/analytics-sheets.ts`. The behaviour the brief names is still one `workbookSheets(data)`
call.

**Other recorded deviations.** The Breakdown Log's `Ticket No.` repeats `Ticket ID` (plan open question 6, our schema
has one reference); `Source` prints the ticket's `history`/`live`; no `DOC. NO.` row (open question 5); `App Settings`
is not written (open question 4); the PM Reports' `Measurements` cells print `key value` pairs because the platform's
measurement labels are not ours to copy.

**Files.** `packages/domain/src/exports/types.ts` (new: `ExportData`, `ExportSheet`, `ExportRow`, the PM and Settings
inputs), `exports/workbook.ts` (new: `workbookSheets`), `exports/headers.ts`, `exports/plant-sheets.ts`,
`exports/analytics-sheets.ts` (new: the split needed by the 400-line rail), `packages/domain/src/index.ts` (publishes
the export), `packages/domain/test/answer-key/workbook-export.ts` (new: the key plus `EXPORT_DATA` mapped from
`input.json`), `packages/domain/test/analytics-workbook.test.ts` (new: nine acceptance tests), and
`packages/domain/test/registry.test.ts` (the one new public name, `workbookSheets`).
