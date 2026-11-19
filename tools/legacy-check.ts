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
/** The sheets' hours are typed by hand: an MTTR within 0.05 h is a named class of its own, never counted as equal. */
const HOURS_TOLERANCE = 0.05 + 1e-9;
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
  /** True when only the MTTR differs, by 0.05 h or less: the hand-rounded hours column. */
  withinRounding?: boolean;
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

const key = (machine: string, year: number, month: number | string): string =>
  `${machine} ${year}-${typeof month === 'number' ? String(month).padStart(2, '0') : month}`;

/** A header cell as a quarter, `Q-1` to `Q-4`, written `Q1` in a key. */
function quarterOf(cell: Cell | undefined): string | null {
  const match = /^Q-?\s*([1-4])\b/i.exec(text(cell));
  return match ? `Q${match[1]}` : null;
}
/** The months a period key covers, and the hours a plant machine has available in it. */
const monthsOf = (period: string): string[] =>
  /^\d\d$/.test(period)
    ? [period]
    : [1, 2, 3].map((i) => String((Number(period[1]) - 1) * 3 + i).padStart(2, '0'));
export const basisOf = (month: string): number =>
  month.includes('Q') ? 3 * HOURS_A_MONTH : HOURS_A_MONTH;

const text = (cell: Cell | undefined): string => (typeof cell === 'string' ? cell.trim() : '');
/** A header cell as text; a machine written as a bare number is a machine too. */
const label = (cell: Cell | undefined): string =>
  typeof cell === 'number' ? String(cell) : text(cell);
type MachineOf = (label: string) => string | null;
type Which = 'mttr' | 'mtbf';

/** One cell of a summary sheet into the summary; a blank, text or error value (`#DIV/0!`) reads as no figure. */
function put(summary: Summary, at: string, which: Which, value: Cell | undefined): void {
  const shown = summary.cells.get(at) ?? { mttr: null, mtbf: null };
  shown[which] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  summary.cells.set(at, shown);
}

/** A machine label of a sheet as the plant's code; a label that is no plant machine is counted once. */
function machineIn(summary: Summary, label: string, machineOf: MachineOf): string | null {
  const machine = machineOf(label);
  if (machine === null && !summary.notPlant.includes(label)) summary.notPlant.push(label);
  return machine;
}

/** The machine columns of a block header row: from the cell after `Machines` to the `Total` column. */
function blockColumns(line: readonly Cell[], from: number): number[] {
  const columns: number[] = [];
  for (let k = from; label(line[k]) !== '' && !/^total/i.test(label(line[k])); k++) columns.push(k);
  return columns;
}

/** The rows under a block header, by their label in the `Machines` column, up to the next block or a blank label. */
function blockRows(grid: readonly Cell[][], r: number, c: number): [number, Which][] {
  const rows: [number, Which][] = [];
  for (let i = r + 1; ; i++) {
    const label = text(grid[i]?.[c]);
    if (label === '' || label.toLowerCase() === 'machines') return rows;
    if (/^mttr/i.test(label)) rows.push([i, 'mttr']);
    else if (/^mtbf/i.test(label)) rows.push([i, 'mtbf']);
  }
}

/**
 * The real layout: one block per month, stacked down the sheet (or side by side). A `Machines` cell opens a block, the
 * month name sits just left of it or just above that, the machine codes run right of it, and the rows below are
 * labelled `MTTR` and `MTBF` (hours). A block with no month name (a quarter) is not read. Returns the blocks read.
 */
function parseBlocks(
  grid: readonly Cell[][],
  at: {
    year: number;
    machineOf: MachineOf;
    period: (cell: Cell | undefined) => number | string | null;
  },
  summary: Summary,
): number {
  const { year, machineOf, period } = at;
  let blocks = 0;
  grid.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (text(cell).toLowerCase() !== 'machines' || c === 0) return;
      const month = period(grid[r]?.[c - 1]) ?? period(grid[r - 1]?.[c - 1]);
      if (month === null) return;
      const columns = blockColumns(line, c + 1);
      if (columns.length === 0) {
        summary.unreadable++;
        return;
      }
      blocks++;
      const codes = columns.map((k): [number, string | null] => [
        k,
        machineIn(summary, label(line[k]), machineOf),
      ]);
      for (const [i, which] of blockRows(grid, r, c)) {
        for (const [k, machine] of codes) {
          if (machine !== null) put(summary, key(machine, year, month), which, grid[i]?.[k]);
        }
      }
    });
  });
  return blocks;
}

/** The first layout assumed: months across a header row, a machine down the first column. */
function parseAcross(
  grid: readonly Cell[][],
  which: Which,
  at: { year: number; machineOf: MachineOf },
  summary: Summary,
): void {
  const { year, machineOf } = at;
  const head = header(grid);
  if (!head) {
    summary.unreadable++;
    return;
  }
  for (const line of grid.slice(head.row + 1)) {
    const label = text(line[0]);
    const machine = label ? machineIn(summary, label, machineOf) : null;
    if (machine === null) continue;
    for (const [column, month] of head.months) {
      put(summary, key(machine, year, month), which, line[column]);
    }
  }
}

/**
 * Reads the MTTR and MTBF sheets of one workbook year. `machineOf` turns a row label into the plant's machine code,
 * or null when the label is not a plant machine.
 */
export function parseSummary(
  sheets: Readonly<Record<string, Cell[][]>>,
  year: number,
  machineOf: MachineOf,
): Summary {
  const summary: Summary = { cells: new Map(), notPlant: [], unreadable: 0 };
  for (const [name, grid] of Object.entries(sheets)) {
    const blocky = /MTTR|MTBF/i.test(name) && !/^Q-/i.test(name);
    if (blocky && parseBlocks(grid, { year, machineOf, period: monthOf }, summary) > 0) continue;
    const which = kind(name);
    if (which) parseAcross(grid, which, { year, machineOf }, summary);
  }
  if (summary.cells.size === 0) {
    // A workbook with no monthly blocks (one set keeps only quarters) is compared by quarter.
    for (const [name, grid] of Object.entries(sheets)) {
      if (/MTTR|MTBF/i.test(name))
        parseBlocks(grid, { year, machineOf, period: quarterOf }, summary);
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

const near = (a: number | null, b: number, tolerance = ROUNDING): boolean =>
  Math.abs((a ?? 0) - b) <= tolerance;

/** Whether the sheet's pair is what `loaded` gives: no breakdown reads blank, 0 or (MTBF only) the full month. */
export function agrees(
  sheet: Shown,
  loaded: Loaded,
  basis = HOURS_A_MONTH,
  hoursTolerance = ROUNDING,
): boolean {
  if (loaded.count === 0) {
    return near(sheet.mttr, 0, hoursTolerance) && (near(sheet.mtbf, 0) || near(sheet.mtbf, basis));
  }
  return (
    near(sheet.mttr, loaded.hours / loaded.count, hoursTolerance) &&
    near(sheet.mtbf, basis / loaded.count)
  );
}

export interface Comparison {
  /** Machine-months on the sheets. */
  compared: number;
  equal: number;
  different: Difference[];
}

/** What the load holds for a machine in a month (`YYYY-MM`) or a quarter (`YYYY-Q1`: its three months added). */
function loadedIn(loaded: ReadonlyMap<string, Loaded>, machine: string, month: string): Loaded {
  const [year = '', period = ''] = month.split('-');
  const parts = monthsOf(period).map((m) => loaded.get(`${machine} ${year}-${m}`));
  return {
    count: parts.reduce((n, p) => n + (p?.count ?? 0), 0),
    hours: parts.reduce((n, p) => n + (p?.hours ?? 0), 0),
  };
}

/** Every machine-month on the sheets, equal or named; `different` is the named list, in machine and month order. */
export function compare(summary: Summary, loaded: ReadonlyMap<string, Loaded>): Comparison {
  const different: Difference[] = [];
  const keys = [...summary.cells.keys()].sort();
  for (const at of keys) {
    const sheet = summary.cells.get(at) as Shown;
    const [machine = '', month = ''] = at.split(' ');
    const mine = loadedIn(loaded, machine, month);
    if (agrees(sheet, mine, basisOf(month))) continue;
    const withinRounding = agrees(sheet, mine, basisOf(month), HOURS_TOLERANCE);
    different.push({ machine, month, sheet, loaded: mine, withinRounding });
  }
  return { compared: keys.length, equal: keys.length - different.length, different };
}

const fixed = (value: number | null, digits: number): string =>
  value === null ? '-' : value.toFixed(digits);

/** One named pair: the sheet's two figures beside the loaded count, hours, MTTR, MTBF and availability. */
export function formatDifference(d: Difference): string {
  const { count, hours } = d.loaded;
  const mttr = count === 0 ? null : hours / count;
  const basis = basisOf(d.month);
  const mtbf = count === 0 ? basis : basis / count;
  return (
    `${d.machine} ${d.month}: sheet MTTR ${fixed(d.sheet.mttr, 2)} MTBF ${fixed(d.sheet.mtbf, 2)}` +
    ` | loaded ${count} / ${fixed(hours, 2)} h / MTTR ${fixed(mttr, 2)} / MTBF ${fixed(mtbf, 2)}` +
    ` / availability ${(1 - hours / basis).toFixed(5)}`
  );
}
