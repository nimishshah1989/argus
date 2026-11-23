// @vitest-environment node
import { readFileSync } from 'node:fs';
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
import type { PlantMachine } from './model.js';
import { DashboardView } from './View.js';

/**
 * The real-server e2e (`e2e/analytics.spec.ts`, "a head lands on Today") finds every Dashboard figure by a region named
 * with its label (`getByRole('region', { name, exact: true })`). This mirrors that loop without a browser: the names
 * are read from the spec itself, so the page and the spec cannot drift apart unseen.
 */
const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );

/** `'dashboard.x': 'Label',` lines of the spec's LABEL map. */
function specLabels(): Record<string, string> {
  const spec = readFileSync(new URL('../../../../e2e/analytics.spec.ts', import.meta.url), 'utf8');
  const block = /const LABEL: Record<string, string> = \{([\s\S]*?)\n\};/.exec(spec)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/'(dashboard\.[\w-]+)':\s*'([^']+)'/g)].map((m) => [m[1]!, m[2]!]),
  );
}

/** The names of the regions on the page: a section's `aria-label`, or the heading a section is labelled by. */
function regionNames(markup: string): string[] {
  const headings = new Map(
    [...markup.matchAll(/<h2[^>]*id="([^"]+)"[^>]*>(.*?)<\/h2>/g)].map((h) => [h[1]!, h[2]!]),
  );
  const unescape = (text: string) =>
    text
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"');
  return [...markup.matchAll(/<section\b([^>]*)>/g)].flatMap((s) => {
    const label = /aria-label="([^"]*)"/.exec(s[1]!)?.[1];
    const by = /aria-labelledby="([^"]*)"/.exec(s[1]!)?.[1];
    const name = label ?? (by ? headings.get(by) : undefined);
    return name === undefined ? [] : [unescape(name)];
  });
}

describe('every Dashboard figure has the region the e2e looks for', () => {
  const real = realReply();
  const machines: PlantMachine[] = ENGINE_DATA.machines.map((m) => ({
    id: m.id,
    code: m.code,
    category: m.category ?? null,
    cell: m.cell ?? null,
  }));
  const model = dashboardModel(
    { reply: real, open: { tickets: [], now: '2026-11-11T09:00:00.000Z' }, board: null, machines },
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
  const names = regionNames(markup);
  const labels = specLabels();
  const dashboard = real.figures.filter((f) => f.screen === 'dashboard').map((f) => f.key);

  it('names all 20 Dashboard figures in the spec, none missing and none extra', () => {
    expect(Object.keys(labels).sort()).toEqual([...dashboard].sort());
  });

  it.each(dashboard)('%s is a region named as the spec names it, once', (key) => {
    const matching = names.filter((name) => name === labels[key]);
    expect(matching, `${key}: "${labels[key]}" among ${JSON.stringify(names)}`).toHaveLength(1);
  });

  it("keeps both pictures' region names when they have nothing to draw or are not computed", () => {
    for (const change of [{ value: null }, { status: 'not_computed' as const, value: null }]) {
      const reply = {
        ...real,
        figures: real.figures.map((f) =>
          f.screen === 'dashboard' && /bubble|expansion/.test(f.key) ? { ...f, ...change } : f,
        ),
      } as typeof real;
      const bare = dashboardModel({ reply, open: null, board: null, machines }, t);
      const out = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: ['/analytics/today'] },
          createElement(DashboardView, {
            model: bare,
            nav: [
              { id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true },
            ],
            title: 'Dashboard',
          }),
        ),
      );
      for (const key of ['dashboard.bubble-chart', 'dashboard.expansion-timeline'])
        expect(regionNames(out)).toContain(labels[key]);
    }
  });
});
