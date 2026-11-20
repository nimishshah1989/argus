// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dashboard } from '../../screens/v2/dashboard/Dashboard.js';
import { dashboardFixture as model } from '../../screens/v2/dashboard/fixture.js';
import { colour, ratio, readTokens } from '../contrast.js';
import { BulletBar, place } from './bullet-bar.js';
import { DecisionRow } from './domain/decision-row.js';
import { nextTile } from './domain/plant-keys.js';
import { PlantMap } from './domain/plant-map.js';
import { Pareto, paretoMismatch } from './pareto.js';
import { Points } from './points.js';
import { WhyToggle } from './why-toggle.js';

const html = (el: ReactElement) => renderToStaticMarkup(el);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const all = (markup: string, re: RegExp) => [...markup.matchAll(re)].map((m) => text(m[1]!));
/** No-break spaces glue a number to its unit; compare as plain spaces. */
const plain = (s: string) => s.replace(/\u00a0/g, ' ');
const num = (s: string) => parseFloat(s.replace(/[^\d.]/g, ''));
const words = { why: 'Why?', perMonth: 'a month', stripCaption: 'Breakdowns, last 90 days' };
const noop = () => {};

describe('v2 rich text and Why', () => {
  it('reads as one sentence with the key number in bold', () => {
    const out = html(
      createElement(Points, {
        points: [[{ text: 'Lost ' }, { text: '308 h', tone: 'loss' }, { text: ' this year' }]],
      }),
    );
    expect(text(out)).toBe('Lost 308 h this year');
    expect(all(out, /<b[^>]*>(.*?)<\/b>/g)).toEqual(['308 h']);
  });

  it('cannot carry markup of its own', () => {
    const out = html(createElement(Points, { points: [[{ text: '<img src=x>', tone: 'gain' }]] }));
    expect(out).not.toContain('<img');
  });

  it('starts closed, and the region it controls is in the page but hidden', () => {
    const out = html(createElement(WhyToggle, { label: 'Why?', points: [[{ text: 'Hidden' }]] }));
    const controls = /aria-expanded="false" aria-controls="([^"]+)"/.exec(out)?.[1];
    expect(controls).toBeTruthy();
    expect(out).toMatch(new RegExp(`<div id="${controls}" hidden=""[^>]*>.*Hidden`));
  });
});

describe('v2 decision row', () => {
  const d = model.decisions[0]!;
  const row = (decided: boolean) =>
    html(createElement(DecisionRow, { d: { ...d, decided }, words, onDecide: noop, onUndo: noop }));

  it('shows what to decide, its worth, the strip read aloud, and the action not yet taken', () => {
    const out = row(false);
    for (const part of [d.kindLabel, d.title, d.hours, d.money, d.owner])
      expect(text(out)).toContain(plain(part));
    expect(out).toContain(`role="img" aria-label="${d.stripLabel}"`);
    expect(out).toMatch(new RegExp(`aria-pressed="false"[^>]*>${d.action}</button>`));
  });

  it('says what was done, pressed, once the model says it is decided', () => {
    const out = row(true);
    expect(out).toMatch(/aria-pressed="true"/);
    expect(text(out)).toContain(d.doneText);
    expect(text(out)).not.toContain(d.action);
  });
});

describe('v2 bullet bar', () => {
  const b = model.bullets[0]!;
  it('prints the figure as given, names the bar aloud, and opens from the whole row', () => {
    const out = html(createElement(BulletBar, { b }));
    expect(text(out)).toContain(`${b.label} ${b.shown}${b.unit} ${b.verdict}`);
    expect(out).toContain(`role="img" aria-label="${b.aria}"`);
    expect(out).toMatch(/<button type="button"[^>]*aria-expanded="false"/);
  });

  it('places marks on the scale, inside the bar, and never divides by an empty scale', () => {
    expect(place([0, 6])(3)).toBe('50.0%');
    expect(place([0, 6])(9)).toBe('100.0%');
    expect(place([0, 6])(-1)).toBe('0.0%');
    expect(place([5, 5])(5)).toBe('0.0%');
  });

  it('marks a value past either end of the scale', () => {
    expect(html(createElement(BulletBar, { b: { ...b, value: 120 } }))).toContain(
      'data-clamp="over"',
    );
    expect(html(createElement(BulletBar, { b: { ...b, value: 90 } }))).toContain(
      'data-clamp="under"',
    );
    expect(html(createElement(BulletBar, { b }))).not.toContain('data-clamp');
  });

  it('puts the good zone below the limit when lower is better, above the target when higher is', () => {
    const low = model.bullets.find((x) => !x.higherIsBetter)!;
    const at = place(low.scale)(low.target);
    expect(html(createElement(BulletBar, { b: low }))).toContain(`style="left:0;width:${at}"`);
    expect(html(createElement(BulletBar, { b }))).toContain(
      `style="left:${place(b.scale)(b.target)};right:0"`,
    );
  });
});

describe('v2 pareto', () => {
  const out = html(
    createElement(Pareto, { data: model.pareto, whyLabel: 'Why these 3?', actions: null }),
  );

  it('prints every bar as the engine wrote it, inside a chart that reads aloud', () => {
    expect(out).toContain(`role="img" aria-label="${model.pareto.aria}"`);
    for (const bar of model.pareto.bars) expect(text(out)).toContain(`${bar.shown} ${bar.label}`);
  });

  it('ends the running total at 100 %, on the 100 % tick', () => {
    const points = /<polyline points="([^"]+)"/.exec(out)![1]!.split(' ');
    const lastY = Number(points[points.length - 1]!.split(',')[1]);
    const tickY = Number(/<text x="\d+" y="([\d.]+)"[^>]*data-tick="100"/.exec(out)![1]) - 4;
    expect(lastY).toBeCloseTo(tickY, 5);
    expect(all(out, /<text[^>]*data-end="true"[^>]*>(.*?)<\/text>/g)).toEqual(['100%']);
  });

  it('says when the bars do not add up to the total', () => {
    expect(paretoMismatch(model.pareto)).toBeNull();
    expect(paretoMismatch({ ...model.pareto, total: 400 })).toMatch(/add up to 312.4/);
  });
});

describe('v2 plant map', () => {
  const cell = (states: ('run' | 'down' | 'risk')[]) => ({
    name: 'Cell 1',
    machines: states.map((state, i) => ({ code: `TC-${i + 1}`, state, why: [] })),
  });
  const note = (states: ('run' | 'down' | 'risk')[]) =>
    text(html(createElement(PlantMap, { cells: [cell(states)], words: model.words.plant })));

  it('says "all running" only when every machine runs, and otherwise counts the rest, worst first', () => {
    expect(note(['run', 'run'])).toContain('all running');
    expect(note(['run', 'risk', 'down', 'risk'])).toContain('1 down · 2 at risk');
    expect(note(['run', 'risk'])).not.toContain('all running');
  });

  it('is one tab stop: only the first machine can take focus from the keyboard', () => {
    const out = html(createElement(PlantMap, { cells: model.cells, words: model.words.plant }));
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out).toMatch(/<button[^>]*tabindex="0"[^>]*aria-label="TC-1, Cell 1: Running"/);
  });

  it('moves with the arrow keys: along the map, between cells, and to either end', () => {
    const rows = [['A1', 'A2', 'A3'], [], ['B1', 'B2']];
    expect(nextTile(rows, 'A3', 'ArrowRight')).toBe('B1');
    expect(nextTile(rows, 'B1', 'ArrowLeft')).toBe('A3');
    expect(nextTile(rows, 'A3', 'ArrowDown')).toBe('B2');
    expect(nextTile(rows, 'B2', 'ArrowUp')).toBe('A2');
    expect(nextTile(rows, 'B2', 'Home')).toBe('A1');
    expect(nextTile(rows, 'A1', 'End')).toBe('B2');
    expect(nextTile(rows, 'B2', 'ArrowRight')).toBe('B2');
    expect(nextTile(rows, 'A1', 'Enter')).toBeUndefined();
  });
});

describe('v2 Dashboard on the fixture', () => {
  const out = html(createElement(Dashboard, { model }));

  it('leads with the verdict, then every section under its own heading', () => {
    expect(all(out, /<h1[^>]*>(.*?)<\/h1>/g)[0]).toContain('November is 9% worse than October.');
    expect(all(out, /<h2[^>]*>(.*?)<\/h2>/g)).toEqual([
      'Decide today',
      'The plant right now',
      'Against target',
      'Where the hours go',
    ]);
  });

  it('shows the decisions in the model order, which is biggest first by hours at stake', () => {
    expect(all(out, /<h3[^>]*>(.*?)<\/h3>/g)).toEqual(model.decisions.map((d) => d.title));
    const hours = model.decisions.map((d) => num(d.hours));
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
  });

  it('announces how many are decided, and names every machine as a button', () => {
    expect(out).toMatch(/aria-live="polite" aria-atomic="true">4 waiting · biggest first</);
    const machines = model.cells.reduce((n, c) => n + c.machines.length, 0);
    expect(out.match(/aria-label="[A-Z]+-\d+, Cell \d: [^"]+"/g)).toHaveLength(machines);
  });
});

describe('v2 fixture figures agree with each other', () => {
  const winBack = model.verdict.figures[1]!;

  it('wins back exactly what the decisions add up to, in hours and in money', () => {
    const hours = model.decisions.reduce((s, d) => s + num(d.hours), 0);
    const lakh = model.decisions.reduce(
      (s, d) => s + (num(/([\d.]+)\slakh/.exec(d.money)?.[1] ?? '0') || 0),
      0,
    );
    expect(plain(winBack.note)).toContain(`${hours.toFixed(1)} h a month`);
    expect(num(winBack.value)).toBeCloseTo(lakh, 2);
  });

  it('shares out the month’s breakdown hours across the Pareto bars, and the rest is smaller than the top', () => {
    expect(model.verdict.figures[0]!.note).toContain(String(model.pareto.total));
    const top = model.pareto.bars.slice(0, model.pareto.top).reduce((s, b) => s + b.hours, 0);
    const rest = model.pareto.total - top;
    expect(rest).toBeLessThan(top);
    const why = model.pareto.why.map((p) => plain(p.map((s) => s.text).join('')));
    expect(
      why.some(
        (line) => line.includes(`${rest.toFixed(1)} h`) && line.includes('less than these 3'),
      ),
    ).toBe(true);
  });
});

describe('v2 tokens', () => {
  const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
  const v2 = (k: string) => `color-v2-${k}`;
  const pairs = (fgs: string[], bgs: string[]) =>
    fgs.flatMap((f) => bgs.map((b) => [f, b] as const));
  const TEXT = [
    ...pairs(['ink', 'ink-2', 'loss', 'gain', 'risk', 'plan', 'decide'], ['panel']),
    ...pairs(['ink', 'ink-2'], ['page', 'well', 'segment', 'track']),
    ...['loss', 'gain', 'risk', 'plan', 'decide'].map((k) => [k, `${k}-tint`] as const),
    ['on-ink', 'ink'] as const,
  ];
  const FILLS = [
    ...pairs(
      ['gain-fill', 'risk-fill', 'loss-fill', 'plan-fill', 'idle-fill', 'quiet', 'loss'],
      ['panel'],
    ),
    ...pairs(['on-fill'], ['loss-fill', 'plan-fill', 'idle-fill']),
    ['on-risk', 'risk-fill'] as const,
  ];
  const under = (
    tokens: Record<string, string>,
    list: (readonly [string, string])[],
    min: number,
  ) =>
    list
      .map(([fg, bg]) => [fg, bg, ratio(colour(tokens, v2(fg)), colour(tokens, v2(bg)))] as const)
      .filter(([, , r]) => r < min)
      .map(([fg, bg, r]) => `${fg} on ${bg}: ${r.toFixed(2)}`);

  for (const [name, tokens] of Object.entries(readTokens(css))) {
    it(`reads every v2 text at 4.5:1 or better on its background in ${name}`, () => {
      expect(under(tokens, TEXT, 4.5)).toEqual([]);
    });
    it(`shows every v2 tile, bar and glyph at 3:1 or better in ${name}`, () => {
      expect(under(tokens, FILLS, 3)).toEqual([]);
    });
  }
});
