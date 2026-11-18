import { formatNumber } from './format.js';
import {
  DASH,
  MONTH_NAMES,
  boughtOn,
  categoriesOf,
  categoryOf,
  countDelta,
  countText,
  hoursText,
  previousText,
  productionMachines,
  shareText,
  teamHoursDelta,
  type MonthPeriod,
  type ReportStats,
} from './report-period.js';
import { effectiveHours } from './rows.js';
import type { EngineData } from './types.js';

/**
 * The monthly report's two secondary tables (ticket 45, packet 45a): the maintenance team and the machines added.
 * They live beside `monthly-report.ts` because the hard 400-line rail could not hold the whole page and its eight
 * tables in one file; the figure still builds the page and keeps the key's order.
 */

/** One printed table: the key's title, header, cells and row count. */
export interface Table {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

/** The report's table builder, shared by the page's tables. */
export const tableOf = (title: string, header: string[], rows: string[][]): Table => ({
  title,
  header,
  rows,
  rowCount: rows.length,
});

interface TeamLine {
  name: string;
  attended: number;
  before: number;
  hours: number;
  beforeHours: number;
  supported: number;
  pm: number;
}

/** The Settings team list's rows: anyone with an attended, supported or PM job this month or last month. */
function teamLines(data: EngineData, current: ReportStats, previous: ReportStats): TeamLine[] {
  const names = new Map(data.people.map((person) => [person.code, person.displayName]));
  const codes =
    data.settings?.teamCodes ??
    data.people.filter((person) => person.team === 'maintenance').map((person) => person.code);
  return codes
    .map((code): TeamLine => {
      const attended = current.breakdowns.filter((row) => row.report.doneBy.includes(code));
      const before = previous.breakdowns.filter((row) => row.report.doneBy.includes(code));
      return {
        name: names.get(code) ?? code,
        attended: attended.length,
        before: before.length,
        hours: attended.reduce((total, row) => total + effectiveHours(row.report), 0),
        beforeHours: before.reduce((total, row) => total + effectiveHours(row.report), 0),
        supported: current.breakdowns.filter((row) => row.report.supportedBy.includes(code)).length,
        pm: current.pm.filter((row) => row.report.doneBy.includes(code)).length,
      };
    })
    .filter((line) => line.attended > 0 || line.before > 0 || line.supported > 0 || line.pm > 0)
    .sort((left, right) => right.attended - left.attended || right.hours - left.hours);
}

/** The two pieces the team table needs beyond its stats: the comparison month and whether it exists. */
interface TeamOptions {
  period: MonthPeriod;
  hasPrev: boolean;
}

/** The maintenance team table, the comparison month named in its own header. */
export function teamTable(
  data: EngineData,
  current: ReportStats,
  previous: ReportStats,
  options: TeamOptions,
): Table {
  const { period, hasPrev } = options;
  const rows = teamLines(data, current, previous).map((line) => [
    line.name,
    String(line.attended),
    previousText(String(line.before), hasPrev),
    countDelta(line.attended, line.before, hasPrev),
    hoursText(line.hours),
    previousText(hoursText(line.beforeHours), hasPrev),
    teamHoursDelta(line.hours, line.beforeHours, hasPrev),
    line.attended > 0 ? formatNumber(line.hours / line.attended, 2) : DASH,
    String(line.supported),
    String(line.pm),
    shareText(line.attended, current.count),
  ]);
  return tableOf(
    'Maintenance team',
    [
      'Name',
      'Breakdowns attended',
      MONTH_NAMES[period.previous.month - 1]!,
      'Change',
      'Hours',
      'Prev. hrs',
      'Change',
      'Avg repair (hrs)',
      'Supported',
      'PM visits',
      'Share',
    ],
    rows,
  );
}

interface AddedLine {
  category: string;
  start: number;
  added: number;
  addedPrev: number;
  end: number;
}

/** One row per category that had a machine added in either month or has a fleet at the end. */
function addedLines(data: EngineData, period: MonthPeriod): AddedLine[] {
  const machines = productionMachines(data);
  const lines = new Map<string, AddedLine>(
    categoriesOf(machines).map((category) => [
      category,
      { category, start: 0, added: 0, addedPrev: 0, end: 0 },
    ]),
  );
  for (const machine of machines) {
    const bought = boughtOn(machine);
    if (bought === null) continue;
    const line = lines.get(categoryOf(machine));
    if (line === undefined) continue;
    if (bought < period.current.start) line.start += 1;
    if (bought <= period.current.end) line.end += 1;
    if (bought >= period.current.start && bought <= period.current.end) line.added += 1;
    if (bought >= period.previous.start && bought <= period.previous.end) line.addedPrev += 1;
  }
  return [...lines.values()].filter((line) => line.added > 0 || line.addedPrev > 0 || line.end > 0);
}

/** The machines added table, then its total row. */
export function addedTable(data: EngineData, period: MonthPeriod, hasPrev: boolean): Table {
  const lines = addedLines(data, period);
  const rows = lines.map((line) => [
    line.category,
    countText(line.start),
    countText(line.added),
    previousText(countText(line.addedPrev), hasPrev),
    countDelta(line.added, line.addedPrev, hasPrev),
    countText(line.end),
  ]);
  const total = lines.reduce(
    (sum, line) => ({
      start: sum.start + line.start,
      added: sum.added + line.added,
      addedPrev: sum.addedPrev + line.addedPrev,
      end: sum.end + line.end,
    }),
    { start: 0, added: 0, addedPrev: 0, end: 0 },
  );
  rows.push([
    'Total CNC machines',
    countText(total.start),
    countText(total.added),
    previousText(countText(total.addedPrev), hasPrev),
    countDelta(total.added, total.addedPrev, hasPrev),
    countText(total.end),
  ]);
  return tableOf(
    'Machines added',
    [
      'Category',
      'Fleet at start',
      'Added this period',
      `Added ${MONTH_NAMES[period.previous.month - 1]!}`,
      'Change',
      'Fleet at end',
    ],
    rows,
  );
}
