import { EntityChip, type EntityChipProps } from '../entity-chip.js';
import { dropEmptyColumns, mostlyEmpty } from '../heat-rules.js';
import { RankedBars } from '../ranked-bars.js';

/** The five steps of a heat tint, light to strong. */
export type HeatLevel = 1 | 2 | 3 | 4 | 5;

/** One cell: what the engine printed, its step (none for a dash, a month with nothing in it) and what it is called. */
export type HeatCell = { text: string; level: HeatLevel | null; name: string };

export type HeatRow = {
  head: string;
  chip?: EntityChipProps;
  cells: HeatCell[];
  /** The columns after the months (a total, the share passed): printed plain, never tinted. */
  plain: string[];
};

export type HeatMatrixData = {
  id: string;
  title: string;
  /** The row-name column, the months, then the plain columns. */
  header: { first: string; cells: string[]; plain: string[] };
  rows: HeatRow[];
};

export type HeatWords = { low: string; high: string };

/**
 * The step a value falls in: 1 for the lowest fifth of the range to 5 for the highest; the whole range on one step
 * when it has no spread. `root` spreads a range where a few cells dwarf the rest (hours by month), so the middle of
 * the map still shows its weight.
 */
export function levelOf(value: number, min: number, max: number, root = false): HeatLevel {
  if (max <= min) return 3;
  const share = (value - min) / (max - min);
  const spread = root ? Math.sqrt(share) : share;
  return (Math.min(4, Math.floor(spread * 5)) + 1) as HeatLevel;
}

/** A printed figure as a number, the way the screen adapters read one; a dash or word is 0. */
const figure = (text: string): number => {
  const value = Number(text.replaceAll(',', '').replace('%', '').trim());
  return Number.isFinite(value) ? value : 0;
};

/** A mostly-empty grid as a ranked list: each row's total is the sum of its non-empty cells. */
function RowTotals({ matrix }: { matrix: HeatMatrixData }) {
  const ranked = matrix.rows.map((row) => {
    const total = row.cells.reduce((sum, c) => sum + (c.level === null ? 0 : figure(c.text)), 0);
    return {
      key: row.head,
      label: row.chip ? <EntityChip {...row.chip} /> : row.head,
      value: total,
      valueText: String(total),
    };
  });
  return (
    <section className="v2-card" aria-label={matrix.title}>
      <RankedBars rows={ranked} label={matrix.title} />
    </section>
  );
}

/** ADR 0036 R22: a dash cell is empty and a month empty in every row is dropped; null when what is left is mostly empty. */
function withoutEmptyMonths(
  matrix: HeatMatrixData,
): Pick<HeatMatrixData, 'header' | 'rows'> | null {
  const grid = matrix.rows.map((row) =>
    row.cells.map((cell) => (cell.level === null ? null : cell)),
  );
  const kept = dropEmptyColumns(grid[0]?.map((_, at) => String(at)) ?? [], grid).columns.map(
    Number,
  );
  if (mostlyEmpty(grid.map((row) => kept.map((at) => row[at])))) return null;
  return {
    header: { ...matrix.header, cells: kept.map((at) => matrix.header.cells[at] ?? '') },
    rows: matrix.rows.map((row) => ({
      ...row,
      cells: kept.map((at) => row.cells[at] as HeatCell),
    })),
  };
}

/**
 * The engine's matrix with its cells tinted by weight: every cell prints its figure, a month with nothing is a dash
 * and stays untinted, a cell is named by its row and column for a screen reader and a hover, and a legend says which
 * way the tint runs. Rows that name a machine or a cell are chips.
 */
export function HeatMatrix({ matrix, words }: { matrix: HeatMatrixData; words: HeatWords }) {
  const pruned = withoutEmptyMonths(matrix);
  if (!pruned) return <RowTotals matrix={matrix} />;
  const { header, rows } = pruned;
  return (
    <section className="v2-card" aria-label={matrix.title}>
      <div className="v2-heat-scroll">
        <table className="v2-heat" data-heat="matrix">
          <caption>{matrix.title}</caption>
          <thead>
            <tr>
              <th scope="col">{header.first}</th>
              {header.cells.map((label, at) => (
                <th key={`${label}-${at}`} scope="col">
                  {label}
                </th>
              ))}
              {header.plain.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              <tr key={`${row.head}-${at}`}>
                <th scope="row">{row.chip ? <EntityChip {...row.chip} /> : row.head}</th>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    data-level={cell.level ?? undefined}
                    title={cell.name}
                    aria-label={cell.name}
                  >
                    {cell.text}
                  </td>
                ))}
                {row.plain.map((text, i) => (
                  <td key={`p${i}`} data-total="">
                    {text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="v2-heat-legend" aria-hidden="true">
        <span>{words.low}</span>
        {([1, 2, 3, 4, 5] as const).map((level) => (
          <span key={level} className="v2-heat-step" data-level={level} />
        ))}
        <span>{words.high}</span>
      </div>
    </section>
  );
}
