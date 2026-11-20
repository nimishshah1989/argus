import { describe, expect, it } from 'vitest';
import {
  answerKey,
  keyPage,
  missingCells,
  shownCells,
  testT,
} from '../printed-page/test-support.js';
import { bdPmModel } from './adapter.js';

const reply = answerKey('a1-bd-pm', 'a1-bd-pm', 40);
const model = bdPmModel(reply, testT)!;
const page = keyPage(reply);
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('BD % and PM split from the engine reply', () => {
  it('prints all six figures as the engine sent them', () => {
    expect(model.figures.map((f) => [f.label, f.value, f.sub])).toEqual(
      page.kpis.map((k) => [k.label, k.value, k.sub]),
    );
  });

  it('draws both charts and prints every cell of the four tables, the paired matrix as one table per measure', () => {
    expect(model.charts.map((c) => c.spec.kind)).toEqual(['bar', 'line']);
    expect(model.tables).toHaveLength(5);
    expect(missingCells(page.tables, shownCells(model.tables))).toEqual([]);
  });

  it('opens with the engine figures in one sentence and names the cell that loses the most', () => {
    expect(says(model.verdict.headline)).toBe(
      'Breakdowns took 3,060.1 hrs (0.54% of available) and PM took 759.3 hrs (0.13% of available). Fleet availability is 99.32%.',
    );
    expect(model.verdict.why.map(says)).toContain(
      'Cell 1 loses the most: 1.38% of its available hours (breakdowns 1.36%, PM 0.02%).',
    );
    expect(model.verdict.why[1]![0]!.entity).toMatchObject({ kind: 'cell', id: 'Cell 1' });
  });

  it('says the hours and the percent the engine glued together ("11.80.4%") as two figures', () => {
    expect(page.tables[2]!.rows[0]![1]).toBe('11.80.4%');
    expect(model.tables[3]!.rows[0]![1]!.text).toBe('11.8 (0.4%)');
    expect(model.tables[3]!.rows[0]![6]!.text).toBe('243.6 (8.0%)');
  });

  it('makes a cell a chip, but not the plant total', () => {
    const cells = model.tables[0]!.rows.map((r) => r[0]!.chips[0]?.id);
    expect(cells.slice(0, 2)).toEqual(['Cell 1', 'Cell 2']);
    expect(model.tables[1]!.rows.at(-1)![0]).toMatchObject({ text: 'PLANT TOTAL', chips: [] });
  });

  it('is empty when the engine did not compute it', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(bdPmModel(none, testT)).toBeNull();
  });
});
