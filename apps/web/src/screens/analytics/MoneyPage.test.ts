import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/index.js';
import { ApiError, OnlineContext } from '../../data/index.js';
import { groupFor } from './groups.js';

const reply = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('../../api.js', () => ({
  getMe: async () => ({ user: { role: 'head' } }),
  getConfig: async () => ({ machines: [] }),
  getDrill: async () => ({ rows: [] }),
  useAnalyticsFigures: () => ({
    data: reply.current,
    error: null,
    refetch: async () => undefined,
  }),
}));

const { MoneyPage } = await import('./MoneyPage.js');

const MONEY_PAGE = {
  screen: 'money-matters',
  asOf: '2026-11-11',
  pages: [
    {
      page: 'mm',
      title: 'Money Matters',
      kpis: [
        { label: 'Open Team Focus actions', value: '₹ 44.87 lakh a year', sub: '254 hrs a month' },
        { label: 'Next month, expected', value: '—', sub: null },
      ],
      tables: [],
      charts: [],
    },
  ],
};

const figures = (value: unknown) => ({
  asOf: '2026-11-11',
  figures: [
    {
      key: 'money-matters',
      screen: 'money-matters',
      owner: 43,
      status: 'ready',
      value,
      drill: { type: 'ticket', ids: [] },
    },
  ],
});

function render(role: string | null, { online = true, url = '/analytics/cost' } = {}): string {
  const client = new QueryClient();
  if (role !== null) client.setQueryData(['me'], { user: { role } });
  const group = groupFor('cost')!;
  return renderToStaticMarkup(
    h(
      OnlineContext.Provider,
      { value: online },
      h(
        QueryClientProvider,
        { client },
        h(MemoryRouter, { initialEntries: [url] }, h(MoneyPage, { group })),
      ),
    ),
  );
}

beforeEach(() => {
  reply.current = figures(MONEY_PAGE);
});

describe('Money Matters', () => {
  it('prints an engine figure verbatim and a missing one as a dash', () => {
    const page = render('head');
    expect(page).toContain('₹ 44.87 lakh a year');
    expect(page).toContain('254 hrs a month');
    expect(page).toMatch(/Next month, expected<\/span><\/dt><dd[^>]*>—<\/dd>/);
  });

  it('gives a login that may not read money the refusal, not the page', () => {
    const page = render('supervisor');
    expect(page).toContain('Money Matters is for heads and admin');
    expect(page).not.toContain('₹ 44.87 lakh a year');
  });

  it('never shows the refusal while the login is not known yet', () => {
    expect(render(null)).not.toContain('for heads and admin');
    expect(render(null, { online: false })).not.toContain('for heads and admin');
  });

  it('shows Retry, never the refusal, when the login cannot be read', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
    client
      .getQueryCache()
      .build(client, { queryKey: ['me'], queryFn: async () => ({ user: { role: 'head' } }) })
      .setState({ status: 'error', error: new ApiError('boom', 'bad'), data: undefined });
    const page = renderToStaticMarkup(
      h(
        OnlineContext.Provider,
        { value: true },
        h(
          QueryClientProvider,
          { client },
          h(
            MemoryRouter,
            { initialEntries: ['/analytics/cost'] },
            h(MoneyPage, { group: groupFor('cost')! }),
          ),
        ),
      ),
    );
    expect(page).toContain('role="alert"');
    expect(page).toContain('Try again');
    expect(page).not.toContain('for heads and admin');
  });

  it('says so when the engine has not computed the page', () => {
    reply.current = figures(null);
    expect(render('head')).toContain('Not computed yet');
  });

  it('has one h2, the page title, also when the rows behind a figure are open', () => {
    const page = render('head', { url: '/analytics/cost?drill=ticket:t1' });
    expect(page.match(/<h2/g)).toHaveLength(1);
    expect(page).toContain('The rows behind this figure');
  });
});
