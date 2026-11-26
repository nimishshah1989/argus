// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { hits, placeLabels } from './bubble-math.js';
import { labelled, Quadrant, shortName, type QPoint } from './quadrant.js';

/** The staging crowd Nimish saw (26 Nov): three long names whose dots sit almost on top of each other. */
const crowd: QPoint[] = [
  { key: 'axis', label: 'Axis motor / drive / encoder / servo', x: 104, y: 4.66 },
  { key: 'turret', label: 'Turret clamp / indexing', x: 101, y: 4.6 },
  { key: 'spindle', label: 'Spindle motor / overload / noise', x: 99, y: 4.7 },
  { key: 'coolant', label: 'Coolant pump / leak', x: 98, y: 4.55 },
  { key: 'chuck', label: 'Chuck / jaw / hydraulic pressure', x: 97, y: 4.62 },
  { key: 'tool', label: 'Tool changer / ATC arm', x: 96, y: 4.68 },
  { key: 'home', label: 'Home position / geometry / backlash', x: 30, y: 9 },
  ...Array.from({ length: 20 }, (_, i) => ({
    key: `p${i}`,
    label: `Small group ${i}`,
    x: 5 + i * 2,
    y: 1 + (i % 5) * 0.3,
  })),
];
const split = { x: 40, y: 3 };

describe('Quadrant labels never overlap (Nimish, 26 Nov: "bubble legends aren\'t proper")', () => {
  it('no two placed label boxes intersect, and no label covers a dot', () => {
    const dots = crowd.map((p) => ({ x: p.x * 3, y: 300 - p.y * 25, r: 5 }));
    const asks = labelled(crowd, split).map((p) => ({
      key: p.key,
      cx: p.x * 3,
      cy: 300 - p.y * 25,
      width: 7 * shortName(p.label).length,
    }));
    const placed = placeLabels(asks, dots, { x0: 0, x1: 400, y0: 0, y1: 320 });
    expect(placed.length).toBeGreaterThanOrEqual(4);
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) expect(hits(a.box, b.box, 0), `${a.key}/${b.key}`).toBe(false);
      for (const d of dots)
        expect(hits(a.box, { x0: d.x - 5, x1: d.x + 5, y0: d.y - 5, y1: d.y + 5 }, 0)).toBe(false);
    }
  });

  it('labels the often-and-long and the biggest, at most six, long names cut with the whole name on hover', () => {
    const keys = labelled(crowd, split).map((p) => p.key);
    expect(keys.length).toBeLessThanOrEqual(6);
    expect(keys).toContain('axis');
    const html = renderToStaticMarkup(
      createElement(Quadrant, {
        points: crowd,
        split,
        names: { hh: 'Often and long', hl: 'Often, short', lh: 'Rare, long', ll: 'Rare, short' },
        axis: { x: 'Breakdowns', y: 'Hours each' },
        aria: 'chart',
      }),
    );
    expect(html).toContain('<title>Axis motor / drive / encoder / servo</title>');
    expect(html).toContain('>Axis motor / drive…<title>');
    // Every point still has its dot and its name on hover.
    expect(html.split('<circle').length - 1).toBe(crowd.length);
  });
});
