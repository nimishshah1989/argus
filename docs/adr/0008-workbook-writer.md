# 0008 — Our own xlsx workbook writer

Date: 18 November 2026
Status: accepted (the one-off desktop open is a human check; see Prototype condition)

## Context

Ticket 45 exports the plant's data set as an `.xlsx` workbook: 17 sheets of names, headers and rows, with
no styling, widths, formulas or merged cells. The milestone says "writer library under an ADR", so the
question is how the repo turns sheets into a file: with a dependency or with our own writer.

The repo already ships a dependency-free xlsx **reader** for the answer key
(`tools/answer-key/xlsx.ts`, 96 lines, `node:zlib` only). It reads inline strings and numbers, so a writer
can be its mirror and the round-trip test can use the same file the key uses. LEAN's ladder puts Node's
standard library before an installed dependency, and no dependency is added for a few hundred lines.

## Decision

**A. Write the workbook ourselves**, in `apps/server/src/modules/reports/xlsx.ts`:
`writeXlsx(sheets: readonly Sheet[]): Buffer`.

- A zip built with `node:zlib` `deflateRawSync` (method 8), with a CRC32 per entry, local headers, the
  central directory and its end record, and no data descriptors.
- Parts: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, and one
  `xl/worksheets/sheetN.xml` per sheet in order.
- A text cell is an inline string, a number a bare `<v>`; `null` and `''` write no cell. Rows carry
  `<row r="n">` and every cell its `r` attribute.
- XML-escape `& < > " '` and strip control characters except tab, newline and carriage return.
- No shared strings, styles, formulas, merged cells, column widths or frozen panes.
- A sheet name keeps its text (escaped in `workbook.xml`) and names are unique.

The test writes a two-sheet workbook and reads it back with `tools/answer-key/xlsx.ts`: names and order
exact, rows exact with numbers as numbers and blanks `null`, Unicode intact, bytes starting `PK`.

## Why not B and C

- **B. SheetJS CE 0.20.x** (Apache-2.0, already in `THIRD_PARTY.md`, installed from `cdn.sheetjs.com`):
  rejected as the default because it is a second xlsx implementation, a URL-pinned install, and extra
  dependency and licence checks for data we can write. The npm `xlsx` is frozen at 0.18.5 with CVEs, so the
  CDN tarball would have to be pinned exactly. It remains the **fallback** below.
- **C. ExcelJS** (MIT): rejected again for a heavier dependency chain, older maintenance and a third xlsx
  dialect; the SPEC already rejected it once.

## Prototype condition

A written file must open cleanly in desktop Excel or LibreOffice, with every sheet and its text intact. If
it does not, 45c-1 switches to **B**: pin SheetJS CE 0.20.x, add it to `THIRD_PARTY.md`, and amend this ADR
to record the switch. C stays rejected.

The mechanical proof was run for this packet and is recorded in `changes/45-reports-guide.md`:
`unzip -t` and `unzip -l` show the six parts and their CRC, `unzip -p` shows the workbook, relationships and
sheet XML, the answer-key reader round-trips the values, and an independent openpyxl load reads the same
sheet names and values. **The desktop open was not possible in this agent's environment** (no Excel or
LibreOffice installed); it is the one-off human check the plan assigns, and it must pass before the export
route ships. Without it the writer is proven mechanically, not visually.

## Consequences

- The writer is ours to keep: no new dependency, no licence review, `THIRD_PARTY.md` unchanged.
- The reader and writer are tested together; a format change must update both and the round-trip test.
- The writer is deliberately data-only. Adding styling, widths, formulas, merged cells or shared strings is
  a new decision, and the point at which B becomes cheaper.
- The workbook is not a restorable backup and carries no `DOC. NO.` header line; both are 45c-2's product
  questions (open questions 4 and 5), not this ADR's.
- If the desktop check fails, option B is the recorded fallback; no rewrite of the rest of ticket 45.
