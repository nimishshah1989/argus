import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { run } from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * Ticket 76, packet 76e: the six figures the cut alone fixes read the span and nothing else. A characterisation:
 * it holds the engine's cut (`cutToPeriod`) to hand values, so a later edit cannot undo it. Nothing below came from
 * running the engine; every value is worked out from the fixture's rule (`many-years/fixture.ts`, sums in `hand.ts`).
 *
 * The rule, as the figures read it. Each machine that exists in a year has, every recorded month (2025 skips July):
 * `AX` "Axis jam" and `EL` "Panel trip" (2025: days 5 and 20, 1 h each; 2026: days 5, 12 and 20, 2 h each), `NO DT`
 * on 8 January (0 h, counted as a breakdown), `PM` on the 15th of March, June, September and December (3 h, never
 * a breakdown). So per machine and year the breakdown rows are 22 + 1 = 23 (22 h) in 2025 and 36 + 1 = 37 (72 h) in
 * 2026. A run names its span, and a period figure sees the plant as of the span's end (`asOf = period.to`).
 *
 * At the default 12 h Why-Why threshold A6 is empty on every span (no breakdown lasts over 2 h), so it could not see
 * the cut; the run uses a 1 h threshold, which only the 2 h breakdowns of 2026 pass (1 h and 0.5 h are not over it).
 */

const PROFILE = { ...DEFAULT_PROFILE, whyWhyThresholdHours: 1 };
const results = Object.fromEntries(
  SPAN_KEYS.map((key) => [
    key,
    run(MANY_YEARS, AS_OF_ENGINE, PROFILE, { from: HAND[key].from, to: HAND[key].to }),
  ]),
) as Record<SpanKey, ReturnType<typeof run>>;
const valueOf = (key: SpanKey, figure: string): unknown =>
  results[key].figures.find((result) => result.key === figure)?.value;
const everySpan = (figure: string, hand: Record<SpanKey, unknown>): void =>
  expect(SPAN_KEYS.map((key) => valueOf(key, figure))).toEqual(SPAN_KEYS.map((key) => hand[key]));

/** The ids of the machines a span has: VC-2 is bought on 2026-01-01, so 2025 has three and the rest four. */
const IDS: Record<SpanKey, string[]> = {
  '2025': ['TC-1', 'VC-1', 'TC-2'],
  '2026': ['TC-1', 'VC-1', 'TC-2', 'VC-2'],
  both: ['TC-1', 'VC-1', 'TC-2', 'VC-2'],
};

type Entry = [date: string, machine: string, code: string, hours: string];
const KIND: Record<string, [string, string, string]> = {
  AX: ['1', 'Axis jam', 'Person 1'],
  EL: ['2', 'Panel trip', 'Person 2'],
  'NO DT': ['1', 'Checked outside production', 'Person 1'],
  PM: ['1', 'Planned service', 'Person 2'],
};
const entries = (year: number): Entry[] => {
  const [bd, hours] = year === 2025 ? ([[5, 20], '1'] as const) : ([[5, 12, 20], '2'] as const);
  const out: Entry[] = [];
  for (let m = 1; m <= 12; m += 1) {
    if (year === 2025 && m === 7) continue;
    for (const id of IDS.both.filter((x) => year === 2026 || x !== 'VC-2')) {
      const day = (d: number) =>
        `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      bd.forEach((d, i) => out.push([day(d), id, i === bd.length - 1 ? 'EL' : 'AX', hours]));
      if (m === 1) out.push([day(8), id, 'NO DT', '—']);
      if (m % 3 === 0) out.push([day(15), id, 'PM', '3']);
    }
  }
  return out;
};

describe('the cut fixes the six span figures', () => {
  it('ranks the problems costing the most downtime by the span alone', () => {
    // Axis jam and Panel trip rank by hours, the tie in 2025 kept in log order; `NO DT` reads "Other / unclear", 0 h.
    // 2025: 33 rows of 1 h each, 33 rows, 3 `NO DT`; total 66 h. 2026: 96 x 2 = 192 h, 48 x 2 = 96 h, 4; total 288 h.
    // Both: 33 + 96 = 129 rows and 33 + 192 = 225 h; 33 + 48 = 81 rows and 33 + 96 = 129 h; 3 + 4 = 7; total 354 h.
    const axis = 'Axis motor / drive / encoder / servo';
    const panel = 'Push button / switch / cable / panel';
    const rows = (a: number[], b: number[], c: number[]) =>
      [axis, panel, 'Other / unclear'].map((problem, i) => {
        const [hours, share, breakdowns] = [a, b, c][i]!;
        return { problem, hours, share, breakdowns };
      });
    everySpan('dashboard.costliest-problems', {
      '2025': { rows: rows([33, 50, 33], [33, 50, 33], [0, 0, 3]), totalHours: 66 },
      // 192 / 288 = 66.67 %, 96 / 288 = 33.33 %
      '2026': { rows: rows([192, 66.67, 96], [96, 33.33, 48], [0, 0, 4]), totalHours: 288 },
      // 225 / 354 = 63.56 %, 129 / 354 = 36.44 %
      both: { rows: rows([225, 63.56, 129], [129, 36.44, 81], [0, 0, 7]), totalHours: 354 },
    });
  });

  it('plots one bubble per machine that exists in the span, aged at its end', () => {
    // x = BD hours, y = breakdowns, r = 4 + 18 x sqrt(MTTR / largest MTTR), MTTR = x / y; age = completed years.
    // 2025: 22 h over 23 each, all alike, so r = 22; ages 2020-01-01 to 2025-12-31 = 5.
    // 2026: 72 h over 37 each, ages 6 and VC-2 (bought 2026-01-01) 0. Both: 22 + 72 = 94 h over 23 + 37 = 60 for the
    // three old machines, VC-2 72 h over 37 (the largest MTTR, so r = 22); the three read 4 + 18 x sqrt(94/60 / (72/37)).
    type Bubble = { x: number; y: number; r: number; age: number };
    const point = (id: string, { x, y, r, age }: Bubble) => ({
      ...{ x, y, r, id, model: '—', age: `${age} yrs` },
      mttr: x / y,
    });
    const chart = (points: unknown[]) => ({
      axes: { x: 'BD Hours (machine total)', y: 'Number of Breakdowns' },
      datasets: [{ label: 'Machines', data: points }],
    });
    const old = 4 + 18 * Math.sqrt(94 / 60 / (72 / 37));
    everySpan('dashboard.bubble-chart', {
      '2025': chart(IDS['2025'].map((id) => point(id, { x: 22, y: 23, r: 22, age: 5 }))),
      '2026': chart(
        IDS['2026'].map((id) => point(id, { x: 72, y: 37, r: 22, age: id === 'VC-2' ? 0 : 6 })),
      ),
      both: chart(
        IDS.both.map((id) =>
          id === 'VC-2'
            ? point(id, { x: 72, y: 37, r: 22, age: 0 })
            : point(id, { x: 94, y: 60, r: old, age: 6 }),
        ),
      ),
    });
  });

  it('prints the log of the span newest first, numbered in date order from the whole history', () => {
    // `entries` is the rule in stored order (month, machine, entry); the log numbers the whole uncut history in date
    // order, ties by stored order, cuts it to the span and prints the highest number first. Counts: 2025 69 + 12 PM =
    // 81, 2026 148 + 16 = 164, both 245. The loader stores no number, so a span must not renumber: 2026 holds rows
    // 82 to 245 (2025's 81 rows come first), where it once started again at 1 (fixed in packet 76y); 2025 and both
    // years keep their numbers.
    const header = [
      '',
      'Sr No',
      'Ticket No.',
      'Date',
      'Shift',
      'Machine',
      'Problem',
      'Done By',
      'Downtime (Hrs)',
      'Code',
    ];
    const page = (key: SpanKey) => {
      const numbered = [2025, 2026]
        .flatMap(entries)
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) =>
          a.entry[0] < b.entry[0] ? -1 : a.entry[0] > b.entry[0] ? 1 : a.index - b.index,
        )
        .map(({ entry }, position) => ({ entry, srNo: position + 1 }))
        .filter(({ entry }) => entry[0] >= HAND[key].from && entry[0] <= HAND[key].to)
        .sort((a, b) => b.srNo - a.srNo);
      /** The fixture's ticket id is its printed ticket number. */
      const ticketOf = ([date, id, code]: Entry) => `T-${id}-${date}-${code.replace(' ', '')}`;
      const rows = numbered.map(({ entry: [date, id, code, hours], srNo }) => {
        const [shift, problem, by] = KIND[code]!;
        const [y, m, d] = date.split('-');
        return [
          '👁',
          String(srNo),
          ticketOf([date, id, code, hours]),
          `${d}-${m}-${y}`,
          shift,
          id,
          problem,
          by,
          hours,
          code,
        ];
      });
      return {
        screen: 'breakdown-log',
        asOf: HAND[key].to,
        pages: [
          {
            page: 'breakdowns',
            title: 'Breakdown Log',
            kpis: [],
            charts: [],
            tables: [
              {
                title: '',
                header,
                rows,
                rowTicketIds: numbered.map(({ entry }) => ticketOf(entry)),
                rowCount: rows.length,
                truncated: true,
              },
            ],
          },
        ],
      };
    };
    expect(SPAN_KEYS.map((key) => page(key).pages[0]!.tables[0]!.rowCount)).toEqual([81, 164, 245]);
    const srNos = (key: SpanKey) => page(key).pages[0]!.tables[0]!.rows.map((row) => row[1]);
    expect([srNos('2026').at(0), srNos('2026').at(-1)]).toEqual(['245', '82']);
    everySpan('breakdown-log', { '2025': page('2025'), '2026': page('2026'), both: page('both') });
  });

  it('lists the Why-Why candidates of the span, and none when no breakdown passes the threshold', () => {
    // Over 1 h only the 2 h breakdowns of 2026 pass: 4 machines x 12 months x 3 = 144, all 2 h, so worst-first keeps
    // the stored order. 2025 has none (1 h is not over 1 h), so its page is null; both years list the same 144.
    const rows = entries(2026)
      .filter(([, , code, hours]) => (code === 'AX' || code === 'EL') && Number(hours) > 1)
      .map(([date, id, code]) => {
        const [y, m, d] = date.split('-');
        return [id, `${d}-${m}-${y}`, KIND[code]![1], '2.00', 'Not Started', 'Start Why-Why'];
      });
    const page = {
      screen: 'a6-why-why',
      asOf: '2026-12-31',
      pages: [
        {
          page: 'a6',
          title: 'Why-Why Analysis',
          kpis: [],
          charts: [],
          tables: [
            {
              title: 'Why-Why (Root Cause) Analysis',
              header: ['Machine', 'Date', 'Problem', 'Down (Hrs)', 'Status', ''],
              rows,
              rowCount: 144,
              // One ticket per row in row order, by the fixture's rule `T-<machine>-<date>-<code>`.
              rowTicketIds: entries(2026)
                .filter(
                  ([, , code, hours]) => (code === 'AX' || code === 'EL') && Number(hours) > 1,
                )
                .map(([date, id, code]) => `T-${id}-${date}-${code}`),
            },
          ],
        },
      ],
    };
    expect(rows).toHaveLength(144);
    everySpan('a6-why-why', { '2025': null, '2026': page, both: page });
    const plain = run(MANY_YEARS, AS_OF_ENGINE, DEFAULT_PROFILE, {
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(plain.figures.find((f) => f.key === 'a6-why-why')?.value).toBeNull();
  });

  it('prints the category and cell analysis of the machines and breakdowns of the span', () => {
    // Per machine and year (see the rule): 23 breakdown rows and 22 h in 2025, 37 and 72 h in 2026 (`NO DT` is a row
    // of 0 h). Categories in machine order, Turning Center (TC-1, TC-2) then Vertical Machining Center (VC-1, VC-2).
    // 2025: Turning 2 x 23 = 46 rows, 44 h of 66 = 66.67 %, 44 / 2 = 22.00 a machine, 44 / 46 = 0.96 a row; Vertical
    // 23 rows, 22 h = 33.33 %. Cell 1 holds TC-1 and VC-1 (46 rows, 44 h), cell 2 TC-2 (and VC-2 from 2026).
    // 2026: every machine 37 rows, 72 h: a category or cell is 74 rows, 144 h of 288 = 50.00 %, 72.00 a machine,
    // 144 / 74 = 1.95 a row; a machine is 72 / 288 = 25.00 %.
    // Both: TC-1, VC-1, TC-2 are 60 rows, 94 h; VC-2 is 37 rows, 72 h; of 354 h. Turning 120 rows, 188 h = 53.11 %,
    // 94.00 a machine, 188 / 120 = 1.57; Vertical 97 rows, 166 h = 46.89 %, 83.00, 166 / 97 = 1.71. Cell 1 = TC-1 +
    // VC-1 = 120 rows, 188 h; cell 2 = TC-2 + VC-2 = 97 rows, 166 h. Machines: 94 / 354 = 26.55 %, 72 / 354 = 20.34 %.
    // The cell charts print the same numbers as the category charts: each cell's totals equal one category's here.
    type Span = {
      categories: string[][];
      cells: string[][];
      machines: string[][][];
      hours: number[];
      count: number[];
      avgHours: number[];
      avgCount: number[];
    };
    const page = (key: SpanKey, s: Span) => {
      const header = [
        'Machines',
        '# Breakdowns',
        'BD Hours',
        '% of Total BD',
        'Avg Hrs/Machine',
        'Avg Hrs/Breakdown',
      ];
      const table = (title: string, first: string, rows: string[][]) => ({
        title,
        header: [first, ...header],
        rows,
        rowCount: rows.length,
      });
      const categories = ['Turning Center', 'Vertical Machining Center'];
      const cells = ['Cell 1', 'Cell 2'];
      const bar = (id: string, labels: string[], data: number[], label: string) => ({
        id,
        type: 'bar',
        axes: { x: '', y: '' },
        tickLabels: { x: [], y: [] },
        labels,
        datasets: [{ label, data }],
      });
      const totals = (labels: string[], prefix: string) => [
        bar(`ch-a2-${prefix}hrs`, labels, s.hours, 'BD Hrs'),
        bar(`ch-a2-${prefix}cnt`, labels, s.count, '# Breakdowns'),
      ];
      const averages = (labels: string[], prefix: string) => [
        bar(`ch-a2-${prefix}avghrs`, labels, s.avgHours, 'Avg BD Hrs / Machine'),
        bar(`ch-a2-${prefix}avgcnt`, labels, s.avgCount, 'Avg Breakdowns / Machine'),
      ];
      return {
        screen: 'a2-category-cell',
        asOf: HAND[key].to,
        pages: [
          {
            page: 'a2',
            title: 'Category & Cell Analysis',
            kpis: [],
            tables: [
              table('By Category — Detail', 'Category', s.categories),
              table('By Cell — Detail', 'Cell', s.cells),
              ...s.machines.map((rows) => ({
                title: 'Machine-Level Detail',
                header: ['Machine ID', 'Cell', '# Breakdowns', 'BD Hours', '% of Total BD'],
                rows,
                rowCount: rows.length,
              })),
            ],
            charts: [
              ...totals(categories, 'cat'),
              ...totals(cells, 'cell'),
              ...averages(categories, 'cat'),
              ...averages(cells, 'cell'),
            ],
          },
        ],
      };
    };
    const turning = (rows: string[]) => ['Turning Center', ...rows];
    const vertical = (rows: string[]) => ['Vertical Machining Center', ...rows];
    const cell = (n: number, rows: string[]) => [`Cell ${n}`, ...rows];
    const spans: Record<SpanKey, Span> = {
      '2025': {
        categories: [
          turning(['2', '46', '44.00', '66.67%', '22.00', '0.96']),
          vertical(['1', '23', '22.00', '33.33%', '22.00', '0.96']),
        ],
        cells: [
          cell(1, ['2', '46', '44.00', '66.67%', '22.00', '0.96']),
          cell(2, ['1', '23', '22.00', '33.33%', '22.00', '0.96']),
        ],
        machines: [
          [
            ['TC-1', '1', '23', '22.00', '33.33%'],
            ['TC-2', '2', '23', '22.00', '33.33%'],
          ],
          [['VC-1', '1', '23', '22.00', '33.33%']],
        ],
        hours: [44, 22],
        count: [46, 23],
        avgHours: [22, 22],
        avgCount: [23, 23],
      },
      '2026': {
        categories: [
          turning(['2', '74', '144.00', '50.00%', '72.00', '1.95']),
          vertical(['2', '74', '144.00', '50.00%', '72.00', '1.95']),
        ],
        cells: [
          cell(1, ['2', '74', '144.00', '50.00%', '72.00', '1.95']),
          cell(2, ['2', '74', '144.00', '50.00%', '72.00', '1.95']),
        ],
        machines: [
          [
            ['TC-1', '1', '37', '72.00', '25.00%'],
            ['TC-2', '2', '37', '72.00', '25.00%'],
          ],
          [
            ['VC-1', '1', '37', '72.00', '25.00%'],
            ['VC-2', '2', '37', '72.00', '25.00%'],
          ],
        ],
        hours: [144, 144],
        count: [74, 74],
        avgHours: [72, 72],
        avgCount: [37, 37],
      },
      both: {
        categories: [
          turning(['2', '120', '188.00', '53.11%', '94.00', '1.57']),
          vertical(['2', '97', '166.00', '46.89%', '83.00', '1.71']),
        ],
        cells: [
          cell(1, ['2', '120', '188.00', '53.11%', '94.00', '1.57']),
          cell(2, ['2', '97', '166.00', '46.89%', '83.00', '1.71']),
        ],
        machines: [
          [
            ['TC-1', '1', '60', '94.00', '26.55%'],
            ['TC-2', '2', '60', '94.00', '26.55%'],
          ],
          [
            ['VC-1', '1', '60', '94.00', '26.55%'],
            ['VC-2', '2', '37', '72.00', '20.34%'],
          ],
        ],
        hours: [188, 166],
        count: [120, 97],
        avgHours: [94, 83],
        avgCount: [60, 48.5],
      },
    };
    everySpan('a2-category-cell', {
      '2025': page('2025', spans['2025']),
      '2026': page('2026', spans['2026']),
      both: page('both', spans.both),
    });
  });

  it('bands the machines by their age at the span end, with the breakdowns of the span', () => {
    // CNC production machines, age in completed years at the span end: TC-1, VC-1, TC-2 (2020-01-01) are 5 at
    // 2025-12-31 and 6 at 2026-12-31 (band 5-10 yrs); VC-2 (2026-01-01) is 0 (band 0-5 yrs); the other bands are empty.
    // 2025: 3 machines, 3 x 23 = 69 rows, 66 h, 66 / 3 = 22.00 a machine.
    // 2026: 3 machines, 3 x 37 = 111 rows, 216 h, 72.00; VC-2 alone 1 machine, 37 rows, 72 h, 72.00.
    // Both: 3 machines, 3 x 60 = 180 rows, 3 x 94 = 282 h, 94.00; VC-2 as in 2026 (its breakdowns are all in 2026).
    const labels = ['0-5 yrs', '5-10 yrs', '10-15 yrs', '15-20 yrs', '20+ yrs'];
    // each band: [machines, breakdowns, hours printed, average printed]
    type Band = [number, number, string, string];
    const page = (bands: Band[]) => ({
      pages: [
        {
          page: 'a8',
          title: 'Age Analysis',
          tables: [],
          kpis: [
            ...labels.map((label, i) => ({
              label,
              value: `${bands[i]![2]} hrs`,
              sub: `${bands[i]![0]} machines, ${bands[i]![1]} breakdowns`,
            })),
            ...labels.map((label, i) => ({
              label,
              value: bands[i]![0] === 0 ? '—' : `${bands[i]![3]} hrs`,
              sub: `${bands[i]![2]} hrs ÷ ${bands[i]![0]} machines`,
            })),
          ],
        },
      ],
    });
    const none: Band = [0, 0, '0.0', '—'];
    everySpan('a8-age', {
      '2025': page([none, [3, 69, '66.0', '22.00'], none, none, none]),
      '2026': page([[1, 37, '72.0', '72.00'], [3, 111, '216.0', '72.00'], none, none, none]),
      both: page([[1, 37, '72.0', '72.00'], [3, 180, '282.0', '94.00'], none, none, none]),
    });
  });
});
