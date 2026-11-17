import { readFileSync } from 'node:fs';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type EngineResult, type FigureResult } from '../src/index.js';
import { availabilityWindow } from '../src/analytics/availability.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { formatInr, formatNumber } from '../src/analytics/format.js';
import {
  availableByCell,
  availableHoursFor,
  cellAt,
  cellFrac,
  monthlyWindow,
  quarterAverage,
  type DateWindow,
  type HoursWindow,
} from '../src/analytics/hours.js';
import {
  effectiveHours,
  isHistory,
  isNoDowntime,
  isPm,
  sourcedReports,
} from '../src/analytics/rows.js';
import {
  A1,
  A2,
  A3,
  BREAKDOWN_LOG,
  ENGINE_DATA,
  kpiByLabel,
  type FigureKey,
  type KeyTable,
} from './answer-key/fixture.js';
import type { Workbook, WorkbookBreakdown } from './answer-key/workbook.js';

/**
 * The shared seam the four breakdown figures build on (packet 40h), checked against the platform's own 11
 * November workbook: the days-so-far available hours, the cell a machine was in at the time, the quarter rule
 * and the Indian grouping. No figure is computed here; each helper is proven on the key's own numbers.
 */

const AS_OF = '2026-11-11';
/** The profile's annual hours per machine: 20 production hours a day times 300 working days. */
const ANNUAL = DEFAULT_PROFILE.prodHrsPerDay * DEFAULT_PROFILE.workDaysPerYear;
/** The days-so-far window: 1 January of the data year to the run date. */
const WINDOW: HoursWindow = { ...availabilityWindow(AS_OF, AS_OF), annualHours: ANNUAL };
/** The machines the plant counts in production data: CNC, never the Robot or a Settings exclusion. */
const PRODUCTION = ENGINE_DATA.machines.filter(
  (machine) => machine.segment === 'CNC' && !machine.excludedFromProduction,
);

function hoursIn(window: HoursWindow): number {
  return PRODUCTION.reduce((sum, machine) => sum + availableHoursFor(machine, window), 0);
}

function kpiValue(key: FigureKey, label: string): string {
  for (const page of key.pages) {
    const found = page.kpis.find((kpi) => kpi.label === label);
    if (found) return found.value;
  }
  throw new Error(`the ${key.screen} key holds no KPI labelled "${label}"`);
}

function tableFor(key: FigureKey, title: string): KeyTable {
  for (const page of key.pages) {
    const found = page.tables.find((table) => table.title.includes(title));
    if (found) return found;
  }
  throw new Error(`the ${key.screen} key holds no table titled "${title}"`);
}

function tableRow(key: FigureKey, title: string, label: string): string[] {
  const row = tableFor(key, title).rows.find((candidate) => candidate[0] === label);
  if (!row) throw new Error(`the ${key.screen} ${title} table holds no row "${label}"`);
  return row;
}

describe('the four breakdown keys', () => {
  it('reads each figure from its own file on the key date', () => {
    expect([A1.screen, A2.screen, A3.screen, BREAKDOWN_LOG.screen]).toEqual([
      'a1-bd-pm',
      'a2-category-cell',
      'a3-mttr-mtbf',
      'breakdown-log',
    ]);
    expect([A1.asOf, A2.asOf, A3.asOf, BREAKDOWN_LOG.asOf]).toEqual([AS_OF, AS_OF, AS_OF, AS_OF]);
    expect(A1.pages[0]!.kpis).toHaveLength(6);
    expect(A2.pages[0]!.tables).toHaveLength(16);
    expect(A3.pages[0]!.charts).toHaveLength(7);
    expect(BREAKDOWN_LOG.pages[0]!.tables[0]!.rowCount).toBe(1343);
  });

  it('keeps the workbook coded doneBy name for the log to print', () => {
    const names = new Map(ENGINE_DATA.people.map((person) => [person.code, person.displayName]));
    expect(names.get('person-41')).toBe('Person 41');
    expect(names.get('maint-team')).toBe('Maint. Team');
    const firstRow = BREAKDOWN_LOG.pages[0]!.tables[0]!.rows[0]!;
    expect(firstRow[7]).toBe(names.get('person-41'));
  });
});

describe('the available-hours basis', () => {
  it("sums the plant to the key's 5,65,692.47 hours on 11 November", () => {
    expect(PRODUCTION).toHaveLength(125);
    expect(WINDOW).toEqual({ from: '2026-01-01', to: AS_OF, annualHours: ANNUAL });
    const total = hoursIn(WINDOW);
    expect(formatInr(total, 2)).toBe('5,65,692.47');
    expect(formatInr(total, 2)).toBe(kpiValue(A1, 'Total Available Hrs'));
    expect(kpiValue(A1, 'Total Machines')).toBe('125');
  });

  it('counts one month from its own window, cut at the run date', () => {
    const january = { ...monthlyWindow(AS_OF, 1), annualHours: ANNUAL };
    expect(january).toEqual({ from: '2026-01-01', to: '2026-01-31', annualHours: ANNUAL });
    expect(formatInr(hoursIn(january), 2)).toBe('50,548.39');

    const november = { ...monthlyWindow(AS_OF, 11), annualHours: ANNUAL };
    expect(november).toEqual({ from: '2026-11-01', to: AS_OF, annualHours: ANNUAL });

    const december = { ...monthlyWindow(AS_OF, 12), annualHours: ANNUAL };
    expect(hoursIn(december)).toBe(0);
  });

  it('counts a machine from its purchase date, not from the window start', () => {
    const later = PRODUCTION.filter(
      (machine) => machine.purchasedOn !== null && machine.purchasedOn > WINDOW.from,
    );
    expect(later.length).toBeGreaterThan(0);
    const machine = later[0]!;
    const ownWindow: HoursWindow = { ...WINDOW, from: machine.purchasedOn! };
    expect(availableHoursFor(machine, WINDOW)).toBe(availableHoursFor(machine, ownWindow));
  });
});

describe('the cell a machine was in', () => {
  it("weights Cell 1 by the days each machine was in it, against the key's 36,272.45", () => {
    const cell1 = availableByCell(PRODUCTION, ENGINE_DATA.moves, WINDOW, '1');
    expect(formatInr(cell1, 2)).toBe('36,272.45');
    expect(formatInr(cell1, 2)).toBe(tableRow(A1, 'By Cell', 'Cell 1')[2]);

    const naive = PRODUCTION.filter((machine) => machine.cell === '1').reduce(
      (sum, machine) => sum + availableHoursFor(machine, WINDOW),
      0,
    );
    expect(formatInr(naive, 2)).toBe('32,751.08');
    expect(naive).not.toBe(cell1);
    expect(formatInr(naive, 2)).not.toBe(formatInr(cell1, 2));
  });

  it('walks the move log from its first fromCell, not from the machine column', () => {
    const tmc2 = PRODUCTION.find((machine) => machine.id === 'TMC-2')!;
    expect(cellAt(tmc2, ENGINE_DATA.moves, '2026-08-02')).toBe('1');
    expect(cellAt(tmc2, ENGINE_DATA.moves, '2026-08-03')).toBe('2');
    expect(cellAt(tmc2, ENGINE_DATA.moves, '2026-01-01')).toBe('1');

    const neverMoved = PRODUCTION.find(
      (machine) =>
        machine.id === 'TC-16' && !ENGINE_DATA.moves.some((move) => move.machineId === machine.id),
    )!;
    expect(cellAt(neverMoved, ENGINE_DATA.moves, AS_OF)).toBe(neverMoved.cell);

    const window: DateWindow = { from: WINDOW.from, to: WINDOW.to };
    expect(cellFrac(tmc2, ENGINE_DATA.moves, window, '1')).toBe(214 / 315);
    expect(cellFrac(tmc2, ENGINE_DATA.moves, window, '2')).toBe(101 / 315);
    expect(cellFrac(neverMoved, ENGINE_DATA.moves, window, '1')).toBe(1);
  });
});

describe('the quarter rule', () => {
  it('averages the unrounded months, so the printed page is never the source', () => {
    const table = tableFor(A3, 'Cell-wise');
    const mtbf = table.rows[1]!;
    // The second row of a pair prints no label, so its cells sit one column left of the header's.
    const july = table.header.indexOf('Jul') - 1;
    const months = [july, july + 1, july + 2].map((index) =>
      Number(mtbf[index]!.replace(/,/g, '')),
    );
    expect(months).toEqual([697.5, 490.4, 316.5]);

    const printedPage = formatNumber(quarterAverage(months)!, 1);
    expect(printedPage).toBe('501.5');
    const keyQ3 = mtbf[table.header.indexOf('Q3 Avg') - 1];
    expect(keyQ3).toBe('501.4');
    expect(printedPage).not.toBe(keyQ3);
  });

  it('skips a month with no entries instead of counting it as zero', () => {
    const table = tableFor(A1, 'Month-on-Month');
    const row = table.rows.find((candidate) => candidate[0] === 'Cell 1BD % / PM %')!;
    const months = ['Oct', 'Nov', 'Dec'].map((month) => {
      const value = row[table.header.indexOf(month)]!;
      return value === '—' ? null : Number(value.replace('%', ''));
    });
    expect(months).toEqual([0.08, 0.82, null]);
    expect(`${formatNumber(quarterAverage(months)!, 2)}%`).toBe(
      row[table.header.indexOf('Q4 Avg')],
    );
    expect(quarterAverage([null, null, null])).toBeNull();
  });
});

describe('the Indian grouping', () => {
  it('groups a figure in lakhs and crores, not thousands', () => {
    expect(formatInr(565692.47, 2)).toBe('5,65,692.47');
    expect(formatInr(121284.81, 2)).toBe('1,21,284.81');
    expect(formatInr(4525.54, 2)).toBe('4,525.54');
    expect(formatInr(96732.3, 1)).toBe('96,732.3');
    expect(formatInr(123456789.5, 2)).toBe('12,34,56,789.50');
    expect(formatInr(-565692.47, 2)).toBe('-5,65,692.47');
    expect(formatInr(565692.47, 0)).toBe('5,65,692');
  });

  it('leaves the thousands grouping beside it unchanged', () => {
    expect(formatNumber(565692.47, 2)).toBe('565,692.47');
    expect(formatNumber(4525.54, 2)).toBe('4,525.54');
  });
});

describe('the effective hours', () => {
  it('counts a NO DT entry as a breakdown of zero hours', () => {
    const rows = sourcedReports(ENGINE_DATA);
    const noDt = rows.filter(isNoDowntime);
    expect(noDt.length).toBeGreaterThan(0);
    expect(noDt.every((row) => !isPm(row))).toBe(true);
    expect(noDt.every((row) => effectiveHours(row.report) === 0)).toBe(true);
    expect(noDt.some((row) => (row.report.recordedHours ?? 0) > 0)).toBe(true);
  });

  it('keeps the recorded hours, never the minutes', () => {
    const rows = sourcedReports(ENGINE_DATA);
    const disagreed = rows.find((row) => {
      const recorded = row.report.recordedHours;
      return (
        recorded !== null &&
        recorded !== undefined &&
        Math.abs(recorded - row.report.downtimeMin / 60) > 0.01
      );
    });
    expect(disagreed).toBeDefined();
    expect(effectiveHours(disagreed!.report)).toBe(disagreed!.report.recordedHours);
  });

  it("keeps a PM row's hours for the log while the analyses leave it out", () => {
    const rows = sourcedReports(ENGINE_DATA);
    const pm = rows.filter(isPm).find((row) => (row.report.recordedHours ?? 0) > 0)!;
    expect(effectiveHours(pm.report)).toBe(pm.report.recordedHours);
  });
});

/**
 * The Breakdown Log figure (packet 40a): the platform's whole history log, PM rows included, newest first by its
 * stable Sr No. The key pins the page shape, the three newest rows and the count; the workbook below pins the rest
 * (the order, the ticket numbers, the names, the hours and the totals) so no expected number is a constant here.
 */

interface LogTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
  truncated?: boolean;
}
interface LogPage {
  page: string;
  title: string;
  kpis: unknown[];
  tables: LogTable[];
  charts: unknown[];
}
interface LogValue {
  screen: string;
  asOf: string;
  pages: LogPage[];
}

/** The 11 November workbook, read here too so the log's rows are checked against their source, not the key. */
const INPUT = JSON.parse(
  readFileSync(new URL('../../../fixtures/answer-key/input.json', import.meta.url), 'utf8'),
) as Workbook;
const HISTORY = INPUT.breakdowns;

/** The workbook's own Sr No: the permanent log number the platform prints. */
function srNo(row: WorkbookBreakdown): number {
  if (row.srNo === undefined) throw new Error(`the workbook row ${row.id} carries no Sr No`);
  return row.srNo;
}

/** The log's order as the workbook pins it: newest Sr No first. */
const NEWEST = [...HISTORY].sort((left, right) => srNo(right) - srNo(left));

/** The platform's own hours for a workbook row: the recorded column, minutes otherwise, zero for NO DT. */
const recorded = (row: WorkbookBreakdown): number =>
  row.maintCode === 'NO DT' ? 0 : (row.downHrs ?? (row.downMin ?? 0) / 60);

const TOTAL_HOURS = HISTORY.reduce((sum, row) => sum + recorded(row), 0);
const NO_DT_HOURS = HISTORY.filter((row) => row.maintCode === 'NO DT').reduce(
  (sum, row) => sum + (row.downHrs ?? 0),
  0,
);
/** The dashboard's Total Downtime: every non-PM row, NO DT being zero hours. */
const BD_HOURS = HISTORY.filter((row) => row.maintCode !== 'PM').reduce(
  (sum, row) => sum + recorded(row),
  0,
);

const RESULT: EngineResult = runWith(COMPUTERS, {
  data: ENGINE_DATA,
  asOf: AS_OF,
  profile: DEFAULT_PROFILE,
});

function figure(key: string): FigureResult {
  const found = RESULT.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`the engine knows no figure ${key}`);
  return found;
}

function valueOf<T>(key: string): T {
  const found = figure(key);
  if (found.status !== 'ready') throw new Error(`the figure ${key} is ${found.status}`);
  return found.value as unknown as T;
}

/** Done By as the plant printed it: the coded names behind the report, in the row's own order. */
function displayDoneBy(row: WorkbookBreakdown): string {
  const names = (row.doneBy ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  if (names.length === 0) return '—';
  return names
    .map((name) => {
      const person = ENGINE_DATA.people.find((candidate) => candidate.displayName === name);
      if (!person) throw new Error(`the fixture holds no person named "${name}"`);
      return person.displayName;
    })
    .join(', ');
}

const logTable = (): LogTable => valueOf<LogValue>('breakdown-log').pages[0]!.tables[0]!;

describe('the breakdown log figure', () => {
  it('prints the key page shape: all history rows, the count derived from the workbook', () => {
    const log = valueOf<LogValue>('breakdown-log');
    const keyPage = BREAKDOWN_LOG.pages[0]!;
    const keyTable = keyPage.tables[0]!;
    expect(log.screen).toBe(BREAKDOWN_LOG.screen);
    expect(log.asOf).toBe(AS_OF);
    expect(log.pages).toHaveLength(1);
    const page = log.pages[0]!;
    expect({ page: page.page, title: page.title, kpis: page.kpis, charts: page.charts }).toEqual({
      page: keyPage.page,
      title: keyPage.title,
      kpis: keyPage.kpis,
      charts: keyPage.charts,
    });
    const table = page.tables[0]!;
    expect({ title: table.title, header: table.header, truncated: table.truncated }).toEqual({
      title: keyTable.title,
      header: keyTable.header,
      truncated: true,
    });
    expect(table.rowCount).toBe(HISTORY.length);
    expect(table.rows).toHaveLength(table.rowCount);
    // The key's own count is the workbook's count, never a constant the figure was handed.
    expect(keyTable.rowCount).toBe(HISTORY.length);
    expect(table.rows.slice(0, 3)).toEqual(keyTable.rows);
  });

  it("orders every row by the workbook's Sr No, newest first", () => {
    const printed = logTable().rows.map((row) => Number(row[1]));
    expect(printed).toEqual(NEWEST.map(srNo));
    expect(printed[0]).toBeGreaterThan(printed.at(-1)!);
  });

  it('prints every workbook row exactly: eye, ticket, date, shift, machine, problem, name, hours, code', () => {
    const rows = logTable().rows;
    expect(rows).toHaveLength(NEWEST.length);
    NEWEST.forEach((row, index) => {
      expect(rows[index], row.id).toEqual([
        '👁',
        String(srNo(row)),
        row.ticketRef ?? row.id,
        row.date,
        row.shift,
        row.machineId,
        row.problem,
        displayDoneBy(row),
        row.maintCode === 'NO DT' ? '—' : String(recorded(row)),
        (row.maintCode ?? '').trim() === '' ? '—' : row.maintCode,
      ]);
    });
  });

  it('keeps the 64 PM rows in the log while the analyses leave them out', () => {
    const printed = logTable().rows.filter((row) => row[9] === 'PM');
    expect(printed).toHaveLength(HISTORY.filter((row) => row.maintCode === 'PM').length);
  });

  it("names every row's real ticket in row order, so every row drills", () => {
    const computed = COMPUTERS['breakdown-log']!({
      data: ENGINE_DATA,
      asOf: AS_OF,
      profile: DEFAULT_PROFILE,
    });
    const known = new Set(
      [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
    );
    const carrying = sourcedReports(ENGINE_DATA).filter(isHistory);
    expect(carrying.every((row) => row.report.ticketId !== null)).toBe(true);
    expect(carrying).toHaveLength(HISTORY.length);
    expect(computed.drillIds).toEqual(NEWEST.map((row) => row.ticketId ?? row.id));
    expect(computed.drillIds.every((id) => known.has(id))).toBe(true);
    const drill = figure('breakdown-log').drill;
    expect(drill.type).toBe('ticket');
    expect(drill.ids).toHaveLength(carrying.length);
    expect(drill.ids.every((id) => known.has(id))).toBe(true);
  });

  it('derives the hours from the workbook: 3,819.38 over the log and 209.1 NO-DT, never 3,060.1', () => {
    const table = logTable();
    const printed = table.rows.map((row) => (row[8] === '—' ? 0 : Number(row[8])));
    expect(printed.every(Number.isFinite)).toBe(true);
    expect(printed.reduce((sum, hours) => sum + hours, 0)).toBeCloseTo(TOTAL_HOURS, 6);
    expect(formatNumber(TOTAL_HOURS, 2)).toBe('3,819.38');
    const noDt = HISTORY.filter((row) => row.maintCode === 'NO DT');
    expect(table.rows.filter((row) => row[8] === '—')).toHaveLength(noDt.length);
    // The NO-DT hours are the dashboard's own 209.1, not its 3,060.1 downtime (which is the non-PM total).
    expect(formatNumber(NO_DT_HOURS, 1)).toBe('209.1');
    expect(`${formatNumber(NO_DT_HOURS, 1)} hrs`).toBe(
      kpiByLabel('BD Hours but NO Downtime').value,
    );
    expect(`${formatNumber(BD_HOURS, 1)} hrs`).toBe(kpiByLabel('Total Downtime').value);
    expect(formatNumber(NO_DT_HOURS, 1)).not.toBe(formatNumber(BD_HOURS, 1));
  });
});
