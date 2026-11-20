// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../i18n/index.js';
import { cellNote } from '../ui/v2/domain/plant.js';
import { nextTile } from '../ui/v2/domain/plant.js';
import { dashboardFixture as model } from '../screens/v2/dashboard/fixture.js';
import { DemoView } from './v2-dashboard-demo.js';

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const all = (markup: string, re: RegExp) => [...markup.matchAll(re)].map((m) => text(m[1]!));
const plain = (s: string) => s.replace(/\u00a0/g, ' ');
const num = (s: string) => parseFloat(s.replace(/[^\d.]/g, ''));
const machines = model.cells.flatMap((c) => c.machines);
const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];

/** The Dashboard at a URL: the drawer lives in the query, so the page needs a router around it. */
const render = (url = '/gallery') =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(DemoView, { model, nav, title: 'Dashboard' }),
    ),
  );

describe('the v2 Dashboard on its fixture', () => {
  const out = render();

  it('answers first: the verdict, then four key figures, then the decisions', () => {
    expect(text(out)).toContain('November is 9.2% worse than October.');
    expect(out.match(/class="v2-card v2-kpi"/g)).toHaveLength(4);
    expect(all(out, /<h2[^>]*>(.*?)<\/h2>/g)).toEqual([
      'Decide today',
      'Breakdown and PM hours',
      'Against target',
      'Where the hours go',
      'The plant right now',
      'Machines',
    ]);
  });

  it('lists the decisions in the model order, biggest first by hours, each opening from its title', () => {
    expect(
      all(out, /<h3[^>]*>(.*?)<\/h3>/g).filter((t) => model.decisions.some((d) => d.title === t)),
    ).toEqual(model.decisions.map((d) => d.title));
    const hours = model.decisions.map((d) => num(d.hours));
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
    expect(out).toMatch(/<button type="button" class="v2-title-btn" aria-expanded="false">/);
  });

  it('starts with the drawer closed, and shows ten machines of all of them', () => {
    expect(out).toMatch(/<aside[^>]*inert=""/);
    expect(text(out)).toContain(`1–10 of ${machines.length}`);
  });

  it('opens a decision in the drawer from a pasted link, with its Decide button and a link to its page', () => {
    const open = render('/gallery?view=v2-dashboard&drawer=decision:axis');
    expect(open).toMatch(/<aside[^>]*aria-label="Stop axis motor and encoder failures"/);
    expect(open).not.toMatch(/<aside[^>]*inert/);
    expect(open).toMatch(/aria-expanded="true"/);
    expect(open).toMatch(
      /<footer[^>]*><a[^>]*href="\/analytics\/today\/action-center\?drawer=decision:axis"[^>]*>Open full page/,
    );
  });

  it('ignores a drawer value it does not understand', () => {
    for (const bad of ['drawer=widget:1', 'drawer=machine', 'drawer=machine:', 'drawer=:TC-4'])
      expect(render(`/gallery?${bad}`)).toMatch(/<aside[^>]*inert=""/);
  });

  it('prints every machine, cell and person it names as a chip that opens it', () => {
    const chips = [...out.matchAll(/<button type="button" class="v2-entity[^"]*"[^>]*>/g)];
    expect(chips.length).toBeGreaterThan(30);
    expect(out).toMatch(/data-kind="machine" data-cat="1"><svg/);
    expect(out).toMatch(/data-kind="person"/);
    expect(out).toMatch(/data-kind="cell"/);
  });
});

describe('the fixture figures agree with each other', () => {
  const kpi = (id: string) => model.kpis.find((k) => k.id === id)!;

  it('shares the month’s breakdown hours out across every machine and across the Pareto bars', () => {
    const month = num(kpi('hours').value);
    const byMachine = machines.reduce((s, m) => s + m.hours.value, 0);
    expect(byMachine).toBeCloseTo(month, 5);
    expect(model.pareto.total).toBe(month);
  });

  it('wins back exactly what the decisions add up to, in hours and in money', () => {
    const why = plain(model.verdict.why.map((p) => p.map((s) => s.text).join('')).join(' '));
    const hours = model.decisions.reduce((s, d) => s + num(d.hours), 0);
    const lakh = model.decisions.reduce(
      (s, d) => s + (num(/([\d.]+)\slakh/.exec(d.money)?.[1] ?? '0') || 0),
      0,
    );
    expect(why).toContain(`${hours.toFixed(1)} h a month`);
    expect(why).toContain(`₹ ${lakh.toFixed(2)} lakh a year`);
    expect(why).toContain(`₹ ${(lakh / 12).toFixed(2)} lakh a month`);
  });

  it('keeps the rest of the Pareto smaller than the top three, as its Why says', () => {
    const top = model.pareto.bars.slice(0, model.pareto.top).reduce((s, b) => s + b.hours, 0);
    const rest = model.pareto.total - top;
    expect(rest).toBeLessThan(top);
    expect(plain(model.pareto.why.map((p) => p.map((s) => s.text).join('')).join(' '))).toContain(
      `${rest.toFixed(1)} h, less than these 3`,
    );
  });

  it('names only machines the plant has, and gives running machines no breakdown hours', () => {
    const codes = new Set(machines.map((m) => m.code));
    const named = model.decisions.find((d) => d.id === 'axis')!.codes;
    expect(named.filter((c) => !codes.has(c.id))).toEqual([]);
    expect(machines.filter((m) => m.state === 'run' && m.hours.value > 0)).toEqual([]);
  });

  it('ends the trend on this month and last month, as the KPI says', () => {
    const breakdown = model.trend.series[0]!.values;
    expect(breakdown.at(-1)).toBe(num(kpi('hours').value));
    expect((breakdown.at(-1)! - breakdown.at(-2)!).toFixed(1)).toBe(
      plain(kpi('hours').delta.text).replace(/[^\d.]/g, ''),
    );
  });
});

describe('the plant map', () => {
  const words = model.words.plant;
  const cell = (states: ('run' | 'down' | 'risk')[]) => ({
    name: 'Cell 1',
    machines: states.map((state, i) => ({ ...machines[0]!, code: `TC-${i + 1}`, state })),
  });
  it('says "all running" only when every machine runs, otherwise the rest, worst first', () => {
    expect(cellNote(cell(['run', 'run']), words)).toBe('all running');
    expect(plain(cellNote(cell(['run', 'risk', 'down', 'risk']), words))).toBe(
      '1 down · 2 at risk',
    );
  });
  it('moves with the arrow keys: along the map, between cells, and to either end', () => {
    const rows = [['A1', 'A2', 'A3'], [], ['B1', 'B2']];
    expect(nextTile(rows, 'A3', 'ArrowRight')).toBe('B1');
    expect(nextTile(rows, 'A3', 'ArrowDown')).toBe('B2');
    expect(nextTile(rows, 'B2', 'Home')).toBe('A1');
    expect(nextTile(rows, 'A1', 'Enter')).toBeUndefined();
  });
});
