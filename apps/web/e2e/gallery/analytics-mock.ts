import type { Page, Route } from '@playwright/test';
import { mockPlant } from './plant-mock.js';

/**
 * The analytics figures answered from the browser (ticket 87, rest): an invented plant's A4 and
 * Compare, in the engine's own page shape. Invented names and numbers only. The
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

const FIGURES = [
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
    charts: [
      {
        id: 'ch-cmp-code',
        labels: ['No code', 'Spindle'],
        datasets: [
          { label: 'CNC-01', data: [1.5, 4] },
          { label: 'CNC-02', data: [0, 2.5] },
        ],
      },
      {
        id: 'ch-cmp-month',
        labels: ['Jan 26', 'Feb 26'],
        datasets: [
          { label: 'CNC-01', data: [3, 2.5] },
          { label: 'CNC-02', data: [1, 0] },
        ],
      },
    ],
  }),
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

/** Every heading and control top to bottom, as `controlOrder` reads them, and the chart's `summary` ("Show the numbers"). */
export function analyticsOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'h1,h2,h3,a[href],button,input,select,textarea,summary';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => {
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ');
        return `${el.tagName.toLowerCase()}: ${name.trim().slice(0, 12)}`;
      });
  });
}
