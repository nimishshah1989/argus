/**
 * The platform's green heat scale, now used only by the engine's heat matrices (`parts.tsx`: the breakdown month
 * grids). The energy screen draws its tiles from the shared elements and no longer paints its own.
 */
/**
 * The platform's flat green scale: light green for a low load, dark green for a high one, mid green for a grid
 * whose loads are all equal. Kept as the platform's own formula because A5's tile colour is the figure's data.
 */
export function heatT(value: number, min: number, max: number): number {
  return max <= min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function heatColor(value: number, min: number, max: number): string {
  const t = heatT(value, min, max);
  return `hsl(${140 + t * 10}, ${45 + t * 30}%, ${88 - t * 66}%)`;
}

/** Dark text on a light tile, white on a dark one, as the platform paints its heat text. */
export function heatInk(value: number, min: number, max: number): string {
  return heatT(value, min, max) > 0.45 ? '#ffffff' : '#14532d';
}
