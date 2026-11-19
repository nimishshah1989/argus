import { describe, expect, it } from 'vitest';
import { heatColor, heatInk, heatT } from './EnergyGrids.js';

/**
 * The platform's green heat scale (41e-1): light green at a grid's minimum, dark green at its maximum, mid green
 * when the whole grid is flat. The energy screen no longer paints with it; it now colours only the breakdown month
 * grids (`parts.tsx`), so this file pins the paint rule the journeys cannot read reliably from a computed style.
 */
describe('the energy heat scale', () => {
  it('ranges the grid from light to dark green and falls back to mid green when flat', () => {
    expect(heatT(5, 5, 10)).toBe(0);
    expect(heatT(10, 5, 10)).toBe(1);
    expect(heatT(7, 7, 7)).toBe(0.5);
    expect(heatColor(5, 5, 10)).toBe('hsl(140, 45%, 88%)');
    expect(heatColor(10, 5, 10)).toBe('hsl(150, 75%, 22%)');
    expect(heatColor(7, 7, 7)).toBe('hsl(145, 60%, 55%)');
  });

  it('puts dark ink on a light tile and white on a dark one', () => {
    expect(heatInk(5, 5, 10)).toBe('#14532d');
    expect(heatInk(10, 5, 10)).toBe('#ffffff');
  });
});
