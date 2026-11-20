// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { teamFocusFixture as model } from './fixture.js';
import { RAW } from './fixture-actions.js';
import { TeamFocusView } from './View.js';

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const all = (markup: string, re: RegExp) => [...markup.matchAll(re)].map((m) => text(m[1]!));
const num = (s: string) => parseFloat(s.replace(/[^\d.−-]/g, '').replace('−', '-'));
const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const kpi = (id: string) => model.kpis.find((k) => k.id === id)!;
const tenths = (h: { value: number }) => Math.round(h.value * 10);

const render = (url = '/gallery') =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(TeamFocusView, { model, nav, title: 'Team Focus' }),
    ),
  );

describe('the Team Focus fixture adds up', () => {
  const open = model.actions.filter((a) => a.status === 'todo' || a.status === 'doing');
  const unowned = open.filter((a) => a.owner === null);

  it('has the open actions of the people and of nobody add up to every open action', () => {
    expect(model.people.reduce((s, p) => s + p.open, 0) + unowned.length).toBe(open.length);
    expect(num(kpi('open').value)).toBe(open.length);
    expect(num(kpi('unowned').value)).toBe(unowned.length);
    expect(model.start).toHaveLength(unowned.length);
  });

  it('has the hours a month add up: the people and the unowned make the key figure', () => {
    const owned = model.people.reduce((s, p) => s + tenths(p.hours), 0);
    const waiting = unowned.reduce((s, a) => s + tenths(a.hours), 0);
    expect((owned + waiting) / 10).toBeCloseTo(num(kpi('stake').value), 5);
    expect(owned + waiting).toBe(open.reduce((s, a) => s + tenths(a.hours), 0));
  });

  it('has closed actions and the done share agree with the week-by-week line', () => {
    const closed = model.actions.length - open.length;
    expect(num(kpi('progress').value)).toBe(Math.round((closed / model.actions.length) * 100));
    expect(kpi('progress').trend!.at(-1)).toBe(Math.round((closed / model.actions.length) * 100));
    expect(kpi('open').trend!.at(-1)).toBe(open.length);
    expect(model.people.reduce((s, p) => s + p.done, 0)).toBe(closed);
  });

  it('names only machines of the Dashboard plant, and only people the drawer knows', () => {
    const plant = new Set(dashboardFixture.cells.flatMap((c) => c.machines.map((m) => m.code)));
    for (const r of RAW) for (const code of r.codes) expect(plant.has(code)).toBe(true);
    expect(model.people.map((p) => p.chip.id)).toEqual(['arjun-v', 'neel-s', 'meera-k']);
  });

  it('lists the actions nobody owns biggest first, each suggested to someone under the line', () => {
    const hours = model.start.map((d) => num(d.hours));
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
    for (const d of model.start) {
      expect(d.decided).toBe(false);
      expect(d.days).toHaveLength(Number(/^(\d+) /.exec(d.stripLabel)![1]));
    }
    expect(model.people.filter((p) => p.load === 'over').map((p) => p.chip.id)).toEqual([
      'arjun-v',
    ]);
  });

  it('proposes moving enough off the overloaded person to bring them under the line', () => {
    const over = model.people.find((p) => p.load === 'over')!;
    const moved = Number(/^Move (\d+)/.exec(model.rebalance!.action)![1]);
    expect(over.open - moved).toBeLessThan(8);
    expect(over.open - moved + 1).toBeGreaterThanOrEqual(8);
  });
});

describe('the Team Focus screen', () => {
  const out = render();

  it('answers first: the verdict, then four key figures, then who needs an owner', () => {
    expect(text(out)).toContain('19 open actions put');
    expect(text(out)).toContain('4 have no owner');
    expect(out.match(/class="v2-card v2-kpi"/g)).toHaveLength(4);
    expect(all(out, /<h2[^>]*>(.*?)<\/h2>/g).slice(0, 3)).toEqual([
      'Needs an owner',
      'Who is carrying what',
      'Take 2 actions off Arjun V',
    ]);
  });

  it('shows ten of the actions with a count, and prints every person and machine as a chip', () => {
    expect(text(out)).toContain(`1–10 of ${model.actions.length}`);
    expect(out.match(/<button type="button" class="v2-entity[^"]*"/g)!.length).toBeGreaterThan(30);
    expect(text(out)).toContain('Figures as of 20-Nov-2026');
  });

  it('opens a person from a pasted link, and an action to be assigned with its button', () => {
    const person = render('/gallery?view=v2-team-focus&drawer=person:arjun-v');
    expect(person).not.toMatch(/<aside[^>]*inert/);
    const action = render('/gallery?view=v2-team-focus&drawer=decision:a02');
    expect(action).toMatch(/<aside[^>]*aria-label="Overhaul or replace the turning centre"/);
    expect(action).toContain('Assign to Meera K');
  });

  it('says so, in words, when every open action has an owner', () => {
    const owned = { ...model, start: [] };
    const page = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/gallery'] },
        createElement(TeamFocusView, { model: owned, nav, title: 'Team Focus' }),
      ),
    );
    expect(text(page)).toContain('Every open action has an owner.');
  });
});
