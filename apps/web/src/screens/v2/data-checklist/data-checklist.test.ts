// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { entityFixture } from '../entity/fixture.js';
import { dataChecklistFixture as model } from './fixture.js';
import { DataChecklistView } from './View.js';

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const all = (markup: string, re: RegExp) => [...markup.matchAll(re)].map((m) => text(m[1]!));
const plain = (s: string) => s.replace(/\u00a0/g, ' ');
const num = (s: string) => parseFloat(plain(s).replace(/[^\d.]/g, ''));
const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const kpi = (id: string) => model.kpis.find((k) => k.id === id)!;
const checks = model.groups.flatMap((g) => g.checks);
const machines = dashboardFixture.cells.flatMap((c) => c.machines);

const render = (view = model) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/gallery'] },
      createElement(DataChecklistView, { model: view, nav, title: 'Data Checklist' }),
    ),
  );

describe('the v2 Data Checklist on its fixture', () => {
  const out = render();

  it('answers first: whether the figures can be trusted, then four key figures, then what to fix', () => {
    expect(text(out)).toContain('7 of 12 data checks pass. 3 gaps change figures you see today.');
    expect(out.match(/class="v2-card v2-kpi"/g)).toHaveLength(4);
    expect(all(out, /<h2[^>]*>(.*?)<\/h2>/g)).toEqual([
      'Breakdown log',
      'Machine records',
      'PM',
      'Records to fix',
      'Already trusted',
    ]);
  });

  it('puts the gaps first, each with its action and its owner', () => {
    expect(checks.map((c) => c.status)).toEqual(['gap', 'gap', 'gap', 'check', 'check']);
    expect(out.match(/class="v2-btn v2-btn-primary"/g)).toHaveLength(checks.length);
    for (const c of checks) expect(out).toContain(c.fix);
  });

  it('shows ten records of all of them, and no drawer until one is chosen', () => {
    expect(text(out)).toContain(`1–10 of ${model.records.length}`);
    expect(out).toMatch(/<aside[^>]*inert=""/);
  });

  it('says so when every check passes', () => {
    const clear = render({ ...model, groups: [], records: [] });
    expect(text(clear)).toContain('Every check passes. The figures can be trusted.');
    expect(text(clear)).toContain('No record matches this search and filter.');
  });
});

describe('the fixture figures agree with each other', () => {
  const gaps = checks.filter((c) => c.status === 'gap');

  it('counts the checks that pass against all of them', () => {
    const passing = model.passing.length;
    expect(passing + checks.length).toBe(12);
    expect(kpi('passing').value).toBe(`${Math.round((passing / 12) * 100)}%`);
    expect(kpi('passing').meaning).toBe(`${passing} of 12 data checks pass`);
  });

  it('counts the gaps and names the figure each one changes', () => {
    expect(kpi('gaps').value).toBe(String(gaps.length));
    for (const g of gaps) expect(kpi('gaps').more).toContain(g.impact.replace('Changes ', ''));
  });

  it('has a record row for every record a check counts, in its part of the data', () => {
    expect(kpi('records').value).toBe(String(model.records.length));
    expect(checks.reduce((s, c) => s + num(c.records), 0)).toBe(model.records.length);
    for (const g of model.groups)
      expect(g.checks.reduce((s, c) => s + num(c.records), 0)).toBe(
        model.records.filter((r) => r.area.key === g.id).length,
      );
  });

  it('summarises each group as its gaps and checks, the one with the most gaps first', () => {
    for (const g of model.groups) {
      const gap = g.checks.filter((c) => c.status === 'gap').length;
      expect(g.summary).toBe(
        [
          gap && `${gap} gap${gap > 1 ? 's' : ''}`,
          g.checks.length - gap &&
            `${g.checks.length - gap} check${g.checks.length - gap > 1 ? 's' : ''}`,
        ]
          .filter(Boolean)
          .join(' · '),
      );
    }
    expect(model.groups.map((g) => g.id)).toEqual(['log', 'machines', 'pm']);
  });

  it('reports the oldest gap as the longest a gap record has been open', () => {
    const gapIds = new Set(gaps.map((c) => c.id));
    const oldest = Math.max(
      ...model.records.filter((r) => gapIds.has(r.id.split('-')[0]!)).map((r) => r.open.value),
    );
    expect(kpi('oldest').value).toBe(`${oldest} days`);
    expect(kpi('oldest').more).toBe('Open since 14-Oct-2026');
  });

  it('keeps the records oldest first, each with an owner and a date', () => {
    const open = model.records.map((r) => r.open.value);
    expect(open).toEqual([...open].sort((a, b) => b - a));
    expect(model.records.every((r) => /since \d{2}-[A-Z][a-z]{2}-2026$/.test(r.open.shown))).toBe(
      true,
    );
  });

  it('names only things the gallery can open: every chip resolves in a drawer', () => {
    const codes = new Set(machines.map((m) => m.code));
    const found: { kind: string; id: string }[] = [];
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>;
        if (
          ['machine', 'cell', 'person', 'decision'].includes(o.kind as string) &&
          typeof o.label === 'string'
        )
          found.push({ kind: o.kind as string, id: o.id as string });
        Object.values(o).forEach(walk);
      }
    };
    walk(model);
    expect(found.length).toBeGreaterThan(40);
    for (const c of found) {
      if (c.kind === 'machine') expect(codes.has(c.id), c.id).toBe(true);
      else expect(entityFixture({ kind: c.kind as 'person', id: c.id }), c.id).not.toBeNull();
    }
  });
});
