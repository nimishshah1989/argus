import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { workbookBytes } from '../xlsx.js';

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
    expect(crc32(body), `${name} CRC`).toBe(view.getUint32(at + 14, true));
    files.set(name, text.decode(body));
    at = start + size;
  }
  return files;
}

const sheet1 = (bytes: Uint8Array) => unzip(bytes).get('xl/worksheets/sheet1.xml') ?? '';

describe('workbookBytes: edges', () => {
  it('escapes & < > " in cells and sheet names', () => {
    const files = unzip(workbookBytes([{ name: 'R&D <1>', rows: [['a & b < c > "d"']] }]));
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('a &amp; b &lt; c &gt; &quot;d&quot;');
    expect(files.get('xl/workbook.xml')).toContain('name="R&amp;D &lt;1&gt;"');
  });

  it('cuts a sheet name to 31 characters', () => {
    const long = 'Breakdown history by machine and shift';
    const workbook = unzip(workbookBytes([{ name: long, rows: [] }])).get('xl/workbook.xml');
    expect(workbook).toContain(`name="${long.slice(0, 31)}"`);
    expect(workbook).not.toContain(long.slice(0, 32));
  });

  it('writes numbers as numbers: zero, negative, many decimals', () => {
    const xml = sheet1(workbookBytes([{ name: 'S', rows: [[0, -12.5, 0.1 + 0.2]] }]));
    expect(xml).toMatch(/<c r="A1"[^>]*><v>0<\/v>/);
    expect(xml).toMatch(/<c r="B1"[^>]*><v>-12\.5<\/v>/);
    expect(xml).toMatch(/<c r="C1"[^>]*><v>0\.30000000000000004<\/v>/);
    expect(xml).not.toContain('inlineStr');
  });

  it('still writes an empty sheet', () => {
    const files = unzip(workbookBytes([{ name: 'Empty', rows: [] }]));
    expect(files.has('xl/worksheets/sheet1.xml')).toBe(true);
    expect(files.get('xl/worksheets/sheet1.xml')).not.toContain('<row');
  });

  it('an empty sheet with a docRef holds only the DOC. NO. row; no docRef, no such row', () => {
    const withRef = sheet1(workbookBytes([{ name: 'S', rows: [] }], 'CE-MTN-F-01'));
    expect(withRef.match(/<row /g)).toHaveLength(1);
    expect(withRef).toContain('DOC. NO. CE-MTN-F-01');
    const withoutRef = sheet1(workbookBytes([{ name: 'S', rows: [['x']] }]));
    expect(withoutRef).not.toContain('DOC. NO.');
    expect(withoutRef).toMatch(/<row r="1">.*>x<\/t>/);
  });
});
