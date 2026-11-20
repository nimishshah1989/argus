// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { entityFixture } from '../entity/fixture.js';
import { actionCenterFixture as model } from './fixture.js';
import { ActionCenterView } from './View.js';

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const all = (markup: string, re: RegExp) => [...markup.matchAll(re)].map((m) => text(m[1]!));
const plain = (s: string) => s.replace(/\u00a0/g, ' ');
const num = (s: string) => parseFloat(plain(s).replace(/[^\d.]/g, ''));
const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const sentence = (p: { text: string }[]) => plain(p.map((s) => s.text).join(''));
const kpi = (id: string) => model.kpis.find((k) => k.id === id)!;
const machines = dashboardFixture.cells.flatMap((c) => c.machines);

/** The Action Center at a URL: the drawer lives in the query, so the page needs a router around it. */
const render = (url = '/gallery') =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(ActionCenterView, { model, nav, title: 'Action Center' }),
    ),
  );

/** Every machine, cell, person and decision the model names as a chip, wherever it sits. */
function chipsIn(node: unknown, found: { kind: string; id: string }[] = []) {
  if (Array.isArray(node)) node.forEach((n) => chipsIn(n, found));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (
      ['machine', 'cell', 'person', 'decision'].includes(o.kind as string) &&
      typeof o.id === 'string' &&
      typeof o.label === 'string'
    )
      found.push({ kind: o.kind as string, id: o.id });
    Object.values(o).forEach((v) => chipsIn(v, found));
  }
  return found;
}

describe('the v2 Action Center on its fixture', () => {
  const out = render();

  it('answers first: the verdict, then four key figures, then the decisions to take', () => {
    expect(sentence(model.verdict.headline)).toBe(
      '7 decisions are waiting, worth 104.9 h a month. 2 have no owner yet.',
    );
    expect(text(out)).toContain('7 decisions are waiting');
    expect(out.match(/class="v2-card v2-kpi"/g)).toHaveLength(4);
    expect(all(out, /<h2[^>]*>(.*?)<\/h2>/g)).toEqual([
      'Decide today',
      'Who owns what',
      'Not waiting',
      'Machines that keep coming up',
    ]);
  });

  it('lists the decisions biggest first by hours, each opening from its title', () => {
    expect(
      all(out, /<h3[^>]*>(.*?)<\/h3>/g).filter((t) => model.decisions.some((d) => d.title === t)),
    ).toEqual(model.decisions.map((d) => d.title));
    const hours = model.decisions.map((d) => num(d.hours));
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
  });

  it('starts with the drawer closed, and shows ten machines of all of them', () => {
    expect(out).toMatch(/<aside[^>]*inert=""/);
    expect(text(out)).toContain(`1–10 of ${model.watch.length}`);
  });

  it('opens any decision from a pasted link, waiting or parked, with its Decide button only while waiting', () => {
    const drawer = (id: string) =>
      /<aside[\s\S]*<\/aside>/.exec(
        render(`/gallery?view=v2-action-center&drawer=decision:${id}`),
      )![0];
    const waiting = drawer('bearing');
    expect(waiting).toMatch(/^<aside[^>]*aria-label="Keep a spare spindle bearing/);
    expect(waiting).toContain('aria-pressed="false"');
    expect(waiting).toContain('Approve a spare');
    expect(waiting).toMatch(
      /href="\/analytics\/today\/action-center\?drawer=decision:bearing"[^>]*>Open full page/,
    );
    const parked = drawer('oil');
    expect(parked).toMatch(/^<aside[^>]*aria-label="Check the hydraulic oil/);
    expect(parked).not.toContain('aria-pressed');
  });

  it('prints every machine, person and decision it names as a chip', () => {
    expect(out).toMatch(/data-kind="person"/);
    expect(out).toMatch(/data-kind="decision"/);
    expect(out).toMatch(/data-kind="machine" data-cat="1"/);
  });
});

describe('the fixture figures agree with each other', () => {
  it('adds the decisions up: the worth, the money, the count', () => {
    const hours = model.decisions.reduce((s, d) => s + num(d.hours), 0);
    expect(num(kpi('worth').value)).toBeCloseTo(hours, 5);
    const lakh = model.decisions.reduce(
      (s, d) => s + (num(/([\d.]+)\slakh/.exec(d.money)?.[1] ?? '0') || 0),
      0,
    );
    expect(plain(kpi('worth').more)).toContain(`₹ ${lakh.toFixed(2)} lakh a year`);
    expect(kpi('waiting').value).toBe(String(model.decisions.length));
  });

  it('gives every owner their share: the owners add up to every decision and every hour', () => {
    const lines = model.owners.map(sentence);
    const counts = lines.map((l) => num(/(\d+) decision/.exec(l)![1]!));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(model.decisions.length);
    const hours = lines.map((l) => num(/([\d.]+) h a month/.exec(l)![1]!));
    expect(hours.reduce((a, b) => a + b, 0)).toBeCloseTo(num(kpi('worth').value), 5);
    expect(hours).toEqual([...hours.slice(0, -1)].sort((a, b) => b - a).concat(hours.at(-1)!));
  });

  it('counts the decisions nobody owns, and keeps them last', () => {
    const unowned = model.decisions.filter((d) => sentence(d.owner).includes('not assigned'));
    expect(kpi('unowned').value).toBe(String(unowned.length));
    expect(sentence(model.owners.at(-1)!)).toContain(`${unowned.length} decisions have no owner`);
    const hours = unowned.reduce((s, d) => s + num(d.hours), 0);
    expect(plain(kpi('unowned').more)).toContain(`${hours.toFixed(1)} h a month`);
  });

  it('counts what is settled and parked, newest first', () => {
    const settled = model.settled.filter((s) => s.status === 'settled').length;
    expect(kpi('settled').value).toBe(String(settled));
    expect(kpi('settled').more).toContain(`${model.settled.length - settled} decisions are parked`);
    expect(model.settled.filter((s) => s.decision.decided).length).toBe(settled);
  });

  it('scores each machine from its open nudges (high 3, medium 2, low 1) and ranks the worst first', () => {
    for (const r of model.watch) expect(r.score.value).toBe(r.high * 3 + r.medium * 2 + r.low);
    const scores = model.watch.map((r) => r.score.value);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(model.watch.every((r) => r.machine.state === 'down' || r.machine.state === 'risk')).toBe(
      true,
    );
  });

  it('states each change against last week with its sign, and the bad ones are not green', () => {
    expect(kpi('waiting').delta).toEqual({ text: '+2', up: true, good: false });
    expect(kpi('settled').delta).toEqual({ text: '+1', up: true, good: true });
    expect(plain(kpi('worth').delta.text)).toBe(
      `+${(num(kpi('worth').value) - 92.3).toFixed(1)} h`,
    );
  });

  it('names only things the gallery can open: every chip resolves in a drawer', () => {
    const codes = new Set(machines.map((m) => m.code));
    const decisions = new Set(
      [...model.decisions, ...model.settled.map((s) => s.decision)].map((d) => d.id),
    );
    for (const c of chipsIn(model)) {
      if (c.kind === 'machine') expect(codes.has(c.id), c.id).toBe(true);
      else if (c.kind === 'decision') expect(decisions.has(c.id), c.id).toBe(true);
      else expect(entityFixture({ kind: c.kind as 'person', id: c.id }), c.id).not.toBeNull();
    }
  });
});
