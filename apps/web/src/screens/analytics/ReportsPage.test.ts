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

const figures = (status: string, value: unknown) => ({
  asOf: '2026-11-11',
  figures: [
    {
      key: 'monthly-report',
      screen: 'monthly-report',
      owner: 45,
      status,
      value,
      drill: { type: 'ticket', ids: [] },
    },
  ],
});

const REPORT = {
  screen: 'monthly-report',
  asOf: '2026-11-11',
  pages: [
    {
      page: 'rp',
      title: 'Monthly Report',
      kpis: [],
      tables: [
        {
          title: 'Where the time went',
          header: ['Machine', 'Hours'],
          rows: [['TC-1', '12.5']],
          rowCount: 1,
        },
      ],
      charts: [],
    },
  ],
};

function render(): string {
  return renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        { initialEntries: ['/analytics/reports'] },
        h(ReportsPage, { group: groupFor('reports')! }),
      ),
    ),
  );
}

beforeEach(() => {
  reply.current = figures('ready', REPORT);
});

describe('the Reports page', () => {
  it('shows the report, its period line and its downloads under the title', () => {
    const page = render();
    expect(page).toContain('>Monthly Report</h2>');
    expect(page).toContain('October 2026');
    expect(page).toContain('Download PDF');
    expect(page).toContain('Where the time went');
    expect(page).toContain('12.5');
  });

  it('says an empty report is empty, under its title and period line', () => {
    reply.current = figures('ready', null);
    const page = render();
    expect(page).toContain('>Monthly report</h2>');
    expect(page).toContain('Nothing was recorded in this period, so this report is empty.');
    expect(page).toContain('October 2026');
  });

  it('says a report the engine has not computed is not computed, under its title', () => {
    reply.current = figures('not_computed', null);
    const page = render();
    expect(page).toContain('>Monthly report</h2>');
    expect(page).toContain('Not computed yet');
  });
});
