// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ratio, readTokens, resolve } from '../contrast.js';
import { withValue } from './motion.js';
import { Row } from './row.js';
import { ScreenStates } from './screen-states.js';

const html = (el: ReactElement) => renderToStaticMarkup(el);
// Every sheet in this folder, v2.css first: a new kit sheet joins the checks with no list to edit.
const SHEETS = readdirSync(new URL('.', import.meta.url))
  .filter((name) => name.endsWith('.css'))
  .sort((a, b) => Number(b === 'v2.css') - Number(a === 'v2.css') || a.localeCompare(b));
const css = (name: string) =>
  readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const kit = SHEETS.map(css).join('\n');
const tokensCss = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
const values = (prop: string) =>
  [...kit.matchAll(new RegExp(`(?:^|[\\s;{])${prop}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim());

describe('v2 type (UX-RULES.md §10)', () => {
  it('has five sizes and only five: 12, 13, 14, 20 and 24 px', () => {
    const sizes = [...tokensCss.matchAll(/--text-v2-([\w-]+):\s*(\d+px);/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    );
    expect(sizes).toEqual(['label 12px', 'secondary 13px', 'body 14px', 'title 20px', 'kpi 24px']);
    for (const size of values('font-size'))
      expect(size).toMatch(/^var\(--text-v2-(label|secondary|body|title|kpi)\)/);
  });

  it('uses three families: Inter for text, Geist for numbers, Geist Mono for codes', () => {
    expect(tokensCss).toMatch(/--font-v2-text:\s*'Inter'/);
    expect(tokensCss).toMatch(/--font-v2-num:\s*'Geist'/);
    expect(tokensCss).toMatch(/--font-v2-mono:\s*'Geist Mono'/);
    for (const family of values('font-family'))
      expect(family).toMatch(/^var\(--font-v2-(text|num|mono)\)/);
  });

  it('lets weight do the hierarchy with 400, 500 and 600 only', () => {
    expect([...new Set(values('font-weight'))].sort()).toEqual(['400', '500', '600']);
  });
});

describe('v2 surfaces and motion (UX-RULES.md §1, §8)', () => {
  it('draws every shadow from the three-step scale (a keyframe of state motion aside)', () => {
    const outside = kit.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
    for (const m of outside.matchAll(/(?:^|[\s;{])box-shadow:\s*([^;]+);/g))
      expect(m[1]!.trim()).toMatch(
        /^(none|var\(--shadow-v2-(rest|raised|overlay)\)( !important)?)$/,
      );
  });

  it('times UI motion at 160–240 ms and data motion at 500–800 ms, on one ease-out curve', () => {
    const ms = (name: string) =>
      Number(new RegExp(`--motion-v2-${name}:\\s*(\\d+)ms`).exec(tokensCss)?.[1]);
    expect([ms('fast'), ms('ui')].every((v) => v >= 160 && v <= 240)).toBe(true);
    expect(ms('data')).toBeGreaterThanOrEqual(500);
    expect(ms('data')).toBeLessThanOrEqual(800);
    expect(tokensCss).toMatch(/--ease-v2: cubic-bezier\(0\.22, 1, 0\.36, 1\);/);
    // Every duration is a token; the one exception is the slow pulse of a machine that is down (three times, then still).
    const literal = [...values('animation'), ...values('transition')].filter(
      (v) => v !== 'none' && /(?:^|,\s*)[\w-]+ (?!0s\b)\d/.test(v) && !v.startsWith('v2-pulse'),
    );
    expect(literal).toEqual([]);
  });

  it('never fades a section in on page load', () => {
    expect(kit).not.toMatch(/stagger|v2-rise/);
  });

  it('moves a printed figure to a value with the same decimals and grouping, and leaves words alone', () => {
    expect(withValue('₹ 10.4 lakh', 5.2)).toBe('₹ 5.2 lakh');
    expect(withValue('1,24,000 h', 62000)).toBe('62,000 h');
    expect(withValue('99.36%', 0)).toBe('0.00%');
    expect(withValue('On target', 3)).toBe('On target');
    expect(withValue('−3.0 h', -12)).toBe('−12.0 h');
    expect(withValue('-3 pts', 4)).toBe('4 pts');
  });

  it('turns every animation and transition off under reduced motion', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{((?:[^{}]*\{[^}]*\})*)[^}]*\}/g;
    const off = new Set(
      [...kit.matchAll(reduced)].flatMap((m) =>
        [...m[1]!.matchAll(/([^{}]+)\{[^}]*\}/g)].flatMap((r) =>
          r[1]!.split(',').map((x) => x.trim()),
        ),
      ),
    );
    const rest = kit
      .replace(reduced, '')
      .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
    const moving = [...rest.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((r) => /\b(animation|transition):\s*(?!none)/.test(r[2]!))
      .flatMap((r) => r[1]!.split(',').map((x) => x.replace(/^@media[^{]*/, '').trim()));
    expect(moving.filter((sel) => !off.has(sel))).toEqual([]);
  });
});

describe('v2 colour (UX-RULES.md §5)', () => {
  const { light, dark } = readTokens(tokensCss);
  const pairs: [string, string][] = [
    ...['ink', 'ink-2', 'ink-3', 'loss', 'gain', 'risk', 'plan', 'decide'].map(
      (k): [string, string] => [k, 'panel'],
    ),
    ...['loss', 'gain', 'risk', 'plan', 'decide'].map((k): [string, string] => [k, `${k}-tint`]),
    ['ink-3', 'subtle'],
    ['ink-3', 'selected'],
    ['ink-2', 'selected'],
    ['on-ink', 'accent'],
  ];
  const fills = [
    'gain-fill',
    'risk-fill',
    'loss-fill',
    'plan-fill',
    'decide-fill',
    'idle-fill',
    'quiet',
    'cat-1',
    'cat-2',
    'cat-3',
    'cat-4',
    'cat-5',
  ];
  for (const [name, tokens] of Object.entries({ light, dark })) {
    /** A token's real colour; an alias or a missing token fails here, never as a silent NaN below. */
    const c = (k: string) => resolve(tokens, `color-v2-${k}`);
    const r = (f: string, b: string) => {
      const value = ratio(c(f), c(b));
      expect(Number.isFinite(value), `${f} on ${b}`).toBe(true);
      return value;
    };
    it(`reads every text at 4.5:1 and shows every fill at 3:1 in ${name}`, () => {
      expect(pairs.filter(([f, b]) => r(f, b) < 4.5)).toEqual([]);
      expect(fills.filter((f) => r(f, 'panel') < 3)).toEqual([]);
    });
  }
});

describe('v2 layout and load states', () => {
  it('puts cards side by side on one grid of 2, 3, 4 or wide', () => {
    expect(html(createElement(Row, { children: 'a' }))).toBe(
      '<div class="v2-grid v2-grid-2">a</div>',
    );
    expect(html(createElement(Row, { cols: 4, children: 'a' }))).toMatch(/v2-grid-4/);
    expect(html(createElement(Row, { wide: true, children: 'a' }))).toMatch(/v2-grid-wide/);
  });

  const states = (state: 'loading' | 'error' | 'empty') =>
    html(
      createElement(ScreenStates<string>, {
        loaded: { state, retry: () => {} },
        children: (m: string) => m,
      }),
    );
  it('says it is loading, announces an error with a way to try again, and shows an empty state', () => {
    expect(states('loading')).toMatch(/role="status"/);
    expect(states('error')).toMatch(/role="alert"[\s\S]*<button type="button"/);
    expect(states('empty')).toMatch(/data-state="empty"/);
  });
});
