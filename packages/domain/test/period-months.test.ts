import { describe, expect, it } from 'vitest';
import {
  calendarMonths,
  historyOf,
  monthLabel,
  observedDays,
  yearLabel,
  yearToDate,
  type Period,
} from '../src/analytics/availability.js';
import type { EngineData } from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND, NO_RECORDS, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * The period's months, labels, observed days and history window (ticket 76, packet 76c), read over the two-year plant
 * and held whole against `many-years/hand.ts`. The expected values are hand arithmetic, never an engine run.
 */

const period = (key: SpanKey): Period => ({
  from: HAND[key].from,
  to: HAND[key].to,
  noRecords: HAND[key].noRecords,
});

/** The first and last breakdown of each span: 5 January and 20 December of its first and last year. */
const FIRST_LAST: Readonly<Record<SpanKey, readonly [string, string]>> = {
  '2025': ['2025-01-05', '2025-12-20'],
  '2026': ['2026-01-05', '2026-12-20'],
  both: ['2025-01-05', '2026-12-20'],
};

const YEARS: Readonly<Record<SpanKey, readonly number[]>> = {
  '2025': [2025],
  '2026': [2026],
  both: [2025, 2026],
};

const monthKeys = (key: SpanKey): string[] =>
  YEARS[key].flatMap((year) =>
    Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`),
  );

describe('calendarMonths', () => {
  it('lists January of the first year to December of the last: 12, 12 and 24 months', () => {
    expect(SPAN_KEYS.map((key) => calendarMonths(period(key)).length)).toEqual([12, 12, 24]);
    for (const key of SPAN_KEYS) {
      expect(calendarMonths(period(key)).map((month) => month.key)).toEqual(monthKeys(key));
    }
  });

  it('marks July 2025 no-records and every other month of the plant recorded', () => {
    for (const key of SPAN_KEYS) {
      const states = calendarMonths(period(key)).map((month) => [month.key, month.state]);
      expect(states).toEqual(
        monthKeys(key).map((month) => [
          month,
          HAND[key].noRecords.includes(month) ? 'no-records' : 'recorded',
        ]),
      );
    }
  });

  it('gives a month its year, number and calendar days', () => {
    const months = calendarMonths(period('both'));
    expect(months[0]).toEqual({
      key: '2025-01',
      year: 2025,
      month: 1,
      from: '2025-01-01',
      to: '2025-01-31',
      state: 'recorded',
    });
    expect(months[6]).toEqual({
      key: '2025-07',
      year: 2025,
      month: 7,
      from: '2025-07-01',
      to: '2025-07-31',
      state: 'no-records',
    });
    expect(months[13]).toEqual({
      key: '2026-02',
      year: 2026,
      month: 2,
      from: '2026-02-01',
      to: '2026-02-28',
      state: 'recorded',
    });
  });

  it('marks the months of a part-year span that lie wholly outside it', () => {
    const states = calendarMonths({ from: '2026-03-15', to: '2026-09-10', noRecords: [] }).map(
      (month) => month.state,
    );
    expect(states).toEqual([
      'outside',
      'outside',
      'recorded',
      'recorded',
      'recorded',
      'recorded',
      'recorded',
      'recorded',
      'recorded',
      'outside',
      'outside',
      'outside',
    ]);
  });
});

describe('labels', () => {
  it('prints Jan to Dec inside one year and Jan 25 to Dec 26 across two', () => {
    const labels = (key: SpanKey): string[] =>
      calendarMonths(period(key)).map((month) => monthLabel(month, period(key)));
    expect(labels('2025')).toEqual([
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
      'Dec',
    ]);
    expect(labels('2026')).toEqual(labels('2025'));
    expect(labels('both')).toEqual([
      ...labels('2025').map((label) => `${label} 25`),
      ...labels('2025').map((label) => `${label} 26`),
    ]);
    expect(labels('both')[0]).toBe('Jan 25');
  });

  it('names the years 2025, 2026 and 2025–2026', () => {
    expect(SPAN_KEYS.map((key) => yearLabel(period(key)))).toEqual(['2025', '2026', '2025–2026']);
  });

  it('prints a month with no records as the words, never a zero', () => {
    expect(NO_RECORDS).toBe('no records');
    expect(HAND['2025'].a1PlantBdPct['2025-07']).toBe(NO_RECORDS);
  });
});

describe('observedDays', () => {
  it('counts first breakdown to last, the days of a no-records month out: 319, 350 and 684', () => {
    const days = SPAN_KEYS.map((key) =>
      observedDays(FIRST_LAST[key][0], FIRST_LAST[key][1], period(key)),
    );
    expect(days).toEqual(SPAN_KEYS.map((key) => HAND[key].observedDays));
    expect(days).toEqual([319, 350, 684]);
  });

  it('counts a machine from its purchase date: VC-2, bought 1 January 2026, observes 354 days', () => {
    expect(observedDays('2025-01-05', '2026-12-20', period('both'), '2026-01-01')).toBe(354);
    expect(observedDays('2025-01-05', '2026-12-20', period('both'), null)).toBe(684);
  });

  it('leaves the days alone when the span names no gap month', () => {
    expect(observedDays('2025-01-05', '2025-12-20', { from: '2025-01-01', to: '2025-12-31' })).toBe(
      350,
    );
  });
});

describe('historyOf', () => {
  it('runs from 1 January of the first record year to the run date, whatever the span', () => {
    expect(historyOf(MANY_YEARS, AS_OF_ENGINE)).toEqual({ from: '2025-01-01', to: AS_OF_ENGINE });
    for (const key of SPAN_KEYS) {
      expect(historyOf(MANY_YEARS, HAND[key].to)).toEqual({
        from: HAND.both.from,
        to: HAND[key].to,
      });
    }
  });

  it('starts at 2026 when the plant holds nothing earlier', () => {
    const from2026: EngineData = {
      ...MANY_YEARS,
      reports: MANY_YEARS.reports.filter((row) => row.date >= HAND['2026'].from),
      tickets: MANY_YEARS.tickets.filter((row) => row.reportedAt >= HAND['2026'].from),
      tasks: MANY_YEARS.tasks.filter((row) => row.reportedAt >= HAND['2026'].from),
    };
    expect(historyOf(from2026, HAND['2026'].to)).toEqual({
      from: HAND['2026'].from,
      to: HAND['2026'].to,
    });
  });

  it('falls back to the year so far when the plant holds no record', () => {
    const empty: EngineData = { ...MANY_YEARS, reports: [], tickets: [], tasks: [] };
    expect(historyOf(empty, '2026-11-11')).toEqual(yearToDate('2026-11-11'));
  });
});
