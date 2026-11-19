import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  runWith,
  type EngineData,
  type FigureResult,
  type MachineRow,
  type ReportRow,
  type TicketRow,
} from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import {
  breakdownMap,
  type BreakdownMap,
  type MapDimension,
} from '../src/analytics/breakdown-map.js';
import { formatInr } from '../src/analytics/format.js';
import { codeLabel } from '../src/analytics/report-period.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/**
 * The breakdown map (ticket 48, packet 48c): four Paretos by machine, cell, code and shift, each ranked by the
 * failure set's exact hours, with the running share and the row that passes half the lost time, and four heat grids
 * cutting those same rows by the month of the report's own date. The arithmetic is the plan's own:
 *
 * - the fixture's 1,279 failures record 183,313 minutes, i.e. 3,055.2167 hours (NO DT's 12,546 minutes are not lost
 *   time), so every dimension sums to that same number and the cumulative share ends at 100.00 %;
 * - machines: TMC-2 20 failures 18,455 min = 307.58 h (10.07 %), and 13 of the 125 production machines carry half;
 * - cells: cell 7 283 failures 46,607 min = 776.78 h, cell 2 222 failures 37,270 min = 621.17 h, and 3 of
 *   9 cells carry half;
 * - codes: E 314 failures 41,256 min = 687.60 h, and 3 of 23 codes carry half;
 * - shifts: shift 1 821 failures 121,266 min = 2,021.10 h (66.15 %), and 1 of 3 shifts carries half;
 * - the grids' months are the as-of year's happened months (Jan to Nov at 2026-11-11): shift 1's January is
 *   10,599 min = 176.65 h, code E's April is 15,640 min = 260.67 h and TMC-2's June is 14,545 min = 242.42 h.
 *
 * A row's month cells must always add to that row's Pareto hours: the one invariant a grid cannot drift from.
 */

const AS_OF = '2026-11-11';
/** 183,313 recorded minutes / 60. */
const TOTAL_HOURS = 183_313 / 60;
/** The production fleet A1 prints: 126 CNC rows less the Robot BOXY. */
const PRODUCTION_MACHINES = 125;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
] as const;

interface ValueRow {
  key: string;
  breakdowns: number;
  hours: number;
  cumulativePct: number;
}

interface MapValue {
  screen: string;
  asOf: string;
  map: Array<{
    dimension: MapDimension;
    rows: ValueRow[];
    fiftyPct: { count: number; of: number };
  }>;
  pages: Array<{
    page: string;
    title: string;
    kpis: Array<{ label: string; value: string; sub: string | null }>;
    tables: Array<{
      title: string;
      header: string[];
      rows: string[][];
      rowCount: number;
      heat?: boolean;
    }>;
    charts: Array<{
      id: string;
      labels: string[];
      datasets: Array<{ label: string; data: number[] }>;
    }>;
  }>;
}

function figureOf(
  data: EngineData = ENGINE_DATA,
  asOf = AS_OF,
  key = 'shift-kpis.breakdown-map',
): FigureResult {
  const compute = COMPUTERS[key];
  if (compute === undefined) throw new Error(`the engine knows no figure ${key}`);
  const result = runWith({ [key]: compute }, { data, asOf, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`the engine knows no figure ${key}`);
  return found;
}

function valueOf(data: EngineData = ENGINE_DATA, asOf = AS_OF): MapValue {
  const computed = figureOf(data, asOf);
  if (computed.status !== 'ready')
    throw new Error(`shift-kpis.breakdown-map is ${computed.status}`);
  return computed.value as unknown as MapValue;
}

const dimensionOf = (value: MapValue, dimension: MapDimension) => {
  const found = value.map.find((candidate) => candidate.dimension === dimension);
  if (found === undefined) throw new Error(`the map holds no ${dimension} dimension`);
  return found;
};

const gridOf = (map: BreakdownMap, dimension: MapDimension) => {
  const found = map.grids.find((candidate) => candidate.dimension === dimension);
  if (found === undefined) throw new Error(`the map holds no ${dimension} grid`);
  return found;
};

const pageOf = (value: MapValue) => value.pages[0]!;
const tableOf = (value: MapValue, index: number) => pageOf(value).tables[index]!;

const machine = (id: string, code = id): MachineRow => ({
  id,
  code,
  segment: 'CNC',
  category: 'Turning Center',
  cell: '3',
  location: null,
  make: null,
  model: null,
  controller: null,
  year: 2020,
  purchasedOn: null,
  powerKw: null,
  capacityKva: null,
  assetCode: null,
  status: 'active',
  criticality: null,
  excludedFromProduction: false,
  metadata: {},
});

function ticket(id: string, machineId = 'm1'): TicketRow {
  return {
    id,
    ref: id.toUpperCase(),
    kind: 'stopped',
    status: 'closed',
    machineId,
    reportedAt: '2026-03-02T02:30:00.000Z',
    closedAt: '2026-03-02T03:30:00.000Z',
    source: 'live',
    downtimeMin: 60,
    repairMin: null,
    workType: null,
  };
}

function report(id: string, ticketId: string, code: string, minutes: number): ReportRow {
  return {
    id,
    ticketId,
    machineId: 'm1',
    date: '2026-03-02',
    shift: '1',
    problem: 'x',
    downtimeMin: minutes,
    responseMin: null,
    repairMin: null,
    category: null,
    maintCode: code,
    spareUsed: null,
    rootCause: null,
    doneBy: [],
    supportedBy: [],
  };
}

/** One CNC machine and one closed failure, with no maintenance-code list at all. */
function smallPlant(code: string): EngineData {
  return {
    timeZone: 'Asia/Kolkata',
    machines: [machine('m1', 'M-1')],
    moves: [],
    tickets: [ticket('t1')],
    tasks: [],
    reports: [report('r1', 't1', code, 60)],
    people: [],
    lists: {},
    shifts: ENGINE_DATA.shifts,
  };
}

describe('the breakdown map ranks its four dimensions by hours', () => {
  it('ranks machine, cell, code and shift worst first and ends every cumulative share at 100.00 %', () => {
    const computed = figureOf();
    expect(computed.status).toBe('ready');
    const value = valueOf();
    expect({ screen: value.screen, asOf: value.asOf }).toEqual({
      screen: 'shift-kpis',
      asOf: AS_OF,
    });
    expect(value.map.map((entry) => entry.dimension)).toEqual(['machine', 'cell', 'code', 'shift']);
    for (const entry of value.map) {
      const hours = entry.rows.reduce((sum, row) => sum + row.hours, 0);
      expect(hours).toBeCloseTo(TOTAL_HOURS, 7);
      const ordered = entry.rows.every(
        (row, index) => index === 0 || entry.rows[index - 1]!.hours >= row.hours,
      );
      expect(ordered, entry.dimension).toBe(true);
      expect(entry.rows.at(-1)!.cumulativePct).toBeCloseTo(100, 7);
      const last = entry.rows.at(-1)!;
      const running = entry.rows.reduce((sum, row) => sum + row.hours, 0);
      expect(last.cumulativePct).toBeCloseTo((running / hours) * 100, 7);
    }
  });

  it('pins the worst row of each dimension to the workbook', () => {
    const value = valueOf();
    const machines = dimensionOf(value, 'machine');
    const cells = dimensionOf(value, 'cell');
    const codes = dimensionOf(value, 'code');
    const shifts = dimensionOf(value, 'shift');

    expect(machines.rows[0]).toMatchObject({ key: 'TMC-2', breakdowns: 20 });
    expect(machines.rows[0]!.hours).toBeCloseTo(18_455 / 60, 7); // 307.58 h
    expect(machines.rows[1]).toMatchObject({ key: 'TC-5', breakdowns: 17 });
    expect(machines.rows[2]).toMatchObject({ key: 'VC-28', breakdowns: 27 });

    expect(cells.rows[0]).toMatchObject({ key: '7', breakdowns: 283 });
    expect(cells.rows[0]!.hours).toBeCloseTo(46_607 / 60, 7); // 776.78 h
    expect(cells.rows[1]).toMatchObject({ key: '2', breakdowns: 222 });
    expect(cells.rows[2]).toMatchObject({ key: '6', breakdowns: 217 });

    expect(codes.rows[0]).toMatchObject({ key: 'E', breakdowns: 314 });
    expect(codes.rows[0]!.hours).toBeCloseTo(41_256 / 60, 7); // 687.60 h
    expect(codes.rows[1]).toMatchObject({ key: 'M', breakdowns: 215 });
    expect(codes.rows[2]).toMatchObject({ key: 'HUM', breakdowns: 59 });

    expect(shifts.rows[0]).toMatchObject({ key: '1', breakdowns: 821 });
    expect(shifts.rows[0]!.hours).toBeCloseTo(121_266 / 60, 7); // 2,021.10 h
    expect(shifts.rows[1]).toMatchObject({ key: '2', breakdowns: 456 });
    expect(shifts.rows[2]).toMatchObject({ key: '3', breakdowns: 2 });
    expect(shifts.rows[0]!.cumulativePct).toBeCloseTo(66.15, 1); // 2,021.10 ÷ 3,055.2167
  });

  it('puts the 50 % point at 13 of 125 machines, 3 of 9 cells, 3 of 23 codes and 1 of 3 shifts', () => {
    const value = valueOf();
    expect(dimensionOf(value, 'machine').fiftyPct).toEqual({
      count: 13,
      of: PRODUCTION_MACHINES,
    });
    expect(dimensionOf(value, 'cell').fiftyPct).toEqual({ count: 3, of: 9 });
    expect(dimensionOf(value, 'code').fiftyPct).toEqual({ count: 3, of: 23 });
    expect(dimensionOf(value, 'shift').fiftyPct).toEqual({ count: 1, of: 3 });

    // The count is the fewest worst rows whose running hours pass half the dimension's total.
    for (const entry of value.map) {
      const half = entry.fiftyPct.count;
      const crossed = entry.rows.slice(0, half).reduce((sum, row) => sum + row.hours, 0);
      const before = entry.rows.slice(0, half - 1).reduce((sum, row) => sum + row.hours, 0);
      const total = entry.rows.reduce((sum, row) => sum + row.hours, 0);
      expect(crossed, entry.dimension).toBeGreaterThanOrEqual(total / 2);
      if (half > 1) expect(before, entry.dimension).toBeLessThan(total / 2);
    }
  });

  it('is the same 1,279 failures the comparison counts, so every one of them drills', () => {
    const computed = figureOf();
    expect(computed.drill.type).toBe('ticket');
    expect(computed.drill.ids).toHaveLength(1_279);
    expect(dimensionOf(valueOf(), 'machine').rows.length).toBe(117); // machines with a failure
  });
});

describe('the heat grids cut the same rows by month', () => {
  it('uses the as-of year’s happened months, never a December column of zeroes', () => {
    const computed = breakdownMap(ENGINE_DATA, AS_OF);
    for (const grid of computed.grids) {
      expect(grid.months, grid.dimension).toEqual([...MONTHS]);
    }
    expect(pageOf(valueOf()).tables[0]!.header).toEqual([
      'Machine',
      ...MONTHS,
      'Total',
      'Cumulative %',
    ]);
    expect(pageOf(valueOf()).tables[0]!.header).not.toContain('Dec');
  });

  it('keeps every grid row summing to that row’s Pareto hours, in all four dimensions', () => {
    const computed = breakdownMap(ENGINE_DATA, AS_OF);
    const value = valueOf();
    for (const grid of computed.grids) {
      const dimension = dimensionOf(value, grid.dimension);
      const byKey = new Map(dimension.rows.map((row) => [row.key, row.hours]));
      for (const row of grid.rows) {
        const hours = byKey.get(row.key);
        expect(hours, `${grid.dimension}: ${row.key}`).toBeDefined();
        expect(row.values, `${grid.dimension}: ${row.key}`).toHaveLength(MONTHS.length);
        const summed = row.values.reduce((sum, cell) => sum + cell, 0);
        expect(summed, `${grid.dimension}: ${row.key}`).toBeCloseTo(hours!, 7);
      }
    }
  });

  it('pins one cell of each grid: shift 1 in January, code E in April and TMC-2 in June', () => {
    const computed = breakdownMap(ENGINE_DATA, AS_OF);
    const shift = gridOf(computed, 'shift').rows.find((row) => row.key === '1')!;
    expect(shift.values[0]).toBeCloseTo(10_599 / 60, 6); // 176.65 h
    const code = gridOf(computed, 'code').rows.find((row) => row.key === 'E')!;
    expect(code.values[3]).toBeCloseTo(15_640 / 60, 6); // 260.67 h
    const machine = gridOf(computed, 'machine').rows.find((row) => row.key === 'TMC-2')!;
    expect(machine.values[5]).toBeCloseTo(14_545 / 60, 6); // 242.42 h
  });

  it('prints the top machines and says how many it left out; every other grid prints all its rows', () => {
    const computed = breakdownMap(ENGINE_DATA, AS_OF);
    const machineGrid = gridOf(computed, 'machine');
    expect(machineGrid.rows).toHaveLength(15);
    expect(machineGrid.total).toBe(117);
    expect(machineGrid.omitted).toBe(102);
    for (const dimension of ['cell', 'code', 'shift'] as const) {
      const grid = gridOf(computed, dimension);
      const value = dimensionOf(valueOf(), dimension);
      expect(
        grid.rows.map((row) => row.key),
        dimension,
      ).toEqual(value.rows.map((row) => row.key));
    }
    expect(tableOf(valueOf(), 0).title).toContain('15 of 117 machines');
    expect(tableOf(valueOf(), 0).title).toContain('102 left out');
    expect(tableOf(valueOf(), 0).rows[0]![0]).toBe('TMC-2');
  });
});

describe('the face reads the map as four heat matrices and four Paretos', () => {
  it('draws each dimension as a heat table whose month columns are the grid’s own', () => {
    const value = valueOf();
    const page = pageOf(value);
    expect(page.page).toBe('shift-kpis');
    expect(page.title).toBe('Breakdown map');
    expect(page.tables).toHaveLength(4);
    expect(page.tables.every((table) => table.heat === true)).toBe(true);
    expect(page.tables.map((table) => table.header[0])).toEqual([
      'Machine',
      'Cell',
      'Code',
      'Shift',
    ]);
    const machine = tableOf(value, 0);
    expect(machine.rows[0]).toEqual([
      'TMC-2',
      '1.50',
      '1.08',
      '—',
      '39.33',
      '6.00',
      '242.42',
      '6.67',
      '10.25',
      '0.33',
      '—',
      '—',
      '307.58',
      '10.07',
    ]);
    // The code axis prints the code as recorded and its maint_code label (R11).
    const codes = tableOf(value, 2);
    expect(codes.rows[0]![0]).toBe(codeLabel('E', ENGINE_DATA.lists));
    expect(codes.rows[0]![0]).toBe('E Electronics/Electrical');
  });

  it('sends four Pareto charts: the bars are hours, the line their running share', () => {
    const value = valueOf();
    const charts = pageOf(value).charts;
    expect(charts.map((chart) => chart.id)).toEqual([
      'ch-sk-machine',
      'ch-sk-cell',
      'ch-sk-code',
      'ch-sk-shift',
    ]);
    const machine = charts[0]!;
    expect(machine.labels[0]).toBe('TMC-2');
    expect(machine.datasets[0]!.label).toBe('BD hours');
    expect(machine.datasets[0]!.data[0]).toBeCloseTo(307.58, 2);
    expect(machine.datasets[1]!.label).toBe('Cumulative %');
    expect(machine.datasets[1]!.data[0]).toBeCloseTo(10.07, 2);
    expect(charts[3]!.datasets[0]!.data.at(-1)).toBeCloseTo(3, 6); // shift 3: 3.00 h
    expect(charts[3]!.datasets[1]!.data.at(-1)).toBeCloseTo(100, 6);
  });

  it('states each dimension’s 50 % point on the page', () => {
    const labels = pageOf(valueOf()).kpis.map((kpi) => [kpi.label, kpi.value]);
    expect(labels).toEqual([
      ['Machines for half the hours', '13 of 125'],
      ['Cells for half the hours', '3 of 9'],
      ['Codes for half the hours', '3 of 23'],
      ['Shifts for half the hours', '1 of 3'],
    ]);
  });
});

describe('the failure set is the comparison’s own', () => {
  it('leaves PM out of every dimension and keeps NO DT in its code row at zero hours', () => {
    const value = valueOf();
    for (const entry of value.map) {
      expect(
        entry.rows.map((row) => row.key),
        entry.dimension,
      ).not.toContain('PM');
    }
    const noDowntime = dimensionOf(value, 'code').rows.find((row) => row.key === 'NO DT');
    expect(noDowntime?.hours).toBe(0);
    expect(
      formatInr(
        dimensionOf(value, 'machine').rows.reduce((sum, row) => sum + row.hours, 0),
        2,
      ),
    ).toBe('3,055.22');
  });

  it('prints a code with no maint_code list row as recorded', () => {
    const value = valueOf(smallPlant('ZZZ'), AS_OF);
    const codes = dimensionOf(value, 'code');
    expect(codes.rows[0]).toMatchObject({ key: 'ZZZ', breakdowns: 1 });
    expect(codes.rows[0]!.hours).toBe(1);
    expect(tableOf(value, 2).rows[0]![0]).toBe('ZZZ');
    expect(pageOf(value).charts[2]!.labels).toEqual(['ZZZ']);
  });

  it('prints nothing for a plant with no failure, and maps the hours with no shift window', () => {
    const empty = figureOf({ ...ENGINE_DATA, reports: [], tickets: [], tasks: [] });
    expect(empty.status).toBe('ready');
    expect(empty.value).toBeNull();
    expect(empty.drill.ids).toEqual([]);

    const noWindows = valueOf({ ...ENGINE_DATA, shifts: undefined });
    expect(dimensionOf(noWindows, 'shift').rows[0]!.key).toBe('1');
  });
});
