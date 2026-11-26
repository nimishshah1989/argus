// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { boardModel } from './adapter.js';
import { fixtureConfig, fixtureState, fixtureToday } from './fixture.js';
import { BoardView } from './View.js';

/** Ticket 772 (ADR 0034): one render-smoke per mode. The drawn counts are the model's, as the e2e specs read them. */
const draw = (tv: boolean) =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        null,
        h(BoardView, {
          model: boardModel(
            { state: fixtureState, config: fixtureConfig, today: fixtureToday, tv },
            realT,
          ),
        }),
      ),
    ),
  );

/** The bare number inside the element carrying `data-testid="<id>"`. */
const count = (html: string, id: string) =>
  new RegExp(`data-testid="${id}"[^>]*>\\s*(\\d+)\\s*<`).exec(html)?.[1];
const tiles = (html: string) => html.match(/data-testid="tile"/g)?.length ?? 0;

describe('S30 board view: render-smoke', () => {
  it('draws the phone and desktop board with its counts and every stop', () => {
    const html = draw(false);
    expect(count(html, 'count-running')).toBe('4');
    expect(count(html, 'count-stopped')).toBe('8');
    expect(count(html, 'age-overDay')).toBe('1');
    expect(tiles(html)).toBe(8);
  });

  it('draws the wall TV with no link and at most 3 stops per column', () => {
    const html = draw(true);
    expect(html).not.toMatch(/<a\b/);
    expect(count(html, 'count-stopped')).toBe('8');
    expect(tiles(html)).toBe(7);
  });
});
