import { deflateRawSync } from 'node:zlib';

/** One sheet of a workbook: a name and its rows of text, numbers and blanks. */
export interface Sheet {
  name: string;
  rows: readonly (readonly (string | number | null)[])[];
}

type Entry = { name: string; body: Buffer };
type Packed = { name: Buffer; body: Buffer; size: number; crc: number };

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ROOT = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const BASE = 'http://schemas.openxmlformats.org/package/2006/content-types';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Drop the control characters XML 1.0 forbids; tab, newline and carriage return stay. */
function stripControls(text: string): string {
  let clean = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 || code === 9 || code === 10 || code === 13) clean += char;
  }
  return clean;
}

/** Escape XML text and drop the control characters XML 1.0 forbids. */
function escapeXml(text: string): string {
  return stripControls(text).replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function deflate(entry: Entry): Packed {
  return {
    name: Buffer.from(entry.name, 'utf8'),
    body: deflateRawSync(entry.body),
    size: entry.body.length,
    crc: crc32(entry.body),
  };
}

function localHeader(entry: Packed): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.body.length, 18);
  header.writeUInt32LE(entry.size, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(entry: Packed, offset: number): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x21, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.body.length, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

/** A stored-format zip: local headers, then the central directory and its end record. */
function zip(entries: readonly Entry[]): Buffer {
  const packed = entries.map(deflate);
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of packed) {
    locals.push(localHeader(entry), entry.name, entry.body);
    central.push(centralHeader(entry, offset), entry.name);
    offset += 30 + entry.name.length + entry.body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(packed.length, 8);
  end.writeUInt16LE(packed.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, directory, end]);
}

const bytes = (text: string): Buffer => Buffer.from(text, 'utf8');

function contentTypes(count: number): Buffer {
  const sheets = Array.from(
    { length: count },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return bytes(
    `${XML}<Types xmlns="${BASE}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}</Types>`,
  );
}

function workbook(sheets: readonly Sheet[]): Buffer {
  const list = sheets
    .map(
      (sheet, i) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('');
  return bytes(
    `${XML}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${list}</sheets></workbook>`,
  );
}

function workbookRels(count: number): Buffer {
  const list = Array.from(
    { length: count },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return bytes(`${XML}<Relationships ${ROOT}>${list}</Relationships>`);
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

function rowXml(values: readonly (string | number | null)[], index: number): string {
  const cells: string[] = [];
  values.forEach((value, column) => {
    if (value !== null && value !== '')
      cells.push(cellXml(value, `${columnName(column)}${index + 1}`));
  });
  return `<row r="${index + 1}">${cells.join('')}</row>`;
}

function sheetXml(rows: Sheet['rows']): Buffer {
  const data = rows.map((row, index) => rowXml(row, index)).join('');
  return bytes(`${XML}<worksheet xmlns="${MAIN}"><sheetData>${data}</sheetData></worksheet>`);
}

/** Write sheets as an .xlsx workbook: inline strings and numbers, no styles or formulas. */
export function writeXlsx(sheets: readonly Sheet[]): Buffer {
  return zip([
    { name: '[Content_Types].xml', body: contentTypes(sheets.length) },
    {
      name: '_rels/.rels',
      body: bytes(
        `${XML}<Relationships ${ROOT}><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    { name: 'xl/workbook.xml', body: workbook(sheets) },
    { name: 'xl/_rels/workbook.xml.rels', body: workbookRels(sheets.length) },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      body: sheetXml(sheet.rows),
    })),
  ]);
}
