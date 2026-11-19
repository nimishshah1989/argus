import type { EngineData } from '../packages/domain/src/index.js';
import type { Cell } from '../apps/server/src/seed/legacy-sheets.js';

/**
 * Ticket 69c, goal 5: a workbook's own MTTR and MTBF sheets set against what the loaded database says, per machine
 * and month. A summary sheet is a table: months across one header row, a machine in the first column, the figure
 * (hours) in the cells. The rule is the sheets' own (R7): a breakdown is a non-PM row with minutes, a month has 500
 * hours, MTTR = hours / count, MTBF = 500 / count, availability = 1 - hours / 500. Counts, hours and machine codes
 * only. A layout this cannot read is reported as unreadable, never guessed.
 */
export const HOURS_A_MONTH = 500;
const ROUNDING = 0.005 + 1e-9;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface Shown {
  mttr: number | null;
  mtbf: number | null;
}
export interface Loaded {
  count: number;
  hours: number;
}
export interface Difference {
  machine: string;
  month: string;
  sheet: Shown;
  loaded: Loaded;
}
export interface Summary {
  /** `<machine> <YYYY-MM>` to what the two sheets show. */
  cells: Map<string, Shown>;
  /** Machine labels on a sheet that are not a plant machine, counted once each. */
  notPlant: string[];
  /** Summary sheets with no month header row: counted, never guessed at. */
  unreadable: number;
}

const kind = (name: string): 'mttr' | 'mtbf' | null => {
  const mttr = /MTTR/i.test(name);
  const mtbf = /MTBF/i.test(name);
  return mttr === mtbf ? null : mttr ? 'mttr' : 'mtbf';
};

/** A header cell as a month number: `Jan`, `JAN-22`, `January 2022`, or a date serial. */
function monthOf(cell: Cell | undefined): number | null {
  if (typeof cell === 'number') {
    if (cell < 36_000 || cell > 80_000) return null;
    return new Date(Date.UTC(1899, 11, 30) + cell * 86_400_000).getUTCMonth() + 1;
  }
  const index = MONTHS.indexOf(
    String(cell ?? '')
      .trim()
      .slice(0, 3)
      .toUpperCase(),
  );
  return index < 0 || !/^[A-Za-z]{3,9}\b/.test(String(cell).trim()) ? null : index + 1;
}

/** The header row (three or more month cells) and its month columns, or null. */
function header(grid: readonly Cell[][]): { row: number; months: Map<number, number> } | null {
  for (let row = 0; row < Math.min(grid.length, 30); row++) {
    const months = new Map<number, number>();
    (grid[row] ?? []).forEach((cell, column) => {
      const month = monthOf(cell);
      if (month !== null) months.set(column, month);
    });
    if (months.size >= 3) return { row, months };
  }
  return null;
}

const key = (machine: string, year: number, month: number): string =>
  `${machine} ${year}-${String(month).padStart(2, '0')}`;

/**
 * Reads the MTTR and MTBF sheets of one workbook year. `machineOf` turns a row label into the plant's machine code,
 * or null when the label is not a plant machine.
 */
export function parseSummary(
  sheets: Readonly<Record<string, Cell[][]>>,
  year: number,
  machineOf: (label: string) => string | null,
): Summary {
  const summary: Summary = { cells: new Map(), notPlant: [], unreadable: 0 };
  for (const [name, grid] of Object.entries(sheets)) {
    const which = kind(name);
    if (!which) continue;
    const head = header(grid);
    if (!head) {
      summary.unreadable++;
      continue;
    }
    for (const line of grid.slice(head.row + 1)) {
      const label = typeof line[0] === 'string' ? line[0].trim() : '';
      if (!label) continue;
      const machine = machineOf(label);
      if (machine === null) {
        if (!summary.notPlant.includes(label)) summary.notPlant.push(label);
        continue;
      }
      for (const [column, month] of head.months) {
        const value = line[column];
        const at = key(machine, year, month);
        const shown = summary.cells.get(at) ?? { mttr: null, mtbf: null };
        shown[which] = typeof value === 'number' ? value : null;
        summary.cells.set(at, shown);
      }
    }
  }
  return summary;
}

/** Breakdowns and hours per machine and month from the loaded plant: non-PM reports with downtime (R7). */
export function loadedFigures(
  data: EngineData,
  /** Only the reports the named workbook holds: its tickets by id and the year it is. */
  workbook?: { year: number; yearOf: ReadonlyMap<string, number> },
): Map<string, Loaded> {
  const code = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const minutes = new Map<string, { count: number; min: number }>();
  for (const report of data.reports) {
    const machine = code.get(report.machineId);
    if (!machine || report.maintCode === 'PM' || !(report.downtimeMin > 0)) continue;
    if (workbook && workbook.yearOf.get(report.ticketId ?? '') !== workbook.year) continue;
    const at = key(machine, Number(report.date.slice(0, 4)), Number(report.date.slice(5, 7)));
    const was = minutes.get(at) ?? { count: 0, min: 0 };
    minutes.set(at, { count: was.count + 1, min: was.min + report.downtimeMin });
  }
  return new Map([...minutes].map(([at, m]) => [at, { count: m.count, hours: m.min / 60 }]));
}

const near = (a: number | null, b: number): boolean => Math.abs((a ?? 0) - b) <= ROUNDING;

/** Whether the sheet's pair is what `loaded` gives: no breakdown reads blank, 0 or (MTBF only) the full month. */
export function agrees(sheet: Shown, loaded: Loaded): boolean {
  if (loaded.count === 0) {
    return near(sheet.mttr, 0) && (near(sheet.mtbf, 0) || near(sheet.mtbf, HOURS_A_MONTH));
  }
  return (
    near(sheet.mttr, loaded.hours / loaded.count) && near(sheet.mtbf, HOURS_A_MONTH / loaded.count)
  );
}

export interface Comparison {
  /** Machine-months on the sheets. */
  compared: number;
  equal: number;
  different: Difference[];
}

/** Every machine-month on the sheets, equal or named; `different` is the named list, in machine and month order. */
export function compare(summary: Summary, loaded: ReadonlyMap<string, Loaded>): Comparison {
  const different: Difference[] = [];
  const keys = [...summary.cells.keys()].sort();
  for (const at of keys) {
    const sheet = summary.cells.get(at) as Shown;
    const mine = loaded.get(at) ?? { count: 0, hours: 0 };
    if (agrees(sheet, mine)) continue;
    const [machine = '', month = ''] = at.split(' ');
    different.push({ machine, month, sheet, loaded: mine });
  }
  return { compared: keys.length, equal: keys.length - different.length, different };
}

const fixed = (value: number | null, digits: number): string =>
  value === null ? '-' : value.toFixed(digits);

/** One named pair: the sheet's two figures beside the loaded count, hours, MTTR, MTBF and availability. */
export function formatDifference(d: Difference): string {
  const { count, hours } = d.loaded;
  const mttr = count === 0 ? null : hours / count;
  const mtbf = count === 0 ? HOURS_A_MONTH : HOURS_A_MONTH / count;
  return (
    `${d.machine} ${d.month}: sheet MTTR ${fixed(d.sheet.mttr, 2)} MTBF ${fixed(d.sheet.mtbf, 2)}` +
    ` | loaded ${count} / ${fixed(hours, 2)} h / MTTR ${fixed(mttr, 2)} / MTBF ${fixed(mtbf, 2)}` +
    ` / availability ${(1 - hours / HOURS_A_MONTH).toFixed(5)}`
  );
}
