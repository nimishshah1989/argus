// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fullView, inside, panned, ticks, zoomed } from './bubble-math.js';
import { plotReducer, type PlotState } from './bubble-state.js';

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

describe('how far a zoom can go', () => {
  it('stops at a few percent of the full range, so a bubble never zooms out of sight', () => {
    let view = full;
    for (let i = 0; i < 100; i += 1) view = zoomed(view, full, 0.5);
    expect(view.x1 - view.x0).toBeCloseTo((full.x1 - full.x0) * 0.04);
    expect(view.y1 - view.y0).toBeCloseTo((full.y1 - full.y0) * 0.04);
  });
});

describe('what the plot keeps across a refresh', () => {
  const start: PlotState = { view: null, key: 'all' };

  it('keeps the zoom when the same data comes again, and when the extent is the same by value', () => {
    const zoomedIn = plotReducer(start, { type: 'zoom', factor: 0.5, full });
    const again = fullView([
      { x: 100, y: 10 },
      { x: 50, y: 4 },
    ]);
    expect(again).not.toBe(full);
    expect(again).toEqual(full);
    // A refresh dispatches nothing: the state, and so the zoom, is exactly what it was.
    expect(zoomedIn.view).not.toBeNull();
    expect(plotReducer(zoomedIn, { type: 'key', key: 'all' })).toBe(zoomedIn);
  });

  it('starts the picture again only when what is plotted changes (a filter)', () => {
    const zoomedIn = plotReducer(start, { type: 'zoom', factor: 0.5, full });
    expect(plotReducer(zoomedIn, { type: 'key', key: 'cell:1' })).toEqual({
      view: null,
      key: 'cell:1',
    });
  });

  it('resets to the whole picture, and pans from the whole picture when not zoomed', () => {
    const zoomedIn = plotReducer(start, { type: 'zoom', factor: 0.5, full });
    expect(plotReducer(zoomedIn, { type: 'reset' }).view).toBeNull();
    expect(plotReducer(start, { type: 'pan', dx: 0.3, dy: 0.3, full }).view).toEqual(full);
  });
});
