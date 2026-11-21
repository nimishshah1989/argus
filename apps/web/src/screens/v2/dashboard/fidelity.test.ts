// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import { focusActions } from '../../analytics/team-focus-actions.js';
import type { Translate } from '../figures/read.js';
import { printed, realReply, UUID } from '../figures/real-reply.js';
import { registersModel } from '../machines-register/adapter.js';
import { dashboardModel } from './adapter.js';
import { bandOf, filterDots, NO_FILTERS } from './bubble.js';
import type { DashboardFacts, DashboardModel, PlantMachine } from './model.js';
import { DashboardView } from './View.js';

/**
 * "Match Bhavin" for the Dashboard: what his page had that ours lost, each shown on the engine's own reply for the
 * frozen answer key. Every assertion is something a person using the page can see or press.
 */
const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );

const real = realReply();
const machines: PlantMachine[] = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
  cell: m.cell ?? null,
}));
const NOW = '2026-11-11T09:00:00.000Z';
const board = (high: number, med: number): ActionCenterBoardReply =>
  ({
    counts: { open: high + med },
    bySeverity: { high, med, low: 0, info: 0 },
  }) as ActionCenterBoardReply;
const model = (over: Partial<DashboardFacts> = {}): DashboardModel =>
  dashboardModel(
    { reply: real, open: { tickets: [], now: NOW }, board: null, machines, ...over },
    t,
  );
const cards = (m: DashboardModel) => m.sections.flatMap((s) => s.kpis);
const card = (m: DashboardModel, name: string) =>
  cards(m).find((k) => k.id === `dashboard.${name}`)!;
const swap = (key: string, changes: Partial<FiguresReply['figures'][number]>): FiguresReply => ({
  ...real,
  figures: real.figures.map((f) =>
    f.key === key ? { ...f, ...changes } : f,
  ) as FiguresReply['figures'],
});

describe('the Team Focus banner', () => {
  const figure = real.figures.find((f) => f.key === 'team-focus')!;
  const actions = focusActions(figure.value);

  it('says how many of the month’s actions are open, the month, and the top one, and links to Team Focus', () => {
    const banner = model().teamFocus!;
    expect(actions.length).toBeGreaterThan(0);
    expect(banner.text.startsWith(`${actions.length} actions open for `)).toBe(true);
    expect(banner.text).toMatch(/for [A-Z][a-z]+ 20\d\d\. Top: \S/);
    const top = actions
      .filter((a) => a.lane !== 'E')
      .reduce((best, a) => (a.stake > best.stake ? a : best));
    expect(banner.text).toContain(top.title);
    expect(banner.href).toBe('/analytics/today?screen=team-focus');
    expect(banner.open).toBe('Open Team Focus');
  });

  it('is not there when the engine has not computed Team Focus, or no action is open', () => {
    expect(
      model({ reply: swap('team-focus', { status: 'not_computed', value: null }) }).teamFocus,
    ).toBe(null);
    expect(model({ reply: swap('team-focus', { value: null }) }).teamFocus).toBe(null);
  });

  it('prints no database id', () => {
    expect(printed(model().teamFocus).some((text) => UUID.test(text))).toBe(false);
  });
});

describe('the Action Center banner’s urgency', () => {
  it('turns urgent, with a word, when any nudge is high priority', () => {
    expect(model({ board: board(2, 1) }).actionCenter).toMatchObject({
      tone: 'loss',
      tag: 'High priority',
    });
  });

  it('is still a watch, with its word, when only medium nudges are open', () => {
    expect(model({ board: board(0, 10) }).actionCenter).toMatchObject({
      tone: 'risk',
      tag: 'Watch',
    });
  });
});

describe('the headline: one lead figure and the meaning colours', () => {
  it('puts the lead figure first with the other headline figures beside it, above everything else', () => {
    const [headline, ...rest] = model().sections;
    expect(headline!.id).toBe('running');
    expect(headline!.hero).toBe(true);
    expect(headline!.kpis.map((k) => k.id.replace('dashboard.', ''))).toEqual([
      'fleet-availability',
      'plant-bd-pct',
      'total-downtime-hours',
      'total-breakdowns',
      'breakdown-free',
    ]);
    expect(headline!.kpis[0]).toMatchObject({ hero: true, value: '99.32%' });
    expect(headline!.kpis[0]!.meter).toBeCloseTo(0.9932);
    expect(rest.every((s) => !s.hero && s.kpis.every((k) => !k.hero))).toBe(true);
    expect(rest.map((s) => s.id)).toEqual(['time', 'fleet']);
  });

  it('colours only the figures whose good direction is known: availability a gain, breakdown share, downtime and breakdowns losses', () => {
    const toned = Object.fromEntries(
      cards(model()).flatMap((k) => (k.tone ? [[k.id.replace('dashboard.', ''), k.tone]] : [])),
    );
    expect(toned).toEqual({
      'fleet-availability': 'gain',
      'plant-bd-pct': 'loss',
      'total-downtime-hours': 'loss',
      'total-breakdowns': 'loss',
    });
    // PM hours and no-downtime hours stay neutral until the plant says which way is good.
    expect(card(model(), 'pm-hours').tone).toBeUndefined();
    expect(card(model(), 'no-downtime-hours').tone).toBeUndefined();
  });

  it('draws no meter for a figure the engine has not computed', () => {
    const k = card(
      model({
        reply: swap('dashboard.fleet-availability', { status: 'not_computed', value: null }),
      }),
      'fleet-availability',
    );
    expect(k.meter).toBeUndefined();
    expect(k.value).toBe('—');
  });
});

describe('every tile is a way in', () => {
  it('opens the register of each type from its machine-count tile, on a page the registers screen has', () => {
    const pages = registersModel(real, t)!.pages.map((p) => p.id);
    const linked = [
      'cnc-machines',
      'conventional-machines',
      'process-machines',
      'utilities',
      'dg-sets',
    ];
    for (const name of linked) {
      const link = card(model(), name).link!;
      const url = new URL(link.href, 'http://plant.test');
      expect(url.pathname).toBe('/analytics/machines');
      expect(url.searchParams.get('screen')).toBe('registers');
      expect(pages, name).toContain(url.searchParams.get('register'));
      expect(link.label).toBe('Open register');
    }
    expect(card(model(), 'total-machines').link).toBeUndefined();
  });

  it('keeps the rows behind every machine-count tile', () => {
    expect(card(model(), 'cnc-machines').drill).toBeDefined();
  });

  it('says how many entries sit behind the no-downtime hours, as many as the rows it opens', () => {
    const figure = real.figures.find((f) => f.key === 'dashboard.no-downtime-hours')!;
    expect(figure.drill.ids.length).toBeGreaterThan(0);
    expect(card(model(), 'no-downtime-hours').meaning).toContain(
      `Entries: ${figure.drill.ids.length}`,
    );
  });
});

describe('the costliest problems', () => {
  it('draws each problem’s hours as a bar, the longest full length, and links to Problem Analysis', () => {
    const c = model().costliest!;
    const bars = c.table!.rows.map((row) => row[1]!.bar!);
    expect(bars[0]).toBe(1);
    expect(bars.every((b) => b > 0 && b <= 1)).toBe(true);
    expect([...bars].sort((a, b) => b - a)).toEqual(bars);
    expect(c.link).toEqual({
      href: '/analytics/breakdowns?screen=a10-problems',
      label: 'View Problem Analysis',
    });
  });
});

describe('the machines failing faster', () => {
  it('names the first eight and says "and N more" for the rest, with every one of them reachable', () => {
    const w = model().warning!;
    expect(w.headline.filter((s) => s.entity)).toHaveLength(8);
    expect(w.more!.label).toBe('and 18 more');
    expect(w.more!.rest.filter((s) => s.entity)).toHaveLength(18);
  });
});

describe('the bubble chart as Bhavin had it', () => {
  const bubble = (m = model()) => {
    const chart = m.charts.find((c) => 'bubble' in c);
    return chart && 'bubble' in chart ? chart.bubble : null;
  };

  it('has a bubble for every machine and a tooltip with its model, age, breakdowns, hours and repair time', () => {
    const b = bubble()!;
    expect(b.dots).toHaveLength(117);
    const row = model().machines!.rows[0]!;
    const dot = b.dots.find((d) => d.title === row[0]!.text)!;
    expect(dot.tip.map((line) => line.split(':')[0])).toEqual([
      'Type',
      'Model',
      'Age',
      'Breakdowns',
      'Downtime hours',
      'Repair time',
    ]);
    expect(dot.tip[3]).toBe(`Breakdowns: ${row[4]!.text}`);
    expect(dot.tip[4]).toBe(`Downtime hours: ${row[3]!.text}`);
    expect(dot.opens).toBe(true);
    expect(dot.r).toBeGreaterThan(0);
  });

  it('filters by type, by cell and by age band, each narrowing the machines shown, and every filter together', () => {
    const { dots } = bubble()!;
    const types = [...new Set(dots.flatMap((d) => d.category ?? []))];
    const cells = [...new Set(dots.flatMap((d) => d.cell ?? []))];
    expect(types.length).toBeGreaterThan(0);
    expect(cells.length).toBeGreaterThan(1);
    expect(filterDots(dots, NO_FILTERS)).toHaveLength(117);
    const byType = types.map((category) => filterDots(dots, { ...NO_FILTERS, category }).length);
    expect(byType.reduce((a, b) => a + b, 0)).toBe(dots.filter((d) => d.category).length);
    expect(
      filterDots(dots, { ...NO_FILTERS, cell: cells[0]! }).every((d) => d.cell === cells[0]),
    ).toBe(true);
    const bands = ['0', '1', '2', '3', '4', 'u'] as const;
    expect(
      bands
        .map((age) => filterDots(dots, { ...NO_FILTERS, age }).length)
        .reduce((a, b) => a + b, 0),
    ).toBe(117);
    expect(
      filterDots(dots, { cell: cells[0]!, category: types[0]!, age: 'u' }).length,
    ).toBeLessThanOrEqual(filterDots(dots, { ...NO_FILTERS, cell: cells[0]! }).length);
  });

  it('puts an age in Bhavin’s bands, and an unknown age in its own', () => {
    expect([
      bandOf('3 yrs'),
      bandOf('5 yrs'),
      bandOf('14 yrs'),
      bandOf('19 yrs'),
      bandOf('25 yrs'),
    ]).toEqual(['0', '1', '2', '3', '4']);
    expect([bandOf('—'), bandOf(null)]).toEqual(['u', 'u']);
  });

  it('keeps the bubble of a machine the plant no longer lists, as a dash that opens nothing', () => {
    const { dots } = bubble(model({ machines: machines.slice(5) }))!;
    expect(dots).toHaveLength(117);
    const gone = dots.filter((d) => !d.opens);
    expect(gone.length).toBeGreaterThan(0);
    expect(gone.every((d) => d.title === '—' && d.cat === undefined)).toBe(true);
  });

  it('opens a machine by its code, never by the database id the server sends', () => {
    const id = (code: string) =>
      `00000000-0000-4000-8000-${String(machines.findIndex((m) => m.code === code)).padStart(12, '0')}`;
    const keyed = machines.map((m) => ({ ...m, id: id(m.code) }));
    const asServed: FiguresReply = {
      ...real,
      figures: real.figures.map((f) => {
        const v = f.value as { datasets?: { data: { id: string }[] }[] } | null;
        if (f.key !== 'dashboard.bubble-chart' || !v?.datasets) return f;
        return {
          ...f,
          value: {
            ...v,
            datasets: v.datasets.map((d) => ({
              ...d,
              data: d.data.map((p) => ({ ...p, id: id(p.id) })),
            })),
          },
        };
      }) as FiguresReply['figures'],
    };
    const { dots } = bubble(model({ reply: asServed, machines: keyed }))!;
    expect(dots).toHaveLength(117);
    expect(dots.every((d) => d.opens && !UUID.test(d.id) && !UUID.test(d.title))).toBe(true);
    expect(dots.every((d) => machines.some((m) => m.code === d.id))).toBe(true);
    expect(printed(dots).some((text) => UUID.test(text))).toBe(false);
  });

  it('keeps its place with a dash when no machine has a breakdown, and says so when the engine has not computed it', () => {
    const none = model({ reply: swap('dashboard.bubble-chart', { value: null }) }).charts;
    expect(none.find((c) => c.id === 'dashboard.bubble-chart')).toMatchObject({ note: '—' });
    const held = model({
      reply: swap('dashboard.bubble-chart', { status: 'not_computed', value: null }),
    }).charts;
    expect(held.find((c) => c.id === 'dashboard.bubble-chart')).toMatchObject({
      note: 'Not computed yet',
    });
  });
});

describe('the page', () => {
  const render = (m: DashboardModel) =>
    renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/analytics/today'] },
        createElement(DashboardView, {
          model: m,
          nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
          title: 'Dashboard',
        }),
      ),
    );

  it('draws the lead card large, the meaning colours as data, and the tiles as one target each', () => {
    const out = render(model({ board: board(2, 1) }));
    expect(out.match(/v2-grid v2-grid-hero/g)).toHaveLength(1);
    expect(out.match(/v2-kpi v2-kpi-hero/g)).toHaveLength(1);
    expect(out.match(/data-tone="gain"/g)).toHaveLength(1);
    expect(out.match(/data-tone="loss"/g)).toHaveLength(4);
    expect(out.match(/data-stretch="link"/g)).toHaveLength(5);
    expect(out.match(/data-stretch="drill"/g)).toHaveLength(11);
    expect(out.match(/Open register/g)).toHaveLength(5);
    expect(out).toContain('High priority');
    expect(out).toContain('View Problem Analysis');
  });

  it('puts the headline figures before what needs you, so they show without scrolling', () => {
    const out = render(model());
    const at = (label: string) => out.indexOf(`aria-label="${label}"`);
    expect(at('Team Focus')).toBeGreaterThan(0);
    expect(at('Team Focus')).toBeLessThan(at('Fleet availability'));
    expect(at('Fleet availability')).toBeLessThan(out.indexOf('>What needs you now<'));
  });
});
