import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  runWith,
  type EngineData,
  type EngineResult,
  type FigureResult,
  type MachineRow,
  type ReportRow,
  type ShiftRow,
  type TicketRow,
} from '../src/index.js';
import { periodFraction } from '../src/analytics/availability.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { formatInr } from '../src/analytics/format.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { failureEvents, legacyTotals, standardTotals } from '../src/analytics/standard-kpis.js';
import {
  shiftCalendar,
  workingHoursFor,
  workingHoursPlant,
  workingMinutesPerDay,
} from '../src/analytics/working-hours.js';
import { businessMinutesBetween } from '../src/business-hours.js';
import { A1, A3, ENGINE_DATA } from './answer-key/fixture.js';
import { SHIFT_KPIS_EXPECTED as EXPECTED } from './shift-kpis-expected.js';

/**
 * The standard (working-hours) family (ticket 48, packet 48a): the plant's own shift windows instead of the
 * workbook's 20 x 300, printed beside the platform's frozen column and never replacing it. The expected numbers are
 * hand-computed in `shift-kpis-expected.ts`; the platform column is read out of A1's and A3's own files, so the two
 * families are asserted against each other and neither can drift silently.
 */

const AS_OF = '2026-11-11';
const YEAR_END = '2026-12-31';

const RESULT: EngineResult = runWith(COMPUTERS, {
  data: ENGINE_DATA,
  asOf: AS_OF,
  profile: DEFAULT_PROFILE,
});

function figure(data: EngineData = ENGINE_DATA, key = 'shift-kpis.compare'): FigureResult {
  const result =
    data === ENGINE_DATA
      ? RESULT
      : runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`the engine knows no figure ${key}`);
  return found;
}

function valueOf<T>(data: EngineData = ENGINE_DATA): T {
  const computed = figure(data);
  if (computed.status !== 'ready') throw new Error(`shift-kpis.compare is ${computed.status}`);
  return computed.value as unknown as T;
}

interface CompareValue {
  screen: string;
  asOf: string;
  basis: {
    legacy: ReturnType<typeof legacyTotals>;
    standard: ReturnType<typeof standardTotals>;
    minutesPerDay: number;
    annualHours: number;
  };
  pages: Array<{
    page: string;
    title: string;
    kpis: Array<{ label: string; value: string; sub: string }>;
    tables: Array<{ title: string; header: string[]; rows: string[][]; rowCount: number }>;
    charts: unknown[];
  }>;
}

const tableOf = (value: CompareValue) => value.pages[0]!.tables[0]!;
const kpiOf = (value: CompareValue, label: string) => {
  const found = value.pages[0]!.kpis.find((kpi) => kpi.label === label);
  if (found === undefined) throw new Error(`the comparison holds no KPI "${label}"`);
  return found;
};

/** A1's own KPI, read from the answer-key file rather than retyped. */
function a1Kpi(label: string): { label: string; value: string; sub: string } {
  for (const page of A1.pages) {
    const found = page.kpis.find((kpi) => kpi.label === label);
    if (found !== undefined) return found;
  }
  throw new Error(`the A1 key holds no KPI labelled "${label}"`);
}

/** A1's own printed value without its trailing percent, so `5,65,692.47` and `99.32` read as the key prints them. */
function a1Value(label: string): string {
  return a1Kpi(label).value.replace(/%$/, '');
}

/** A1's KPI share as the number before its `%`, e.g. `0.54` from `0.54% of available`. */
function a1Share(label: string): string {
  const sub = a1Kpi(label).sub;
  const match = /^([\d.]+)%/.exec(sub);
  if (match === null) throw new Error(`the A1 KPI "${label}" has no share: ${sub}`);
  return match[1]!;
}

/** A3's PLANT TOTAL pair: the MTTR cell on the labelled row, the MTBF cell on the row below it. */
function a3PlantTotal(): { mttr: string; mtbf: string } {
  const page = A3.pages[0]!;
  const table = page.tables.find((candidate) => candidate.title.includes('Cell-wise'));
  if (table === undefined) throw new Error('the A3 key holds no cell-wise table');
  const index = table.rows.findIndex((row) => row[0]?.startsWith('PLANT TOTALMTTR / MTBF'));
  if (index < 0) throw new Error('the A3 key holds no PLANT TOTAL pair');
  const mttrRow = table.rows[index]!;
  const mtbfRow = table.rows[index + 1]!;
  return { mttr: mttrRow[mttrRow.length - 1]!, mtbf: mtbfRow[mtbfRow.length - 1]! };
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

const ticket = (
  id: string,
  machineId: string,
  source: TicketRow['source'],
  kind: TicketRow['kind'] = 'stopped',
): TicketRow => ({
  id,
  ref: id,
  kind,
  status: 'closed',
  machineId,
  reportedAt: '2026-01-01T04:00:00.000Z',
  closedAt: '2026-01-01T05:00:00.000Z',
  source,
  downtimeMin: 0,
  repairMin: null,
  workType: null,
});

const report = (
  id: string,
  ticketId: string,
  date: string,
  rest: { minutes: number; shift?: string; code?: string | null },
): ReportRow => ({
  id,
  ticketId,
  machineId: 'm1',
  date,
  shift: rest.shift ?? '1',
  problem: 'x',
  downtimeMin: rest.minutes,
  responseMin: null,
  repairMin: null,
  category: null,
  maintCode: rest.code ?? null,
  spareUsed: null,
  rootCause: null,
  doneBy: [],
  supportedBy: [],
});

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
 * The cutover fixture: one machine, the year's share exactly 1 (6,300 working hours; the legacy column 6,000).
 * Two history rows, a live close, a live row that repeats the first history row exactly, a PM row and a live NO DT
 * row. Four failures; the duplicate drops, the PM row is not a failure and the NO DT row loses no time.
 */
function cutoverData(): EngineData {
  return plantData(
    [
      ticket('h1', 'm1', 'history'),
      ticket('h2', 'm1', 'history'),
      ticket('l1', 'm1', 'live'),
      ticket('l2', 'm1', 'live'),
      ticket('p1', 'm1', 'history'),
      ticket('n1', 'm1', 'live'),
    ],
    [
      report('r1', 'h1', '2026-03-02', { minutes: 60, code: 'E' }),
      report('r2', 'h2', '2026-04-06', { minutes: 120, shift: '2', code: 'M' }),
      report('r3', 'l1', '2026-11-02', { minutes: 90, code: 'E' }),
      report('r4', 'l2', '2026-03-02', { minutes: 60, code: 'E' }),
      report('r5', 'p1', '2026-05-04', { minutes: 240, code: 'PM' }),
      report('r6', 'n1', '2026-06-02', { minutes: 30, shift: '2', code: 'NO DT' }),
    ],
  );
}

describe('the working-hours basis', () => {
  it('is the union of the plant’s active windows, 629 and 631 minutes, the overlap to the later shift', () => {
    const shifts = ENGINE_DATA.shifts!;
    expect(shifts.map((shift) => shift.code)).toEqual(['1', '2']);
    expect(workingMinutesPerDay(shifts)).toEqual({ total: 1_260, byShift: { '1': 629, '2': 631 } });

    const calendar = shiftCalendar(shifts, 'Asia/Kolkata');
    expect(
      calendar.windows.map((window) => [
        window.code,
        window.startMinute,
        window.endMinute,
        window.crossesMidnight,
      ]),
    ).toEqual([
      ['1', 8 * 60, 18 * 60 + 29, false],
      ['2', 18 * 60 + 29, 5 * 60, true],
    ]);
    // One plant day's union is the 21 hours the two windows cover: 5 h before 05:00, 10 h 29 min in shift 1,
    // 5 h 31 min after 18:29.
    const from = new Date('2026-11-11T00:00:00+05:30');
    const to = new Date('2026-11-12T00:00:00+05:30');
    expect(businessMinutesBetween(from, to, calendar)).toBe(1_260);
  });

  it('gives each machine its own share of 6,300 hours and the plant the summed total', () => {
    const plant = workingHoursPlant(ENGINE_DATA, DEFAULT_PROFILE, AS_OF);
    expect(plant.minutesPerDay).toBe(EXPECTED.minutesPerDay);
    expect(plant.annualHours).toBe(EXPECTED.annualHours);
    expect(plant.machines).toHaveLength(EXPECTED.machines);
    expect(plant.machines.every(isProduction)).toBe(true);

    const production = ENGINE_DATA.machines.filter(isProduction);
    let summed = 0;
    for (const machine of production) {
      const start =
        machine.purchasedOn !== null && machine.purchasedOn > plant.window.from
          ? machine.purchasedOn
          : plant.window.from;
      const own = EXPECTED.annualHours * periodFraction(start, AS_OF);
      expect(workingHoursFor(machine, ENGINE_DATA.shifts!, 300, plant.window)).toBeCloseTo(own, 8);
      summed += own;
    }
    expect(plant.hours!).toBeCloseTo(summed, 6);
    expect(plant.hours!).toBeCloseTo(EXPECTED.workingHours, 6);

    // The two bases are the same fractions under 6,300 and 6,000, and the legacy one is A1's own printed total.
    const legacy = legacyTotals(ENGINE_DATA, DEFAULT_PROFILE, AS_OF);
    expect(legacy.workingHours!).toBeCloseTo(summed * (6_000 / 6_300), 6);
    expect(formatInr(legacy.workingHours!, 2)).toBe(a1Value('Total Available Hrs'));
    expect(formatInr(legacy.workingHours!, 2)).toBe('5,65,692.47');
    expect(formatInr(plant.hours!, 2)).toBe(EXPECTED.printed.workingHours);
  });

  it('leaves a switched-off shift out, and a third row keeps its own minutes only when it is on', () => {
    const two = ENGINE_DATA.shifts!;
    const third: ShiftRow = {
      code: '3',
      name: 'Shift 3',
      startMinute: 5 * 60,
      endMinute: 8 * 60,
      crossesMidnight: false,
      active: false,
    };
    expect(workingMinutesPerDay([...two, third])).toEqual({
      total: 1_260,
      byShift: { '1': 629, '2': 631 },
    });
    const on = workingMinutesPerDay([...two, { ...third, active: true }]);
    expect(on.total).toBe(1_440);
    expect(on.byShift).toEqual({ '1': 629, '2': 631, '3': 180 });
  });
});

describe('the comparison figure', () => {
  it('prints the whole expected table: the platform basis beside the working-hour basis', () => {
    const computed = figure();
    expect(computed.status).toBe('ready');
    const value = valueOf<CompareValue>();
    expect({ screen: value.screen, asOf: value.asOf }).toEqual({
      screen: 'shift-kpis',
      asOf: AS_OF,
    });

    // The four KPI facts: 21.0 h/day, 5,93,977.10 h, 1,279 failures, 8 machines with no failure.
    expect(kpiOf(value, 'Working Hours / Day').value).toBe('21.0');
    expect(kpiOf(value, 'Working Hours').value).toBe('5,93,977.10');
    expect(kpiOf(value, 'Failures').value).toBe('1,279');
    expect(kpiOf(value, 'Machines Without a Failure')).toMatchObject({
      value: String(EXPECTED.machinesWithoutFailure),
      sub: `${EXPECTED.machines} machines in production data`,
    });

    // The platform column is A3's PLANT TOTAL pair and A1's three KPI cells, read from their own files.
    const a3 = a3PlantTotal();
    const legacyCells = [
      a3.mtbf,
      a3.mttr,
      a1Value('Fleet Availability'),
      a1Share('Actual Breakdown'),
      a1Share('PM Downtime'),
    ];
    const table = tableOf(value);
    expect(table.title).toBe('The platform basis beside the working-hour basis');
    expect(table.header).toEqual(['Measure', 'Platform basis', 'Working-hour basis']);
    expect(table.rows.map((row) => row[0])).toEqual([
      'MTBF (hours)',
      'MTTR (hours)',
      'Availability (%)',
      'Breakdown %',
      'PM %',
    ]);
    expect(table.rows.map((row) => row[1])).toEqual(legacyCells);
    expect(table.rows.map((row) => row[2])).toEqual([
      EXPECTED.printed.mtbf,
      EXPECTED.printed.mttr,
      EXPECTED.printed.availability,
      EXPECTED.printed.bdPct,
      EXPECTED.printed.pmPct,
    ]);
    expect(table.rowCount).toBe(5);
  });

  it('states the same numbers in its value block, computed from exact minutes', () => {
    const value = valueOf<CompareValue>();
    expect(value.basis.minutesPerDay).toBe(EXPECTED.minutesPerDay);
    expect(value.basis.annualHours).toBe(EXPECTED.annualHours);
    const { legacy, standard } = value.basis;
    expect(legacy.workingHours!).toBeCloseTo(EXPECTED.legacyWorkingHours, 6);
    expect(legacy.mttr!).toBeCloseTo(3_060.11 / 1_279, 10);
    expect(legacy.mtbf!).toBeCloseTo((EXPECTED.legacyWorkingHours - 3_060.11) / 1_279, 6);
    expect(standard.workingHours!).toBeCloseTo(EXPECTED.workingHours, 6);
    expect(standard.failures).toBe(EXPECTED.failures);
    expect(standard.machines).toBe(EXPECTED.machines);
    expect(standard.machinesWithoutFailure).toBe(EXPECTED.machinesWithoutFailure);
    expect(standard.breakdownHours).toBeCloseTo(EXPECTED.breakdownHours, 10);
    expect(standard.pmHours).toBeCloseTo(EXPECTED.pmHours, 10);
    expect(standard.mttr!).toBeCloseTo(EXPECTED.mttr, 10);
    expect(standard.mtbf!).toBeCloseTo(EXPECTED.mtbf, 10);
    expect(standard.availability!).toBeCloseTo(EXPECTED.availability, 10);
    expect(standard.bdPct!).toBeCloseTo(EXPECTED.bdPct, 10);
    expect(standard.pmPct!).toBeCloseTo(EXPECTED.pmPct, 10);
  });

  it('drills every failure ticket it read, history and live', () => {
    const computed = figure();
    expect(computed.drill.type).toBe('ticket');
    expect(computed.drill.ids).toHaveLength(EXPECTED.failures);
    const known = new Set([...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((row) => row.id));
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
  });

  it('is ready with a dash column and an honest KPI when the plant has no shift windows', () => {
    const noShifts: EngineData = { ...ENGINE_DATA, shifts: [] };
    const computed = figure(noShifts);
    expect(computed.status).toBe('ready');
    const value = computed.value as unknown as CompareValue;
    expect(value.pages[0]!.kpis.map((kpi) => kpi.label)).toEqual(['No shift windows in Settings']);
    expect(value.pages[0]!.kpis[0]!.value).toBe('—');
    expect(value.basis.minutesPerDay).toBe(0);
    expect(value.basis.standard.workingHours).toBeNull();
    // MTTR needs no working hours; the four cells that divide by them are dashes.
    expect(tableOf(value).rows.map((row) => row[2])).toEqual([
      '—',
      EXPECTED.printed.mttr,
      '—',
      '—',
      '—',
    ]);
  });

  it('prints nothing for a plant with no failure at all', () => {
    const noRows: EngineData = { ...ENGINE_DATA, reports: [], tickets: [], tasks: [] };
    const computed = COMPUTERS['shift-kpis.compare']!({
      data: noRows,
      asOf: AS_OF,
      profile: DEFAULT_PROFILE,
    });
    expect(computed).toEqual({ value: null, drillIds: [] });
  });
});

describe('the failure set', () => {
  it('counts a live close and a NO DT row with zero hours, drops the exact duplicate and the PM row', () => {
    const standard = standardTotals(cutoverData(), DEFAULT_PROFILE, YEAR_END);
    expect(standard.failures).toBe(4);
    expect(standard.breakdownHours).toBeCloseTo(4.5, 10);
    expect(standard.pmHours).toBeCloseTo(4, 10);
    expect(standard.workingHours!).toBeCloseTo(6_300, 6);
    expect(standard.mttr!).toBeCloseTo(1.125, 10);
    expect(standard.mtbf!).toBeCloseTo(1_573.875, 6);
    expect(standard.availability!).toBeCloseTo(1 - 8.5 / 6_300, 10);

    const legacy = legacyTotals(cutoverData(), DEFAULT_PROFILE, YEAR_END);
    expect(legacy.failures).toBe(2);
    expect(legacy.breakdownHours).toBeCloseTo(3, 10);
    expect(legacy.mttr!).toBeCloseTo(1.5, 10);
    expect(legacy.mtbf!).toBeCloseTo(2_998.5, 6);

    // The printed cells of the same data: the live close moves the standard column and not the platform's.
    const computed = COMPUTERS['shift-kpis.compare']!({
      data: cutoverData(),
      asOf: YEAR_END,
      profile: DEFAULT_PROFILE,
    });
    const value = computed.value as unknown as CompareValue;
    expect(tableOf(value).rows).toEqual([
      ['MTBF (hours)', '2,998.5', '1,573.9'],
      ['MTTR (hours)', '1.50', '1.13'],
      ['Availability (%)', '99.88', '99.87'],
      ['Breakdown %', '0.05', '0.07'],
      ['PM %', '0.07', '0.06'],
    ]);
  });

  it('counts a live repeat of the same four fields once, and a same-day repeat with different downtime twice', () => {
    const repeat = (liveMinutes: number): EngineData =>
      plantData(
        [ticket('h1', 'm1', 'history'), ticket('l1', 'm1', 'live')],
        [
          report('r1', 'h1', '2026-03-02', { minutes: 60, code: 'E' }),
          report('r2', 'l1', '2026-03-02', { minutes: liveMinutes, code: 'E' }),
        ],
      );
    const exact = standardTotals(repeat(60), DEFAULT_PROFILE, YEAR_END);
    expect(exact.failures).toBe(1);
    expect(exact.breakdownHours).toBeCloseTo(1, 10);

    const repeatSameDay = standardTotals(repeat(45), DEFAULT_PROFILE, YEAR_END);
    expect(repeatSameDay.failures).toBe(2);
    expect(repeatSameDay.breakdownHours).toBeCloseTo((60 + 45) / 60, 10);
    expect(failureEvents(repeat(45)).map((event) => event.ticket.id)).toEqual(['h1', 'l1']);
  });

  it('leaves out a support ticket, a PM job and a general work request, and keeps history in', () => {
    const data = plantData(
      [
        ticket('h1', 'm1', 'history'),
        ticket('h2', 'm1', 'history'),
        ticket('s1', 'm1', 'live', 'support'),
        ticket('p1', 'm1', 'live', 'general'),
        ticket('g1', 'm1', 'live', 'general'),
      ],
      [
        report('r1', 'h1', '2026-03-02', { minutes: 60, code: 'E' }),
        report('r2', 'h2', '2026-04-06', { minutes: 30, shift: '2', code: 'M' }),
        report('r3', 's1', '2026-05-02', { minutes: 90, code: 'E' }),
        report('r4', 'p1', '2026-06-02', { minutes: 240, code: 'PM' }),
        report('r5', 'g1', '2026-07-02', { minutes: 45, code: 'E' }),
      ],
    );
    expect(failureEvents(data).map((event) => event.ticket.id)).toEqual(['h1', 'h2']);
    const standard = standardTotals(data, DEFAULT_PROFILE, YEAR_END);
    expect(standard.failures).toBe(2);
    expect(standard.breakdownHours).toBeCloseTo(1.5, 10);
    expect(standard.pmHours).toBeCloseTo(4, 10);
  });

  it('counts an open breakdown nowhere: it is in no failure set', () => {
    const open = { ...ticket('o1', 'm1', 'live'), status: 'open' as const, closedAt: null };
    const data = plantData([open], [report('r1', 'o1', '2026-03-02', { minutes: 60, code: 'E' })]);
    expect(failureEvents(data)).toEqual([]);
    expect(standardTotals(data, DEFAULT_PROFILE, YEAR_END).failures).toBe(0);
  });
});
