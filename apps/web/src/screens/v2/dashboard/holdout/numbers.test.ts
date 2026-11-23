// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { ENGINE_DATA } from '../../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../../i18n/index.js';
import type { Translate } from '../../figures/read.js';
import { realReply } from '../../figures/real-reply.js';
import { dashboardModel } from '../adapter.js';
import type { DashboardModel, PlantMachine } from '../model.js';
import { DashboardView } from '../View.js';

/** G1.4, hidden: the numbers sit under their own chart, and a chart that is not drawn has none. */
const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );

const machines: PlantMachine[] = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
  cell: m.cell ?? null,
}));

const real = realReply();
const modelOf = (reply: FiguresReply): DashboardModel =>
  dashboardModel(
    { reply, open: { tickets: [], now: '2026-11-11T09:00:00.000Z' }, board: null, machines },
    t,
  );

const draw = (model: DashboardModel): string =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/analytics/today'] },
      createElement(DashboardView, {
        model,
        nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
        title: 'Dashboard',
      }),
    ),
  );

const SUMMARY = /<summary[^>]*>Show the numbers<\/summary>/g;

describe('the Dashboard numbers, hidden', () => {
  it('puts each "Show the numbers" inside its own chart card, after the chart and before the next card', () => {
    const model = modelOf(real);
    const markup = draw(model);
    const drawn = model.charts.filter((chart) => 'spec' in chart);
    expect(drawn.length).toBeGreaterThan(0);
    for (const chart of drawn) {
      const start = markup.indexOf(`aria-label="${chart.spec.title}"`);
      expect(start, chart.id).toBeGreaterThan(0);
      const end = markup.indexOf('</section>', start);
      const card = markup.slice(start, end);
      expect(card.match(SUMMARY), chart.id).toHaveLength(1);
    }
  });

  it('has no "Show the numbers" for a chart the engine has not computed', () => {
    const held: FiguresReply = {
      ...real,
      figures: real.figures.map((figure) =>
        figure.key === 'dashboard.expansion-timeline'
          ? { ...figure, status: 'not_computed', value: null }
          : figure,
      ) as FiguresReply['figures'],
    };
    const model = modelOf(held);
    expect(model.charts.some((chart) => 'spec' in chart)).toBe(false);
    expect(draw(model).match(SUMMARY)).toBeNull();
  });
});
