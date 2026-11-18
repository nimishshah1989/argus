# 45c-1 — ADR 0008 and the xlsx writer

**What changed for a user:** nothing visible yet: the reports and export screens arrive in 45d and 45e. This packet
settles how the workbook export is written and adds the writer the export route will call. A workbook of sheets now
round-trips through the same dependency-free reader the answer key uses — sheet names and their order exact, strings
(Unicode, `&`, `<`, quotes) intact, numbers as numbers, blanks `null` — and the bytes start `PK`.

**ADR 0008.** The decision is **A: our own writer**, `apps/server/src/modules/reports/xlsx.ts`, about 203 lines. It
builds a zip with `node:zlib` `deflateRawSync` (CRC32, local headers, central directory and end record, no data
descriptors) holding `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, its rels and one worksheet part per
sheet. Text is inline (`<c r="A1" t="inlineStr"><is><t>`), numbers are bare `<v>`, `null` and `''` write no cell,
rows carry `<row r="n">` and cells their `r`; XML is escaped and control characters other than tab, newline and CR
are stripped. No shared strings, styles, formulas, widths, merged cells or frozen panes. **B (SheetJS CE 0.20.x)** is
rejected as the default (a second xlsx implementation, a URL-pinned install and extra dependency/licence checks for
data we can write; the npm `xlsx` is frozen at 0.18.5 with CVEs) and kept as the recorded fallback. **C (ExcelJS)** is
rejected again (heavier chain, older maintenance, a third dialect; the SPEC already rejected it).

**Acceptance, exactly as the plan states it.** `apps/server/test/xlsx-write.test.ts` writes a two-sheet workbook (a
Unicode string, a number, a blank, an empty sheet, an `&` in a sheet name), asserts the result is a `Buffer` whose
first two bytes are `PK`, writes it to a temp file and reads it back with `tools/answer-key/xlsx.ts`. It asserts the
sheet names and their order exactly (`['Data & Notes', 'Empty']`), the rows exactly (the interior blank `null`, the
empty string at B2 never written and read as an interior `null`), a number as a number, the Unicode text intact, the
control character stripped and the empty sheet `[]`.

**Tests that prove it.** Red first with the module absent: `Test Files 1 failed (1)`, `Tests no tests`,
`Cannot find module '../src/modules/reports/xlsx.js'`. Green:
`pnpm exec vitest run apps/server/test/xlsx-write.test.ts` — 1/1. `pnpm exec vitest run apps/server/test` — 129 files, 1,523 tests passed.
`pnpm precheck` — 13 checks passed, 5 files checked by prettier. `pnpm exec tsc --noEmit` is clean.

**The prototype check.** The plan's one-off is a real open in desktop Excel or LibreOffice; this environment has
neither installed, so that visual check remains for the human at the PR and is recorded as such in ADR 0008. The
mechanical proof on a generated two-sheet file: `unzip -t` reports **"No errors detected in compressed data"**;
`unzip -l` lists the six parts (`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`,
`xl/_rels/workbook.xml.rels`, `xl/worksheets/sheet1.xml`, `xl/worksheets/sheet2.xml`, 2,465 bytes); `unzip -p` shows
the workbook with `Data &amp; Notes` and `Empty`, inline-string cells, `<v>42.5</v>` and `<v>-7</v>`, the omitted
blank cells and the empty sheet's `<sheetData></sheetData>`; and an independent openpyxl load returns
`['Data & Notes', 'Empty']` with the same values (`42.5` and `-7` as numbers, the blank as `None`). **If the desktop
open refuses the file, 45c-1 switches to B** (pin SheetJS CE, add it to `THIRD_PARTY.md`, amend ADR 0008); C stays
rejected.

**Files.** `docs/adr/0008-workbook-writer.md` (new: context, decision A, B and C rejected, the prototype condition
and the consequences), `apps/server/src/modules/reports/xlsx.ts` (new, 203 lines), `apps/server/test/xlsx-write.test.ts`
(new, 41 lines), `docs/adr/README.md` (one index line), and this fragment. No new dependency; no migration, schema,
route or parity change.

**Deviations recorded.**

1. The writer is 203 lines, a little above the plan's "about 180" because the zip headers and the XML helpers are
   separate small functions; it is well under the 400-line rail and every function is under 60.
2. `docs/adr/README.md` gains one line for 0008; the packet's file list names only the ADR, the writer, the test and
   the fragment.
3. The desktop Excel/LibreOffice open could not be run here; ADR 0008 records it as the plan's one-off human check,
   with the unzip/openpyxl/reader evidence above standing in mechanically until it is done.
4. A non-finite `number` (`NaN`, `Infinity`) is written as an inline string rather than an invalid `<v>` number; real
   numbers are always numeric cells. No fixture or caller sends one.
