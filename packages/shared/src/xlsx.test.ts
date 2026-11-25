import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { workbookBytes } from './xlsx.js';

/** Reads a stored (method 0) zip's local entries and checks each CRC-32. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  const text = new TextDecoder();
  let at = 0;
  while (at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extra = view.getUint16(at + 28, true);
    const name = text.decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength + extra;
    const body = bytes.subarray(start, start + size);
    expect(view.getUint16(at + 8, true), `${name} is stored`).toBe(0);
    expect(crc32(body), `${name} CRC`).toBe(view.getUint32(at + 14, true));
    files.set(name, text.decode(body));
    at = start + size;
  }
  return files;
}

describe('workbookBytes (ADR 0036 R6)', () => {
  it('is a zip with the workbook parts and one worksheet per sheet', () => {
    const bytes = workbookBytes([
      { name: 'Machines', rows: [['Machine', 'Hours']] },
      { name: 'Cells', rows: [['Cell']] },
    ]);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const files = unzip(bytes);
    expect(files.has('[Content_Types].xml')).toBe(true);
    expect(files.has('xl/workbook.xml')).toBe(true);
    expect([...files.keys()].filter((n) => n.startsWith('xl/worksheets/'))).toEqual([
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    expect(files.get('xl/workbook.xml')).toContain('name="Cells"');
  });

  it('writes the DOC. NO. on row 1 of every sheet, data from row 2', () => {
    const files = unzip(
      workbookBytes(
        [
          { name: 'A', rows: [['Machine']] },
          { name: 'B', rows: [['Cell']] },
        ],
        'CE-MTN-F-04',
      ),
    );
    for (const sheet of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
      expect(files.get(sheet)).toMatch(/<row r="1">.*DOC\. NO\. CE-MTN-F-04.*?<\/row><row r="2">/);
    }
  });

  it('keeps numbers exact and numeric, text inline', () => {
    const sheet = unzip(workbookBytes([{ name: 'S', rows: [['Hours', 1234.5678]] }])).get(
      'xl/worksheets/sheet1.xml',
    );
    expect(sheet).toMatch(/<c r="B1"[^>]*><v>1234\.5678<\/v><\/c>/);
    expect(sheet).not.toMatch(/<c r="B1"[^>]*t="(inlineStr|s|str)"/);
    expect(sheet).toMatch(/<c r="A1"[^>]*t="inlineStr"[^>]*><is><t[^>]*>Hours<\/t><\/is><\/c>/);
  });
});
