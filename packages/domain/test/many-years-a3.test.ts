import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ONE_COMPUTER, HAND, NO_RECORDS, type SpanKey } from './many-years/hand.js';

/**
 * A3, MTTR and MTBF, run per span and held whole against the page worked out by hand (ticket 76, packets 76j, 76k).
 *
 * The rule: a machine's month holds 2 breakdowns of 1 h in 2025 and 3 of 2 h in 2026, plus one `NO DT` (a failure at
 * 0 h) on every January; PM is never a breakdown. A machine has 500 available hours a month from its purchase, so a
 * machine counts 2 x 1 h and 500 h in a 2025 month, 3 x 2 = 6 h and 500 h in a 2026 month. July 2025 holds nothing.
 * MTTR = hours / count and MTBF = (available - hours) / count; a quarter is the mean of its recorded months' values.
 *
 * Machines in each span: 2025 has TC-1, VC-1 (cell 1) and TC-2 (cell 2), all aged 5 at 31 Dec 2025; VC-2 is bought on
 * 2026-01-01, so 2026 and both years add it to cell 2 and to the 0-5 band (aged 0), the other three aged 6 (5-10).
 */

interface Month {
  count: number;
  hours: number;
  available: number;
}
type Slot = Month | null | 'gap';

/** A group's month: `machines` machines in a 2025 or 2026 month; no machine is an empty (dash) month. */
function month(year: number, machines: number, january: boolean): Slot {
  if (machines === 0) return null;
  const breakdowns = year === 2025 ? 2 : 3;
  const hours = year === 2025 ? 1 : 2;
  return {
    count: machines * (breakdowns + (january ? 1 : 0)),
    hours: machines * breakdowns * hours,
    available: machines * 500,
  };
}

/** A group's months over the span's years, with July 2025 a gap. `perYear` is its machine count in each year. */
function months(years: number[], perYear: Record<number, number>): Slot[] {
  return years.flatMap((year) =>
    Array.from({ length: 12 }, (_, index) =>
      year === 2025 && index === 6 ? 'gap' : month(year, perYear[year]!, index === 0),
    ),
  );
}

interface Group {
  label: string;
  machines: number;
  count: number;
  hours: number;
  available: number;
  months: Slot[];
}

const text = (value: number, decimals: number): string => value.toFixed(decimals);
const mttr = (m: { count: number; hours: number }): number => (m.count ? m.hours / m.count : 0);
const mtbf = (m: Month): number => (m.count ? (m.available - m.hours) / m.count : m.available);
const cell = (slot: Slot, value: (m: Month) => number, decimals: number): string =>
  slot === 'gap' ? NO_RECORDS : slot === null ? '—' : text(value(slot), decimals);
const average = (slots: Slot[], value: (m: Month) => number): number | null => {
  const present = slots.filter((slot): slot is Month => slot !== null && slot !== 'gap');
  return present.length === 0
    ? null
    : present.reduce((sum, slot) => sum + value(slot), 0) / present.length;
};
const quarters = (slots: Slot[], value: (m: Month) => number, decimals: number): string[] =>
  Array.from({ length: slots.length / 3 }, (_, quarter) => {
    const mean = average(slots.slice(quarter * 3, quarter * 3 + 3), value);
    return mean === null ? '—' : text(mean, decimals);
  });

const summary = (group: Group, label: string): string[] => [
  label,
  String(group.machines),
  String(group.count),
  text(group.hours, 2),
  text(mttr(group), 2),
  text(mtbf(group), 2),
];

/** The key's pair: MTTR on the labelled row, MTBF on the next row with no label. */
function pair(group: Group, header: { quarters: number }): string[][] {
  const { months: slots } = group;
  expect(slots.length / 3).toBe(header.quarters);
  return [
    [
      `${group.label}MTTR / MTBF · ${group.count} breakdowns`,
      ...slots.map((slot) => cell(slot, mttr, 2)),
      ...quarters(slots, mttr, 2),
      group.count ? text(group.hours / group.count, 2) : '—',
    ],
    [
      ...slots.map((slot) => cell(slot, mtbf, 1)),
      ...quarters(slots, mtbf, 1),
      group.count ? text((group.available - group.hours) / group.count, 1) : '—',
    ],
  ];
}

const chart = (id: string, labels: string[], data: number[], dataset: string) => ({
  id,
  type: 'bar',
  axes: { x: '', y: '' },
  tickLabels: { x: [], y: [] },
  labels,
  datasets: [{ label: dataset, data }],
});
const cents = (value: number): number => Math.round(value * 100) / 100;

interface Spec {
  years: number[];
  categories: Group[];
  cells: Group[];
  bands: Group[];
  plant: Group;
  /** Each machine's table row: id, category, cell, count, hours, then MTTR and MTBF printed. */
  machines: string[][];
  header: { months: string[]; quarters: string[]; total: string };
}

const group = (
  label: string,
  years: number[],
  perYear: Record<number, number>,
  total: Omit<Group, 'label' | 'months'>,
): Group => ({ label, ...total, months: months(years, perYear) });

const EMPTY = { machines: 0, count: 0, hours: 0, available: 0 };
const bandsOf = (
  years: number[],
  young: Record<number, number>,
  old: Record<number, number>,
  totals: Omit<Group, 'label' | 'months'>[],
) => [
  group('0-5 yrs', years, young, totals[0]!),
  group('5-10 yrs', years, old, totals[1]!),
  group('10-15 yrs', years, { 2025: 0, 2026: 0 }, EMPTY),
  group('15-20 yrs', years, { 2025: 0, 2026: 0 }, EMPTY),
  group('20+ yrs', years, { 2025: 0, 2026: 0 }, EMPTY),
];

const MONTH_NAMES = [
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
];

const SPECS: Partial<Record<SpanKey, Spec>> = {
  // Per machine in 2025: 11 months x 2 + 1 NO DT = 23 failures, 22 h, 11 x 500 = 5,500 h available.
  '2025': {
    years: [2025],
    header: {
      months: MONTH_NAMES,
      quarters: ['Q1 Avg', 'Q2 Avg', 'Q3 Avg', 'Q4 Avg'],
      total: 'Total 2025',
    },
    // Turning Center: TC-1 + TC-2 = 2 x (23, 22, 5,500); Vertical: VC-1 = (23, 22, 5,500).
    categories: [
      group(
        'Turning Center',
        [2025],
        { 2025: 2 },
        { machines: 2, count: 46, hours: 44, available: 11000 },
      ),
      group(
        'Vertical Machining Center',
        [2025],
        { 2025: 1 },
        { machines: 1, count: 23, hours: 22, available: 5500 },
      ),
    ],
    // Cell 1: TC-1 + VC-1 (46, 44, 11,000); cell 2: TC-2 (23, 22, 5,500).
    cells: [
      group('Cell 1', [2025], { 2025: 2 }, { machines: 2, count: 46, hours: 44, available: 11000 }),
      group('Cell 2', [2025], { 2025: 1 }, { machines: 1, count: 23, hours: 22, available: 5500 }),
    ],
    // All three machines are 5 years old on 31 Dec 2025: the 5-10 band is the whole plant, the others are empty.
    bands: bandsOf([2025], { 2025: 0 }, { 2025: 3 }, [
      EMPTY,
      { machines: 3, count: 69, hours: 66, available: 16500 },
    ]),
    // 3 x (23, 22, 5,500) = 69 failures, 66 h, 16,500 h (MTBF (16,500 - 66) / 69 = 238.2).
    plant: group(
      'PLANT TOTAL',
      [2025],
      { 2025: 3 },
      { machines: 3, count: 69, hours: 66, available: 16500 },
    ),
    // 22 / 23 = 0.96; (5,500 - 22) / 23 = 238.17. All three tie on 22 h, so the machine order stands.
    machines: [
      ['TC-1', 'Turning Center', '1', '23', '22.00', '0.96', '238.17'],
      ['VC-1', 'Vertical Machining Center', '1', '23', '22.00', '0.96', '238.17'],
      ['TC-2', 'Turning Center', '2', '23', '22.00', '0.96', '238.17'],
    ],
  },
  // Both years: TC-1, VC-1, TC-2 hold 23 + 37 = 60 failures, 22 + 72 = 94 h and 11,500 h; VC-2 (2026 only) 37, 72 h, 6,000 h.
  both: {
    years: [2025, 2026],
    header: {
      months: ['2025', '2026'].flatMap((year) =>
        MONTH_NAMES.map((name) => `${name} ${year.slice(2)}`),
      ),
      quarters: ['25', '26'].flatMap((year) => [1, 2, 3, 4].map((q) => `Q${q} ${year} Avg`)),
      total: 'Total 2025–2026',
    },
    // Turning Center: TC-1 + TC-2 = 2 x (60, 94, 11,500) = (120, 188, 23,000); Vertical: VC-1 + VC-2 = (97, 166, 17,500).
    categories: [
      group(
        'Turning Center',
        [2025, 2026],
        { 2025: 2, 2026: 2 },
        { machines: 2, count: 120, hours: 188, available: 23000 },
      ),
      group(
        'Vertical Machining Center',
        [2025, 2026],
        { 2025: 1, 2026: 2 },
        { machines: 2, count: 97, hours: 166, available: 17500 },
      ),
    ],
    // Cell 1: TC-1 + VC-1 = (120, 188, 23,000); cell 2: TC-2 + VC-2 = (60 + 37, 94 + 72, 11,500 + 6,000).
    cells: [
      group(
        'Cell 1',
        [2025, 2026],
        { 2025: 2, 2026: 2 },
        { machines: 2, count: 120, hours: 188, available: 23000 },
      ),
      group(
        'Cell 2',
        [2025, 2026],
        { 2025: 1, 2026: 2 },
        { machines: 2, count: 97, hours: 166, available: 17500 },
      ),
    ],
    // On 31 Dec 2026 VC-2 is 0 years old (0-5); the other three are 6 (5-10): 3 x (60, 94, 11,500) = (180, 282, 34,500).
    bands: bandsOf([2025, 2026], { 2025: 0, 2026: 1 }, { 2025: 3, 2026: 3 }, [
      { machines: 1, count: 37, hours: 72, available: 6000 },
      { machines: 3, count: 180, hours: 282, available: 34500 },
    ]),
    // 69 + 148 = 217 failures, 66 + 288 = 354 h, 16,500 + 24,000 = 40,500 h: MTBF (40,500 - 354) / 217 = 185.0.
    plant: group(
      'PLANT TOTAL',
      [2025, 2026],
      { 2025: 3, 2026: 4 },
      { machines: 4, count: 217, hours: 354, available: 40500 },
    ),
    // 94 / 60 = 1.57; (11,500 - 94) / 60 = 190.10; VC-2: 72 / 37 = 1.95, (6,000 - 72) / 37 = 160.22.
    machines: [
      ['TC-1', 'Turning Center', '1', '60', '94.00', '1.57', '190.10'],
      ['VC-1', 'Vertical Machining Center', '1', '60', '94.00', '1.57', '190.10'],
      ['TC-2', 'Turning Center', '2', '60', '94.00', '1.57', '190.10'],
      ['VC-2', 'Vertical Machining Center', '2', '37', '72.00', '1.95', '160.22'],
    ],
  },
};

const page = (spec: Spec, key: SpanKey) => {
  const { categories, cells, bands, plant } = spec;
  const columns = spec.header.quarters.length;
  const mom = (title: string, first: string, groups: Group[]) => {
    const rows = [...groups, plant].flatMap((g) => pair(g, { quarters: columns }));
    return {
      title,
      header: [first, ...spec.header.months, ...spec.header.quarters, spec.header.total],
      rows,
      rowCount: rows.length,
    };
  };
  const summaryTable = (
    title: string,
    first: string,
    groups: Group[],
    label: (g: Group) => string,
  ) => ({
    title,
    header: [first, 'Machines', '# Breakdowns', 'BD Hours', 'MTTR (Hrs)', 'MTBF (Hrs)'],
    rows: groups.map((g) => summary(g, label(g))),
    rowCount: groups.length,
  });
  const both = [...cells, plant];
  const trend = (value: (m: Month) => number) =>
    plant.months.map((slot) => (slot === null || slot === 'gap' ? null : cents(value(slot))));
  const per = (groups: Group[], value: (g: Group) => number) => groups.map((g) => cents(value(g)));
  return {
    screen: 'a3-mttr-mtbf',
    asOf: HAND[key].to,
    pages: [
      {
        page: 'a3',
        title: 'MTTR & MTBF',
        kpis: [],
        tables: [
          summaryTable('By Category', 'Category', categories, (g) => g.label),
          summaryTable('By Cell', 'Cell', cells, (g) => g.label),
          mom('Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide', 'Cell', cells),
          mom('Month-on-Month MTTR & MTBF — Age Band-wise and Plant-wide', 'Age Band', bands),
          summaryTable('By Machine Age Band', 'Age Band', bands, (g) => g.label),
          {
            title: 'By Individual Machine',
            header: [
              'Machine ID',
              'Category',
              'Cell',
              '# Breakdowns',
              'BD Hours',
              'MTTR (Hrs)',
              'MTBF (Hrs)',
            ],
            rows: spec.machines,
            rowCount: spec.machines.length,
          },
        ],
        charts: [
          chart(
            'ch-a3-catmttr',
            categories.map((g) => g.label),
            per(categories, mttr),
            'MTTR',
          ),
          chart(
            'ch-a3-catmtbf',
            categories.map((g) => g.label),
            per(categories, mtbf),
            'MTBF',
          ),
          chart(
            'ch-a3-cellmttr',
            cells.map((g) => g.label),
            per(cells, mttr),
            'MTTR',
          ),
          chart(
            'ch-a3-cellmtbf',
            cells.map((g) => g.label),
            per(cells, mtbf),
            'MTBF',
          ),
          chart(
            'ch-a3-agemttr',
            bands.map((g) => g.label),
            per(bands, mttr),
            'MTTR',
          ),
          chart(
            'ch-a3-agemtbf',
            bands.map((g) => g.label),
            per(bands, mtbf),
            'MTBF',
          ),
          {
            id: 'ch-a3-planttrend',
            type: 'undefined',
            axes: { x: '', y: '', y1: '' },
            tickLabels: { x: [], y: [], y1: [] },
            labels: spec.header.months,
            datasets: [
              { label: 'Plant MTTR (Hrs)', data: trend(mttr) },
              { label: 'Plant MTBF (Hrs)', data: trend(mtbf) },
            ],
          },
        ],
      },
    ],
  };
};

const figure = (key: SpanKey) => {
  const result = runWith(
    { 'a3-mttr-mtbf': COMPUTERS['a3-mttr-mtbf']! },
    {
      data: MANY_YEARS,
      asOf: AS_OF_ONE_COMPUTER,
      profile: DEFAULT_PROFILE,
      span: { from: HAND[key].from, to: HAND[key].to },
    },
  );
  return result.figures.find((entry) => entry.key === 'a3-mttr-mtbf')!;
};

describe('A3 per span', () => {
  it.each(['2025', 'both'] as const)('prints the whole page of span %s', (key) => {
    const found = figure(key);
    expect(found.value).toEqual(page(SPECS[key]!, key));
    // The headline cells, read off the engine's own page and held to hand.ts: the plant's MTBF and July 2025.
    const tables = (found.value as ReturnType<typeof page>).pages[0]!.tables;
    const plant = tables[2]!.rows.slice(-2);
    expect(plant[1]!.at(-1)).toBe(HAND[key].mtbf.toFixed(1));
    expect(plant[0]![7]).toBe(NO_RECORDS);
  });
});
