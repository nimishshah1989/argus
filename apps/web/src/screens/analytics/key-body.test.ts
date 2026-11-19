import { describe, expect, it } from 'vitest';
import { tableView } from '../../ui/elements/index.js';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import { columnsOf, sortNumber } from './key-body.js';
import { drawnChart } from './key-chart.js';
import type { PageTable } from './page-content.js';

const table: PageTable = {
  title: 'Machines',
  header: ['Machine', 'Hours', 'Share'],
  rows: [
    ['TC-1', '1,200.5', '12.5%'],
    ['TC-2', '—', '3%'],
    ['TC-3', '95', '40%'],
  ],
  rowCount: 3,
  truncated: false,
  sortable: true,
};
const rows = table.rows.map((cells, at) => ({ at, cells }));
const sorted = (column: string, dir: 'asc' | 'desc') =>
  tableView(
    rows,
    columnsOf(table, rows),
    { sort: { column, dir }, filter: '', page: 0, pageSize: 50 },
    (row) => row.cells.join(' '),
  ).rows.map((row) => row.cells[0]);

describe('the engine table columns', () => {
  it('sorts a numeric column as numbers, reading grouping commas and %, and keeps a dash last both ways', () => {
    expect(sorted('1', 'asc')).toEqual(['TC-3', 'TC-1', 'TC-2']);
    expect(sorted('1', 'desc')).toEqual(['TC-1', 'TC-3', 'TC-2']);
    expect(sorted('2', 'asc')).toEqual(['TC-2', 'TC-1', 'TC-3']);
  });

  it('prints a missing cell as a dash and every other cell exactly as the engine wrote it', () => {
    const columns = columnsOf(table, rows);
    expect(rows.map((row) => columns[1]!.cell(row))).toEqual(['1,200.5', '—', '95']);
    expect(rows.map((row) => columns[2]!.cell(row))).toEqual(['12.5%', '3%', '40%']);
  });

  it('offers no sort on a table the engine did not mark sortable', () => {
    const plain = { ...table, sortable: undefined };
    expect(columnsOf(plain, rows).every((column) => column.sortValue === undefined)).toBe(true);
  });
});

describe('the chart a key page draws', () => {
  const line: ChartSpec = {
    kind: 'line',
    title: 'Hours',
    categoryLabel: 'Month',
    categories: ['Jan', 'Feb'],
    series: [{ name: 'BD hours', values: [1, 2] }],
  };

  it('draws in once, and names the value axis after a lone series', () => {
    expect(drawnChart(line)).toMatchObject({ draw: true, legend: false, valueLabel: 'BD hours' });
  });

  it('shows a legend from two series up and keeps a title the spec already has', () => {
    const two: ChartSpec = {
      ...line,
      valueLabel: 'Hours',
      series: [...line.series, { name: 'Count', values: [3, 4] }],
    };
    expect(drawnChart(two)).toMatchObject({
      title: 'Hours',
      draw: true,
      legend: true,
      valueLabel: 'Hours',
    });
  });

  it('leaves a scatter as it came', () => {
    const scatter: ChartSpec = {
      kind: 'scatter',
      title: 'x',
      machineLabel: 'm',
      xLabel: 'x',
      yLabel: 'y',
      mttrLabel: 't',
      points: [],
    };
    expect(drawnChart(scatter)).toBe(scatter);
  });
});

describe('money columns', () => {
  const money: PageTable = {
    title: 'Lost',
    header: ['Problem', 'Money'],
    rows: [
      ['A', '₹ 90.00 lakh'],
      ['B', '₹ 1.20 cr'],
      ['C', '₹ 71,784'],
      ['D', '—'],
    ],
    rowCount: 4,
    truncated: false,
    sortable: true,
  };
  const moneyRows = money.rows.map((cells, at) => ({ at, cells }));
  const order = (dir: 'asc' | 'desc') =>
    tableView(
      moneyRows,
      columnsOf(money, moneyRows),
      { sort: { column: '1', dir }, filter: '', page: 0, pageSize: 50 },
      (row) => row.cells.join(' '),
    ).rows.map((row) => row.cells[0]);

  it('reads lakh and crore to rupees so the rows sort by value, a dash last', () => {
    expect(sortNumber('₹ 1.20 cr')).toBe(12000000);
    expect(sortNumber('₹ 38.23 lakh a year')).toBe(3823000);
    expect(order('asc')).toEqual(['C', 'A', 'B', 'D']);
    expect(order('desc')).toEqual(['B', 'A', 'C', 'D']);
  });

  it('prints the cells exactly as the engine wrote them', () => {
    const column = columnsOf(money, moneyRows)[1]!;
    expect(moneyRows.map((row) => column.cell(row))).toEqual([
      '₹ 90.00 lakh',
      '₹ 1.20 cr',
      '₹ 71,784',
      '—',
    ]);
  });
});
