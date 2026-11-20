// @vitest-environment node
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import type { LoadState } from '../../ui/v2/screen-states.js';
import { ModelFrame, liveScreen } from './live.js';

/** The page a live screen puts in its fragment: the `ModelPage` element, with the title and words it was given. */
type PageProps = Record<string, unknown> & { title: Parameters<typeof i18n.t>[0] & string };
const pageOf = (group: string, screen: string): { key: string | null; props: PageProps } => {
  const found = liveScreen(group, screen) as ReactElement<{ children: ReactElement<PageProps> }>;
  return { key: found.key, props: found.props.children.props };
};

const SCREENS = [
  ['machines', 'a5-energy', 'Energy Heatmap'],
  ['breakdowns', 'shift-kpis', 'Shift-calendar KPIs'],
  ['breakdowns', 'a4-manpower', 'Manpower'],
  ['breakdowns', 'a6-why-why', 'Why-Why'],
  ['forecast-scorecard', 'a9-bottleneck-forecast', 'Bottleneck Analysis'],
  ['forecast-scorecard', 'forecast-lab', 'Forecast Lab'],
  ['breakdowns', 'a1-bd-pm', 'BD % and PM split'],
  ['breakdowns', 'a2-category-cell', 'Category and cell'],
  ['breakdowns', 'a3-mttr-mtbf', 'MTTR and MTBF'],
] as const;

const draw = (props: PageProps, loaded: { state: LoadState }, lastGood?: unknown) =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        null,
        h(ModelFrame as unknown as (p: Record<string, unknown>) => ReactElement, {
          ...props,
          loaded: { ...loaded, retry: () => {} },
          lastGood,
        }),
      ),
    ),
  );

describe('moving between two live screens', () => {
  it('gives each screen of each group its own identity, so a screen never inherits the last one’s model', () => {
    const keys = [
      ...SCREENS.map(([group, screen]) => pageOf(group, screen).key),
      pageOf('machines', 'registers').key,
      pageOf('breakdowns', 'fix-finder').key,
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(pageOf('forecast-scorecard', 'forecast-lab').key).toBe(
      pageOf('forecast-scorecard', 'forecast-lab').key,
    );
  });
});

describe('Energy, Shift-calendar KPIs, Manpower, Why-Why, Bottleneck, Forecast Lab, BD % and PM split, Category and cell and MTTR and MTBF in every state that is not the page', () => {
  for (const [group, screen, title] of SCREENS) {
    const { props } = pageOf(group, screen);
    const states: LoadState[] = ['loading', 'error', 'empty', 'offline', 'refused'];

    it(`${title} keeps its page title as the first heading in loading, error, empty, offline and refused`, () => {
      expect(i18n.t(props.title)).toBe(title);
      for (const state of states)
        expect(draw(props, { state }), state).toMatch(
          new RegExp(`<h1[^>]*>${title.replace(/&/g, '&amp;')}</h1>`),
        );
    });

    it(`${title} says "Not computed yet" when the engine has nothing, never "nothing to show"`, () => {
      const markup = draw(props, { state: 'empty' });
      expect(markup).toContain('data-state="empty"');
      expect(markup).toContain('Not computed yet');
    });
  }

  it('says the connection is lost, the refusal, or a failure with a button to try again, each in its own state', () => {
    const { props } = pageOf('forecast-scorecard', 'forecast-lab');
    for (const state of ['offline', 'refused', 'error'] as const)
      expect(draw(props, { state })).toContain(`data-state="${state}"`);
    expect(draw(props, { state: 'loading' })).toContain('data-state="loading"');
  });

  it('names the Forecast Lab on its own pressed tab, in the group’s tab row', () => {
    const { props } = pageOf('forecast-scorecard', 'forecast-lab');
    const markup = draw(props, { state: 'loading' });
    expect(markup).toContain('Screens in Reliability &amp; forecast');
    expect(markup).toMatch(/aria-pressed="true"[^>]*>[^<]*Forecast Lab/);
  });
});

describe('a screen that has drawn once', () => {
  const drawn = {
    ...pageOf('forecast-scorecard', 'forecast-lab').props,
    draw: () => h('p', null, 'the page'),
  };

  it('stays drawn while a refresh loads and when a refresh fails, as v1 kept its data', () => {
    for (const state of ['loading', 'error', 'offline'] as const)
      expect(draw(drawn, { state }, 'model'), state).toContain('the page');
  });

  it('shows the error state for a first load that fails, when there is nothing yet to keep', () => {
    expect(draw(drawn, { state: 'error' })).toContain('data-state="error"');
  });

  it('replaces the page when the refresh brings news: nothing computed, or a refusal', () => {
    for (const state of ['empty', 'refused'] as const)
      expect(draw(drawn, { state }, 'model'), state).not.toContain('the page');
  });
});

describe('the section’s screens row', () => {
  const { props } = pageOf('breakdowns', 'a1-bd-pm');
  const as = (role: string) => {
    const client = new QueryClient();
    client.setQueryData(['me'], { user: { role } });
    return renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client },
        h(
          MemoryRouter,
          null,
          h(ModelFrame as unknown as (p: Record<string, unknown>) => ReactElement, {
            ...props,
            loaded: { state: 'loading', retry: () => {} },
          }),
        ),
      ),
    );
  };

  it('is left out for a login that may not open analytics, who sees the refusal and no menu of screens', () => {
    expect(as('operator')).not.toContain('Breakdowns screens');
  });

  it('is there for a login that may', () => {
    expect(as('supervisor')).toContain('Breakdowns screens');
  });
});
