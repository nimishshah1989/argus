// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { answerKey, realT } from '../../printed-page/test-support.js';
import { bottleneckModel, FIGURE } from '../adapter.js';
import { bottleneckSheets } from '../sweep.js';

const model = bottleneckModel(answerKey('a9-bottleneck-forecast', FIGURE, 42), realT, (id) => id)!;

describe('bottleneckSheets, hidden', () => {
  it('gives unique sheet names of at most 31 characters', () => {
    const names = bottleneckSheets(model).map((s) => s.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.length).toBeLessThanOrEqual(31);
  });

  it('prints every cell and column as the page shows it, a plain number as that exact number', () => {
    const sheets = bottleneckSheets(model);
    sheets.forEach((sheet, at) => {
      const table = model.tables[at]!;
      table.rows.forEach((row, r) => {
        expect(sheet.rows[r + 1]).toEqual(
          row.map(({ text }, c) => {
            return table.header[c]!.numeric && /^-?\d[\d,]*(\.\d+)?$/.test(text)
              ? Number(text.replace(/,/g, ''))
              : text;
          }),
        );
      });
    });
  });

  it('is empty for a page with no tables', () => {
    expect(bottleneckSheets({ ...model, tables: [] })).toEqual([]);
  });
});
