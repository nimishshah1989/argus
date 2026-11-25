// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sheetNames, workbookBytes } from '@uptimo/shared/xlsx';
import '../../i18n/index.js';
import { DownloadExcel, saveWorkbook } from './download-excel.js';

/** The stored zip's local entries, by name, as text. */
function entries(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, string>();
  const text = new TextDecoder();
  let at = 0;
  while (at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const start = at + 30 + nameLength + view.getUint16(at + 28, true);
    out.set(
      text.decode(bytes.subarray(at + 30, at + 30 + nameLength)),
      text.decode(bytes.subarray(start, start + size)),
    );
    at = start + size;
  }
  return out;
}
const tabNames = (bytes: Uint8Array) =>
  [...(entries(bytes).get('xl/workbook.xml') ?? '').matchAll(/<sheet name="([^"]*)"/g)].map(
    (m) => m[1],
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('xlsx hardening (ticket 732, ADR 0041)', () => {
  it('replaces the characters Excel bans in a sheet name', () => {
    expect(sheetNames(['Downtime/Cell: 7 [A]?*\\'])).toEqual(['Downtime-Cell- 7 -A----']);
  });

  it('an empty name falls back to Sheet<N>', () => {
    expect(sheetNames(['Hours', '', '   '])).toEqual(['Hours', 'Sheet2', 'Sheet3']);
  });

  it('names are unique ignoring case, the suffix kept within 31 characters', () => {
    expect(sheetNames(['Hours', 'hours'])).toEqual(['Hours', 'hours (2)']);
    const long = 'X'.repeat(40);
    const [first, second] = sheetNames([long, long]);
    expect(first).toBe('X'.repeat(31));
    expect(second).toBe(`${'X'.repeat(27)} (2)`);
  });

  it('the workbook uses the cleaned names', () => {
    expect(
      tabNames(
        workbookBytes([
          { name: 'a/b', rows: [] },
          { name: 'A-B', rows: [] },
        ]),
      ),
    ).toEqual(['a-b', 'A-B (2)']);
  });

  it('no sheets still writes one empty sheet Excel can open', () => {
    const files = entries(workbookBytes([], 'X-1'));
    expect(files.has('xl/worksheets/sheet1.xml')).toBe(true);
    expect(tabNames(workbookBytes([]))).toEqual(['Sheet1']);
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('DOC. NO. X-1');
  });

  it('every zip entry carries the DOS date 0x21', () => {
    const bytes = workbookBytes([{ name: 'S', rows: [[1]] }]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let locals = 0;
    let centrals = 0;
    for (let at = 0; at + 4 <= bytes.length; at++) {
      const sig = view.getUint32(at, true);
      if (sig === 0x04034b50) {
        expect(view.getUint16(at + 12, true)).toBe(0x21);
        locals++;
      } else if (sig === 0x02014b50) {
        expect(view.getUint16(at + 14, true)).toBe(0x21);
        centrals++;
      }
    }
    expect(locals).toBeGreaterThan(0);
    expect(centrals).toBe(locals);
  });

  it('the button wears the kit word "Download Excel"', () => {
    const html = renderToStaticMarkup(h(DownloadExcel, { file: 'downtime', sheets: [] }));
    expect(html).toContain('type="button"');
    expect(html).toContain('Download Excel');
  });

  it('saving names the file <file>.xlsx, clicks it and frees the URL', () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: () => link, body: { append } });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    saveWorkbook('downtime', [{ name: 'S', rows: [[1]] }], 'D-1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(link.href).toBe('blob:x');
    expect(link.download).toBe('downtime.xlsx');
    expect(append).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
