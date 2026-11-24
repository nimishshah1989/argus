/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the body and deletes this line */

/** One sheet of a workbook: its tab name and its rows of text and numbers. */
export type Sheet = { name: string; rows: (string | number)[][] };

/**
 * An .xlsx workbook as bytes, built in the browser (ADR 0036 R6): a stored (uncompressed) zip with correct CRC-32s
 * holding `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels` and one
 * `xl/worksheets/sheetN.xml` per sheet, in order. Port of `apps/server/src/modules/reports/xlsx.ts` on `Uint8Array`
 * + `TextEncoder` (no `Buffer`, no `node:` imports).
 * - A finite number is a numeric cell with its exact value (`<v>1234.5678</v>`, never rounded, never a string);
 *   anything else is an inline string. Text is XML-escaped (& < > " ') and XML-forbidden control characters dropped.
 * - Sheet names are escaped and cut to Excel's 31 characters.
 * - `docRef` → row 1 of every sheet is the single text cell `DOC. NO. <docRef>`; the sheet's rows follow from row 2.
 * - A sheet with no rows is still written (an empty `<sheetData/>`).
 */
export function workbookBytes(sheets: Sheet[], docRef?: string): Uint8Array {
  throw new Error('not implemented');
}
