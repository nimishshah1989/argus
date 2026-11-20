// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { compareFixture, DEFAULT_PAIR } from './fixture.js';
import { RATE, yearOf } from './fixture-rows.js';
import { CompareView } from './View.js';

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const num = (s: string) => parseFloat(s.replace(/[^\d.-]/g, ''));
const nav = [
  { id: 'machines', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
];
const model = compareFixture(DEFAULT_PAIR)!;

const render = (url = '/gallery') =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(CompareView, { model, nav, title: 'Compare machines' }),
    ),
  );
const figure = (side: 0 | 1, id: string) => model.boxes[side].figures.find((f) => f.id === id)!;

describe('the Compare fixture adds up', () => {
  it('prints each machine’s hours and breakdowns as its breakdowns added up', () => {
    const [a, b] =
      DEFAULT_PAIR.a === model.boxes[0].chip.id ? ([0, 1] as const) : ([1, 0] as const);
    for (const [side, code] of [
      [a, DEFAULT_PAIR.a],
      [b, DEFAULT_PAIR.b],
    ] as const) {
      const rows = yearOf(code)!.breakdowns;
      expect(num(figure(side, 'hours').value)).toBeCloseTo(
        rows.reduce((s, r) => s + r.tenths, 0) / 10,
        5,
      );
      expect(num(figure(side, 'count').value)).toBe(rows.length);
    }
  });

  it('prints the money lost as the hours at the plant’s rate', () => {
    for (const side of [0, 1] as const) {
      const lakh = (num(figure(side, 'hours').value) * RATE) / 100000;
      expect(num(figure(side, 'money').value)).toBeCloseTo(lakh, 1);
    }
  });

  it('prints the key figures as the gap between the two sides', () => {
    const [h0, h1] = [0, 1].map((s) => num(figure(s as 0 | 1, 'hours').value));
    expect(num(model.kpis[0]!.value)).toBeCloseTo(Math.abs(h0! - h1!), 1);
    const [n0, n1] = [0, 1].map((s) => num(figure(s as 0 | 1, 'count').value));
    expect(num(model.kpis[1]!.value)).toBe(Math.abs(n0! - n1!));
    expect(model.verdict.headline.map((s) => s.text).join('')).toContain(
      `${(Math.max(h0!, h1!) / Math.min(h0!, h1!)).toFixed(1)}× more hours`,
    );
  });

  it('lines the two boxes up: the same figures in the same order, the biggest gap first, never both ahead', () => {
    const [a, b] = model.boxes;
    expect(a.figures.map((f) => f.id)).toEqual(b.figures.map((f) => f.id));
    expect(a.figures[0]!.id).toBe('hours');
    for (const [i, f] of a.figures.entries()) {
      const other = b.figures[i]!.mark;
      expect([f.mark, other].sort()).toEqual(
        f.mark === 'same' ? ['same', 'same'] : ['better', 'worse'],
      );
    }
  });

  it('names the problem that costs most as the first difference, with its hours from the breakdowns', () => {
    const hoursOf = (code: string, cause: string) =>
      yearOf(code)!
        .breakdowns.filter((r) => r.cause === cause)
        .reduce((s, r) => s + r.tenths, 0) / 10;
    const first = model.differences.points[0]!.map((seg) => seg.text)
      .join('')
      .replace(/\u00a0/g, ' ');
    expect(first).toContain('Axis drive');
    expect(first).toContain(`${hoursOf('VC-67', 'Axis drive').toFixed(1)} h`);
    expect(first).toContain(`${hoursOf('VC-18', 'Axis drive').toFixed(1)} h`);
  });

  it('draws the weeks from the breakdowns: no week above the machine’s hours, and none lost', () => {
    for (const series of model.trend.series) {
      const rows = yearOf(series.name)!.breakdowns;
      const total = rows.reduce((s, r) => s + r.tenths, 0) / 10;
      const shown = series.values.reduce((s: number, v) => s + (v ?? 0), 0);
      expect(shown).toBeLessThanOrEqual(total + 0.05);
      expect(shown).toBeCloseTo(
        rows.filter((r) => r.week >= 34).reduce((s, r) => s + r.tenths, 0) / 10,
        5,
      );
    }
  });

  it('asks for any pair of the five, in either order, and nothing for a pair it cannot make', () => {
    expect(compareFixture({ a: 'VC-18', b: 'VC-67' })!.verdict.headline[0]!.entity!.id).toBe(
      'VC-67',
    );
    expect(compareFixture({ a: 'VC-18', b: 'VC-18' })).toBeNull();
    expect(compareFixture({ a: 'VC-18', b: 'TC-4' })).toBeNull();
  });
});

describe('the Compare screen', () => {
  const out = render();

  it('answers first: the verdict, the pickers, three gap figures, then two aligned boxes', () => {
    expect(text(out)).toContain('loses 2.7× more hours than');
    expect(out.match(/class="v2-card v2-kpi"/g)).toHaveLength(3);
    expect(out.match(/class="v2-card v2-pad v2-compare"/g)).toHaveLength(2);
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(2);
  });

  it('says who is ahead in words, not colour alone', () => {
    expect(text(out)).toContain('Better');
    expect(text(out)).toMatch(/\d\.\d× more/);
  });

  it('prints machines and cells as chips, and opens one from a pasted link', () => {
    expect(out.match(/<button type="button" class="v2-entity[^"]*"/g)!.length).toBeGreaterThan(8);
    const open = render('/gallery?view=v2-compare&drawer=machine:VC-18');
    expect(open).not.toMatch(/<aside[^>]*inert/);
  });
});
