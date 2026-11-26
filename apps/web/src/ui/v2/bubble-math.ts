/** A window onto the plot: the values the left and right edges, and the bottom and top edges, stand for. */
export type View = { x0: number; x1: number; y0: number; y1: number };

/** The smallest share of the full range a zoom may reach, so a bubble never zooms out of sight. */
const MIN_SPAN = 0.04;

/** The window that holds every dot with a little air: both axes start at zero, as the chart always did. */
export function fullView(dots: readonly { x: number; y: number }[]): View {
  const top = (values: number[]) => Math.max(1, ...values) * 1.08;
  return { x0: 0, x1: top(dots.map((d) => d.x)), y0: 0, y1: top(dots.map((d) => d.y)) };
}

function clamp(lo: number, hi: number, fullLo: number, fullHi: number): [number, number] {
  const span = Math.min(hi - lo, fullHi - fullLo);
  const start = Math.min(Math.max(lo, fullLo), fullHi - span);
  return [start, start + span];
}

/** One axis zoomed by `factor` about `anchor` (0 to 1 along it), inside its full range. */
function zoomAxis(
  [lo, hi]: [number, number],
  [fullLo, fullHi]: [number, number],
  factor: number,
  anchor: number,
): [number, number] {
  const wide = fullHi - fullLo;
  const span = Math.min(wide, Math.max(wide * MIN_SPAN, (hi - lo) * factor));
  const pivot = lo + (hi - lo) * anchor;
  return clamp(pivot - span * anchor, pivot + span * (1 - anchor), fullLo, fullHi);
}

/** Zoom by `factor` (below 1 in, above 1 out) about a point (0 to 1 across, 0 to 1 up); never past the full view. */
export function zoomed(view: View, full: View, factor: number, at = { x: 0.5, y: 0.5 }): View {
  const [x0, x1] = zoomAxis([view.x0, view.x1], [full.x0, full.x1], factor, at.x);
  const [y0, y1] = zoomAxis([view.y0, view.y1], [full.y0, full.y1], factor, at.y);
  return { x0, x1, y0, y1 };
}

/** Pan by a share of the window (positive `dx` moves the picture right, `dy` up), kept inside the full view. */
export function panned(view: View, full: View, dx: number, dy: number): View {
  const across = view.x1 - view.x0;
  const up = view.y1 - view.y0;
  const [x0, x1] = clamp(view.x0 - dx * across, view.x1 - dx * across, full.x0, full.x1);
  const [y0, y1] = clamp(view.y0 - dy * up, view.y1 - dy * up, full.y0, full.y1);
  return { x0, x1, y0, y1 };
}

/** Round tick values inside [lo, hi], about `count` of them, on 1, 2 or 5 times a power of ten. */
export function ticks(lo: number, hi: number, count = 5): number[] {
  const raw = (hi - lo) / Math.max(1, count);
  if (!(raw > 0)) return [lo];
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step)
    out.push(Math.round(v / step) * step);
  return out;
}

/** Whether a value sits inside the window. */
export const inside = (view: View, x: number, y: number): boolean =>
  x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;

/** A label's box on the plot, in the plot's own units: left, right, top, bottom. */
export type LabelBox = { x0: number; x1: number; y0: number; y1: number };
/** A label to place beside its dot (`cx`, `cy`), `width` its guessed printed width. */
export type LabelAsk = { key: string; cx: number; cy: number; width: number };
/** Where a label went: its text anchor point, its box, and a leader line back to its dot when it moved off it. */
export type Placed = {
  key: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  box: LabelBox;
  leader?: { x1: number; y1: number; x2: number; y2: number };
};

const LINE = 13; // one label line's height, baseline to baseline
const GAP = 8; // from the dot's centre to the label's near edge
const STEPS = [0, -1, 1, -2, 2, -3, 3]; // lines up or down from the dot, nearest first

/** Two boxes overlap, or come within `pad` of each other. */
export const hits = (a: LabelBox, b: LabelBox, pad = 1): boolean =>
  a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

function boxOf(ask: LabelAsk, step: number, anchor: 'start' | 'end'): LabelBox {
  const base = ask.cy + 4 + step * LINE;
  const [x0, x1] =
    anchor === 'start'
      ? [ask.cx + GAP, ask.cx + GAP + ask.width]
      : [ask.cx - GAP - ask.width, ask.cx - GAP];
  return { x0, x1, y0: base - 10, y1: base + 3 };
}

/**
 * Labels placed so none touches another label, any dot or the plot's edge (Nimish, 26 Nov: "bubble legends aren't
 * proper"). In the order asked (most important first), each label tries its dot's outer side then the other, on the
 * dot's line first, then one, two and three lines up or down, with a leader line back to the dot once it has moved.
 * A label with no free spot is left out: its dot keeps its name on hover and in "Show the numbers".
 */
export function placeLabels(
  asks: readonly LabelAsk[],
  dots: readonly { x: number; y: number; r: number }[],
  bounds: LabelBox,
): Placed[] {
  const blocked: LabelBox[] = dots.map((d) => ({
    x0: d.x - d.r,
    x1: d.x + d.r,
    y0: d.y - d.r,
    y1: d.y + d.r,
  }));
  const mid = (bounds.x0 + bounds.x1) / 2;
  const placed: Placed[] = [];
  for (const ask of asks) {
    const sides: ('start' | 'end')[] = ask.cx > mid ? ['end', 'start'] : ['start', 'end'];
    const free = (box: LabelBox) =>
      box.x0 >= bounds.x0 &&
      box.x1 <= bounds.x1 &&
      box.y0 >= bounds.y0 &&
      box.y1 <= bounds.y1 &&
      !blocked.some((b) => hits(box, b));
    const spot = STEPS.flatMap((step) => sides.map((anchor) => ({ step, anchor }))).find(
      ({ step, anchor }) => free(boxOf(ask, step, anchor)),
    );
    if (!spot) continue;
    const box = boxOf(ask, spot.step, spot.anchor);
    blocked.push(box);
    const start = spot.anchor === 'start';
    placed.push({
      key: ask.key,
      x: start ? box.x0 : box.x1,
      y: box.y1 - 3,
      anchor: spot.anchor,
      box,
      ...(spot.step === 0
        ? {}
        : {
            leader: {
              x1: ask.cx,
              y1: ask.cy,
              x2: start ? box.x0 - 2 : box.x1 + 2,
              y2: (box.y0 + box.y1) / 2,
            },
          }),
    });
  }
  return placed;
}
