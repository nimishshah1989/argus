// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { offenders, Quadrant, quadrantOf, type QPoint } from './quadrant.js';

const split = { x: 10, y: 5 };
const p = (key: string, x: number, y: number): QPoint => ({ key, label: `L-${key}`, x, y });
const names = { hh: 'Q-HH', hl: 'Q-HL', lh: 'Q-LH', ll: 'Q-LL' };
const count = (html: string, s: string) => html.split(s).length - 1;

describe('Quadrant (ADR 0036 R21)', () => {
  it('places a point by x first, then y', () => {
    expect(quadrantOf({ x: 12, y: 8 }, split)).toBe('hh');
    expect(quadrantOf({ x: 12, y: 1 }, split)).toBe('hl');
    expect(quadrantOf({ x: 3, y: 9 }, split)).toBe('lh');
    expect(quadrantOf({ x: 3, y: 1 }, split)).toBe('ll');
  });

  it('offenders are the high-high points, worst score first, first n', () => {
    const points = [p('a', 11, 6), p('b', 30, 5), p('c', 20, 20), p('d', 2, 50), p('e', 50, 1)];
    // scores: a 2.3, b 4, c 6; d is low x, e is low y
    expect(offenders(points, split).map((x) => x.key)).toEqual(['c', 'b', 'a']);
    expect(offenders(points, split, 2).map((x) => x.key)).toEqual(['c', 'b']);
  });

  it('names every quadrant once and labels the offenders and the biggest by x × y', () => {
    const points = [p('a', 11, 6), p('b', 30, 5), p('d', 2, 50), p('e', 50, 1)];
    const html = renderToStaticMarkup(
      createElement(Quadrant, { points, split, names, axis: { x: 'AX', y: 'AY' }, aria: 'chart' }),
    );
    for (const name of Object.values(names)) expect(count(html, name)).toBe(1);
    expect(html).toContain('>L-a</text>');
    expect(html).toContain('>L-b</text>');
    // d is rare but long: 2 × 50 = 100, among the three biggest (b 150, d 100, a 66), so it is named too.
    expect(html).toContain('>L-d</text>');
    expect(html).not.toContain('>L-e</text>');
    expect(count(html, '<circle')).toBe(4);
  });
});
