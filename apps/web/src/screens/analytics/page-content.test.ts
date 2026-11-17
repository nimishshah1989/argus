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
        {
          label: 'Actual Breakdown',
          value: '3,060.1 hrs',
          sub: '0.54% of available',
        },
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
