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
 * The top offenders (ADR 0036 R21): drop every point whose x or y is not finite (NaN, ±Infinity); keep only the points
 * in 'hh' (`quadrantOf`); sort by the score x / s.x + y / s.y, highest first; equal scores by `key` ascending
 * (`a.key.localeCompare(b.key)`); return the first `n` (all of them when fewer than `n` are in 'hh'). Never mutates
 * `points`.
 */
export function offenders(points: readonly QPoint[], split: Split, n = 5): QPoint[] {
  const score = (p: QPoint) => p.x / split.x + p.y / split.y;
  return points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && quadrantOf(p, split) === 'hh')
    .sort((a, b) => score(b) - score(a) || a.key.localeCompare(b.key))
    .slice(0, n);
}

const W = 400;
const H = 300;
const PAD = { l: 40, r: 12, t: 16, b: 36 };
const MID = (PAD.l + W - PAD.r) / 2;
const CHAR_PX = 7; // rough text width per character; only used to keep names clear of dots and labels

type Spot = { x: number; y: number; w: number }; // a dot and the width of the label printed beside it (0 if none)
type Box = { x0: number; x1: number; y0: number; y1: number };

/** A quadrant name goes in the first corner of its quadrant (outer corner first) that no dot or offender label touches. */
function Name({
  q,
  text,
  cross,
  spots,
}: {
  q: QuadKey;
  text: string;
  cross: { x: number; y: number }; // where the split lines cross, in pixels
  spots: readonly Spot[];
}) {
  const hx = q[0] === 'h';
  const hy = q[1] === 'h';
  const box: Box = {
    x0: hx ? cross.x : PAD.l,
    x1: hx ? W - PAD.r : cross.x,
    y0: hy ? PAD.t : cross.y,
    y1: hy ? cross.y : H - PAD.b,
  };
  const xs = hx ? (['end', 'start'] as const) : (['start', 'end'] as const);
  const ys = hy ? [box.y0 + 14, box.y1 - 6] : [box.y1 - 6, box.y0 + 14];
  const width = CHAR_PX * text.length;
  const corners = ys.flatMap((y) =>
    xs.map((anchor) => ({ y, anchor, x: anchor === 'end' ? box.x1 - 4 : box.x0 + 4 })),
  );
  const free = ({ x, y, anchor }: (typeof corners)[number]) =>
    !spots.some((s) => {
      const [a, b] = anchor === 'end' ? [x - width, x] : [x, x + width];
      const [c, d] = s.x > MID ? [s.x - 8 - s.w, s.x + 5] : [s.x - 5, s.x + 8 + s.w];
      return a < d && c < b && Math.abs(s.y - y + 4) < 14;
    });
  const at = corners.find(free) ?? corners[0]!;
  return (
    <text className="v2-quad-name" x={at.x} y={at.y} textAnchor={at.anchor}>
      {text}
    </text>
  );
}

/**
 * A four-quadrant chart (ADR 0036 R21, R19), replacing bubble charts. One inline `<svg role="img" aria-label={aria}>`:
 * - Points whose x or y is not finite are not drawn at all; a negative x or y is drawn at 0.
 * - Both axes start at 0 and reach the largest of the points and the split, with a little air (as `fullView` in
 *   `bubble-math.ts`); the x axis is named `axis.x`, the y axis `axis.y`.
 * - Two split lines: a vertical one at `split.x`, a horizontal one at `split.y`.
 * - Each of the four quadrants prints its own name from `names` once, as `<text>` inside that quadrant, in the corner
 *   (outer one first) that no dot or offender label touches.
 * - One `<circle>` per drawn point. Each circle holds `<title>{label}</title>` so hovering names it.
 * - Only the `offenders(points, split)` (top 5) get their label printed as a `<text>{label}</text>` beside their dot
 *   (right of it, or left-aligned to its left past the middle of the plot); every other point's label appears only in
 *   its `<title>`.
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
  const drawn = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ ...p, x: Math.max(0, p.x), y: Math.max(0, p.y) }));
  const view = fullView([...drawn, split]);
  const [left, right, top, bottom] = [PAD.l, W - PAD.r, PAD.t, H - PAD.b];
  const sx = (v: number) => left + (v / view.x1) * (right - left);
  const sy = (v: number) => bottom - (v / view.y1) * (bottom - top);
  const worst = new Set(offenders(points, split).map((p) => p.key));
  const spots = drawn.map((p) => ({
    x: sx(p.x),
    y: sy(p.y),
    w: worst.has(p.key) ? CHAR_PX * p.label.length : 0,
  }));
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
        <Name
          key={q}
          q={q}
          text={names[q]}
          cross={{ x: sx(split.x), y: sy(split.y) }}
          spots={spots}
        />
      ))}
      {drawn.map((p) => (
        <Dot key={p.key} p={p} cx={sx(p.x)} cy={sy(p.y)} offender={worst.has(p.key)} />
      ))}
    </svg>
  );
}

function Dot({ p, cx, cy, offender }: { p: QPoint; cx: number; cy: number; offender: boolean }) {
  const right = cx > MID; // near the right edge a label to the right would spill off the chart
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
        <text
          className="v2-quad-label"
          x={right ? cx - 8 : cx + 8}
          y={cy + 4}
          textAnchor={right ? 'end' : 'start'}
        >
          {p.label}
        </text>
      )}
    </g>
  );
}
