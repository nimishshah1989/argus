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
import { formatInr } from '../src/analytics/format.js';
import { standardTotals } from '../src/analytics/standard-kpis.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { SHIFT_KPIS_EXPECTED, SHIFT_SPLIT_EXPECTED as SPLIT } from './shift-kpis-expected.js';

/**
 * The shift split (ticket 48, packet 48b): the failure set's rows grouped by the shift recorded on the report, each
 * shift on its own share of the plant's working hours. Only the counts, the BD hours, the PM hours and the working
 * hours add; the plant's MTTR, MTBF and availability are recomputed from those sums, never averaged from the rows.
 */

const AS_OF = '2026-11-11';
const YEAR_END = '2026-12-31';

interface SplitRow {
  code: string;
  breakdowns: number;
  breakdownHours: number;
  pmHours: number;
  workingHours: number | null;
  mttr: number | null;
  mtbf: number | null;
  availability: number | null;
}

interface SplitValue {
  screen: string;
  asOf: string;
  shifts: SplitRow[];
  pages: Array<{
    page: string;
    title: string;
    kpis: Array<{ label: string; value: string; sub: string | null }>;
    tables: Array<{ title: string; header: string[]; rows: string[][]; rowCount: number }>;
    charts: unknown[];
  }>;
}

function figureOf(
  data: EngineData = ENGINE_DATA,
  asOf = AS_OF,
  key = 'shift-kpis.shift-split',
): FigureResult {
  const compute = COMPUTERS[key];
  if (compute === undefined) throw new Error(`the engine knows no figure ${key}`);
  const result = runWith({ [key]: compute }, { data, asOf, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`the engine knows no figure ${key}`);
  return found;
}

function valueOf(data: EngineData = ENGINE_DATA, asOf = AS_OF): SplitValue {
  const computed = figureOf(data, asOf);
  if (computed.status !== 'ready') throw new Error(`shift-kpis.shift-split is ${computed.status}`);
  return computed.value as unknown as SplitValue;
}

const tableOf = (value: SplitValue) => value.pages[0]!.tables[0]!;
const rowOf = (value: SplitValue, code: string): SplitRow => {
  const found = value.shifts.find((row) => row.code === code);
  if (found === undefined) throw new Error(`the split holds no shift ${code}`);
  return found;
};
const kpiOf = (value: SplitValue, label: string) => {
  const found = value.pages[0]!.kpis.find((kpi) => kpi.label === label);
  if (found === undefined) throw new Error(`the split holds no KPI "${label}"`);
  return found;
};

/** The sum of the shift rows, on their unrounded values. */
function sumOf(rows: readonly SplitRow[]) {
  return rows.reduce(
    (sum, row) => ({
      breakdowns: sum.breakdowns + row.breakdowns,
      breakdownHours: sum.breakdownHours + row.breakdownHours,
      pmHours: sum.pmHours + row.pmHours,
      workingHours: sum.workingHours + (row.workingHours ?? 0),
    }),
    { breakdowns: 0, breakdownHours: 0, pmHours: 0, workingHours: 0 },
  );
}

const machine = (id: string): MachineRow => ({
  id,
  code: id,
  segment: 'CNC',
  category: 'Turning Center',
  cell: '1',
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

function ticket(id: string): TicketRow {
  return {
    id,
    ref: id.toUpperCase(),
    kind: 'stopped',
    status: 'closed',
    machineId: 'm1',
    reportedAt: '2026-01-01T04:00:00.000Z',
    closedAt: '2026-01-01T05:00:00.000Z',
    source: 'live',
    downtimeMin: 0,
    repairMin: null,
    workType: null,
  };
}

function report(
  id: string,
  ticketId: string,
  date: string,
  rest: { shift: string; minutes: number },
) {
  return {
    id,
    ticketId,
    machineId: 'm1',
    date,
    shift: rest.shift,
    problem: 'x',
    downtimeMin: rest.minutes,
    responseMin: null,
    repairMin: null,
    category: null,
    maintCode: 'E',
    spareUsed: null,
    rootCause: null,
    doneBy: [],
    supportedBy: [],
  } satisfies ReportRow;
}

function plantData(tickets: TicketRow[], reports: ReportRow[]): EngineData {
  return {
    timeZone: 'Asia/Kolkata',
    machines: [machine('m1')],
    moves: [],
    tickets,
    tasks: [],
    reports,
    people: [],
    lists: {},
    shifts: ENGINE_DATA.shifts,
  };
}

/**
 * The alias fixture: one machine, the year's share exactly 1 (6,300 working hours). Shift 1 records `1` and `1ST`,
 * shift 2 records `2` and `2ND`, and shift 3 is a code the Settings have no window for. No report repeats another's
 * four fields, so all five rows are failures.
 */
function aliasData(): EngineData {
  return plantData(['t1', 't2', 't3', 't4', 't5'].map(ticket), [
    report('r1', 't1', '2026-03-02', { shift: '1', minutes: 60 }),
    report('r2', 't2', '2026-03-03', { shift: '1ST', minutes: 30 }),
    report('r3', 't3', '2026-03-04', { shift: '2', minutes: 120 }),
    report('r4', 't4', '2026-03-05', { shift: '2ND', minutes: 60 }),
    report('r5', 't5', '2026-03-06', { shift: '3', minutes: 90 }),
  ]);
}

describe('the shift split', () => {
  it('prints the three recorded shifts and the plant total, the overlap minute on the later shift', () => {
    const computed = figureOf();
    expect(computed.status).toBe('ready');
    const value = valueOf();
    expect({ screen: value.screen, asOf: value.asOf }).toEqual({
      screen: 'shift-kpis',
      asOf: AS_OF,
    });
    expect(value.shifts.map((row) => row.code)).toEqual([...SPLIT.codes]);

    const table = tableOf(value);
    expect(table.header).toEqual([...SPLIT.printed.header]);
    expect(table.rows).toEqual(SPLIT.printed.rows.map((row) => [...row]));
    expect(table.rowCount).toBe(4);
    expect(table.title).toBe('Breakdowns, hours and MTTR by shift');
  });

  it('gives each shift its own share of the plant: 629 and 631 minutes of the 1,260-minute day', () => {
    const value = valueOf();
    const one = rowOf(value, '1');
    const two = rowOf(value, '2');
    const three = rowOf(value, '3');

    expect(one).toMatchObject({ breakdowns: SPLIT.rows['1'].breakdowns });
    expect(two).toMatchObject({ breakdowns: SPLIT.rows['2'].breakdowns });
    expect(three).toMatchObject({ breakdowns: SPLIT.rows['3'].breakdowns });

    // The counts and the BD hours are the plan's cells; the PM and working hours are compared unrounded.
    expect(formatInr(one.breakdownHours, 2)).toBe('2,021.10');
    expect(formatInr(two.breakdownHours, 2)).toBe('1,031.12');
    expect(formatInr(three.breakdownHours, 2)).toBe('3.00');
    expect(one.pmHours).toBeCloseTo(SPLIT.rows['1'].pmHours, 10);
    expect(two.pmHours).toBeCloseTo(SPLIT.rows['2'].pmHours, 10);
    expect(one.workingHours!).toBeCloseTo(SPLIT.rows['1'].workingHours, 6);
    expect(two.workingHours!).toBeCloseTo(SPLIT.rows['2'].workingHours, 6);
    expect(three.workingHours).toBeNull();

    // Each shift's rates are its own totals, never the plant's.
    expect(one.mttr!).toBeCloseTo(SPLIT.rows['1'].mttr, 10);
    expect(one.mtbf!).toBeCloseTo(SPLIT.rows['1'].mtbf, 10);
    expect(one.availability!).toBeCloseTo(SPLIT.rows['1'].availability, 10);
    expect(two.mttr!).toBeCloseTo(SPLIT.rows['2'].mttr, 10);
    expect(two.mtbf!).toBeCloseTo(SPLIT.rows['2'].mtbf, 10);
    expect(two.availability!).toBeCloseTo(SPLIT.rows['2'].availability, 10);
    // A code with no window has no denominator: all its measures are dashes, its hours stay in the plant total.
    expect([three.mttr, three.mtbf, three.availability]).toEqual([null, null, null]);

    const summed = sumOf(value.shifts);
    expect(summed.breakdowns).toBe(SHIFT_KPIS_EXPECTED.failures);
    expect(summed.breakdownHours).toBeCloseTo(SHIFT_KPIS_EXPECTED.breakdownHours, 10);
    expect(summed.pmHours).toBeCloseTo(SHIFT_KPIS_EXPECTED.pmHours, 10);
    expect(summed.workingHours).toBeCloseTo(SHIFT_KPIS_EXPECTED.workingHours, 6);
  });

  it('recomputes the plant row from the summed totals, never from the shift rows averaged', () => {
    const value = valueOf();
    const summed = sumOf(value.shifts);
    const plant = standardTotals(ENGINE_DATA, DEFAULT_PROFILE, AS_OF);

    // The counts, BD hours, PM hours and working hours are the only cells that add.
    expect(summed.breakdowns).toBe(plant.failures);
    expect(summed.breakdownHours).toBeCloseTo(plant.breakdownHours, 10);
    expect(summed.pmHours).toBeCloseTo(plant.pmHours, 10);
    expect(summed.workingHours).toBeCloseTo(plant.workingHours!, 6);

    // Recomputed from the sums: 3,055.2167 / 1,279, (5,93,977.0968 - 3,055.2167) / 1,279, 1 - 3,814.4834 / 5,93,977.0968.
    expect(formatInr(summed.breakdownHours / summed.breakdowns, 2)).toBe(
      SHIFT_KPIS_EXPECTED.printed.mttr,
    );
    expect(formatInr((summed.workingHours - summed.breakdownHours) / summed.breakdowns, 1)).toBe(
      SHIFT_KPIS_EXPECTED.printed.mtbf,
    );
    expect(
      formatInr((1 - (summed.breakdownHours + summed.pmHours) / summed.workingHours) * 100, 2),
    ).toBe(SHIFT_KPIS_EXPECTED.printed.availability);

    // The average of the two shifts' MTTRs is a different number: the invariant has power.
    const one = rowOf(value, '1');
    const two = rowOf(value, '2');
    const average = ((one.mttr ?? 0) + (two.mttr ?? 0)) / 2;
    expect(formatInr(average, 2)).toBe('2.36');
    expect(formatInr(summed.breakdownHours / summed.breakdowns, 2)).not.toBe(formatInr(average, 2));

    // And the page's plant row is the plant's own, not the sum of the printed cells (PM rounds to 759.26).
    const plantRow = tableOf(value).rows.at(-1)!;
    expect(plantRow[0]).toBe('PLANT TOTAL');
    expect(plantRow[4]).toBe(SHIFT_KPIS_EXPECTED.printed.workingHours);
    expect(plantRow[5]).toBe(SHIFT_KPIS_EXPECTED.printed.mttr);
    expect(plantRow[6]).toBe(SHIFT_KPIS_EXPECTED.printed.mtbf);
    expect(plantRow[7]).toBe(SHIFT_KPIS_EXPECTED.printed.availability);
  });

  it('counts a 1ST row in shift 1 and a 2ND row in shift 2, and a windowless code in the plant total', () => {
    const value = valueOf(aliasData(), YEAR_END);
    expect(value.shifts.map((row) => row.code)).toEqual(['1', '2', '3']);
    expect(rowOf(value, '1').breakdowns).toBe(2);
    expect(rowOf(value, '2').breakdowns).toBe(2);
    expect(rowOf(value, '3').breakdowns).toBe(1);

    // 6,300 working hours at the year's end, split 629/631: the two windows add to the plant exactly.
    expect(rowOf(value, '1').workingHours!).toBeCloseTo((6_300 * 629) / 1_260, 6);
    expect(rowOf(value, '2').workingHours!).toBeCloseTo((6_300 * 631) / 1_260, 6);
    expect(rowOf(value, '1').breakdownHours).toBeCloseTo(1.5, 10);
    expect(rowOf(value, '2').breakdownHours).toBeCloseTo(3, 10);
    expect(rowOf(value, '3').breakdownHours).toBeCloseTo(1.5, 10);

    // 5 failures and 6 hours: the windowless row is in the plant total, its own hours are not dropped.
    const plantRow = tableOf(value).rows.at(-1)!;
    expect(plantRow).toEqual([
      'PLANT TOTAL',
      '5',
      '6.00',
      '0.00',
      '6,300.00',
      '1.20',
      '1,258.8',
      '99.90',
    ]);
    expect(tableOf(value).rows[2]).toEqual([
      '3 (no window)',
      '1',
      '1.50',
      '0.00',
      '—',
      '—',
      '—',
      '—',
    ]);
  });

  it('keeps a live close at 01:00 in the shift it was recorded with, never re-derived from the clock', () => {
    const late: TicketRow = {
      ...ticket('late'),
      reportedAt: '2026-11-10T19:30:00.000Z', // 01:00 on 11 November in the plant
    };
    const data = plantData(
      [late],
      [{ ...report('r1', 'late', '2026-11-10', { shift: '2', minutes: 90 }), problem: 'night' }],
    );
    const value = valueOf(data, YEAR_END);
    expect(value.shifts.map((row) => row.code)).toEqual(['2']);
    expect(rowOf(value, '2').breakdowns).toBe(1);
    expect(value.shifts.some((row) => row.code === '1')).toBe(false);
  });

  it('is ready with dashes when the plant has no shift window, and keeps the counts', () => {
    const value = valueOf({ ...ENGINE_DATA, shifts: [] });
    expect(kpiOf(value, 'No shift windows in Settings').value).toBe('—');
    expect(value.shifts.every((row) => row.workingHours === null)).toBe(true);
    expect(value.shifts.every((row) => row.mttr === null)).toBe(true);
    const table = tableOf(value);
    expect(table.rows.map((row) => row[1])).toEqual(['821', '456', '2', '1,279']);
    expect(table.rows.map((row) => row[2])).toEqual(['2,021.10', '1,031.12', '3.00', '3,055.22']);
    expect(table.rows.map((row) => row[4])).toEqual(['—', '—', '—', '—']);
    expect(table.rows.at(-1)![5]).toBe('2.39');
  });

  it('prints nothing for a plant with no failure at all', () => {
    const empty: EngineData = { ...ENGINE_DATA, reports: [], tickets: [], tasks: [] };
    const computed = figureOf(empty);
    expect(computed.status).toBe('ready');
    expect(computed.value).toBeNull();
    expect(computed.drill.ids).toEqual([]);
  });

  it('drills every failure ticket, history and live', () => {
    const computed = figureOf();
    expect(computed.drill.type).toBe('ticket');
    expect(computed.drill.ids).toHaveLength(SHIFT_KPIS_EXPECTED.failures);
    const known = new Set([...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((row) => row.id));
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
  });
});
