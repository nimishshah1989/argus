// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import '../../../i18n/index.js';
import { ApiError, OnlineContext } from '../../../data/index.js';
import { ScreenStates } from '../../../ui/v2/screen-states.js';

const server = vi.hoisted(() => ({ role: 'operator', calendarError: null as unknown }));

vi.mock('../../../api.js', async (original) => ({
  ...(await original<typeof import('../../../api.js')>()),
  getMe: async () => ({ user: { role: server.role } }),
  analyticsFiguresQuery: {
    queryKey: ['analytics-figures', 'one', null],
    queryFn: async () => ({ asOf: '2026-11-11', figures: [] }),
  },
  pmCalendarQuery: () => ({
    queryKey: ['pm-calendar', 'a', 'b'],
    queryFn: async () => {
      throw server.calendarError;
    },
  }),
}));

const { load } = await import('../data.js');
const { livePmCalendar } = await import('./live.js');

const ask = (error: unknown) => {
  server.calendarError = error;
  return load<'pm-calendar'>(
    (query, ctx) => livePmCalendar(ctx.client, query, i18n.t.bind(i18n)),
    {
      range: null,
    },
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
  );
};

const draw = (state: Parameters<typeof ScreenStates>[0]['loaded']['state']) =>
  renderToStaticMarkup(
    h(
      OnlineContext.Provider,
      { value: true },
      h(ScreenStates, { loaded: { state, retry: () => {} }, children: () => null }),
    ),
  );

describe('the PM calendar before it can show anything', () => {
  it('is refused, and says so alone, when the server will not let this login read it', async () => {
    const loaded = await ask(new ApiError('forbidden', 'Not allowed', undefined, 403));
    expect(loaded.state).toBe('refused');
    const page = draw(loaded.state);
    expect(page).toContain('role="alert"');
    expect(page).not.toContain('PM calendar');
    expect(page).not.toContain('data-date');
    expect(page).not.toContain('<h2');
  });

  it('prints no heading while it is still loading either', () => {
    expect(draw('loading')).not.toContain('<h2');
  });

  it('is an offline state, not a refusal, when the connection is down', async () => {
    expect((await ask(new TypeError('Failed to fetch'))).state).toBe('offline');
  });
});
