import { describe, expect, it } from 'vitest';
import { dataAsOf } from '../src/analytics/as-of.js';
import { failureEvents } from '../src/analytics/standard-kpis.js';
import type { EngineData, MachineRow, ReportRow } from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { HAND, SPAN_KEYS, type HandSpan } from './many-years/hand.js';

/**
 * The two-year fixture (ticket 76, packet 76b) and the hand values written beside it. This file counts the fixture's
 * own rows with plain loops and holds them against `hand.ts`, whose numbers are arithmetic on the fixture's rule.
 * It runs no figure of the engine, so a wrong hand value fails here and not in the packet that first reads it.
 */

const data: EngineData = MANY_YEARS;
const reports: readonly ReportRow[] = data.reports;
const isPm = (report: ReportRow): boolean => report.maintCode === 'PM';
const isFailure = (report: ReportRow): boolean => !isPm(report);
const monthOf = (date: string): string => date.slice(0, 7);
const round = (value: number, decimals: number): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;
const DAY_MS = 86_400_000;
const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const daysInMonth = (month: string): number => {
  const [year, number] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
};

/** The rows of one span, by the date the report carries. */
const inSpan = (span: HandSpan, rows: readonly ReportRow[] = reports): ReportRow[] =>
  rows.filter((report) => report.date >= span.from && report.date <= span.to);

/** Months with any report, counted over the whole plant: the plant's own record of what it kept. */
const recordedMonths = (span: HandSpan): string[] => [
  ...new Set(inSpan(span).map((report) => monthOf(report.date))),
];

/** Every `YYYY-MM` the span covers, January of its first year to December of its last. */
function monthsOf(span: HandSpan): string[] {
  const first = Number(span.from.slice(0, 4));
  const last = Number(span.to.slice(0, 4));
  const months: string[] = [];
  for (let year = first; year <= last; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      months.push(`${year}-${String(month).padStart(2, '0')}`);
    }
  }
  return months;
}

const productionMachines = (span: HandSpan): MachineRow[] =>
  data.machines.filter((machine) => machine.purchasedOn !== null && machine.purchasedOn <= span.to);

/** A machine's recorded months in the span from its purchase month on: each is 500 available hours. */
const machineMonths = (machine: MachineRow, span: HandSpan): number =>
  recordedMonths(span).filter((month) => month >= monthOf(machine.purchasedOn!)).length;

const hoursOf = (rows: readonly ReportRow[]): number =>
  rows.reduce((sum, report) => sum + (report.maintCode === 'NO DT' ? 0 : report.downtimeMin), 0) /
  60;

/** Days from the first to the last breakdown, both included, with every month that has no record taken out. */
function observedDays(span: HandSpan): number {
  const dates = inSpan(span)
    .filter(isFailure)
    .map((report) => report.date)
    .sort();
  const first = dates[0]!;
  const last = dates.at(-1)!;
  const kept = new Set(recordedMonths(span));
  const gapDays = monthsOf(span)
    .filter((month) => month >= monthOf(first) && month <= monthOf(last) && !kept.has(month))
    .reduce((sum, month) => sum + daysInMonth(month), 0);
  return dayNumber(last) - dayNumber(first) + 1 - gapDays;
}

describe('the two-year fixture, as built', () => {
  it('holds 245 closed history rows, each report under its own ticket: 210 breakdowns, 7 NO DT, 28 PM', () => {
    expect(reports).toHaveLength(245);
    expect(data.tickets).toHaveLength(245);
    expect(data.tasks).toEqual([]);
    expect(new Set(data.tickets.map((ticket) => ticket.id)).size).toBe(245);
    expect(new Set(reports.map((report) => report.ticketId))).toEqual(
      new Set(data.tickets.map((ticket) => ticket.id)),
    );
    expect(data.tickets.every((ticket) => ticket.status === 'closed')).toBe(true);
    expect(data.tickets.every((ticket) => ticket.source === 'history')).toBe(true);
    expect(reports.filter((report) => report.maintCode === 'PM')).toHaveLength(28);
    expect(reports.filter((report) => report.maintCode === 'NO DT')).toHaveLength(7);
    expect(reports.filter((report) => ['AX', 'EL'].includes(report.maintCode ?? ''))).toHaveLength(
      210,
    );
  });

  it('carries every PM job as a planned ticket with its scheduled day, and no other row as one', () => {
    const planned = data.tickets.filter((ticket) => ticket.raisedChannel === 'pm');
    expect(planned).toHaveLength(28);
    const dateOf = new Map(reports.map((report) => [report.ticketId, report.date]));
    expect(planned.every((ticket) => ticket.scheduledOn === dateOf.get(ticket.id))).toBe(true);
    expect(data.tickets.filter((ticket) => ticket.raisedChannel === undefined)).toHaveLength(217);
  });

  it('has nothing at all in July 2025, and a record in every other month of both years', () => {
    expect(reports.filter((report) => monthOf(report.date) === '2025-07')).toEqual([]);
    expect(
      data.tickets.filter((ticket) => ticket.reportedAt.startsWith('2025-07')).length +
        data.tickets.filter((ticket) => ticket.closedAt?.startsWith('2025-07')).length,
    ).toBe(0);
    const months = new Set(reports.map((report) => monthOf(report.date)));
    expect(months.size).toBe(23);
    expect(months.has('2025-06') && months.has('2025-08')).toBe(true);
    expect([...months].filter((month) => month.startsWith('2026'))).toHaveLength(12);
  });

  it('has VC-2 in 2026 only, and the other three machines in both years', () => {
    const years = (code: string): string[] => [
      ...new Set(
        reports
          .filter((report) => report.machineId === code)
          .map((report) => report.date.slice(0, 4)),
      ),
    ];
    expect(years('VC-2')).toEqual(['2026']);
    expect(data.machines.find((machine) => machine.id === 'VC-2')?.purchasedOn).toBe('2026-01-01');
    for (const code of ['TC-1', 'TC-2', 'VC-1']) {
      expect(years(code)).toEqual(['2025', '2026']);
      expect(data.machines.find((machine) => machine.id === code)?.purchasedOn).toBe('2020-01-01');
    }
  });

  it('has two cells of two machines, two categories and two people', () => {
    const cell = (id: string): string | null =>
      data.machines.find((machine) => machine.id === id)?.cell ?? null;
    expect(data.machines.map((machine) => machine.id)).toEqual(['TC-1', 'VC-1', 'TC-2', 'VC-2']);
    expect([cell('TC-1'), cell('VC-1'), cell('TC-2'), cell('VC-2')]).toEqual(['1', '1', '2', '2']);
    expect(data.machines.every((machine) => machine.segment === 'CNC')).toBe(true);
    expect(data.machines.map((machine) => machine.category)).toEqual([
      'Turning Center',
      'Vertical Machining Center',
      'Turning Center',
      'Vertical Machining Center',
    ]);
    expect(data.people.map((person) => [person.code, person.displayName])).toEqual([
      ['P-1', 'Person 1'],
      ['P-2', 'Person 2'],
    ]);
    expect(data.shifts?.map((shift) => [shift.startMinute, shift.endMinute])).toEqual([
      [8 * 60, 18 * 60 + 29],
      [18 * 60 + 29, 5 * 60],
    ]);
  });
});

describe('hand.ts against the fixture rows, counted without the engine', () => {
  it.each(SPAN_KEYS)('span %s: the counts, hours and hours-available equal the table', (key) => {
    const span = HAND[key];
    const rows = inSpan(span);
    const failures = rows.filter(isFailure);
    expect(span.recordedMonths).toBe(recordedMonths(span).length);
    expect(monthsOf(span).filter((month) => !recordedMonths(span).includes(month))).toEqual(
      span.noRecords,
    );
    expect(productionMachines(span)).toHaveLength(span.machines);
    expect(failures).toHaveLength(span.failures);
    expect(hoursOf(failures)).toBe(span.breakdownHours);
    expect(hoursOf(rows.filter(isPm))).toBe(span.pmHours);
    const available = productionMachines(span).reduce(
      (sum, machine) => sum + 500 * machineMonths(machine, span),
      0,
    );
    expect(available).toBe(span.availableHours);
    const working = productionMachines(span).reduce(
      (sum, machine) => sum + 525 * machineMonths(machine, span),
      0,
    );
    expect(working).toBe(span.workingHours);
  });

  it.each(SPAN_KEYS)('span %s: every printed ratio is its own sum, rounded as printed', (key) => {
    const span = HAND[key];
    const { breakdownHours, pmHours, availableHours, failures } = span;
    expect(round((100 * breakdownHours) / availableHours, 2)).toBe(span.bdPct);
    expect(round((100 * pmHours) / availableHours, 2)).toBe(span.pmPct);
    expect(round(100 - (100 * (breakdownHours + pmHours)) / availableHours, 2)).toBe(
      span.availabilityPct,
    );
    expect(round(breakdownHours / failures, 2)).toBe(span.mttr);
    expect(round((availableHours - breakdownHours) / failures, 1)).toBe(span.mtbf);
    expect(round(breakdownHours / span.machines, 2)).toBe(span.bdHoursPerMachine);
    expect(observedDays(span)).toBe(span.observedDays);
    expect(round(failures / span.observedDays, 2)).toBe(span.breakdownsPerDay);
    expect(round(breakdownHours / span.observedDays, 2)).toBe(span.bdHoursPerDay);
  });

  it.each(SPAN_KEYS)('span %s: A1 PLANT TOTAL cells are a month over its own hours', (key) => {
    const span = HAND[key];
    const kept = new Set(recordedMonths(span));
    for (const [month, printed] of Object.entries(span.a1PlantBdPct)) {
      if (!kept.has(month)) {
        expect(printed).toBe('no records');
        continue;
      }
      const rows = reports.filter((report) => monthOf(report.date) === month && isFailure(report));
      const existing = data.machines.filter((machine) => monthOf(machine.purchasedOn!) <= month);
      const available = existing.length * 500;
      expect(`${round((100 * hoursOf(rows)) / available, 2).toFixed(2)}%`).toBe(printed);
    }
  });

  it.each(['TC-1', 'VC-2'] as const)('machine %s: the page MTBF is its own sum', (code) => {
    const machine = data.machines.find((candidate) => candidate.id === code)!;
    for (const key of SPAN_KEYS) {
      const span = HAND[key];
      const rows = inSpan(span).filter((report) => report.machineId === code && isFailure(report));
      const expected = code === 'TC-1' ? span.mtbfTc1 : span.mtbfVc2;
      const available = 500 * machineMonths(machine, span);
      const mtbf = rows.length === 0 ? null : round((available - hoursOf(rows)) / rows.length, 1);
      expect(mtbf).toBe(expected);
    }
  });

  it('the span tables agree with one another: 2025 + 2026 is both', () => {
    const [a, b, both] = [HAND['2025'], HAND['2026'], HAND.both];
    const additive = [
      'failures',
      'breakdownHours',
      'pmHours',
      'availableHours',
      'workingHours',
    ] as const;
    for (const key of additive) expect(a[key] + b[key]).toBe(both[key]);
    expect(a.recordedMonths + b.recordedMonths).toBe(both.recordedMonths);
  });
});

describe('the fixture as the engine reads its rows', () => {
  it('every non-PM row is a failure to the engine, 217 over both years', () => {
    expect(failureEvents(data)).toHaveLength(HAND.both.failures);
  });

  it('is whole at the end of 2026 and holds the 2025 rows and three machines at the end of 2025', () => {
    const end2026 = dataAsOf(data, '2026-12-31');
    expect(end2026.reports).toHaveLength(245);
    expect(end2026.machines).toHaveLength(4);
    const end2025 = dataAsOf(data, '2025-12-31');
    expect(end2025.reports).toHaveLength(81);
    expect(end2025.machines.map((machine) => machine.id)).toEqual(['TC-1', 'VC-1', 'TC-2']);
    expect(failureEvents(end2025)).toHaveLength(HAND['2025'].failures);
  });
});
