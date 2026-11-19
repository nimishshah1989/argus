import { describe, expect, it } from 'vitest';
import { numberOf, numericColumns, type EngineRow } from './engine-table-model.js';

const rows = (cells: string[][]): EngineRow[] => cells.map((row, index) => ({ row, index }));

describe('which columns of the engine table are numbers', () => {
  it('takes a column of printed numbers and dashes, and leaves words alone', () => {
    const found = numericColumns(
      rows([
        ['Turning Center', '38', '5,65,692.47', '0.54%', '—'],
        ['Cell 1', '7', '36,272.45', '1.36%', '—'],
      ]),
      5,
    );
    expect([...found]).toEqual([1, 2, 3]);
  });

  it('does not call a column numeric when one cell is a word', () => {
    expect([...numericColumns(rows([['12'], ['n/a'], ['7']]), 1)]).toEqual([]);
  });

  it('reads the number a cell prints, Indian grouping and percent included, and a dash as no number', () => {
    expect(numberOf('5,65,692.47')).toBe(565692.47);
    expect(numberOf('0.54%')).toBe(0.54);
    expect(numberOf('—')).toBeNaN();
    expect(numberOf('')).toBeNaN();
  });
});
