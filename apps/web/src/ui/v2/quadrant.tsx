/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */
import type { ReactElement } from 'react';

/** One point on the chart: `key` is unique and breaks ties, `label` is the text printed beside an offender's dot. */
export type QPoint = { key: string; label: string; x: number; y: number };

/** Where the two split lines cross: the vertical line at `x`, the horizontal line at `y` (both positive numbers). */
export type Split = { x: number; y: number };

/** A quadrant: first letter x, second y; `h` high (at or above the split line), `l` low (below it). */
export type QuadKey = 'hh' | 'hl' | 'lh' | 'll';

/**
 * The quadrant a point sits in (ADR 0036 R21). x ≥ s.x is high, x < s.x is low; the same for y against s.y. A point
 * exactly on a split line counts as high. Examples with s = {x: 10, y: 5}: (10, 5) → 'hh', (12, 1) → 'hl',
 * (3, 9) → 'lh', (3, 1) → 'll'.
 */
export function quadrantOf(p: { x: number; y: number }, s: Split): QuadKey {
  throw new Error('not implemented');
}

/**
 * The top offenders (ADR 0036 R21): drop every point whose x or y is NaN; keep only the points in 'hh'
 * (`quadrantOf`); sort by the score x / s.x + y / s.y, highest first; equal scores by `key` ascending
 * (`a.key.localeCompare(b.key)`); return the first `n` (all of them when fewer than `n` are in 'hh'). Never mutates
 * `points`.
 */
export function offenders(points: readonly QPoint[], split: Split, n = 5): QPoint[] {
  throw new Error('not implemented');
}

/**
 * A four-quadrant chart (ADR 0036 R21, R19), replacing bubble charts. One inline `<svg role="img" aria-label={aria}>`:
 * - Points whose x or y is NaN are not drawn at all.
 * - Both axes start at 0 and reach the largest of the points and the split, with a little air (as `fullView` in
 *   `bubble-math.ts`); the x axis is named `axis.x`, the y axis `axis.y`.
 * - Two split lines: a vertical one at `split.x`, a horizontal one at `split.y`.
 * - Each of the four quadrants prints its own name from `names` once, as `<text>` inside that quadrant
 *   (`names.hh` top right, `names.hl` bottom right, `names.lh` top left, `names.ll` bottom left).
 * - One `<circle>` per drawn point. Each circle holds `<title>{label}</title>` so hovering names it.
 * - Only the `offenders(points, split)` (top 5) get their label printed as a `<text>{label}</text>` beside their dot;
 *   every other point's label appears only in its `<title>`.
 * - No legend. All words come in through props; colours from tokens in `quadrant.css` (class prefix `v2-quad`).
 * - Classes (styles in `quadrant.css`, written by Plan, auto-loaded by `sheets.ts`): the `<svg class="v2-quad">`; axis
 *   lines `v2-quad-axis`, axis names `v2-quad-title`; split lines `v2-quad-split`; quadrant names `v2-quad-name`; every
 *   `<circle class="v2-quad-dot">`, an offender's also `data-offender`; its printed label `v2-quad-label`.
 */
export function Quadrant({
  points,
  split,
  names,
  axis,
  aria,
}: {
  points: readonly QPoint[];
  split: Split;
  names: Record<QuadKey, string>;
  axis: { x: string; y: string };
  aria: string;
}): ReactElement {
  throw new Error('not implemented');
}
