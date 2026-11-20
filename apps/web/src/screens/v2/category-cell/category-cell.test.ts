import { describe, expect, it } from 'vitest';
import {
  answerKey,
  keyPage,
  missingCells,
  shownCells,
  testT,
} from '../printed-page/test-support.js';
import { categoryCellModel } from './adapter.js';

const reply = answerKey('a2-category-cell', 'a2-category-cell', 40);
const model = categoryCellModel(reply, testT)!;
const page = keyPage(reply);
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('Category and cell from the engine reply', () => {
  it('draws all eight charts the engine sent', () => {
    expect(model.charts).toHaveLength(8);
    expect(page.charts).toHaveLength(8);
  });

  it('keeps every machine of the fourteen category tables in one table, under the category the engine order gives it', () => {
    const machines = model.tables.at(-1)!;
    const printed = page.tables.slice(2).reduce((n, t) => n + t.rows.length, 0);
    expect(machines.rows).toHaveLength(printed);
    expect(machines.header.map((h) => h.label)).toEqual([
      'Machine ID',
      'Category',
      'Cell',
      '# Breakdowns',
      'BD Hours',
      '% of Total BD',
    ]);
    const first = machines.rows[0]!;
    expect(first.map((c) => c.text).slice(0, 2)).toEqual(['TC-5', 'Turning Center']);
    expect(machines.rows[38]![1]!.text).toBe('Vertical Machining Center');
  });

  it('prints every cell of the three kinds of table the engine sent', () => {
    expect(missingCells(page.tables, shownCells(model.tables))).toEqual([]);
  });

  it('says which category and cell cost the most hours, and which loses the most a machine', () => {
    expect(says(model.verdict.headline)).toBe(
      'Vertical Machining Center has the most breakdown hours: 1,057.79 hrs, 34.57% of the total.',
    );
    expect(model.verdict.why.map(says)).toEqual([
      expect.stringMatching(
        /^Cell \d has the most breakdown hours of any cell: .* hrs, .*% of the total\.$/,
      ),
      'Turnmill loses the most per machine: 87.96 hrs each.',
    ]);
  });

  it('offers category and cell chips on the machine table, only values it shows', () => {
    const chips = model.tables.at(-1)!.chips;
    expect(chips[0]).toMatchObject({ key: 'all' });
    expect(chips.map((c) => c.label)).toContain('Vertical Machining Center');
    expect(chips.length).toBeLessThanOrEqual(5);
  });

  it('keeps the tables as printed when a category table does not hold the machines its row counts', () => {
    const value = JSON.parse(JSON.stringify(reply.figures[0]!.value));
    value.pages[0].tables[2].rows.pop();
    const odd = { ...reply, figures: [{ ...reply.figures[0]!, value }] };
    expect(categoryCellModel(odd, testT)!.tables).toHaveLength(16);
  });
});
