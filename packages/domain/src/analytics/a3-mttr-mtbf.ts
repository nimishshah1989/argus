import { monthLabel, NO_RECORDS, yearLabel, type PeriodMonth } from './availability.js';
import { formatInr, normalizeLabel } from './format.js';
import { availableHoursFor, cellKey, quarterAverage } from './hours.js';
import {
  ageMomGroups,
  buildContext,
  cellMomGroups,
  cellName,
  momRow,
  mtbfOf,
  mttrOf,
  plantMomGroup,
  sumHours,
  type A3Context,
  type Group,
  type MomGroup,
  type MomRow,
} from './a3-mttr-mtbf-context.js';
import type { Computer, FigureValue } from './types.js';

/**
 * A3, MTTR and MTBF (ticket 40, packet 40d): the platform's own page, whole — the two summary tables, the two
 * paired month-on-month matrices, the age-band summary, the machine table and the seven charts. The model holds
 * the four MTBF bases; this file prints them as the key does: Indian grouping, the key's own decimals, the dash
 * for a month with no entries, and the paired rows that print the label once and sit one column left.
 */

const DASH = '—';
const SUMMARY_HEADER = ['Machines', '# Breakdowns', 'BD Hours', 'MTTR (Hrs)', 'MTBF (Hrs)'];

const chartValue = (value: number): number => Math.round(value * 100) / 100;
const inr = (value: number, decimals: number): string => formatInr(value, decimals);

function summaryTable(
  title: string,
  firstHeader: string,
  groups: readonly Group[],
  label: (group: Group) => string,
) {
  const rows = groups.map((group) => [
    label(group),
    String(group.machines),
    String(group.count),
    inr(group.hours, 2),
    inr(mttrOf(group), 2),
    inr(mtbfOf(group), 2),
  ]);
  return { title, header: [firstHeader, ...SUMMARY_HEADER], rows, rowCount: rows.length };
}

function machineTable(ctx: A3Context) {
  const rows = ctx.machines
    .map((machine) => {
      const own = ctx.entries.filter((entry) => entry.machine.id === machine.id);
      const hours = sumHours(own);
      const count = own.length;
      return {
        machine,
        count,
        hours,
        available: availableHoursFor(machine, ctx.window),
      };
    })
    .sort((left, right) => right.hours - left.hours)
    .map(({ machine, count, hours, available }) => [
      machine.code,
      normalizeLabel(machine.category?.trim() ?? ''),
      cellKey(machine.cell),
      String(count),
      inr(hours, 2),
      inr(count > 0 ? hours / count : 0, 2),
      inr(count > 0 ? (available - hours) / count : available, 2),
    ]);
  return {
    title: 'By Individual Machine',
    header: [
      'Machine ID',
      'Category',
      'Cell',
      '# Breakdowns',
      'BD Hours',
      'MTTR (Hrs)',
      'MTBF (Hrs)',
    ],
    rows,
    rowCount: rows.length,
  };
}

const text = (value: number | null, decimals: number): string =>
  value === null ? DASH : inr(value, decimals);

/** A month's cell: a month the plant recorded nothing in says so, an empty one is the dash. */
const monthText = (value: number | null, month: PeriodMonth, decimals: number): string =>
  month.state === 'no-records' ? NO_RECORDS : text(value, decimals);

function quarterText(
  series: readonly (number | null)[],
  quarter: number,
  decimals: number,
): string {
  const value = quarterAverage(series.slice(quarter * 3, quarter * 3 + 3));
  return value === null ? DASH : inr(value, decimals);
}

/** The month column labels: `Jan` inside one year, `Jan 25` across years. */
const monthLabels = (ctx: A3Context): string[] =>
  ctx.months.map((month) => monthLabel(month, ctx.period));

/** `Q1 Avg` inside one year, `Q1 25 Avg` across years: a quarter never loses its year. */
const quarterLabels = (ctx: A3Context): string[] =>
  Array.from({ length: ctx.months.length / 3 }, (_, quarter) => {
    const year =
      ctx.months.length === 12
        ? ''
        : ` ${String(ctx.months[quarter * 3]!.year % 100).padStart(2, '0')}`;
    return `Q${(quarter % 4) + 1}${year} Avg`;
  });

/** The key's pair: MTTR on the labelled row, MTBF on the next row with no label, one column left. */
function momRows(rows: readonly MomRow[], months: readonly PeriodMonth[]): string[][] {
  const quarters = Array.from({ length: months.length / 3 }, (_, quarter) => quarter);
  return rows.flatMap((row) => [
    [
      row.label + 'MTTR / MTBF · ' + row.count + ' breakdowns',
      ...row.mttr.map((value, index) => monthText(value, months[index]!, 2)),
      ...quarters.map((quarter) => quarterText(row.mttr, quarter, 2)),
      text(row.totalMttr, 2),
    ],
    [
      ...row.mtbf.map((value, index) => monthText(value, months[index]!, 1)),
      ...quarters.map((quarter) => quarterText(row.mtbf, quarter, 1)),
      text(row.totalMtbf, 1),
    ],
  ]);
}

function momTable(title: string, firstHeader: string, rows: readonly MomRow[], ctx: A3Context) {
  const printed = momRows(rows, ctx.months);
  return {
    title,
    header: [
      firstHeader,
      ...monthLabels(ctx),
      ...quarterLabels(ctx),
      'Total ' + yearLabel(ctx.period),
    ],
    rows: printed,
    rowCount: printed.length,
  };
}

function barChart(id: string, labels: readonly string[], data: readonly number[], dataset: string) {
  return {
    id,
    type: 'bar',
    axes: { x: '', y: '' },
    tickLabels: { x: [], y: [] },
    labels,
    datasets: [{ label: dataset, data }],
  };
}

/** The platform's mixed chart: MTTR on the left axis, MTBF on the right (y1), its type left undefined. */
function plantTrend(group: MomGroup, ctx: A3Context) {
  const row = momRow(group, ctx.months);
  const plot = (series: readonly (number | null)[]) =>
    series.map((value) => (value === null ? null : chartValue(value)));
  return {
    id: 'ch-a3-planttrend',
    type: 'undefined',
    axes: { x: '', y: '', y1: '' },
    tickLabels: { x: [], y: [], y1: [] },
    labels: monthLabels(ctx),
    datasets: [
      { label: 'Plant MTTR (Hrs)', data: plot(row.mttr) },
      { label: 'Plant MTBF (Hrs)', data: plot(row.mtbf) },
    ],
  };
}

/** The seven charts; the plant trend runs over `trend`, every recorded year when the data-from date cut `ctx` (ADR 0063). */
function charts(ctx: A3Context, plant: MomGroup, trend: A3Context = ctx) {
  const categories = ctx.categoryGroups.map((group) => group.label);
  const cells = ctx.cellGroups.map((group) => cellName(group.label));
  const bands = ctx.ageGroups.map((group) => group.label);
  const series = (groups: readonly Group[]) => groups.map((group) => chartValue(mttrOf(group)));
  const between = (groups: readonly Group[]) => groups.map((group) => chartValue(mtbfOf(group)));
  return [
    barChart('ch-a3-catmttr', categories, series(ctx.categoryGroups), 'MTTR'),
    barChart('ch-a3-catmtbf', categories, between(ctx.categoryGroups), 'MTBF'),
    barChart('ch-a3-cellmttr', cells, series(ctx.cellGroups), 'MTTR'),
    barChart('ch-a3-cellmtbf', cells, between(ctx.cellGroups), 'MTBF'),
    barChart('ch-a3-agemttr', bands, series(ctx.ageGroups), 'MTTR'),
    barChart('ch-a3-agemtbf', bands, between(ctx.ageGroups), 'MTBF'),
    plantTrend(trend === ctx ? plant : plantMomGroup(trend), trend),
  ];
}

function a3Tables(ctx: A3Context, plant: MomGroup) {
  return [
    summaryTable('By Category', 'Category', ctx.categoryGroups, (group) =>
      normalizeLabel(group.label),
    ),
    summaryTable('By Cell', 'Cell', ctx.cellGroups, (group) => cellName(group.label)),
    momTable(
      'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide',
      'Cell',
      [...cellMomGroups(ctx), plant].map((group) => momRow(group, ctx.months)),
      ctx,
    ),
    momTable(
      'Month-on-Month MTTR & MTBF — Age Band-wise and Plant-wide',
      'Age Band',
      [...ageMomGroups(ctx), plant].map((group) => momRow(group, ctx.months)),
      ctx,
    ),
    summaryTable('By Machine Age Band', 'Age Band', ctx.ageGroups, (group) => group.label),
    machineTable(ctx),
  ];
}

/**
 * The A3 figure: the key's page shape, six tables and seven charts. An empty production fleet or no breakdown
 * rows has no page to print, so the figure is null rather than a fabricated zero. The drill names every
 * production breakdown ticket the figure read, in the order the rows were read.
 */
export const a3MttrMtbfFigure: Computer = ({ data, asOf, profile, history }) => {
  const annual = profile.prodHrsPerDay * profile.workDaysPerYear;
  const ctx = buildContext(data, asOf, annual);
  if (ctx.machines.length === 0 || ctx.entries.length === 0) return { value: null, drillIds: [] };
  const plant = plantMomGroup(ctx);
  const value = {
    screen: 'a3-mttr-mtbf',
    asOf,
    pages: [
      {
        page: 'a3',
        title: 'MTTR & MTBF',
        kpis: [],
        tables: a3Tables(ctx, plant),
        charts: charts(ctx, plant, history ? buildContext(history, asOf, annual) : ctx),
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: ctx.entries.map((entry) => entry.row.ticket.id),
  };
};
