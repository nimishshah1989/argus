/**
 * Legacy maintenance workbooks (2022-2025), step one: a sheet grid becomes plain rows.
 *
 * Pure: it takes the cells a reader returned and nothing else, so it needs no file and no database. Machine
 * sheets are found by their header (`SR.NO` and `PROBLEM`), never by name; every column is found by its
 * flattened header text; a date is an Excel serial or a `DD.MM.YYYY` text, or it is blank (a template row,
 * not read) or bad. Nothing here decides what a row becomes: that is `legacy-classify.ts`.
 */
export type Cell = string | number | null;

export interface LegacyRow {
  /** The workbook's own year; the row's date may belong to another year. */
  year: number;
  /** The sheet's machine code after the spelling fold (R3), before any switch. */
  machine: string;
  excelRow: number;
  /** `YYYY-MM-DD`, or `null` when the cell is not a readable date. */
  date: string | null;
  shift: string;
  problem: string;
  observedBy: string;
  correctiveAction: string;
  doneBy: string;
  minutes: number;
  blankMinutes: boolean;
  code: string;
  elecMech: string;
  pmHours: number;
  utiHours: number;
  /** The log's own hours column (typed by hand), or `null` when the sheet has none: the summary sheets read it. */
  hours: number | null;
}

export interface SheetRead {
  machine: string;
  rows: LegacyRow[];
  /** The count printed beside the sheet: rows whose date cell is not blank. */
  dated: number;
}

const flatten = (cell: Cell | undefined): string =>
  String(cell ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const text = (cell: Cell | undefined): string =>
  cell === null || cell === undefined ? '' : String(cell).replace(/\s+/gu, ' ').trim();

/** One fold table for the plant's spelling variants (R3). `known` picks the plant's own zero padding. */
export function foldMachine(sheet: string, known: ReadonlySet<string>): string {
  const base = sheet
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/_.*$/, '')
    .replace(/^VL-/, 'VTL-')
    .replace(/^STAR[- ]?0*(\d)$/, 'STAR-$1');
  const unpadded = base.replace(/-0+(\d)/, '-$1');
  const padded = base.replace(/-(\d)$/, '-0$1');
  for (const candidate of [base, unpadded, padded, `${base}-01`]) {
    if (known.has(candidate)) return candidate;
  }
  return unpadded;
}

/** An Excel serial (epoch 1899-12-30) or `DD.MM.YYYY` / `DD-MM-YYYY` / `DD/MM/YYYY`; `'blank'` or `'bad'` else. */
export function parseDate(cell: Cell | undefined): string | 'blank' | 'bad' {
  if (cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '')) {
    return 'blank';
  }
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || cell < 20_000 || cell > 80_000) return 'bad';
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  const match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(cell.trim());
  if (!match) return 'bad';
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const moment = new Date(Date.UTC(year, month - 1, day));
  const valid = moment.getUTCMonth() === month - 1 && moment.getUTCDate() === day;
  return valid ? moment.toISOString().slice(0, 10) : 'bad';
}

function number(cell: Cell | undefined): number {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : 0;
  const value = typeof cell === 'string' && /^-?\d+(\.\d+)?$/.test(cell.trim()) ? Number(cell) : 0;
  return Number.isFinite(value) ? value : 0;
}

interface Columns {
  header: number;
  date: number;
  shift: number;
  problem: number;
  observedBy: number;
  correctiveAction: number;
  doneBy: number;
  minutes: number;
  hours: number;
  code: number;
  elecMech: number;
  pm: number;
  uti: number;
}

/** The header row (within rows 1-10) and its columns, or `null` for a summary sheet. */
export function findColumns(grid: readonly Cell[][]): Columns | null {
  for (let header = 0; header < Math.min(10, grid.length); header++) {
    const names = (grid[header] ?? []).map(flatten);
    const sr = names.indexOf('SRNO');
    if (sr < 0 || !names.some((name) => name.startsWith('PROBLEM'))) continue;
    const at = (test: (name: string) => boolean) => names.findIndex(test);
    return {
      header,
      date: sr + 1,
      shift: at((n) => n === 'SHIFT'),
      problem: at((n) => n.startsWith('PROBLEM')),
      observedBy: at((n) => n === 'OBSERVEDBY'),
      correctiveAction: at((n) => n === 'CORRECTIVEACTION'),
      doneBy: at((n) => n === 'DONEBY'),
      minutes: at((n) => /^(TOTAL)?DOWNTIMEINMIN$/.test(n)),
      hours: at((n) => /^(TOTAL)?DOWNTIMEINHR$/.test(n)),
      code: at((n) => n === 'MAINTCODE'),
      elecMech: at((n) => n === 'ELECTMECH'),
      pm: at((n) => n === 'PM' || n === 'PMMCACCIDENT'),
      uti: at((n) => n === 'UTI' || n === 'UTIACCIDENT'),
    };
  }
  return null;
}

function rowOf(cells: readonly Cell[], cols: Columns, base: Omit<LegacyRow, 'date'>): LegacyRow {
  const pick = (index: number) => (index < 0 ? undefined : cells[index]);
  const parsed = parseDate(cells[cols.date]);
  const minutes = Math.min(1_000_000, Math.max(0, Math.round(number(pick(cols.minutes)))));
  return {
    ...base,
    date: parsed === 'blank' || parsed === 'bad' ? null : parsed,
    shift: text(pick(cols.shift)).toUpperCase(),
    problem: text(pick(cols.problem)),
    observedBy: text(pick(cols.observedBy)),
    correctiveAction: text(pick(cols.correctiveAction)),
    doneBy: text(pick(cols.doneBy)),
    minutes,
    blankMinutes: !/^-?\d+(\.\d+)?$/.test(text(pick(cols.minutes))),
    code: text(pick(cols.code)).toUpperCase(),
    elecMech: text(pick(cols.elecMech)).toUpperCase(),
    pmHours: Math.max(0, number(pick(cols.pm))),
    utiHours: Math.max(0, number(pick(cols.uti))),
    hours: cols.hours < 0 || text(pick(cols.hours)) === '' ? null : number(pick(cols.hours)),
  };
}

/** Every row with a date cell (even an unreadable one: its `date` is `null`); a blank date is a template row. */
export function readSheet(
  year: number,
  sheet: string,
  grid: readonly Cell[][],
  known: ReadonlySet<string>,
): SheetRead | null {
  const cols = findColumns(grid);
  if (!cols) return null;
  const machine = foldMachine(sheet, known);
  const rows: LegacyRow[] = [];
  let dated = 0;
  for (let at = cols.header + 1; at < grid.length; at++) {
    const cells = grid[at];
    if (!cells) continue;
    const blankDate = parseDate(cells[cols.date]) === 'blank';
    // A blank date is a template row, unless it carries a problem or minutes: then a person must look (ticket 623).
    const carries =
      text(cells[cols.problem]) !== '' || (cols.minutes >= 0 && text(cells[cols.minutes]) !== '');
    if (blankDate && !carries) continue;
    if (!blankDate) dated++;
    const base = { year, machine, excelRow: at + 1 } as Omit<LegacyRow, 'date'>;
    rows.push(rowOf(cells, cols, base));
  }
  return { machine, rows, dated };
}
