// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { answerKey, realT } from '../printed-page/test-support.js';
import { FIGURE, forecastLabModel } from './adapter.js';
import { labSheets } from './sweep.js';

/** Sweep 706 (690), batch D: the Forecast Lab's tables as Excel sheets, as shown. */

const model = forecastLabModel(answerKey('forecast-lab', FIGURE, 42), realT)!;
const sheets = () => labSheets(model);

describe('labSheets', () => {
  it('writes one sheet per table, named by its title, in the page’s order', () => {
    expect(sheets().map((s) => s.name)).toEqual(model.tables.map((t) => t.title));
  });

  it('puts the header first, then every row of the table', () => {
    sheets().forEach((sheet, at) => {
      const table = model.tables[at]!;
      expect(sheet.rows[0]).toEqual(table.header.map((h) => h.label));
      expect(sheet.rows).toHaveLength(table.rows.length + 1);
      expect(sheet.rows.slice(1).every((row) => row.length === table.header.length)).toBe(true);
    });
  });

  it('keeps the method’s words as printed, and writes plain numbers as numbers', () => {
    const first = sheets()[0]!.rows[1]!;
    expect(first[0]).toBe(model.tables[0]!.rows[0]![0]!.text);
    const numbers = sheets()
      .flatMap((s) => s.rows.slice(1).flat())
      .filter((v) => typeof v === 'number');
    expect(numbers.length).toBeGreaterThan(0);
  });
});
