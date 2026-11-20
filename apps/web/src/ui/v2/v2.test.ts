// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dashboard } from '../../screens/v2/dashboard/Dashboard.js';
import { dashboardFixture as model } from '../../screens/v2/dashboard/fixture.js';
import { ratio, readTokens } from '../tokens.test.js';
import { BulletBar } from './bullet-bar.js';
import { DecisionRow } from './decision-row.js';
import { Pareto } from './pareto.js';
import { Points } from './points.js';
import { WhyToggle } from './why-toggle.js';

const html = (el: ReactElement) => renderToStaticMarkup(el);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const words = { why: 'Why?', perMonth: 'a month', stripCaption: 'Breakdowns, last 90 days' };

describe('v2 rich text', () => {
  it('reads as one sentence and makes the key numbers bold in their meaning', () => {
    const out = html(
      createElement(Points, {
        points: [[{ text: 'Lost ' }, { text: '308 h', tone: 'loss' }, { text: ' this year' }]],
      }),
    );
    expect(text(out)).toBe('Lost 308 h this year');
    expect(out).toMatch(/<b class="v2-seg v2-seg-loss">308 h<\/b>/);
  });

  it('cannot carry markup of its own', () => {
    const out = html(createElement(Points, { points: [[{ text: '<img src=x>', tone: 'gain' }]] }));
    expect(out).not.toContain('<img');
  });
});

describe('v2 Why', () => {
  it('starts closed: a real button that says so, and no explanation yet', () => {
    const out = html(createElement(WhyToggle, { label: 'Why?', points: [[{ text: 'Hidden' }]] }));
    expect(out).toMatch(/<button type="button" class="v2-why" aria-expanded="false"/);
    expect(text(out)).toBe('Why?');
  });
});

describe('v2 decision row', () => {
  const d = model.decisions[0]!;
  it('shows what to decide, its worth, the strip read aloud, and the action', () => {
    const out = html(createElement(DecisionRow, { d, words, done: false, onAct: () => {} }));
    for (const part of [d.kindLabel, d.title, d.hours, d.money, d.action, d.owner])
      expect(text(out)).toContain(part);
    expect(out).toContain(`role="img" aria-label="${d.stripLabel}"`);
    expect(text(out)).not.toContain(d.doneText);
  });

  it('says what was done once the action is taken', () => {
    const out = html(createElement(DecisionRow, { d, words, done: true, onAct: () => {} }));
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
    expect(out).toMatch(/<button type="button" class="v2-rowbtn" aria-expanded="false"/);
  });

  it('keeps a value off the scale inside the bar', () => {
    const out = html(createElement(BulletBar, { b: { ...b, value: 120 } }));
    expect(out).toContain('class="v2-bullet-bar" style="width:100.0%"');
  });
});

describe('v2 pareto', () => {
  it('prints every bar as the engine wrote it, inside a chart that reads aloud', () => {
    const out = html(
      createElement(Pareto, { data: model.pareto, whyLabel: 'Why these 3?', actions: null }),
    );
    expect(out).toContain(`role="img" aria-label="${model.pareto.aria}"`);
    for (const bar of model.pareto.bars) expect(text(out)).toContain(`${bar.shown} ${bar.label}`);
    expect(out.match(/class="v2-bar-top"/g)).toHaveLength(model.pareto.top);
  });
});

describe('v2 Dashboard on the fixture', () => {
  const out = html(createElement(Dashboard, { model }));
  it('leads with the verdict, then every section under its own heading', () => {
    expect(out.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1]).toBeDefined();
    expect(text(out)).toContain('November is 9% worse than October.');
    const h2 = [...out.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(h2).toEqual([
      'Decide today',
      'The plant right now',
      'Against target',
      'Where the hours go',
    ]);
  });

  it('lists the decisions biggest first, all waiting, and every machine as a named button', () => {
    expect(text(out)).toContain('4 waiting · biggest first');
    expect(out.match(/<article/g)).toHaveLength(model.decisions.length);
    const machines = model.cells.reduce((n, c) => n + c.machines.length, 0);
    expect(out.match(/class="v2-tile" data-state/g)).toHaveLength(machines);
    expect(out).toContain('aria-label="TC-4, Cell 1: Broken down"');
    expect(text(out)).toContain('Tap any square to see why that machine is in its state.');
  });
});

describe('v2 tokens', () => {
  const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
  const hex = (t: Record<string, string>, k: string) => t[`color-v2-${k}`]!;
  const text = ['ink', 'ink-2', 'loss', 'gain', 'risk', 'plan', 'decide'];
  const pairs: [string, string][] = [
    ...text.map((k): [string, string] => [k, 'panel']),
    ...['ink', 'ink-2'].map((k): [string, string] => [k, 'page']),
    ...['loss', 'gain', 'risk', 'plan', 'decide'].map((k): [string, string] => [k, `${k}-tint`]),
    ['on-ink', 'ink'],
    ['ink', 'well'],
    ['ink-2', 'segment'],
    ['ink-2', 'track'],
  ];
  for (const [name, tokens] of Object.entries(readTokens(css))) {
    it(`reads every v2 text at 4.5:1 or better on its background in ${name}`, () => {
      const low = pairs
        .map(([fg, bg]) => [fg, bg, ratio(hex(tokens, fg), hex(tokens, bg))] as const)
        .filter(([, , r]) => r < 4.5)
        .map(([fg, bg, r]) => `${fg} on ${bg}: ${r.toFixed(2)}`);
      expect(low).toEqual([]);
    });
  }
});
