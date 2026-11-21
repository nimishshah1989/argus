// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fullView, inside, panned, ticks, zoomed } from './bubble-math.js';

const full = fullView([
  { x: 100, y: 10 },
  { x: 50, y: 4 },
]);

describe('the bubble plot window', () => {
  it('starts at zero and holds every dot', () => {
    expect(full.x0).toBe(0);
    expect(full.y0).toBe(0);
    expect(inside(full, 100, 10)).toBe(true);
  });

  it('zooms in about a point and out again, never past the full view', () => {
    const closer = zoomed(full, full, 0.5);
    expect(closer.x1 - closer.x0).toBeCloseTo((full.x1 - full.x0) / 2);
    expect(closer.x0).toBeGreaterThan(0);
    const out = zoomed(closer, full, 10);
    expect(out.x0).toBeCloseTo(full.x0);
    expect(out.x1).toBeCloseTo(full.x1);
    expect(out.y1).toBeCloseTo(full.y1);
  });

  it('keeps the point under the pointer still while zooming', () => {
    const at = { x: 0.25, y: 0.75 };
    const before = full.x0 + (full.x1 - full.x0) * at.x;
    const closer = zoomed(full, full, 0.5, at);
    expect(closer.x0 + (closer.x1 - closer.x0) * at.x).toBeCloseTo(before);
  });

  it('pans inside the full view and no further', () => {
    const closer = zoomed(full, full, 0.5);
    const moved = panned(closer, full, -10, -10);
    expect(moved.x1).toBeCloseTo(full.x1);
    expect(moved.y1).toBeCloseTo(full.y1);
    expect(panned(full, full, 0.3, 0.3)).toEqual(full);
  });

  it('draws round ticks', () => {
    expect(ticks(0, 108, 5)).toEqual([0, 50, 100]);
    expect(ticks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});
