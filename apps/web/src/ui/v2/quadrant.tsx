import type { ReactElement } from 'react';
import { fullView, hits, placeLabels, type LabelBox, type Placed } from './bubble-math.js';

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

/** How many of the biggest by x × y (for Problem Analysis: breakdowns × hours each, the hours lost) get a label. */
const BIGGEST = 3;
/** At most this many labels, so the chart stays readable; every point keeps its name on hover and in the numbers. */
const LABEL_CAP = 6;
/** A longer name is cut with "…"; the whole name is its `<title>`. */
const NAME_CHARS = 20;

/**
 * The points that get a printed label, most important first (Nimish, 26 Nov): the `offenders` (often and long), then
 * those of the 3 biggest by x × y not already among them, at most `LABEL_CAP` in all.
 */
export function labelled(points: readonly QPoint[], split: Split): QPoint[] {
  const worst = offenders(points, split);
  const biggest = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => b.x * b.y - a.x * a.y || a.key.localeCompare(b.key))
    .slice(0, BIGGEST)
    .filter((p) => !worst.includes(p));
  return [...worst, ...biggest].slice(0, LABEL_CAP);
}

/** A name short enough to print: at most `NAME_CHARS` characters, cut with "…". */
export const shortName = (name: string): string =>
  name.length > NAME_CHARS ? `${name.slice(0, NAME_CHARS - 1).trimEnd()}…` : name;

const W = 400;
const H = 300;
const PAD = { l: 40, r: 12, t: 16, b: 36 };
const CHAR_PX = 7; // rough text width per character; only used to keep names clear of dots and labels


/** A quadrant name goes in the first corner of its quadrant (outer corner first) that no dot or label touches. */
function Name({
  q,
  text,
  cross,
  taken,
}: {
  q: QuadKey;
  text: string;
  cross: { x: number; y: number }; // where the split lines cross, in pixels
  taken: readonly LabelBox[]; // the dots and the placed labels
}) {
  const hx = q[0] === 'h';
  const hy = q[1] === 'h';
  const box: LabelBox = {
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
  const free = ({ x, y, anchor }: (typeof corners)[number]) => {
    const [x0, x1] = anchor === 'end' ? [x - width, x] : [x, x + width];
    return !taken.some((t) => hits({ x0, x1, y0: y - 10, y1: y + 3 }, t));
  };
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
 * - The `labelled` points (the `offenders`, then the biggest by x × y, at most 6) get their name printed beside their
 *   dot, placed by `placeLabels` so no two labels and no label and dot touch, with a leader line when a label had to
 *   move off its dot's line; a name over 20 characters is cut with "…" and keeps the whole name as its `<title>`.
 *   Every point's name is its circle's `<title>`; the card's "Show the numbers" lists every point for the keyboard.
 * - No legend. All words come in through props; colours from tokens in `quadrant.css` (class prefix `v2-quad`).
 * - Classes (styles in `quadrant.css`, written by Plan, auto-loaded by `sheets.ts`): the `<svg class="v2-quad">`; axis
 *   lines `v2-quad-axis`, axis names `v2-quad-title`; split lines `v2-quad-split`; quadrant names `v2-quad-name`; every
 *   `<circle class="v2-quad-dot">`, an offender's also `data-offender`; a printed label `v2-quad-label`, its leader
 *   `v2-quad-leader`.
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
  const dots = drawn.map((p) => ({ x: sx(p.x), y: sy(p.y), r: 5 }));
  const asks = labelled(drawn, split).map((p) => ({
    key: p.key,
    cx: sx(p.x),
    cy: sy(p.y),
    width: CHAR_PX * shortName(p.label).length,
  }));
  const placed = new Map(
    placeLabels(asks, dots, { x0: 0, x1: W, y0: top, y1: bottom }).map((l) => [l.key, l]),
  );
  const taken = [
    ...dots.map((d) => ({ x0: d.x - 5, x1: d.x + 5, y0: d.y - 5, y1: d.y + 5 })),
    ...[...placed.values()].map((l) => l.box),
  ];
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
          taken={taken}
        />
      ))}
      {[...placed.values()].map((l) =>
        l.leader ? (
          <line
            key={`${l.key}-leader`}
            className="v2-quad-leader"
            x1={l.leader.x1}
            y1={l.leader.y1}
            x2={l.leader.x2}
            y2={l.leader.y2}
          />
        ) : null,
      )}
      {drawn.map((p) => (
        <Dot
          key={p.key}
          p={p}
          cx={sx(p.x)}
          cy={sy(p.y)}
          offender={worst.has(p.key)}
          label={placed.get(p.key)}
        />
      ))}
    </svg>
  );
}

function Dot({
  p,
  cx,
  cy,
  offender,
  label,
}: {
  p: QPoint;
  cx: number;
  cy: number;
  offender: boolean;
  label?: Placed;
}) {
  const name = shortName(p.label);
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
      {label && (
        <text className="v2-quad-label" x={label.x} y={label.y} textAnchor={label.anchor}>
          {name}
          {name === p.label ? null : <title>{p.label}</title>}
        </text>
      )}
    </g>
  );
}
