// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { answerKey, realT } from '../printed-page/test-support.js';
import { bottleneckModel, FIGURE } from './adapter.js';
import { bottleneckSheets } from './sweep.js';

const model = bottleneckModel(answerKey('a9-bottleneck-forecast', FIGURE, 42), realT, (id) => id)!;

describe('Bottleneck sweep: Download Excel', () => {
  it('gives one sheet per table, in the page order, header row first', () => {
    const sheets = bottleneckSheets(model);
    expect(sheets).toHaveLength(model.tables.length);
    sheets.forEach((sheet, at) => {
      const table = model.tables[at]!;
      expect(sheet.rows).toHaveLength(table.rows.length + 1);
      expect(sheet.rows[0]).toEqual(table.header.map((h) => h.label));
    });
  });
});
