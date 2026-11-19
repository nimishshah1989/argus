import type { Page, Route } from '@playwright/test';
import { mockPlant } from './plant-mock.js';

/**
 * The analytics figures answered from the browser (ticket 87, rest): an invented plant's A1 to A4, A10, Fix Finder,
 * Shift KPIs, Compare and the Cell change log, in the engine's own page shape. Invented names and numbers only. The
 * blank cell, the dash and the "pts" below are on purpose: the restyle must print them as they are.
 */
interface PageSpec {
  page: string;
  title: string;
  kpis?: string[][];
  tables?: { title: string; header: string[]; rows: string[][] }[];
  charts?: { id: string; labels: string[]; datasets: { label: string; data: number[] }[] }[];
}

const figure = (key: string, screen: string, spec: PageSpec, ids: string[] = []) => ({
  key,
  screen,
  owner: 41,
  status: 'ready',
  drill: { type: 'ticket', ids },
  value: {
    pages: [
      {
        ...spec,
        kpis: (spec.kpis ?? []).map(([label, value, sub]) => ({ label, value, sub: sub ?? null })),
        tables: (spec.tables ?? []).map((table) => ({
          ...table,
          rowCount: table.rows.length,
          truncated: false,
        })),
        charts: spec.charts ?? [],
      },
    ],
  },
});

const CELLS = ['Cell 2', 'Cell 3', 'Cell 6'];
const BARS = { labels: CELLS, datasets: [{ label: 'Hours', data: [12.5, 8, 21] }] };
const MONTHS = {
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{ label: 'BD hours', data: [4, 9, 6] }],
};

const FIGURES = [
  figure(
    'a1-bd-pm',
    'a1-bd-pm',
    {
      page: 'a1',
      title: 'Breakdown against PM',
      kpis: [
        ['Breakdown hours', '41.5', '3 pts up'],
        ['PM hours', '—'],
      ],
      tables: [
        {
          title: 'By cell',
          header: ['Cell', 'BD hours', 'PM hours'],
          rows: [['Cell 2', '12.5', '']],
        },
        {
          title: 'By month',
          header: ['Month', 'BD hours'],
          rows: [
            ['Jan', '4.0'],
            ['Feb', '—'],
          ],
        },
      ],
      charts: [
        { id: 'ch-a1-cell', ...BARS },
        { id: 'ch-a1-trend', ...MONTHS },
      ],
    },
    ['t1', 't2'],
  ),
  figure('a2-category-cell', 'a2-category-cell', {
    page: 'a2',
    title: 'Category and cell',
    kpis: [['Top category', 'Spindle', '12 breakdowns']],
    tables: [{ title: 'By category', header: ['Category', 'Hours'], rows: [['Spindle', '9.5']] }],
    charts: [{ id: 'ch-a2-cathrs', ...BARS }],
  }),
  figure('a3-mttr-mtbf', 'a3-mttr-mtbf', {
    page: 'a3',
    title: 'MTTR and MTBF',
    kpis: [
      ['MTTR', '2.5', 'hours'],
      ['MTBF', '110.0', 'hours'],
    ],
    tables: [
      {
        title: 'By category',
        header: ['Category', 'MTTR', 'MTBF'],
        rows: [['Spindle', '2.5', '—']],
      },
    ],
    charts: [{ id: 'ch-a3-catmttr', ...BARS }],
  }),
  figure('a4-manpower', 'a4-manpower', {
    page: 'a4',
    title: 'Manpower',
    kpis: [
      ['People', '2'],
      ['Hours handled', '30.5', ''],
    ],
    tables: [
      {
        title: 'Manpower Table',
        header: ['Person', 'Hours'],
        rows: [
          ['Asha', '12.0'],
          ['Ravi', '18.5'],
        ],
      },
      { title: 'Specialization', header: ['Person', 'Spindle'], rows: [['Asha', '3']] },
    ],
    charts: [
      { id: 'ch-a4-count', labels: ['Asha', 'Ravi'], datasets: [{ label: 'Jobs', data: [3, 5] }] },
    ],
  }),
  figure('a10-problems', 'a10-problems', {
    page: 'a10',
    title: 'Problem Analysis',
    kpis: [['Groups', '3']],
    tables: [
      { title: 'Problem groups', header: ['Problem group', 'Count'], rows: [['Coolant', '4']] },
      {
        title: 'Entries the system could not place',
        header: ['Date', 'Machine', 'Problem', 'Hours', 'Group', ''],
        rows: [['01-03-2026', 'CNC-01', 'Odd noise', '1.5', 'Coolant', '']],
      },
      {
        title: 'Group editor',
        header: ['Order', 'Group name', 'Keywords', 'Remove'],
        rows: [['1', 'Coolant', 'coolant, leak', '']],
      },
    ],
    charts: [{ id: 'ch-prob-pareto', labels: ['Coolant'], datasets: [{ label: '', data: [6] }] }],
  }),
  figure('fix-finder', 'fix-finder', {
    page: 'ff',
    title: 'Fix Finder',
    kpis: [
      ['Similar breakdowns', '15'],
      ['Best fix', 'Re-seat the probe'],
    ],
    tables: [
      {
        title: 'Similar breakdowns',
        header: ['Ticket', 'Machine', 'Fix'],
        rows: [['T-001', 'CNC-01', 'Probe re-seated']],
      },
    ],
  }),
  figure('shift-kpis.compare', 'shift-kpis', {
    page: 'sk',
    title: 'Shift comparison',
    kpis: [['Day shift', '55.0%']],
    tables: [
      {
        title: 'By shift',
        header: ['Shift', 'Hours'],
        rows: [
          ['Day', '20.0'],
          ['Evening', ''],
        ],
      },
    ],
  }),
  figure('shift-kpis.backlog', 'shift-kpis', {
    page: 'sk',
    title: 'Backlog',
    tables: [{ title: 'Open at shift end', header: ['Shift', 'Open'], rows: [['Day', '2']] }],
  }),
  figure('compare', 'compare', {
    page: 'cmp',
    title: 'Compare machines',
    tables: [
      {
        title: 'Scorecard',
        header: ['Measure', 'CNC-01', 'CNC-02'],
        rows: [['Health', '82', '74']],
      },
      { title: 'Checkup', header: ['Item', 'CNC-01'], rows: [['Coolant', 'Ok']] },
      { title: 'Specifications', header: ['Item', 'CNC-01'], rows: [['Year', '2019']] },
      { title: 'Longest breakdowns', header: ['Date', 'Hours'], rows: [['01-02-2026', '6.5']] },
    ],
    charts: [{ id: 'ch-a1-trend', ...MONTHS }],
  }),
  {
    key: 'cell-change-log',
    screen: 'cell-change-log',
    owner: 39,
    status: 'ready',
    drill: { type: 'move', ids: [] },
    value: {
      moves: [
        {
          id: 'mv1',
          machineId: 'm1',
          date: '2026-02-10',
          fromCell: 'Cell 2',
          toCell: 'Cell 6',
          fromLocation: 'Bay A',
          toLocation: 'Bay A',
        },
        {
          id: 'mv2',
          machineId: 'm3',
          date: '2026-01-05',
          fromCell: null,
          toCell: 'Cell 2',
          fromLocation: null,
          toLocation: 'Bay B',
        },
      ],
    },
  },
];

const REPLY = {
  asOf: '2026-03-15',
  profile: {},
  rows: { machines: 4, moves: 2, tickets: 5, tasks: 0, reports: 0, people: 2 },
  excludedMachines: 0,
  figures: FIGURES,
};

/** The plant of `plant-mock.ts` plus the figures above. */
export async function mockAnalytics(page: Page): Promise<void> {
  await mockPlant(page);
  await page.route('**/api/v1/analytics/figures**', (route: Route) =>
    route.fulfill({ json: REPLY }),
  );
}
