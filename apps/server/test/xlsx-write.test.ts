import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { writeXlsx } from '../src/modules/reports/xlsx.js';
import { readWorkbook } from '../../../tools/answer-key/xlsx.js';

const dir = mkdtempSync(join(tmpdir(), 'uptimo-xlsx-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('writeXlsx', () => {
  it('writes a workbook the answer-key reader reads back whole', () => {
    const bytes = writeXlsx([
      {
        name: 'Data & Notes',
        rows: [
          ['Héllo 世界 😀 & <tag> "quoted" it\'s', 42.5, null, 'tail'],
          ['bell\u0007 kept', '', 3.25],
          [],
        ],
      },
      { name: 'Empty', rows: [] },
    ]);

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');

    const file = join(dir, 'workbook.xlsx');
    writeFileSync(file, bytes);
    const sheets = readWorkbook(file);

    expect(Object.keys(sheets)).toEqual(['Data & Notes', 'Empty']);
    expect(sheets['Data & Notes']).toEqual([
      ['Héllo 世界 😀 & <tag> "quoted" it\'s', 42.5, null, 'tail'],
      ['bell kept', null, 3.25],
      [],
    ]);
    expect(typeof sheets['Data & Notes']?.[0]?.[1]).toBe('number');
    expect(sheets.Empty).toEqual([]);
  });
});
