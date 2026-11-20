import { describe, expect, it } from 'vitest';
import {
  answerKey,
  keyPage,
  missingCells,
  shownCells,
  testT,
} from '../printed-page/test-support.js';
import { mttrMtbfModel } from './adapter.js';

const reply = answerKey('a3-mttr-mtbf', 'a3-mttr-mtbf', 40);
const model = mttrMtbfModel(reply, testT)!;
const page = keyPage(reply);
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('MTTR and MTBF from the engine reply', () => {
  it('draws all seven charts and prints every cell of the six tables', () => {
    expect(model.charts).toHaveLength(7);
    expect(model.tables).toHaveLength(8);
    expect(missingCells(page.tables, shownCells(model.tables))).toEqual([]);
  });

  it('says the plant year figures the engine printed in its plant-wide row, and which cell is slowest to fix', () => {
    expect(says(model.verdict.headline)).toBe(
      'A breakdown takes 2.39 hrs to fix on average, and a machine runs 439.9 hrs between breakdowns.',
    );
    expect(model.verdict.why.map(says)).toEqual([
      'Cell 1 is the slowest to fix: 6.15 hrs a breakdown, with 447.25 hrs between breakdowns.',
    ]);
  });

  it('keeps every machine in the table of 125 and offers category and cell chips', () => {
    const machines = model.tables.at(-1)!;
    expect(machines.rows).toHaveLength(125);
    expect(machines.rows[0]![0]!.chips[0]).toMatchObject({ kind: 'machine' });
    expect(machines.chips.map((c) => c.label)).toContain('Vertical Machining Center');
  });

  it('is empty when the engine did not compute it', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(mttrMtbfModel(none, testT)).toBeNull();
  });
});
