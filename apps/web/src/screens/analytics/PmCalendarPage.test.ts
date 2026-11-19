import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n/index.js';
import { ApiError, OnlineContext } from '../../data/index.js';
import { groupFor } from './groups.js';

const state = vi.hoisted(() => ({ error: null as unknown }));

vi.mock('../../api.js', () => ({
  getMe: async () => ({ user: { role: 'operator' } }),
  schedulePm: async () => ({}),
  useAnalyticsFigures: () => ({
    data: undefined,
    error: state.error,
    refetch: async () => undefined,
  }),
  usePmCalendar: () => ({ data: undefined, error: null, refetch: async () => undefined }),
}));

const { default: PmCalendarPage } = await import('./PmCalendarPage.js');

const render = (error: unknown): string => {
  state.error = error;
  return renderToStaticMarkup(
    h(
      OnlineContext.Provider,
      { value: true },
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(MemoryRouter, null, h(PmCalendarPage, { group: groupFor('pm')! })),
      ),
    ),
  );
};

describe('the PM calendar before it can show anything', () => {
  it('prints the refusal alone, with no PM calendar heading, when the login may not read it', () => {
    const page = render(new ApiError('Not allowed', 'forbidden'));
    expect(page).toContain('role="alert"');
    expect(page).not.toContain('PM calendar');
    expect(page).not.toContain('<h2');
  });

  it('prints no heading while it is still loading either', () => {
    expect(render(null)).not.toContain('<h2');
  });
});
