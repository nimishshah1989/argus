import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type FigureResult } from '../src/index.js';
import { PROBLEM_GROUPS } from '../src/analytics/problem-groups.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * Ticket 76, packet 76o: A10 and the machine page read the span. Held whole against hand values worked out from the
 * fixture's rule (`many-years/fixture.ts`, sums in `many-years/hand.ts`), never against engine output.
 *
 * The rule, per machine and year: `AX` "Axis jam" (2025 day 5, 1 h; 2026 days 5 and 12, 2 h) and `EL` "Panel trip"
 * (day 20, 1 h in 2025, 2 h in 2026) in every recorded month (2025 skips July), `NO DT` on 8 January (0 h, a failure
 * that costs nothing) and `PM` on the 15th of March, June, September and December. TC-1, VC-1 and TC-2 exist in both
 * years, VC-2 (bought 2026-01-01) in 2026 only. Both years: Axis jam 3 x (11 + 24) + 24 = 129 rows, 3 x (11 + 48) + 48 =
 * 225 h; Panel trip 3 x (11 + 12) + 12 = 81 rows, 3 x (11 + 24) + 24 = 129 h; `NO DT` 3 x 2 + 1 = 7 rows, 0 h;
 * 129 + 81 + 7 = 217 failures and 225 + 129 = 354 h, as in `hand.ts`.
 */

const NAMES = PROBLEM_GROUPS.map((group) => group.name).join('');
const AXIS = 'Axis motor / drive / encoder / servo';
const PANEL = 'Push button / switch / cable / panel';
const KEYS = ['a10-problems', 'machine-page'];

const resultOf = (key: SpanKey): Record<string, FigureResult> => {
  const result = runWith(Object.fromEntries(KEYS.map((name) => [name, COMPUTERS[name]!])), {
    data: MANY_YEARS,
    asOf: AS_OF_ONE_COMPUTER,
    profile: DEFAULT_PROFILE,
    span: { from: HAND[key].from, to: HAND[key].to },
  });
  return Object.fromEntries(
    result.figures.filter((f) => KEYS.includes(f.key)).map((f) => [f.key, f]),
  );
};
const results = Object.fromEntries(SPAN_KEYS.map((key) => [key, resultOf(key)])) as Record<
  SpanKey,
  Record<string, FigureResult>
>;

type Kpi = { label: string; value: string; sub: string };

/**
 * The four "what if we cut a problem?" KPIs: the top group (Axis jam) cut in half against the span's available hours.
 * 2025: 33 h and 33 rows, saved 16.5 h and 16.5 rows; available 3 x 11 x 500 = 16,500; 66 h, 69 failures.
 *   availability 1 - 66 / 16,500 = 99.60 % -> 1 - 49.5 / 16,500 = 99.70 %; MTBF 16,434 / 69 = 238 -> 16,450.5 / 52.5 = 313.
 * 2026: 192 h and 96 rows, saved 96 h and 48 rows; available 4 x 12 x 500 = 24,000; 288 h, 148 failures.
 *   1 - 288 / 24,000 = 98.80 % -> 1 - 192 / 24,000 = 99.20 %; MTBF 23,712 / 148 = 160 -> 23,808 / 100 = 238.
 * Both: 225 h and 129 rows, saved 112.5 h and 64.5 rows; available 16,500 + 24,000 = 40,500; 354 h, 217 failures.
 *   1 - 354 / 40,500 = 99.13 % -> 1 - 241.5 / 40,500 = 99.40 %; MTBF 40,146 / 217 = 185 -> 40,258.5 / 152.5 = 264.
 */
const WHAT_IF: Record<SpanKey, Kpi[]> = {
  '2025': [
    { label: 'Downtime saved', value: '17 hrs', sub: '25.00% of all breakdown hours' },
    { label: 'Breakdowns avoided', value: '17', sub: 'out of 69 in the period' },
    { label: 'Plant availability', value: '99.70%', sub: 'was 99.60% (+0.10 points)' },
    { label: 'MTBF', value: '313 hrs', sub: 'was 238 hrs' },
  ],
  '2026': [
    { label: 'Downtime saved', value: '96 hrs', sub: '33.33% of all breakdown hours' },
    { label: 'Breakdowns avoided', value: '48', sub: 'out of 148 in the period' },
    { label: 'Plant availability', value: '99.20%', sub: 'was 98.80% (+0.40 points)' },
    { label: 'MTBF', value: '238 hrs', sub: 'was 160 hrs' },
  ],
  both: [
    { label: 'Downtime saved', value: '113 hrs', sub: '31.78% of all breakdown hours' },
    { label: 'Breakdowns avoided', value: '65', sub: 'out of 217 in the period' },
    { label: 'Plant availability', value: '99.40%', sub: 'was 99.13% (+0.28 points)' },
    { label: 'MTBF', value: '264 hrs', sub: 'was 185 hrs' },
  ],
};

/** The page across both years: 217 failures over 354 h, every share worked from the rule above. */
function bothYearsPage() {
  const pairs = (
    category: string,
    machine: string,
    group: string,
    [rows, hours]: [number, number],
  ) => [machine, category, group, String(rows), hours.toFixed(1)];
  const turning = 'Turning Center';
  const vertical = 'Vertical Machining Center';
  // One unplaced row per `NO DT`, in the platform's order: machine id, then date. No placed entry shares a word
  // with "Checked outside production", so the classifier has no suggestion for any of them.
  const unplaced = [
    ['08-01-2025', 'TC-1'],
    ['08-01-2026', 'TC-1'],
    ['08-01-2025', 'TC-2'],
    ['08-01-2026', 'TC-2'],
    ['08-01-2025', 'VC-1'],
    ['08-01-2026', 'VC-1'],
    ['08-01-2026', 'VC-2'],
  ].map(([date, machine]) => [
    date,
    machine,
    'Checked outside production',
    '',
    `No suggestion${NAMES}`,
    '',
  ]);
  const word = (text: string) => [
    text,
    '7',
    '0.0',
    'Checked outside production',
    `Choose group…${NAMES}`,
  ];
  const share = (n: number, of: number) => `${((n / of) * 100).toFixed(2)}%`;
  expect([share(129, 217), share(81, 217), share(7, 217)]).toEqual(['59.45%', '37.33%', '3.23%']);
  return {
    screen: 'a10-problems',
    asOf: '2026-12-31',
    pages: [
      {
        page: 'a10',
        title: 'Problem Analysis',
        kpis: [
          { label: 'Breakdowns studied', value: '217', sub: '354 hrs of downtime, PM excluded' },
          { label: 'Top problem group', value: 'Axis motor', sub: '63.56% of all hours' },
          {
            label: 'Quick stops (30 min or less)',
            value: '3.23%',
            sub: 'of breakdowns, but only 0.00% of hours',
          },
          // 3 x 59 + 48 + 3 x 35 + 24 = 354 h of 354 h in the eight repeat pairs
          {
            label: 'Repeat problems',
            value: '100.00%',
            sub: '8 machine and problem pairs, 4+ times',
          },
          ...WHAT_IF.both,
        ],
        tables: [
          {
            title: 'All problem groups',
            header: [
              'Problem group',
              'Family',
              'Breakdowns',
              '% of breakdowns',
              'Hours',
              '% of hours',
              'Hrs each',
              'Machines',
              'Quick',
            ],
            // 225 / 129 = 1.74 h, 129 / 81 = 1.59 h; every `NO DT` is a quick stop (7 of 7)
            rows: [
              [
                AXIS,
                'Axis, drive and geometry',
                '129',
                '59.45%',
                '225.0',
                '63.56%',
                '1.74',
                '4',
                '0.00%',
              ],
              [
                PANEL,
                'Electrical and controls',
                '81',
                '37.33%',
                '129.0',
                '36.44%',
                '1.59',
                '4',
                '0.00%',
              ],
              ['Other / unclear', 'Other', '7', '3.23%', '0.0', '0.00%', '0.00', '4', '100.00%'],
            ],
            rowCount: 3,
          },
          {
            title: 'Families of problems',
            header: [
              'Family',
              'Breakdowns',
              '% of breakdowns',
              'Hours',
              '% of hours',
              'Groups inside',
            ],
            rows: [
              ['Axis, drive and geometry', '129', '59.45%', '225.0', '63.56%', AXIS],
              ['Electrical and controls', '81', '37.33%', '129.0', '36.44%', PANEL],
              ['Other', '7', '3.23%', '0.0', '0.00%', 'Other / unclear'],
            ],
            rowCount: 3,
          },
          {
            title: 'Repeat offenders',
            header: ['Machine', 'Category', 'Problem group', 'Times', 'Hours'],
            // Axis: 11 + 24 = 35 rows, 11 + 48 = 59 h on each old machine, VC-2 24 rows 48 h; Panel: 11 + 12 = 23 rows,
            // 11 + 24 = 35 h, VC-2 12 rows 24 h; most hours first, a tie in machine order
            rows: [
              pairs(turning, 'TC-1', AXIS, [35, 59]),
              pairs(turning, 'TC-2', AXIS, [35, 59]),
              pairs(vertical, 'VC-1', AXIS, [35, 59]),
              pairs(vertical, 'VC-2', AXIS, [24, 48]),
              pairs(turning, 'TC-1', PANEL, [23, 35]),
              pairs(turning, 'TC-2', PANEL, [23, 35]),
              pairs(vertical, 'VC-1', PANEL, [23, 35]),
              pairs(vertical, 'VC-2', PANEL, [12, 24]),
            ],
            rowCount: 8,
          },
          {
            title: 'Entries the system could not place (7, 3.23% of all)',
            header: ['Date', 'Machine', 'Problem', 'Action taken', 'Group', ''],
            rows: unplaced,
            rowCount: 7,
          },
          {
            title: 'Words not yet recognised',
            header: ['Word', 'In entries', 'Hours', 'Example problem', 'Add to group'],
            rows: [word('outside'), word('production')],
            rowCount: 2,
          },
          {
            title: '',
            header: ['Order', 'Group name', 'Family', 'Keywords', ''],
            rows: PROBLEM_GROUPS.map((group) => ['↑ ↓', '', '', group.keywords.join(', '), '×']),
            rowCount: PROBLEM_GROUPS.length,
          },
        ],
        charts: [
          {
            id: 'ch-prob-pareto',
            type: 'bar',
            axes: { x: 'Breakdown hours', y: '' },
            tickLabels: { x: [], y: [] },
            // 225 / 354 = 64 %, 129 / 354 = 36 %
            labels: [`${AXIS}  (64%)`, `${PANEL}  (36%)`, 'Other / unclear  (0%)'],
            datasets: [{ label: '', data: [225, 129, 0] }],
          },
          {
            id: 'ch-prob-scatter',
            type: 'bubble',
            axes: {
              x: 'How often (number of breakdowns)',
              y: 'How long each one takes (average hrs)',
            },
            tickLabels: { x: [], y: [] },
            labels: [],
            datasets: [
              {
                label: '',
                // y = hours / rows to 2 dp; r = 1.3 x sqrt(hours) (15 x 1.3 = 19.5), at least 5
                data: [
                  { x: 129, y: 1.74, r: Math.sqrt(225) * 1.3 },
                  { x: 81, y: 1.59, r: Math.sqrt(129) * 1.3 },
                  { x: 7, y: 0, r: 5 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('A10 reads the span', () => {
  it('prints the whole page across both years against the span hours and nothing else', () => {
    const figure = results.both['a10-problems']!;
    expect(figure.value).toEqual(bothYearsPage());
    const failures = MANY_YEARS.tickets.filter((ticket) => ticket.workType !== 'PM');
    expect(failures).toHaveLength(217);
    expect(figure.drill.ids).toEqual(failures.map((ticket) => ticket.id).sort());
  });

  it('answers the what-if against 16,500, 24,000 and 40,500 available hours for each span', () => {
    const read = (key: SpanKey) =>
      (
        results[key]['a10-problems']!.value as { pages: Array<{ kpis: Kpi[] }> }
      ).pages[0]!.kpis.slice(4);
    expect(SPAN_KEYS.map(read)).toEqual(SPAN_KEYS.map((key) => WHAT_IF[key]));
  });
});

const pad = (value: number): string => String(value).padStart(2, '0');

/** One machine's tickets in stored order: per month AX (day 5, and day 12 in 2026), EL day 20, NO DT, PM. */
function ticketsOf(id: string, years: readonly number[]) {
  const out = { breakdowns: [] as string[], pm: [] as string[] };
  for (const year of years.filter((y) => id !== 'VC-2' || y >= 2026)) {
    for (let month = 1; month <= 12; month += 1) {
      if (year === 2025 && month === 7) continue;
      const ticket = (day: number, code: string) =>
        `T-${id}-${year}-${pad(month)}-${pad(day)}-${code}`;
      out.breakdowns.push(ticket(5, 'AX'));
      if (year === 2026) out.breakdowns.push(ticket(12, 'AX'));
      out.breakdowns.push(ticket(20, 'EL'));
      if (month === 1) out.breakdowns.push(ticket(8, 'NODT'));
      if (month % 3 === 0) out.pm.push(ticket(15, 'PM'));
    }
  }
  return out;
}

/** The breakdown summary of a machine with `count` failures and `hours`; the last one is 20 December 2026 in every span. */
const summary = ([count, hours]: [number, number], mttr: number, mtbf: number, axis: number) => ({
  count,
  hours,
  mttr,
  mtbf,
  lastOn: '2026-12-20',
  topProblem: { problem: 'Axis jam', count: axis },
});

/**
 * The record of one machine at 2026-12-31: nameplate and age as of that day, the span's own breakdowns, PM and drills.
 * Only `year`, `cell` and `category` are set, so the completeness card is 2 of 10 recorded on every machine.
 */
function record(id: string, key: SpanKey, breakdowns: unknown) {
  const years = key === 'both' ? [2025, 2026] : [Number(key)];
  const own = ticketsOf(id, years);
  const bought = id === 'VC-2' ? '2026-01-01' : '2020-01-01';
  return {
    machine: {
      id,
      code: id,
      segment: 'CNC',
      category: id.startsWith('TC') ? 'Turning Center' : 'Vertical Machining Center',
      make: null,
      model: null,
      serial: null,
      controller: null,
      controllerModel: null,
      controllerSerial: null,
      year: Number(bought.slice(0, 4)),
      purchasedOn: bought,
      powerKva: null,
      capacityKva: null,
      location: null,
      cell: id.endsWith('1') ? '1' : '2',
      assetCode: null,
      lengthMm: null,
      widthMm: null,
      conveyor: null,
    },
    ageYears: id === 'VC-2' ? 0 : 6,
    ageEstimated: false,
    floorAreaM2: null,
    efficiencyPct: DEFAULT_PROFILE.efficiencyFactor,
    connectedKva: null,
    runningKva: null,
    breakdowns,
    pm: { visits: own.pm.length, hours: own.pm.length * 3 },
    completeness: {
      recorded: 2,
      of: 10,
      missing: ['make', 'model', 'serial', 'power', 'location', 'length', 'width', 'controller'],
    },
    moves: [],
    drill: { breakdowns: own.breakdowns, pm: own.pm, moves: [] },
  };
}

describe('the machine page reads the span', () => {
  it('prints the four records across both years, the last failure from the whole history', () => {
    // TC-1, VC-1, TC-2: 23 + 37 = 60 failures, 22 + 72 = 94 h, MTTR 94 / 60 = 1.57, 23 months of 500 = 11,500 h so
    // MTBF (11,500 - 94) / 60 = 190.1; Axis jam 11 + 24 = 35. PM 8 visits x 3 h = 24 h. VC-2 exists in 2026 only: 37
    // failures, 72 h, MTTR 72 / 37 = 1.95, 12 months of 500 = 6,000 h so (6,000 - 72) / 37 = 160.2; Axis jam 24; PM 4, 12 h.
    const old = summary([60, 94], 1.57, 190.1, 35);
    const bought2026 = summary([37, 72], 1.95, 160.2, 24);
    const records = (results.both['machine-page']!.value as { byMachine: unknown }).byMachine;
    expect(records).toEqual({
      'TC-1': record('TC-1', 'both', old),
      'VC-1': record('VC-1', 'both', old),
      'TC-2': record('TC-2', 'both', old),
      'VC-2': record('VC-2', 'both', bought2026),
    });
  });

  it('divides by the hours the machine had in the span: 238.2 in 2025, 160.2 in 2026, 190.1 across both', () => {
    // 2025: 11 months of 500 = 5,500 h, 22 h, 23 failures: 238.2; Axis jam 11 and Panel trip 11, the first kept.
    // VC-2 is bought after 2025: no failure in the span, the last one on record is still 20 December 2026.
    const tc1 = (key: SpanKey) => {
      const read = results[key]['machine-page']!.value as {
        byMachine: Record<string, { breakdowns: { mtbf: number | null } }>;
      };
      return [read.byMachine['TC-1']!.breakdowns.mtbf, read.byMachine['VC-2']!.breakdowns.mtbf];
    };
    expect(SPAN_KEYS.map(tc1)).toEqual(
      SPAN_KEYS.map((key) => [HAND[key].mtbfTc1, HAND[key].mtbfVc2]),
    );
    const only2025 = results['2025']['machine-page']!.value as {
      byMachine: Record<string, unknown>;
    };
    expect(only2025.byMachine['TC-1']).toEqual(
      record('TC-1', '2025', summary([23, 22], 0.96, 238.2, 11)),
    );
    expect(only2025.byMachine['VC-2']).toEqual(
      record('VC-2', '2025', {
        ...summary([0, 0], 0, 0, 0),
        mttr: null,
        mtbf: null,
        topProblem: null,
      }),
    );
  });
});
