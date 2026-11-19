import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import type { EngineData, MachineRow, ReportRow, TicketRow } from '../src/index.js';
import {
  availabilityWindow,
  availableHours,
  gapMonths,
  hoursIn,
  periodFraction,
  yearToDate,
  type Period,
} from '../src/analytics/availability.js';

/**
 * The period seam (ticket 76, packet 76a): a span of plant dates with the months the plant never recorded, the
 * hours of that span, and the gap list. Built by hand from a plant of three machines bought in 2020 and one bought on
 * 1 January 2026, with no records in July 2025. Every expected value is a sum written beside it, never an engine run.
 */

const ANNUAL = DEFAULT_PROFILE.prodHrsPerDay * DEFAULT_PROFILE.workDaysPerYear;
const MONTHLY = ANNUAL / 12;

const machine = (id: string, purchasedOn: string | null): MachineRow => ({
  id,
  code: id,
  segment: 'CNC',
  category: 'Turning Center',
  cell: '1',
  location: null,
  make: null,
  model: null,
  controller: null,
  year: null,
  purchasedOn,
  powerKw: null,
  capacityKva: null,
  assetCode: null,
  status: 'active',
  criticality: null,
  excludedFromProduction: false,
  metadata: {},
});

const OLD = [
  machine('TC-1', '2020-01-01'),
  machine('TC-2', '2020-01-01'),
  machine('VC-1', '2020-01-01'),
];
const PLANT = [...OLD, machine('VC-2', '2026-01-01')];

const SPAN_2025: Period = { from: '2025-01-01', to: '2025-12-31', noRecords: ['2025-07'] };
const SPAN_2026: Period = { from: '2026-01-01', to: '2026-12-31', noRecords: [] };
const SPAN_BOTH: Period = { from: '2025-01-01', to: '2026-12-31', noRecords: ['2025-07'] };

const hours = (machines: MachineRow[], period: Period): number =>
  machines.reduce((sum, row) => sum + hoursIn(row, ANNUAL, period), 0);

const report = (date: string): ReportRow => ({
  id: `r-${date}`,
  ticketId: null,
  machineId: 'TC-1',
  date,
  shift: '1',
  problem: 'Axis jam',
  downtimeMin: 60,
  responseMin: null,
  repairMin: null,
  category: null,
  maintCode: null,
  spareUsed: null,
  rootCause: null,
  doneBy: [],
  supportedBy: [],
});

const ticket = (reportedAt: string): TicketRow => ({
  id: `t-${reportedAt}`,
  ref: `BD-${reportedAt}`,
  kind: 'stopped',
  status: 'closed',
  machineId: 'TC-1',
  reportedAt,
  closedAt: reportedAt,
  source: 'history',
  downtimeMin: 60,
  repairMin: 60,
  workType: null,
});

/** One report on the 5th of each listed month, so a month is recorded exactly when it is listed. */
const dataWith = (reports: string[], tickets: string[] = []): EngineData => ({
  timeZone: 'Asia/Kolkata',
  machines: PLANT,
  moves: [],
  tickets: tickets.map(ticket),
  tasks: [],
  reports: reports.map(report),
  people: [],
  lists: {},
});

const monthsOf = (year: number, skip: number[] = []): string[] =>
  Array.from({ length: 12 }, (_, index) => index + 1)
    .filter((month) => !skip.includes(month))
    .map((month) => `${year}-${String(month).padStart(2, '0')}-05`);

describe('hoursIn', () => {
  it('gives the plant 16,500 hours in 2025, 24,000 in 2026 and 40,500 in both, July 2025 left out', () => {
    expect(hours(OLD, SPAN_2025)).toBe(3 * 11 * MONTHLY);
    expect(hours(PLANT, SPAN_2025)).toBe(16_500);
    expect(hours(PLANT, SPAN_2026)).toBe(24_000);
    expect(hours(PLANT, SPAN_BOTH)).toBe(40_500);
  });

  it('counts a machine from its purchase date, and none before it', () => {
    const vc2 = machine('VC-2', '2026-01-01');
    expect(hoursIn(vc2, ANNUAL, SPAN_2025)).toBe(0);
    expect(hoursIn(vc2, ANNUAL, SPAN_BOTH)).toBe(6_000);
    expect(hoursIn(machine('VC-3', null), ANNUAL, SPAN_2025)).toBe(5_500);
  });

  it('skips a gap month before the purchase date without adding or removing hours', () => {
    const bought = machine('VC-4', '2025-09-16');
    // 15 of 30 days in September, then October, November and December: 1,750 hours, each month a twelfth of 6,000.
    expect(hoursIn(bought, ANNUAL, SPAN_2025)).toBe(
      ANNUAL * (15 / 30 / 12 + 1 / 12 + 1 / 12 + 1 / 12),
    );
    expect(hoursIn(bought, ANNUAL, SPAN_2025)).toBeCloseTo(1_750, 9);
    expect(hoursIn(bought, ANNUAL, { from: '2025-01-01', to: '2025-12-31' })).toBe(
      hoursIn(bought, ANNUAL, SPAN_2025),
    );
  });
});

describe('periodFraction', () => {
  it('drops each named month and leaves the rest of the window alone', () => {
    expect(ANNUAL * periodFraction('2025-01-01', '2025-12-31', ['2025-07'])).toBe(5_500);
    expect(periodFraction('2025-06-16', '2025-08-31', ['2025-07'])).toBe(15 / 30 / 12 + 1 / 12);
    expect(periodFraction('2025-07-01', '2025-07-31', ['2025-07'])).toBe(0);
  });

  it('adds many years as whole years, so two full years are exactly two', () => {
    expect(periodFraction('2025-01-01', '2026-12-31')).toBe(2);
    expect(ANNUAL * periodFraction('2025-01-01', '2026-12-31', ['2025-07'])).toBe(11_500);
  });
});

describe('yearToDate', () => {
  it('is 1 January of the as-of year to the as-of date, with no gap month', () => {
    expect(yearToDate('2026-11-11')).toEqual({ from: '2026-01-01', to: '2026-11-11' });
    expect(yearToDate('2027-01-02')).toEqual({ from: '2027-01-01', to: '2027-01-02' });
  });

  it('returns the same doubles as the days-so-far window the 2026 answer key is built on', () => {
    const window = availabilityWindow('2026-11-11', '2026-11-05');
    expect(yearToDate('2026-11-11')).toEqual(window);
    const key = yearToDate('2026-11-11');
    expect(hoursIn(OLD[0]!, ANNUAL, key)).toBe(5183.333333333334);
    expect(hoursIn(OLD[0]!, ANNUAL, key)).toBe(
      availableHours(OLD[0]!, ANNUAL, window.from, window.to),
    );
    expect(hoursIn(machine('TC-9', '2026-03-17'), ANNUAL, key)).toBe(3925.2688172043013);
    expect(periodFraction(key.from, key.to)).toBe(0.8638888888888889);
  });
});

describe('gapMonths', () => {
  it('finds July 2025, the one month with no report and no ticket, from the first record to the as-of date', () => {
    const data = dataWith([...monthsOf(2025, [7]), ...monthsOf(2026)]);
    expect(gapMonths(data, '2026-12-31')).toEqual(['2025-07']);
  });

  it('counts a month with a ticket and no report as recorded', () => {
    const data = dataWith(
      [...monthsOf(2025, [7, 9]), ...monthsOf(2026)],
      ['2025-09-05T04:00:00.000Z'],
    );
    expect(gapMonths(data, '2026-12-31')).toEqual(['2025-07']);
  });

  it('dates a ticket by the plant day, not the UTC day', () => {
    // 19:30Z on 31 July is 01:00 on 1 August in Asia/Kolkata: July stays empty, August is recorded.
    const data = dataWith(
      [...monthsOf(2025, [7, 8]), ...monthsOf(2026)],
      ['2025-07-31T19:30:00.000Z'],
    );
    expect(gapMonths(data, '2026-12-31')).toEqual(['2025-07']);
  });

  it('starts at the first record, so the months before the plant began are not gaps', () => {
    const data = dataWith([...monthsOf(2025, [1, 2, 3, 7])]);
    expect(gapMonths(data, '2025-12-31')).toEqual(['2025-07']);
  });

  it('reads only what the as-of date has reached, and names no gap for a plant with no records', () => {
    const data = dataWith([...monthsOf(2025, [7]), ...monthsOf(2026)]);
    expect(gapMonths(data, '2025-06-30')).toEqual([]);
    expect(gapMonths(data, '2025-10-15')).toEqual(['2025-07']);
    expect(gapMonths(dataWith([]), '2026-12-31')).toEqual([]);
  });
});
