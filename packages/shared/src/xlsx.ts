/** One sheet of a workbook: its tab name and its rows of text and numbers. */
export type Sheet = { name: string; rows: (string | number)[][] };

/** A zip entry: its path and its bytes. */
type Entry = { name: Uint8Array; body: Uint8Array; crc: number };

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const SHEET_NAME_MAX = 31;
const encoder = new TextEncoder();

/** Escape XML text and drop the control characters XML 1.0 forbids (tab, newline, carriage return stay). */
function escapeXml(text: string): string {
  let clean = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 || code === 9 || code === 10 || code === 13) clean += char;
  }
  return clean.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A stored (method 0) zip: local headers and bodies, then the central directory and its end record. */
function zip(files: readonly { path: string; text: string }[]): Uint8Array<ArrayBuffer> {
  const entries: Entry[] = files.map(({ path, text }) => {
    const body = encoder.encode(text);
    return { name: encoder.encode(path), body, crc: crc32(body) };
  });
  const locals = entries.reduce((sum, e) => sum + 30 + e.name.length + e.body.length, 0);
  const directory = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
  const out = new Uint8Array(locals + directory + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  let dir = locals;
  for (const { name, body, crc } of entries) {
    view.setUint32(at, 0x04034b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, 0x0800, true); // UTF-8 names
    view.setUint32(at + 14, crc, true);
    view.setUint32(at + 18, body.length, true);
    view.setUint32(at + 22, body.length, true);
    view.setUint16(at + 26, name.length, true);
    view.setUint32(dir, 0x02014b50, true);
    view.setUint16(dir + 4, 20, true);
    view.setUint16(dir + 6, 20, true);
    view.setUint16(dir + 8, 0x0800, true);
    view.setUint32(dir + 16, crc, true);
    view.setUint32(dir + 20, body.length, true);
    view.setUint32(dir + 24, body.length, true);
    view.setUint16(dir + 28, name.length, true);
    view.setUint32(dir + 42, at, true);
    out.set(name, at + 30);
    out.set(body, at + 30 + name.length);
    out.set(name, dir + 46);
    at += 30 + name.length + body.length;
    dir += 46 + name.length;
  }
  view.setUint32(dir, 0x06054b50, true);
  view.setUint16(dir + 8, entries.length, true);
  view.setUint16(dir + 10, entries.length, true);
  view.setUint32(dir + 12, directory, true);
  view.setUint32(dir + 16, locals, true);
  return out;
}

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function cellXml(value: string | number, ref: string): string {
  if (typeof value === 'number' && Number.isFinite(value))
    return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml(rows: readonly (readonly (string | number)[])[]): string {
  const data = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => (value === '' ? '' : cellXml(value, `${columnName(c)}${r + 1}`)))
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `${XML}<worksheet xmlns="${MAIN}">${data ? `<sheetData>${data}</sheetData>` : '<sheetData/>'}</worksheet>`;
}

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
export function workbookBytes(sheets: Sheet[], docRef?: string): Uint8Array<ArrayBuffer> {
  const ids = sheets.map((_, i) => i + 1);
  const worksheet = (i: number) =>
    `PartName="/xl/worksheets/sheet${i}.xml" ContentType="${SHEET_TYPE}.worksheet+xml"`;
  return zip([
    {
      path: '[Content_Types].xml',
      text: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${SHEET_TYPE}.sheet.main+xml"/>${ids.map((i) => `<Override ${worksheet(i)}/>`).join('')}</Types>`,
    },
    {
      path: '_rels/.rels',
      text: `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      text: `${XML}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${sheets
        .map(
          (sheet, i) =>
            `<sheet name="${escapeXml(sheet.name.slice(0, SHEET_NAME_MAX))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join('')}</sheets></workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      text: `${XML}<Relationships xmlns="${PKG}">${ids
        .map(
          (i) =>
            `<Relationship Id="rId${i}" Type="${REL}/worksheet" Target="worksheets/sheet${i}.xml"/>`,
        )
        .join('')}</Relationships>`,
    },
    ...sheets.map((sheet, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      text: sheetXml(docRef === undefined ? sheet.rows : [[`DOC. NO. ${docRef}`], ...sheet.rows]),
    })),
  ]);
}
