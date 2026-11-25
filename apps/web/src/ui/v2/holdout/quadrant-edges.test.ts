// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { offenders, Quadrant, quadrantOf, type QPoint } from '../quadrant.js';

const split = { x: 10, y: 5 };
const p = (key: string, x: number, y: number): QPoint => ({ key, label: `L-${key}`, x, y });

describe('Quadrant: edges', () => {
  it('a point on a split line counts as high', () => {
    expect(quadrantOf({ x: 10, y: 5 }, split)).toBe('hh');
    expect(quadrantOf({ x: 10, y: 4 }, split)).toBe('hl');
    expect(quadrantOf({ x: 9, y: 5 }, split)).toBe('lh');
    expect(offenders([p('on', 10, 5)], split).map((x) => x.key)).toEqual(['on']);
  });

  it('equal scores are ordered by key', () => {
    const points = [p('z', 20, 10), p('m', 20, 10), p('a', 20, 10), p('top', 40, 10)];
    expect(offenders(points, split).map((x) => x.key)).toEqual(['top', 'a', 'm', 'z']);
  });

  it('n larger than the quadrant returns every high-high point, and leaves the input alone', () => {
    const points = [p('b', 11, 6), p('a', 30, 30), p('low', 1, 1)];
    const before = points.map((x) => x.key);
    expect(offenders(points, split, 10).map((x) => x.key)).toEqual(['a', 'b']);
    expect(points.map((x) => x.key)).toEqual(before);
  });

  it('caps at 5 by default', () => {
    const points = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k, i) => p(k, 20 + i, 10));
    expect(offenders(points, split).map((x) => x.key)).toEqual(['g', 'f', 'e', 'd', 'c']);
  });

  it('drops NaN points from the offenders and from the chart', () => {
    const points = [p('nx', Number.NaN, 50), p('ny', 50, Number.NaN), p('ok', 20, 20)];
    expect(offenders(points, split).map((x) => x.key)).toEqual(['ok']);
    const html = renderToStaticMarkup(
      createElement(Quadrant, {
        points,
        split,
        names: { hh: 'Q-HH', hl: 'Q-HL', lh: 'Q-LH', ll: 'Q-LL' },
        axis: { x: 'AX', y: 'AY' },
        aria: 'chart',
      }),
    );
    expect(html.split('<circle').length - 1).toBe(1);
    expect(html).not.toContain('L-nx');
    expect(html).not.toContain('L-ny');
    expect(html).toContain('>L-ok</text>');
  });
});
