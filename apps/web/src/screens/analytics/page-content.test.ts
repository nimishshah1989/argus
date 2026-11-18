import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en, gu, type MessageKey } from '@uptimo/shared/i18n';
import { contentKind, contentOf } from './figure-content.js';
import { EMPTY_FILTERS, LOG_FILTERS, filterOptions, filterRows } from './log-values.js';

/**
 * The two key-shaped pages (ticket 40, packet 40e-1): the Breakdown Log and A1 are one engine page each,
 * so contentOf maps them to the page kind and the screen renders that with the kit. The engine's printed
 * labels and strings are data; every title or axis the mapper adds is a catalogue key.
 */

type Figure = FiguresReply['figures'][number];
type Call = { key: string; values?: Record<string, unknown> };

const LOG_HEADER = [
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

const LOG_ROWS = [
  [
    '👁',
    '1357',
    'BD-0151',
    '07-11-2026',
    '2',
    'VC-15',
    'ATC trouble Machine Stop',
    'Person 41',
    '1.83',
    'ATC',
  ],
  [
    '👁',
    '1356',
    'BD-0143',
    '07-11-2026',
    '2',
    'VC-41',
    'Power interrupt / phase failure',
    'Person 46',
    '0.58',
    'E',
  ],
  [
    '👁',
    '1355',
    'BD-0144',
    '07-11-2026',
    '3',
    'HMC-2',
    'Atc Arm move to left side time out',
    'Person 46',
    '—',
    'E',
  ],
];

const LOG = {
  screen: 'breakdown-log',
  asOf: '2026-11-11',
  pages: [
    {
      page: 'breakdowns',
      title: 'Breakdown Log',
      kpis: [],
      tables: [
        {
          title: '',
          header: LOG_HEADER,
          rows: LOG_ROWS,
          rowCount: 1343,
          truncated: true,
        },
      ],
      charts: [],
    },
  ],
};

const A1 = {
  screen: 'a1-bd-pm',
  asOf: '2026-11-11',
  pages: [
    {
      page: 'a1',
      title: 'BD % & PM Split',
      kpis: [
        {
          label: 'Avg Available Hrs / Machine',
          value: '4,525.54',
          sub: 'hours to 11 Nov · annual 6,000 from Settings',
        },
        { label: 'Total Machines', value: '125', sub: 'machines counted in production data' },
        { label: 'Total Available Hrs', value: '5,65,692.47', sub: 'whole plant' },
        { label: 'Actual Breakdown', value: '3,060.1 hrs', sub: '0.54% of available' },
        { label: 'PM Downtime', value: '759.3 hrs', sub: '0.13% of available' },
        { label: 'Fleet Availability', value: '99.32%', sub: 'BD + PM excluded' },
      ],
      tables: [
        {
          title: 'By Cell — Detail',
          header: ['Cell', 'Machines', 'Available Hrs', 'BD Hrs'],
          rows: [
            ['Cell 1', '7', '36,272.45', '492.21'],
            ['Cell 2', '25', '1,21,284.81', '317.87'],
          ],
          rowCount: 9,
        },
        {
          title: 'Month-on-Month — BD Hours by Cell (2026)',
          header: ['Cell', 'Jan', 'Total'],
          rows: [['Cell 1', '53.2010.1%', '685.58']],
          rowCount: 9,
        },
      ],
      charts: [
        {
          id: 'ch-a1-cell',
          type: 'bar',
          axes: { x: '', y: '' },
          tickLabels: { x: [], y: [] },
          labels: ['Cell 1', 'Cell 2'],
          datasets: [
            { label: 'BD %', data: [1.36, 0.26] },
            { label: 'PM %', data: [0.02, 0.27] },
          ],
        },
        {
          id: 'ch-a1-trend',
          type: 'line',
          axes: { x: '', y: '' },
          tickLabels: { x: [], y: [] },
          labels: ['Jan', 'Feb'],
          datasets: [
            { label: 'BD Hrs', data: [248.95000000000002, 302.81] },
            { label: 'PM Hrs', data: [13.83, 0] },
          ],
        },
      ],
    },
  ],
};

function translator(): { t: TFunction; calls: Call[] } {
  const calls: Call[] = [];
  const t = ((key: string, values?: Record<string, unknown>) => {
    calls.push(values === undefined ? { key } : { key, values });
    const template = en[key as MessageKey] ?? key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template,
    );
  }) as unknown as TFunction;
  return { t, calls };
}

function figure(key: string, value: unknown, screen = key): Figure {
  return {
    key,
    screen,
    owner: 40,
    status: 'ready',
    value,
    drill: { type: 'ticket', ids: [] },
  };
}

describe('the Breakdown Log page', () => {
  it('maps the key page whole: its title, one empty-KPI page and the platform table with its rowCount', () => {
    const { t, calls } = translator();
    const source = figure('breakdown-log', LOG);
    expect(contentKind(source)).toBe('page');
    expect(contentOf(source, t)).toEqual({
      kind: 'page',
      title: 'Breakdown Log',
      kpis: [],
      tables: [
        {
          title: '',
          header: LOG_HEADER,
          rows: LOG_ROWS,
          rowCount: 1343,
          truncated: true,
        },
      ],
      charts: [],
    });
    expect(calls).toEqual([]);
  });

  it('keeps the NO DT dash and the eye column exactly as the platform printed them', () => {
    const { t } = translator();
    const content = contentOf(figure('breakdown-log', LOG), t);
    if (content?.kind !== 'page' || content.tables[0] === undefined)
      throw new Error('expected the log page');
    expect(content.tables[0].rows[2]?.[0]).toBe('👁');
    expect(content.tables[0].rows[2]?.[8]).toBe('—');
  });
});

describe('the A1 page', () => {
  it('maps the six KPIs, the tables and the two charts with catalogue chrome', () => {
    const { t, calls } = translator();
    const source = figure('a1-bd-pm', A1);
    expect(contentKind(source)).toBe('page');
    expect(contentOf(source, t)).toEqual({
      kind: 'page',
      title: 'BD % & PM Split',
      kpis: A1.pages[0]!.kpis,
      tables: A1.pages[0]!.tables.map((table) => ({ ...table, truncated: false })),
      charts: [
        {
          kind: 'bar',
          title: 'BD % and PM % by cell',
          categoryLabel: 'Cell',
          categories: ['Cell 1', 'Cell 2'],
          series: [
            { name: 'BD %', values: [1.36, 0.26] },
            { name: 'PM %', values: [0.02, 0.27] },
          ],
        },
        {
          kind: 'line',
          title: 'BD and PM hours by month',
          categoryLabel: 'Month',
          categories: ['Jan', 'Feb'],
          series: [
            { name: 'BD Hrs', values: [248.95000000000002, 302.81] },
            { name: 'PM Hrs', values: [13.83, 0] },
          ],
        },
      ],
    });
    expect(calls.map((call) => call.key)).toEqual([
      'analytics.content.a1.cellChart',
      'analytics.content.a1.cellAxis',
      'analytics.content.a1.trendChart',
      'analytics.content.a1.trendAxis',
    ]);
  });

  it('pins all six of the key page KPI labels and values', () => {
    const { t } = translator();
    const content = contentOf(figure('a1-bd-pm', A1), t);
    if (content?.kind !== 'page') throw new Error('expected the A1 page');
    expect(content.kpis.map(({ label, value }) => [label, value])).toEqual([
      ['Avg Available Hrs / Machine', '4,525.54'],
      ['Total Machines', '125'],
      ['Total Available Hrs', '5,65,692.47'],
      ['Actual Breakdown', '3,060.1 hrs'],
      ['PM Downtime', '759.3 hrs'],
      ['Fleet Availability', '99.32%'],
    ]);
  });

  it('draws a chart only when the engine sent a known id, labels and numeric datasets', () => {
    const { t } = translator();
    const value = {
      pages: [
        {
          page: 'a1',
          title: 'BD % & PM Split',
          kpis: [{ label: 'Total Machines', value: '125', sub: null }],
          tables: [],
          charts: [
            { id: 'ch-unknown', type: 'bar', labels: ['x'], datasets: [{ label: 'a', data: [1] }] },
            { id: 'ch-a1-cell', type: 'bar', labels: ['Cell 1'], datasets: [{ label: 'a' }] },
          ],
        },
      ],
    };
    expect(contentOf(figure('a1-bd-pm', value), t)).toEqual({
      kind: 'page',
      title: 'BD % & PM Split',
      kpis: [{ label: 'Total Machines', value: '125', sub: null }],
      tables: [],
      charts: [],
    });
  });
});

const A2_TABLE_TITLES = [
  'By Category — Detail',
  'By Cell — Detail',
  ...Array.from({ length: 14 }, () => 'Machine-Level Detail'),
];

const A2_TABLES = [
  {
    title: 'By Category — Detail',
    header: [
      'Category',
      'Machines',
      '# Breakdowns',
      'BD Hours',
      '% of Total BD',
      'Avg Hrs/Machine',
      'Avg Hrs/Breakdown',
    ],
    rows: [
      ['Turning Center', '38', '271', '944.19', '30.85%', '24.85', '3.48'],
      ['Vertical Machining Center', '52', '645', '1,057.79', '34.57%', '20.34', '1.64'],
      ['Cnc Sliding Head Automatic Lathe', '2', '17', '73.54', '2.40%', '36.77', '4.33'],
    ],
    rowCount: 14,
  },
  {
    title: 'By Cell — Detail',
    header: [
      'Cell',
      'Machines',
      '# Breakdowns',
      'BD Hours',
      '% of Total BD',
      'Avg Hrs/Machine',
      'Avg Hrs/Breakdown',
    ],
    rows: [['Cell 1', '7', '80', '492.21', '16.08%', '70.32', '6.15']],
    rowCount: 9,
  },
  ...Array.from({ length: 14 }, (_, index) => ({
    title: 'Machine-Level Detail',
    header: ['Machine ID', 'Cell', '# Breakdowns', 'BD Hours', '% of Total BD'],
    rows: [[index === 0 ? 'TC-5' : `M-${index}`, '7', '17', '175.08', '5.72%']],
    rowCount: 38,
  })),
];

/** The key's own chart objects: one bar dataset each, the category label kept exactly as the platform printed it. */
function barChart(id: string, categories: string[], dataset: string, data: number[]) {
  return {
    id,
    type: 'bar',
    axes: { x: '', y: '' },
    tickLabels: { x: [], y: [] },
    labels: categories,
    datasets: [{ label: dataset, data }],
  };
}

const A2_CHARTS = [
  barChart(
    'ch-a2-cathrs',
    ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
    'BD Hrs',
    [944.19, 73.54],
  ),
  barChart(
    'ch-a2-catcnt',
    ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
    '# Breakdowns',
    [271, 17],
  ),
  barChart('ch-a2-cellhrs', ['Cell 1', 'Cell 2'], 'BD Hrs', [492.21, 317.87]),
  barChart('ch-a2-cellcnt', ['Cell 1', 'Cell 2'], '# Breakdowns', [80, 204]),
  barChart(
    'ch-a2-catavghrs',
    ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
    'Avg BD Hrs / Machine',
    [24.85, 36.77],
  ),
  barChart(
    'ch-a2-catavgcnt',
    ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
    'Avg Breakdowns / Machine',
    [7.13, 8.5],
  ),
  barChart('ch-a2-cellavghrs', ['Cell 1', 'Cell 2'], 'Avg BD Hrs / Machine', [70.32, 12.71]),
  barChart('ch-a2-cellavgcnt', ['Cell 1', 'Cell 2'], 'Avg Breakdowns / Machine', [11.43, 8.16]),
];

const A2 = {
  screen: 'a2-category-cell',
  asOf: '2026-11-11',
  pages: [
    {
      page: 'a2',
      title: 'Category & Cell Analysis',
      kpis: [],
      tables: A2_TABLES,
      charts: A2_CHARTS,
    },
  ],
};

const A3_TABLES = [
  {
    title: 'By Category',
    header: ['Category', 'Machines', '# Breakdowns', 'BD Hours', 'MTTR (Hrs)', 'MTBF (Hrs)'],
    rows: [
      ['Turning Center', '38', '271', '944.19', '3.48', '598.15'],
      ['CAM Profile Machine', '1', '0', '0.00', '0.00', '5,183.33'],
    ],
    rowCount: 14,
  },
  {
    title: 'By Cell',
    header: ['Cell', 'Machines', '# Breakdowns', 'BD Hours', 'MTTR (Hrs)', 'MTBF (Hrs)'],
    rows: [['Cell 1', '7', '80', '492.21', '6.15', '447.25']],
    rowCount: 9,
  },
  {
    title: 'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide',
    header: ['Cell', 'Jan', 'Feb', 'Nov', 'Q3 Avg', 'Q4 Avg', 'Total 2026'],
    rows: [
      ['Cell 1MTTR / MTBF · 80 breakdowns', '1.18', '1.55', '1.51', '4.62', '0.90', '6.15'],
      ['348.8', '435.9', '181.8', '501.4', '265.8', '447.3'],
      ['Cell 2MTTR / MTBF · 204 breakdowns', '1.16', '1.33', '1.39', '2.17', '—', '1.56'],
    ],
    rowCount: 20,
  },
  {
    title: 'Month-on-Month MTTR & MTBF — Age Band-wise and Plant-wide',
    header: ['Age Band', 'Jan', 'Feb', 'Q1 Avg', 'Total 2026'],
    rows: [['0-5 yrsMTTR / MTBF · 563 breakdowns', '1.84', '3.12', '2.33', '2.02']],
    rowCount: 12,
  },
  {
    title: 'By Machine Age Band',
    header: ['Age Band', 'Machines', '# Breakdowns', 'MTTR (Hrs)', 'MTBF (Hrs)'],
    rows: [['0-5 yrs', '79', '563', '2.02', '560.85']],
    rowCount: 5,
  },
  {
    title: 'By Individual Machine',
    header: ['Machine ID', 'Cell', '# Breakdowns', 'MTTR (Hrs)', 'MTBF (Hrs)'],
    rows: [['TC-5', '7', '17', '10.30', '286.93']],
    rowCount: 125,
  },
];

const A3_CHARTS = [
  barChart(
    'ch-a3-catmttr',
    ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
    'MTTR',
    [3.48, 4.33],
  ),
  barChart(
    'ch-a3-catmtbf',
    ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
    'MTBF',
    [598.15, 605.48],
  ),
  barChart('ch-a3-cellmttr', ['Cell 1', 'Cell 2'], 'MTTR', [6.15, 1.56]),
  barChart('ch-a3-cellmtbf', ['Cell 1', 'Cell 2'], 'MTBF', [447.25, 592.98]),
  barChart('ch-a3-agemttr', ['0-5 yrs', '5-10 yrs'], 'MTTR', [2.02, 3.04]),
  barChart('ch-a3-agemtbf', ['0-5 yrs', '5-10 yrs'], 'MTBF', [560.85, 435.25]),
  {
    id: 'ch-a3-planttrend',
    type: 'undefined',
    axes: { x: '', y: '', y1: '' },
    tickLabels: { x: [], y: [], y1: [] },
    labels: ['Jan', 'Feb', 'Dec'],
    datasets: [
      { label: 'Plant MTTR (Hrs)', data: [2.22, 2.54, null] },
      { label: 'Plant MTBF (Hrs)', data: [449.1, 434.43, null] },
    ],
  },
];

const A3 = {
  screen: 'a3-mttr-mtbf',
  asOf: '2026-11-11',
  pages: [
    {
      page: 'a3',
      title: 'MTTR & MTBF',
      kpis: [],
      tables: A3_TABLES,
      charts: A3_CHARTS,
    },
  ],
};

describe('the A2 page', () => {
  it('maps the key page whole: no KPIs, its 16 tables and its 8 bar charts', () => {
    const { t } = translator();
    const source = figure('a2-category-cell', A2);
    expect(contentKind(source)).toBe('page');
    const content = contentOf(source, t);
    if (content?.kind !== 'page') throw new Error('expected the A2 page');
    expect(content.title).toBe('Category & Cell Analysis');
    expect(content.kpis).toEqual([]);
    expect(content.tables).toHaveLength(16);
    expect(content.tables.map((table) => table.title)).toEqual(A2_TABLE_TITLES);
    expect(content.tables[0]).toEqual({ ...A2_TABLES[0], truncated: false });
    expect(content.tables[2]).toEqual({ ...A2_TABLES[2], truncated: false });
    expect(content.charts).toEqual([
      {
        kind: 'bar',
        title: 'BD hours by category',
        categoryLabel: 'Category',
        categories: ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
        series: [{ name: 'BD Hrs', values: [944.19, 73.54] }],
      },
      {
        kind: 'bar',
        title: 'Breakdowns by category',
        categoryLabel: 'Category',
        categories: ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
        series: [{ name: '# Breakdowns', values: [271, 17] }],
      },
      {
        kind: 'bar',
        title: 'BD hours by cell',
        categoryLabel: 'Cell',
        categories: ['Cell 1', 'Cell 2'],
        series: [{ name: 'BD Hrs', values: [492.21, 317.87] }],
      },
      {
        kind: 'bar',
        title: 'Breakdowns by cell',
        categoryLabel: 'Cell',
        categories: ['Cell 1', 'Cell 2'],
        series: [{ name: '# Breakdowns', values: [80, 204] }],
      },
      {
        kind: 'bar',
        title: 'Average BD hours per machine by category',
        categoryLabel: 'Category',
        categories: ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
        series: [{ name: 'Avg BD Hrs / Machine', values: [24.85, 36.77] }],
      },
      {
        kind: 'bar',
        title: 'Average breakdowns per machine by category',
        categoryLabel: 'Category',
        categories: ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
        series: [{ name: 'Avg Breakdowns / Machine', values: [7.13, 8.5] }],
      },
      {
        kind: 'bar',
        title: 'Average BD hours per machine by cell',
        categoryLabel: 'Cell',
        categories: ['Cell 1', 'Cell 2'],
        series: [{ name: 'Avg BD Hrs / Machine', values: [70.32, 12.71] }],
      },
      {
        kind: 'bar',
        title: 'Average breakdowns per machine by cell',
        categoryLabel: 'Cell',
        categories: ['Cell 1', 'Cell 2'],
        series: [{ name: 'Avg Breakdowns / Machine', values: [11.43, 8.16] }],
      },
    ]);
  });

  it('keeps the raw double space in the chart label and the normalised single-space cell in the table', () => {
    const { t } = translator();
    const content = contentOf(figure('a2-category-cell', A2), t);
    if (content?.kind !== 'page') throw new Error('expected the A2 page');
    const first = content.charts[0];
    if (first?.kind !== 'bar') throw new Error('expected the first A2 chart');
    expect(first.categories[1]).toBe('Cnc Sliding Head  Automatic Lathe');
    expect(content.tables[0]?.rows[2]?.[0]).toBe('Cnc Sliding Head Automatic Lathe');
  });
});

describe('the A3 page', () => {
  it('maps the key page whole: no KPIs, its 6 tables, its 6 bars and the two-line plant trend', () => {
    const { t } = translator();
    const source = figure('a3-mttr-mtbf', A3);
    expect(contentKind(source)).toBe('page');
    const content = contentOf(source, t);
    if (content?.kind !== 'page') throw new Error('expected the A3 page');
    expect(content.title).toBe('MTTR & MTBF');
    expect(content.kpis).toEqual([]);
    expect(content.tables).toHaveLength(6);
    expect(content.tables.map((table) => table.title)).toEqual([
      'By Category',
      'By Cell',
      'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide',
      'Month-on-Month MTTR & MTBF — Age Band-wise and Plant-wide',
      'By Machine Age Band',
      'By Individual Machine',
    ]);
    expect(content.tables[0]).toEqual({ ...A3_TABLES[0], truncated: false });
    expect(content.tables[2]).toEqual({ ...A3_TABLES[2], truncated: false });
    expect(content.tables[2]?.rows[2]?.[5]).toBe('—');
    expect(content.charts).toEqual([
      {
        kind: 'bar',
        title: 'MTTR by category',
        categoryLabel: 'Category',
        categories: ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
        series: [{ name: 'MTTR', values: [3.48, 4.33] }],
      },
      {
        kind: 'bar',
        title: 'MTBF by category',
        categoryLabel: 'Category',
        categories: ['Turning Center', 'Cnc Sliding Head  Automatic Lathe'],
        series: [{ name: 'MTBF', values: [598.15, 605.48] }],
      },
      {
        kind: 'bar',
        title: 'MTTR by cell',
        categoryLabel: 'Cell',
        categories: ['Cell 1', 'Cell 2'],
        series: [{ name: 'MTTR', values: [6.15, 1.56] }],
      },
      {
        kind: 'bar',
        title: 'MTBF by cell',
        categoryLabel: 'Cell',
        categories: ['Cell 1', 'Cell 2'],
        series: [{ name: 'MTBF', values: [447.25, 592.98] }],
      },
      {
        kind: 'bar',
        title: 'MTTR by machine age band',
        categoryLabel: 'Age band',
        categories: ['0-5 yrs', '5-10 yrs'],
        series: [{ name: 'MTTR', values: [2.02, 3.04] }],
      },
      {
        kind: 'bar',
        title: 'MTBF by machine age band',
        categoryLabel: 'Age band',
        categories: ['0-5 yrs', '5-10 yrs'],
        series: [{ name: 'MTBF', values: [560.85, 435.25] }],
      },
      {
        kind: 'line',
        title: 'Plant MTTR and MTBF by month',
        categoryLabel: 'Month',
        categories: ['Jan', 'Feb', 'Dec'],
        series: [
          { name: 'Plant MTTR (Hrs)', values: [2.22, 2.54, undefined] },
          { name: 'Plant MTBF (Hrs)', values: [449.1, 434.43, undefined] },
        ],
        secondAxis: true,
      },
    ]);
  });
});

describe('pages the mapper cannot draw', () => {
  it('maps a ready null, a page-less value and an empty page to nothing', () => {
    const { t } = translator();
    for (const value of [null, {}, { pages: [] }, { pages: [{}] }, { pages: [{ kpis: [] }] }])
      expect(contentOf(figure('breakdown-log', value), t), JSON.stringify(value)).toBeNull();
    expect(contentKind(figure('breakdown-log', null))).toBeNull();
    const held = { ...figure('a1-bd-pm', A1), status: 'not_computed' as const };
    expect(contentOf(held, t)).toBeNull();
  });
});

describe('the log filters', () => {
  it('offers the values the table holds, dates newest first and the rest alphabetically', () => {
    expect(filterOptions(LOG_ROWS, 3)).toEqual(['07-11-2026']);
    expect(filterOptions(LOG_ROWS, 5)).toEqual(['HMC-2', 'VC-15', 'VC-41']);
    expect(
      filterOptions(
        [
          ['', '', '', '07-11-2026', '', '', '', '', '', 'ATC'],
          ['', '', '', '06-11-2026', '', '', '', '', '', 'E'],
          ['', '', '', '', '', '', '', '', '', 'E'],
        ],
        3,
      ),
    ).toEqual(['07-11-2026', '06-11-2026']);
    expect(
      filterOptions(
        [
          ['', '', '', '', '', '', '', '', '', 'E'],
          ['', '', '', '', '', '', '', '', '', 'ATC'],
        ],
        9,
      ),
    ).toEqual(['ATC', 'E']);
  });

  it('keeps the original row index so a filtered row still opens its own ticket', () => {
    const shown = filterRows(LOG_ROWS, { ...EMPTY_FILTERS, date: '07-11-2026', shift: '2' });
    expect(shown.map((entry) => entry.index)).toEqual([0, 1]);
    expect(shown.map((entry) => entry.row[1])).toEqual(['1357', '1356']);
    expect(
      filterRows(LOG_ROWS, { ...EMPTY_FILTERS, machine: 'HMC-2' }).map((e) => e.index),
    ).toEqual([2]);
    expect(filterRows(LOG_ROWS, { ...EMPTY_FILTERS, code: 'E' }).map((e) => e.index)).toEqual([
      1, 2,
    ]);
    expect(filterRows(LOG_ROWS, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('names each filter column and its catalogue label', () => {
    expect(LOG_FILTERS.map((filter) => filter.column)).toEqual([3, 4, 5, 9]);
    for (const filter of LOG_FILTERS) {
      expect(en[filter.labelKey], filter.id).toBeTruthy();
      expect(Object.hasOwn(gu, filter.labelKey), filter.id).toBe(true);
    }
  });
});
