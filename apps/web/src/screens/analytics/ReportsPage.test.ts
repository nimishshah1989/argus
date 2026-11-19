import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/index.js';
import { groupFor } from './groups.js';

const reply = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('../../api.js', () => ({
  getConfig: async () => ({ machines: [] }),
  getDrill: async () => ({ rows: [] }),
  useAnalyticsFigures: () => ({ data: reply.current, error: null, refetch: async () => undefined }),
}));

const { ReportsPage } = await import('./ReportsPage.js');

/** Neutral constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_MONTHLY = 'monthly-report';
const SCREEN_ANNUAL = 'annual-report';

const figure = (screen: string, status: string, value: unknown) => ({
  key: screen,
  screen,
  owner: 45,
  status,
  value,
  drill: { type: 'ticket', ids: [] },
});

const report = (screen: string, title: string, table: string, cell: string) => ({
  screen,
  asOf: '2026-11-11',
  pages: [
    {
      page: 'rp',
      title,
      kpis: [],
      tables: [{ title: table, header: ['Machine', 'Hours'], rows: [['TC-1', cell]], rowCount: 1 }],
      charts: [],
    },
  ],
});

const MONTHLY = report(SCREEN_MONTHLY, 'Monthly Report', 'Where the time went', '12.5');
const ANNUAL = report(SCREEN_ANNUAL, 'Annual Report', 'Month by month', '240.75');

const replyOf = (monthly: unknown[], annual: unknown[]) => ({
  asOf: '2026-11-11',
  figures: [
    figure(SCREEN_MONTHLY, ...(monthly as [string, unknown])),
    figure(SCREEN_ANNUAL, ...(annual as [string, unknown])),
  ],
});

function render(url = '/analytics/reports'): string {
  return renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(MemoryRouter, { initialEntries: [url] }, h(ReportsPage, { group: groupFor('reports')! })),
    ),
  );
}

const ANNUAL_URL = '/analytics/reports?screen=annual-report';
const WORKBOOK_LABEL = 'Export the whole data set (Excel)';

beforeEach(() => {
  reply.current = replyOf(['ready', MONTHLY], ['ready', ANNUAL]);
});

describe('the Monthly report', () => {
  it('shows the report, its period line and its downloads under the title', () => {
    const page = render();
    expect(page).toContain('>Monthly Report</h2>');
    expect(page).toContain('October 2026');
    expect(page).toContain('Where the time went');
    expect(page).toContain('12.5');
  });

  it('offers the monthly PDF and the whole-data workbook, with their labels and links', () => {
    const page = render();
    expect(page).toMatch(/href="\/api\/v1\/reports\/monthly\.pdf"[^>]*>Download PDF</);
    expect(page).toMatch(
      new RegExp(
        `href="/api/v1/reports/workbook\\.xlsx"[^>]*>${WORKBOOK_LABEL.replace(/[()]/g, '\\$&')}<`,
      ),
    );
    expect(page).not.toContain('annual.pdf');
  });
});

describe('the Annual report', () => {
  it('shows the annual report, its period line and its table under the annual title', () => {
    const page = render(ANNUAL_URL);
    expect(page).toContain('>Annual Report</h2>');
    expect(page).toContain('2026 to 11 November');
    expect(page).toContain('Month by month');
    expect(page).toContain('240.75');
    expect(page).not.toContain('Where the time went');
  });

  it('offers the annual PDF and the same workbook, with their labels and links', () => {
    const page = render(ANNUAL_URL);
    expect(page).toMatch(/href="\/api\/v1\/reports\/annual\.pdf"[^>]*>Download PDF</);
    expect(page).toContain('href="/api/v1/reports/workbook.xlsx"');
    expect(page).toContain(WORKBOOK_LABEL);
    expect(page).not.toContain('monthly.pdf');
  });
});

describe('a report with nothing to print', () => {
  it('says an empty report is empty, under its title and period line', () => {
    reply.current = replyOf(['ready', null], ['ready', null]);
    for (const [url, title, period] of [
      ['/analytics/reports', 'Monthly report', 'October 2026'],
      [ANNUAL_URL, 'Annual report', '2026 to 11 November'],
    ] as const) {
      const page = render(url);
      expect(page).toContain(`>${title}</h2>`);
      expect(page).toContain('Nothing was recorded in this period, so this report is empty.');
      expect(page).toContain(period);
    }
  });

  it('says a report the engine has not computed is not computed, under its title', () => {
    reply.current = replyOf(['not_computed', null], ['not_computed', null]);
    expect(render()).toContain('>Monthly report</h2>');
    expect(render(ANNUAL_URL)).toContain('>Annual report</h2>');
    expect(render(ANNUAL_URL)).toContain('Not computed yet');
  });
});
