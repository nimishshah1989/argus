import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type FigureResult } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * PM compliance and the reliability fit run per span (ticket 76, packet 76n), held against hand values.
 *
 * PM: every PM ticket is raised through the `pm` channel on its scheduled day and closed the same day (180 minutes), so
 * each is on time and each is a schedule hit. PM tickets: 3 machines x 4 = 12 in 2025, 4 x 4 = 16 in 2026, 28 across both.
 *
 * Reliability: a machine's failure events are its distinct failure dates. A recorded month holds 525 working hours
 * (21 h x 300 days / 12) spread over its days, a no-records month none, and a machine counts from its purchase date.
 * TC-1, TC-2 and VC-1 fail on days 5 and 20 of ten recorded 2025 months plus 8 January: 2 x 10 + 3 = 23 dates in
 * 2025; 2026 adds the 12th, so 3 x 12 + 1 = 37; both years 60. VC-2, bought 2026-01-01, has 37 and is not in the
 * 2025 span. The tail from the last failure (20 December) to the span's end is 11 of December's 31 days:
 * 11 x 525 / 31 hours. Hours to the span's end: 11 x 525 = 5,775 in 2025, 12 x 525 = 6,300 in 2026, 23 x 525 =
 * 12,075 across both, and 6,300 for VC-2. The fitted shape and scale are ticket 67's, proven by its own reference.
 */

const COUNTS: Record<SpanKey, number> = { '2025': 12, '2026': 16, both: 28 };
const EVENTS: Record<SpanKey, number> = { '2025': 23, '2026': 37, both: 60 };
const TAIL = (11 * 525) / 31;
const HOURS_TO_DATE: Record<SpanKey, number> = { '2025': 5_775, '2026': 6_300, both: 12_075 };
/** VC-2 is bought on 2026-01-01: the 2025 span holds three machines, the others four. */
const MACHINES: Record<SpanKey, string[]> = {
  '2025': ['TC-1', 'TC-2', 'VC-1'],
  '2026': ['TC-1', 'TC-2', 'VC-1', 'VC-2'],
  both: ['TC-1', 'TC-2', 'VC-1', 'VC-2'],
};

const run = (key: SpanKey): Record<string, FigureResult> => {
  const keys = ['pm-compliance', 'reliability'];
  const result = runWith(Object.fromEntries(keys.map((k) => [k, COMPUTERS[k]!])), {
    data: MANY_YEARS,
    asOf: AS_OF_ENGINE,
    profile: DEFAULT_PROFILE,
    span: { from: HAND[key].from, to: HAND[key].to },
  });
  return Object.fromEntries(
    result.figures.filter((f) => keys.includes(f.key)).map((f) => [f.key, f]),
  );
};

const settle = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value), (_key, found) =>
    typeof found === 'number' ? Math.round(found * 1e6) / 1e6 : found,
  ) as T;

/** Working hours from `start` to `date` by the hand rule: 525 a recorded month over its days, none in no-records months. */
function hoursAt(date: string, start: string, noRecords: readonly string[]): number {
  let total = 0;
  for (let month = start.slice(0, 7); month <= date.slice(0, 7);) {
    const [year, number] = month.split('-').map(Number) as [number, number];
    const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
    const days = month === date.slice(0, 7) ? Number(date.slice(8)) : length;
    if (!noRecords.includes(month)) total += (525 * days) / length;
    month = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
  }
  return total;
}

/** Crow-AMSAA's slope on a machine's failure dates, hours from the clock above: n over the sum of ln(T / t). */
function betaOf(machineId: string, key: SpanKey): number {
  const { from, to, noRecords } = HAND[key];
  const machine = MANY_YEARS.machines.find((row) => row.id === machineId)!;
  const start = machine.purchasedOn! > from ? machine.purchasedOn! : from;
  const dates = [
    ...new Set(
      MANY_YEARS.reports
        .filter((r) => r.machineId === machineId && r.maintCode !== 'PM')
        .filter((r) => r.date >= from && r.date <= to)
        .map((r) => r.date),
    ),
  ].sort();
  const end = hoursAt(to, start, noRecords);
  const spread = dates.reduce((sum, d) => sum + Math.log(end / hoursAt(d, start, noRecords)), 0);
  return dates.length / spread;
}

describe('pm-compliance per span', () => {
  it.each(SPAN_KEYS)("counts the span's PM work orders whole, span %s", (key) => {
    const figure = run(key)['pm-compliance']!;
    const count = COUNTS[key];
    expect(figure.value).toEqual({
      from: HAND[key].from,
      to: HAND[key].to,
      pm: {
        eligible: count,
        onTime: count,
        early: 0,
        late: 0,
        overdue: 0,
        cancelled: 0,
        pending: 0,
        pct: 100,
      },
      schedule: { eligible: count, done: count, missed: 0, pending: 0, pct: 100 },
    });
    expect(figure.drill.ids).toHaveLength(count);
  });
});

interface Fit {
  status: string;
  basis: string;
  ownEvents: number;
  events: number;
  completeIntervals: number;
  censoredHours: number;
  machines: number;
  trend: { n: number; beta: number };
}
interface Reliability {
  windowStart: string;
  asOf: string;
  machines: Record<string, { fit: Fit }>;
  categories: Record<string, Fit>;
}

describe('reliability per span', () => {
  const reliability = (key: SpanKey) => run(key).reliability!.value as unknown as Reliability;

  it.each(SPAN_KEYS)('starts at the span and counts its failure dates, span %s', (key) => {
    const value = reliability(key);
    const row = (events: number) => ({
      status: 'fitted',
      basis: 'machine',
      ownEvents: events,
      events,
      completeIntervals: events - 1,
      censoredHours: TAIL,
      n: events,
    });
    const found = MACHINES[key].map((id) => {
      const { status, basis, ownEvents, events, completeIntervals, censoredHours, trend } =
        value.machines[id]!.fit;
      return { status, basis, ownEvents, events, completeIntervals, censoredHours, n: trend.n };
    });
    expect(settle({ windowStart: value.windowStart, asOf: value.asOf, machines: found })).toEqual(
      settle({
        windowStart: HAND[key].from,
        asOf: HAND[key].to,
        machines: [EVENTS[key], EVENTS[key], EVENTS[key], 37]
          .slice(0, MACHINES[key].length)
          .map(row),
      }),
    );
  });

  it.each(SPAN_KEYS)("pools each category from the span's dates, span %s", (key) => {
    const value = reliability(key);
    const pooled = (category: string) => {
      const { events, machines, completeIntervals, censoredHours } = value.categories[category]!;
      return { events, machines, completeIntervals, censoredHours };
    };
    const turning = 2 * EVENTS[key];
    const vertical = key === '2025' ? 23 : key === '2026' ? 74 : 97;
    const machines = key === '2025' ? 1 : 2;
    expect(settle([pooled('Turning Center'), pooled('Vertical Machining Center')])).toEqual(
      settle([
        { events: turning, machines: 2, completeIntervals: turning - 2, censoredHours: 2 * TAIL },
        {
          events: vertical,
          machines,
          completeIntervals: vertical - machines,
          censoredHours: machines * TAIL,
        },
      ]),
    );
  });

  it.each(SPAN_KEYS)("reads the span's working hours, no-records month out, span %s", (key) => {
    // The slope reads every date's hours since the span began, so a month counted that was never recorded moves it.
    expect(hoursAt(HAND[key].to, HAND[key].from, HAND[key].noRecords)).toBe(HOURS_TO_DATE[key]);
    const value = reliability(key);
    expect(settle(MACHINES[key].map((id) => value.machines[id]!.fit.trend.beta))).toEqual(
      settle(MACHINES[key].map((id) => betaOf(id, key))),
    );
  });
});
