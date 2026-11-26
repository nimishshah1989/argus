import type { Cell, EngineTableWords, TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { RegisterTable } from './read.js';
import { numberIn } from './read.js';
import { lookOfHeader, type ColumnLook } from '../../../ui/v2/table-look.js';

export type { Cell, EngineTableWords, TableModel };

export type TableOptions = {
  id: string;
  title: string;
  words: EngineTableWords;
  /** The columns not shown (the engine's row number and its blank action columns). */
  skip?: (label: string, index: number) => boolean;
  /** A column whose cells name a thing: its chip, from the cell and the printed row by header. */
  chip?: Record<string, (cell: string, row: Record<string, string>) => Cell | null>;
  /** The column whose most common values become filter chips. */
  chipColumn?: string;
  /** Looks a screen declares by header, for the columns it names itself (its words are translated, not the engine's). */
  looks?: Record<string, ColumnLook>;
};

const NUMBER = /^-?\d[\d,]*(\.\d+)?\s?(?:%|y|yrs?|hrs?|m²|KVA|kW|x)?$/;
const NONE = new Set(['', '—', '-']);

/** Blank headers are the engine's action columns (Edit, Move, Del) and "#" its row number; neither is a figure. */
export const NOT_A_FIGURE = (label: string): boolean => label.trim() === '' || label === '#';

const isNumeric = (rows: readonly (readonly string[])[], column: number): boolean => {
  const cells = rows.map((row) => (row[column] ?? '').trim()).filter((cell) => !NONE.has(cell));
  return cells.length > 0 && cells.every((cell) => NUMBER.test(cell));
};

const plain = (text: string, numeric: boolean): Cell => ({
  text,
  sort: numeric ? (numberIn(text) ?? Number.NEGATIVE_INFINITY) : text,
});

/** The most common values of a column, at most four, most common first. */
function commonValues(rows: Cell[][], column: number): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[column]?.text ?? '';
    if (!NONE.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, 4)
    .map(([value]) => value);
}

/** The engine's table as the screen draws it. Every printed cell is kept; only the row number and the action columns go. */
export function engineTable(table: RegisterTable, o: TableOptions): TableModel {
  const shown = table.header
    .map((label, index) => ({ label, index }))
    .filter(({ label, index }) => !(o.skip ?? NOT_A_FIGURE)(label, index));
  const numeric = shown.map(({ index }) => isNumeric(table.rows, index));
  const rows = table.rows.map((row) => {
    const named = Object.fromEntries(table.header.map((label, i) => [label, row[i] ?? '']));
    return shown.map(({ label, index }, at) => {
      const cell = row[index] ?? '';
      return o.chip?.[label]?.(cell, named) ?? plain(cell, numeric[at] ?? false);
    });
  });
  const at = shown.findIndex(({ label }) => label === o.chipColumn);
  return {
    id: o.id,
    title: o.title,
    header: shown.map(({ label }, i) => ({
      label,
      numeric: numeric[i] ?? false,
      look: o.looks?.[label] ?? lookOfHeader(label, numeric[i] ?? false, o.title),
    })),
    rows,
    chips: at < 0 ? [] : commonValues(rows, at).map((key) => ({ key, label: key, column: at })),
    words: o.words,
  };
}
