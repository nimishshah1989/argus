import type { ReactElement } from 'react';
import { fullView } from './bubble-math.js';

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
  return `${p.x >= s.x ? 'h' : 'l'}${p.y >= s.y ? 'h' : 'l'}` as QuadKey;
}

/**
 * The top offenders (ADR 0036 R21): drop every point whose x or y is NaN; keep only the points in 'hh'
 * (`quadrantOf`); sort by the score x / s.x + y / s.y, highest first; equal scores by `key` ascending
 * (`a.key.localeCompare(b.key)`); return the first `n` (all of them when fewer than `n` are in 'hh'). Never mutates
 * `points`.
 */
export function offenders(points: readonly QPoint[], split: Split, n = 5): QPoint[] {
  const score = (p: QPoint) => p.x / split.x + p.y / split.y;
  return points
    .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y) && quadrantOf(p, split) === 'hh')
    .sort((a, b) => score(b) - score(a) || a.key.localeCompare(b.key))
    .slice(0, n);
}

const W = 400;
const H = 300;
const PAD = { l: 40, r: 12, t: 16, b: 36 };

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
  const drawn = points.filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y));
  const view = fullView([...drawn, split]);
  const [left, right, top, bottom] = [PAD.l, W - PAD.r, PAD.t, H - PAD.b];
  const sx = (v: number) => left + (v / view.x1) * (right - left);
  const sy = (v: number) => bottom - (v / view.y1) * (bottom - top);
  const worst = new Set(offenders(points, split).map((p) => p.key));
  return (
    <svg className="v2-quad" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
      <path className="v2-quad-axis" d={`M${left} ${top}V${bottom}H${right}`} fill="none" />
      <text className="v2-quad-title" x={right} y={H - 8} textAnchor="end">
        {axis.x}
      </text>
      <text className="v2-quad-title" x={left} y={top - 4}>
        {axis.y}
      </text>
      <path
        className="v2-quad-split"
        d={`M${sx(split.x)} ${top}V${bottom}M${left} ${sy(split.y)}H${right}`}
        fill="none"
      />
      {(Object.keys(names) as QuadKey[]).map((q) => (
        <text
          key={q}
          className="v2-quad-name"
          x={q[0] === 'h' ? right - 4 : left + 4}
          y={q[1] === 'h' ? top + 14 : bottom - 6}
          textAnchor={q[0] === 'h' ? 'end' : 'start'}
        >
          {names[q]}
        </text>
      ))}
      {drawn.map((p) => (
        <Dot key={p.key} p={p} cx={sx(p.x)} cy={sy(p.y)} offender={worst.has(p.key)} />
      ))}
    </svg>
  );
}

function Dot({ p, cx, cy, offender }: { p: QPoint; cx: number; cy: number; offender: boolean }) {
  return (
    <g>
      <circle
        className="v2-quad-dot"
        data-offender={offender ? '' : undefined}
        cx={cx}
        cy={cy}
        r={5}
      >
        <title>{p.label}</title>
      </circle>
      {offender && (
        <text className="v2-quad-label" x={cx + 8} y={cy + 4}>
          {p.label}
        </text>
      )}
    </g>
  );
}
