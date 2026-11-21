import { describe, expect, it } from 'vitest';
import { bdPmModel } from '../bd-pm/adapter.js';
import { categoryCellModel } from '../category-cell/adapter.js';
import { mttrMtbfModel } from '../mttr-mtbf/adapter.js';
import { answerKey, testT } from './test-support.js';

const a1 = bdPmModel(answerKey('a1-bd-pm', 'a1-bd-pm', 40), testT)!;
const a2 = categoryCellModel(answerKey('a2-category-cell', 'a2-category-cell', 40), testT)!;
const a3 = mttrMtbfModel(answerKey('a3-mttr-mtbf', 'a3-mttr-mtbf', 40), testT)!;
const noted = (tables: { title: string; note?: string }[]) =>
  tables.filter((table) => table.note !== undefined).map((table) => table.title);

describe('the explanations Bhavin’s platform prints under its tables and charts', () => {
  it('A1 says how available hours are counted under By Cell, and what each month cell is a share of', () => {
    expect(noted(a1.tables)).toEqual([
      'By Cell — Detail',
      expect.stringMatching(/^Month-on-Month — BD % and PM %/),
      expect.stringMatching(/^Month-on-Month — BD Hours by Cell/),
    ]);
    const cell = a1.tables.find((table) => table.title === 'By Cell — Detail')!;
    expect(cell.note).toContain('the cell move log is applied');
    expect(cell.note).toContain('“No cell”');
    const trend = a1.charts.find((chart) => chart.spec.title === 'BD and PM hours by month')!;
    expect(trend.sub).toBe('Plant-level BD hours against PM hours across the year.');
  });

  it('A2 says what each per-machine average divides by', () => {
    const subs = Object.fromEntries(a2.charts.map((chart) => [chart.spec.title, chart.sub]));
    expect(subs['Average BD hours per machine by category']).toContain(
      '÷ machines in the category',
    );
    expect(subs['Average breakdowns per machine by cell']).toBe(
      'Cell breakdowns ÷ machines currently in the cell.',
    );
    // A chart with no note of its own keeps the quiet line every chart has.
    expect(subs['BD hours by category']).not.toContain('÷');
  });

  it('A3 says the monthly hours are the annual figure ÷ 12, a simplification, and how Total is worked out', () => {
    expect(noted(a3.tables)).toHaveLength(2);
    const cells = a3.tables.find((table) => table.title.includes('Cell-wise'))!;
    expect(cells.note).toContain('annual figure ÷ 12');
    expect(cells.note).toContain('simplifying assumption');
    expect(cells.note).toContain('MTBF = (annual available hours − BD hours) ÷ breakdowns');
    expect(a3.tables.find((table) => table.title.includes('Age Band-wise'))?.note).toContain(
      'annual ÷ 12',
    );
  });

  it('puts a paired matrix’s note on its first table only', () => {
    const matrices = a1.tables.filter((table) => table.title.startsWith('Month-on-Month — BD %'));
    expect(matrices.length).toBeGreaterThan(1);
    expect(matrices.filter((table) => table.note !== undefined)).toHaveLength(1);
  });
});
