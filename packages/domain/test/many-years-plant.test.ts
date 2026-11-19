import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  run,
  runWith,
  type EngineData,
  type MachineRow,
  type ReportRow,
  type TicketRow,
} from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * Ticket 76, packet 76f: the plant-wide rates read the span's hours and days. Held whole against `many-years/hand.ts`
 * (sums beside each value there), never against engine output. Today the fleet's hours are one year's, taken from the
 * year of the latest breakdown, and the per-day averages count a no-records month's days as observed.
 */

const PLANT_FIGURES = [
  'dashboard.plant-bd-pct',
  'dashboard.fleet-availability',
  'dashboard.avg-complaints-per-day',
  'dashboard.avg-bd-hours-per-day',
  'dashboard.avg-bd-hours-per-machine',
] as const;

const valuesOf = (result: ReturnType<typeof run>): unknown[] =>
  PLANT_FIGURES.map((key) => result.figures.find((figure) => figure.key === key)?.value);

describe('the plant-wide rates read the span', () => {
  it('equal the hand table for 2025, 2026 and both years', () => {
    const hand = (key: SpanKey): unknown[] => [
      HAND[key].bdPct,
      HAND[key].availabilityPct,
      HAND[key].breakdownsPerDay,
      HAND[key].bdHoursPerDay,
      HAND[key].bdHoursPerMachine,
    ];
    const read = (key: SpanKey) =>
      valuesOf(
        run(MANY_YEARS, AS_OF_ENGINE, DEFAULT_PROFILE, { from: HAND[key].from, to: HAND[key].to }),
      );
    expect(SPAN_KEYS.map(read)).toEqual(SPAN_KEYS.map(hand));
  });

  it('read the run date year to date when no span is named: January 2027 alone has no downtime', () => {
    // 2027-01-01 to 2027-01-02 holds no report: 0 lost hours over 4 machines' two days is 0 % and 100 %.
    const result = runWith(
      {
        'dashboard.plant-bd-pct': COMPUTERS['dashboard.plant-bd-pct']!,
        'dashboard.fleet-availability': COMPUTERS['dashboard.fleet-availability']!,
      },
      { data: MANY_YEARS, asOf: '2027-01-02', profile: DEFAULT_PROFILE },
    );
    const value = (key: string) => result.figures.find((figure) => figure.key === key)?.value;
    expect([value('dashboard.plant-bd-pct'), value('dashboard.fleet-availability')]).toEqual([
      0, 100,
    ]);
  });
});

/** Two machines and three reports on the edges of 2025: 1 January, 31 December, and 1 January 2026. */
function edgePlant(): EngineData {
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
    purchasedOn: '2020-01-01',
    powerKw: null,
    capacityKva: null,
    assetCode: null,
    status: 'active',
    criticality: null,
    excludedFromProduction: false,
    metadata: {},
  });
  const tickets: TicketRow[] = [];
  const reports: ReportRow[] = [];
  const edges: Array<[string, string, number]> = [
    ['M-1', '2025-01-01', 60],
    ['M-2', '2025-12-31', 120],
    ['M-1', '2026-01-01', 180],
  ];
  for (const [machineId, date, downtimeMin] of edges) {
    const id = `${machineId}-${date}`;
    const start = new Date(`${date}T10:00:00+05:30`);
    tickets.push({
      id: `T-${id}`,
      ref: `T-${id}`,
      kind: 'stopped',
      status: 'closed',
      machineId,
      reportedAt: start.toISOString(),
      closedAt: new Date(start.getTime() + downtimeMin * 60_000).toISOString(),
      source: 'history',
      downtimeMin,
      repairMin: null,
      workType: 'AX',
    });
    reports.push({
      id: `R-${id}`,
      ticketId: `T-${id}`,
      machineId,
      date,
      shift: '1',
      problem: 'Axis jam',
      downtimeMin,
      responseMin: null,
      repairMin: null,
      category: 'M',
      maintCode: 'AX',
      spareUsed: null,
      rootCause: null,
      doneBy: [],
      supportedBy: [],
    });
  }
  return {
    timeZone: 'Asia/Kolkata',
    machines: [machine('M-1'), machine('M-2')],
    moves: [],
    tickets,
    tasks: [],
    reports,
    people: [],
    lists: {},
    shifts: [],
  };
}

describe('a span includes both its first and its last day', () => {
  const read = (from: string, to: string) =>
    runWith(
      {
        'dashboard.total-breakdowns': COMPUTERS['dashboard.total-breakdowns']!,
        'dashboard.total-downtime-hours': COMPUTERS['dashboard.total-downtime-hours']!,
      },
      { data: edgePlant(), asOf: '2026-01-31', profile: DEFAULT_PROFILE, span: { from, to } },
    )
      .figures.filter((figure) => figure.status === 'ready')
      .map((figure) => [figure.key, figure.value, figure.drill.ids]);

  it('counts 1 January and 31 December in 2025 and 1 January 2026 only in 2026', () => {
    expect({
      '2025': read('2025-01-01', '2025-12-31'),
      '2026': read('2026-01-01', '2026-12-31'),
    }).toEqual({
      // 60 + 120 minutes = 3 hours on two rows; the one 180-minute row of 1 January 2026 is also 3 hours.
      '2025': [
        ['dashboard.total-breakdowns', 2, ['T-M-1-2025-01-01', 'T-M-2-2025-12-31']],
        ['dashboard.total-downtime-hours', 3, ['T-M-1-2025-01-01', 'T-M-2-2025-12-31']],
      ],
      '2026': [
        ['dashboard.total-breakdowns', 1, ['T-M-1-2026-01-01']],
        ['dashboard.total-downtime-hours', 3, ['T-M-1-2026-01-01']],
      ],
    });
  });

  it('reads only the as-of year when no span is named: 1 January counts, the last day of the year before does not', () => {
    const [bdPct] = runWith(
      { 'dashboard.plant-bd-pct': COMPUTERS['dashboard.plant-bd-pct']! },
      { data: edgePlant(), asOf: '2026-01-31', profile: DEFAULT_PROFILE },
    ).figures.filter((figure) => figure.status === 'ready');
    // January 2026 alone: 2 machines x 500 h = 1,000 h. The 180-minute row of 1 January is 3 h: 3 / 1,000 = 0.30 %.
    // The 120-minute row of 31 December 2025 is not this year's, or it would be 5 / 1,000 = 0.50 %.
    expect([bdPct?.value, bdPct?.drill.ids]).toEqual([0.3, ['T-M-1-2026-01-01']]);
  });
});
