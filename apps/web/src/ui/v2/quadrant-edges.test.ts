// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { offenders, Quadrant, type QPoint } from './quadrant.js';

const split = { x: 10, y: 5 };
const names = { hh: 'Q-HH', hl: 'Q-HL', lh: 'Q-LH', ll: 'Q-LL' };
const render = (points: QPoint[]) =>
  renderToStaticMarkup(
    createElement(Quadrant, { points, split, names, axis: { x: 'AX', y: 'AY' }, aria: 'chart' }),
  );

describe('Quadrant edges', () => {
  it('right-edge offender labels are right-aligned and stay inside the viewBox', () => {
    const html = render([
      { key: 'a', label: 'A-long-label-here', x: 50, y: 20 },
      { key: 'b', label: 'B', x: 11, y: 6 },
    ]);
    expect(html).toMatch(/text-anchor="end"[^>]*>A-long-label-here</);
    expect(html).toMatch(/x="(\d+(\.\d+)?)"[^>]*text-anchor="start"[^>]*>B</);
    for (const [, x, anchor, label] of html.matchAll(
      /<text class="v2-quad-label" x="([\d.]+)" y="[\d.]+" text-anchor="(\w+)">([^<]*)</g,
    )) {
      const px = 7 * label!.length;
      const [from, to] = anchor === 'end' ? [+x! - px, +x!] : [+x!, +x! + px];
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(400);
    }
  });

  it('drops infinite points and clamps negatives into the viewBox', () => {
    const points: QPoint[] = [
      { key: 'i', label: 'INF', x: Infinity, y: 9 },
      { key: 'n', label: 'NEG', x: -5, y: -5 },
    ];
    expect(offenders(points, split)).toEqual([]);
    const html = render(points);
    expect(html.split('<circle').length - 1).toBe(1);
    expect(html).not.toContain('cx="-');
    expect(html).not.toContain('NaN');
  });
});
