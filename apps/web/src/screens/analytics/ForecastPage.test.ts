import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/index.js';
import { ApiError, OnlineContext } from '../../data/index.js';
import { groupFor } from './groups.js';

const state = vi.hoisted(() => ({ data: undefined as unknown, error: null as unknown }));

vi.mock('../../api.js', () => ({
  getConfig: async () => ({ machines: [] }),
  getDrill: async () => ({ rows: [] }),
  useAnalyticsFigures: () => ({ ...state, refetch: async () => undefined }),
}));

const { ForecastPage } = await import('./ForecastPage.js');

/** A neutral constant, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_A9 = 'a9-bottleneck-forecast';

const figure = (status: string, value: unknown) => ({
  asOf: '2026-11-11',
  figures: [
    {
      key: SCREEN_A9,
      screen: SCREEN_A9,
      owner: 42,
      status,
      value,
      drill: { type: 'machine', ids: [] },
    },
  ],
});

const A9 = {
  screen: SCREEN_A9,
  asOf: '2026-11-11',
  pages: [
    {
      page: 'a9',
      title: 'Bottleneck Analysis',
      kpis: [
        { label: 'Expected next month', value: '188.4 hrs (80% range 120 to 260)', sub: null },
      ],
      tables: [],
      charts: [],
    },
  ],
};

function render(online = true, url = '/analytics/forecast-scorecard'): string {
  return renderToStaticMarkup(
    h(
      OnlineContext.Provider,
      { value: online },
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(
          MemoryRouter,
          { initialEntries: [url] },
          h(ForecastPage, { group: groupFor('forecast-scorecard')! }),
        ),
      ),
    ),
  );
}

beforeEach(() => {
  state.data = figure('ready', A9);
  state.error = null;
});

describe('the A9 and Forecast Lab page', () => {
  it('prints a forecast and its range exactly as the engine wrote them, under the page title', () => {
    const page = render();
    expect(page).toContain('>Bottleneck Analysis</h2>');
    expect(page).toContain('188.4 hrs (80% range 120 to 260)');
  });

  it('keeps the screen title in every state that is not the page', () => {
    state.data = figure('not_computed', null);
    expect(render()).toContain('>A9 bottleneck and forecast</h2>');
    expect(render()).toContain('Not computed yet');

    state.data = undefined;
    expect(render()).toContain('>A9 bottleneck and forecast</h2>');
    expect(render(false)).toContain('>A9 bottleneck and forecast</h2>');

    state.error = new ApiError('boom', 'bad');
    const failed = render();
    expect(failed).toContain('>A9 bottleneck and forecast</h2>');
    expect(failed).toContain('role="alert"');

    state.error = new ApiError('not_found', 'none');
    const empty = render();
    expect(empty).toContain('>A9 bottleneck and forecast</h2>');
    expect(empty).toContain('No figures are registered for this screen yet.');
  });

  it('names the Forecast Lab on its own tab and has one h2 with the machine drill open', () => {
    state.data = figure('not_computed', null);
    const lab = render(true, '/analytics/forecast-scorecard?screen=forecast-lab');
    expect(lab).toContain('>Forecast Lab</h2>');
    state.data = figure('ready', A9);
    const open = render(true, '/analytics/forecast-scorecard?drill=machine:m1');
    expect(open.match(/<h2/g)).toHaveLength(1);
  });
});
