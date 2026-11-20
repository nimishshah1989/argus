import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import { fill } from '../../../i18n/fill.js';
import type { PageKpi, PageTable } from '../../analytics/page-content.js';
import { unpair, type PairWords } from './pair.js';
import { numberValue, type Page } from './printed.js';
import { printedTable, type PrintedChip, type PrintedTable } from './table.js';

/** A chart the engine sent, with the two lines the screen says about it. */
export type PageChart = { id: string; spec: ChartSpec; sub: string; aria: string };

/** The words every printed-page screen shares: the engine's own text is everything else. */
export type PageWords = {
  why: string;
  /** `{series}` and `{axis}`: the quiet line under a chart; `{title}`, `{series}`, `{n}` and `{axis}` for a screen reader. */
  chart: { sub: string; aria: string };
  pair: PairWords;
  /** `{n}`: a cell the engine printed as a bare number (the machine tables), named as every other table names it. */
  cell: string;
  /** `{date}`: the line under the page. */
  source: string;
  all: string;
  table: TableWords;
};

/** Everything a printed-page screen prints: the engine's page, whole, in the reader's words, ready to print. */
export type PrintedPageModel = {
  verdict: VerdictData;
  figures: FigureData[];
  charts: PageChart[];
  tables: PrintedTable[];
  source: string;
  words: PageWords;
};

const names = (spec: ChartSpec): string[] =>
  spec.kind === 'bar' || spec.kind === 'line' || spec.kind === 'heatmap' || spec.kind === 'pareto'
    ? spec.series.map((s) => s.name)
    : spec.kind === 'mixed'
      ? [...spec.bars, ...(spec.line ? [spec.line] : [])].map((s) => s.name)
      : [];

const sizeOf = (spec: ChartSpec): number =>
  spec.kind === 'scatter' ? spec.points.length : spec.categories.length;

const axisOf = (spec: ChartSpec): string => (spec.kind === 'scatter' ? '' : spec.categoryLabel);

/** The chart with the line under it and the sentence for a screen reader; bars, lines and mixed charts alike. */
export function chartOf(spec: ChartSpec, words: PageWords): PageChart {
  const values = {
    title: spec.title,
    series: names(spec).join(', '),
    axis: axisOf(spec).toLocaleLowerCase(),
    n: sizeOf(spec),
  };
  return {
    id: spec.title,
    spec,
    sub: fill(words.chart.sub, values),
    aria: fill(words.chart.aria, values),
  };
}

/** The engine's figures as tiles, exactly as printed. */
export const figuresOf = (kpis: readonly PageKpi[]): FigureData[] =>
  kpis.map((kpi, at) => ({
    id: `kpi-${at}`,
    label: kpi.label,
    value: kpi.value,
    sub: kpi.sub ?? '',
  }));

/**
 * The values a column holds, most frequent first, `count` of them: the chips that narrow a long table. Read from the
 * printed text, so a chip can only name something the table shows.
 */
export function chipsOf(
  table: PageTable | undefined,
  column: number,
  count: number,
  all: string,
): PrintedChip[] {
  const seen = new Map<string, number>();
  for (const row of table?.rows ?? []) {
    const value = row[column] ?? '';
    if (value !== '') seen.set(value, (seen.get(value) ?? 0) + 1);
  }
  const top = [...seen].sort((a, b) => b[1] - a[1]).slice(0, count);
  return [
    { key: 'all', label: all },
    ...top.map(([value]) => ({ key: value, label: value, match: { column, value } })),
  ];
}

/** The row of a table whose `column` prints the largest number; undefined for a table with no numbers. */
export function rowWithMost(table: PageTable | undefined, column: number): string[] | undefined {
  let best: string[] | undefined;
  let top = -Infinity;
  for (const row of table?.rows ?? []) {
    const value = numberValue(row[column] ?? '');
    if (value > top) {
      top = value;
      best = row;
    }
  }
  return top < 0 ? undefined : best;
}

/** The table with the engine's title, found by it; a paired matrix is one table per measure. */
export const byTitle = (page: Page, title: string): PageTable | undefined =>
  page.tables.find((table) => table.title === title);

/**
 * The machine tables print a machine's cell as a bare number ("7") where every other table says "Cell 7". The column
 * is named as the others are, so it is one chip that opens the same cell; a column that holds anything else is left.
 */
export function cellsNamed(table: PageTable, words: PageWords): PageTable {
  const at = table.header.findIndex((label) => label.trim().toLowerCase() === 'cell');
  const bare = at >= 0 && table.rows.every((row) => /^\d+$/.test(row[at] ?? ''));
  if (!bare) return table;
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.map((cell, i) => (i === at ? fill(words.cell, { n: cell }) : cell)),
    ),
  };
}

/** The engine glues a cell's hours (one decimal) to its percent (one decimal): "11.80.4%". Said as "11.8 (0.4%)". */
const GLUED_FIGURES = /^(\d[\d,]*\.\d)(\d+\.\d%)$/;
export const tidyGlued = (cell: string): string => {
  const found = GLUED_FIGURES.exec(cell);
  return found ? `${found[1]} (${found[2]})` : cell;
};
const tidied = (table: PageTable): PageTable => ({
  ...table,
  rows: table.rows.map((row) => row.map(tidyGlued)),
});

/**
 * The tables of a page as printed tables, in the engine's order. A paired matrix becomes its two aligned tables; every
 * other table keeps its rows, with the filter chips `chips` offers for it (read from the table as it will be printed).
 */
export function tablesOf(
  tables: readonly PageTable[],
  words: PageWords,
  chips: (table: PageTable) => PrintedChip[] = () => [],
): PrintedTable[] {
  return tables
    .map((raw) => tidied(cellsNamed(raw, words)))
    .flatMap((table) => {
      const pair = unpair(table, words.pair);
      return pair ? pair.map((half) => printedTable(half)) : [printedTable(table, chips(table))];
    });
}
