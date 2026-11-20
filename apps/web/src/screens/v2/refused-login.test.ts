// @vitest-environment node
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { OnlineContext } from '../../data/index.js';
import type { LoadState } from '../../ui/v2/screen-states.js';
import { BreakdownLogFrame } from './breakdown-log/Page.js';
import { PmCalendarFrame } from './pm-calendar/Page.js';

/**
 * A login that may not read the figures, on the real pages (the frames the live pages draw, in the real shell): the
 * screen's title stays, the refusal is an alert, and no calendar, no table and no row of the group's screens is drawn.
 * v1 drew no title for it; the v2 shell always carries the page's title, as the Action Center's does.
 */
const page = (role: string, frame: ReactElement, state: LoadState): string => {
  const client = new QueryClient();
  client.setQueryData(['me'], { user: { role } });
  return renderToStaticMarkup(
    h(
      OnlineContext.Provider,
      { value: true },
      h(QueryClientProvider, { client }, h(MemoryRouter, null, frame)),
    ),
  ).replace(state, state);
};

const loaded = (state: LoadState) => ({ state, retry: () => {} });
const log = (state: LoadState) =>
  h(BreakdownLogFrame, {
    loaded: loaded(state),
    model: undefined,
    onQuery: () => {},
    onExport: () => Promise.resolve(),
  });
const calendar = (state: LoadState) =>
  h(PmCalendarFrame, {
    loaded: loaded(state),
    model: undefined,
    onRange: () => {},
    onMove: undefined,
  });

describe('a refused operator on the live pages', () => {
  for (const [name, frame, title] of [
    ['Breakdown Log', log, 'Breakdown log'],
    ['PM calendar', calendar, 'PM calendar'],
  ] as const) {
    it(`${name}: keeps the page title, says no in an alert, and draws no table, no calendar and no screen row`, () => {
      const markup = page('operator', frame('refused'), 'refused');
      expect(markup).toContain(title);
      expect(markup).toContain('role="alert"');
      expect(markup).not.toContain('<table');
      expect(markup).not.toContain('data-date');
      expect(markup).not.toContain('aria-label="Breakdowns screens"');
      expect(markup).not.toMatch(/aria-label="Screens in /);
    });

    it(`${name}: a head, whose answer is a page, does get the row of screens (so the check above can fail)`, () => {
      const markup = page('head', frame('loading'), 'loading');
      expect(markup).toMatch(/aria-label="(Breakdowns screens|Screens in [^"]+)"/);
    });
  }
});
