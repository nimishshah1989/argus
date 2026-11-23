// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import type { Translate } from '../figures/read.js';
import { realReply } from '../figures/real-reply.js';
import { dashboardModel } from './adapter.js';
import type { DashboardModel, PlantMachine } from './model.js';
import { DashboardView } from './View.js';

/**
 * G1.4: every Dashboard chart has the table behind it. A drawn chart opens its plotted numbers behind its own "Show
 * the numbers"; the bubble chart's numbers are the machines table printed under it.
 */
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

const model: DashboardModel = dashboardModel(
  {
    reply: realReply(),
    open: { tickets: [], now: '2026-11-11T09:00:00.000Z' },
    board: null,
    machines,
  },
  t,
);

const markup = renderToStaticMarkup(
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

const summaries = [...markup.matchAll(/<summary[^>]*>Show the numbers<\/summary>/g)];

describe('the Dashboard shows the numbers behind each chart', () => {
  it('gives every drawn chart its own "Show the numbers"', () => {
    const drawn = model.charts.filter((chart) => 'spec' in chart);
    expect(drawn.length).toBeGreaterThan(0);
    expect(summaries).toHaveLength(drawn.length);
  });

  it('prints the machines the bubble chart is drawn from in a table after it', () => {
    const bubble = model.charts.find((chart) => 'bubble' in chart);
    expect(bubble).toBeDefined();
    expect(model.machines).not.toBeNull();
    const chartAt = markup.indexOf(`>${bubble!.title}<`);
    const tableAt = markup.indexOf(`>${model.machines!.title}<`);
    expect(chartAt).toBeGreaterThan(0);
    expect(tableAt).toBeGreaterThan(chartAt);
  });
});
