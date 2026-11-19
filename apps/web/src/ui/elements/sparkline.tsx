import type { Tone4 } from '../meaning/index.js';
import { TONE_STROKE } from './tone.js';

const WIDTH = 96;
const HEIGHT = 28;
const PAD = 3;

type Series = readonly (number | null)[];
type Point = [number, number];

/** The polyline points of a series scaled into the box; a flat series runs through the middle. */
export function sparklinePoints(values: number[]): Point[] {
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo;
  const step = (WIDTH - 2 * PAD) / (values.length - 1);
  return values.map((v, at) => [
    PAD + at * step,
    span === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((v - lo) / span) * (HEIGHT - 2 * PAD),
  ]);
}

/** A series on a shared scale; a gap (null) is left out, so a missing month breaks the line instead of bridging it. */
function lay(values: Series, lo: number, hi: number): (Point | null)[] {
  const step = (WIDTH - 2 * PAD) / Math.max(1, values.length - 1);
  const span = hi - lo;
  const y = (v: number) =>
    span === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((v - lo) / span) * (HEIGHT - 2 * PAD);
  return values.map((v, at) => (v === null ? null : [PAD + at * step, y(v)]));
}

/** One path, with a new sub-path after every gap. */
function pathOf(points: (Point | null)[]): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (!p) pen = false;
    else {
      d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      pen = true;
    }
  }
  return d;
}

/** Everything the line draws, worked out from its series; `null` when there are fewer than two values. */
function shape(
  values: Series,
  reference: Series | undefined,
  active: number | null | undefined,
  partial: boolean,
) {
  if (values.filter((v) => v !== null).length < 2) return null;
  const all = [...values, ...(reference ?? [])].filter((v): v is number => v !== null);
  const [lo, hi] = [Math.min(...all), Math.max(...all)];
  const own = lay(values, lo, hi);
  const n = own.length;
  return {
    ref: reference ? pathOf(lay(reference, lo, hi)) : null,
    line: pathOf(partial ? own.map((p, i) => (i === n - 1 ? null : p)) : own),
    running: partial ? pathOf(own.map((p, i) => (i >= n - 2 ? p : null))) : null,
    last: [...own].reverse().find((p): p is Point => p !== null)!,
    hollow: partial && values[n - 1] !== null,
    at: active === null || active === undefined ? undefined : own[active],
  };
}

/** A round dot of fixed size, however the box is stretched: a zero-length line with round caps. */
function Dot({ at, hollow = false, tone }: { at: Point; hollow?: boolean; tone: Tone4 }) {
  const d = `M${at[0]} ${at[1]}h0`;
  const common = {
    d,
    strokeLinecap: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  return (
    <>
      <path {...common} strokeWidth={9} className="stroke-surface" />
      <path {...common} strokeWidth={6} className={TONE_STROKE[tone]} />
      {hollow ? <path {...common} strokeWidth={3} className="stroke-surface" /> : null}
    </>
  );
}

/**
 * A small line of recent values; `label` says it in words (it is an image). Fewer than two values draw nothing.
 * `reference` draws a second, dotted line on the same scale (the plant against a cell); `active` marks the point the
 * person is pointing at elsewhere on the page; `partial` draws the last stretch dashed and ends on a hollow dot (a
 * month still running); a null value is a gap. `wide` fills the width it is given. It draws in once (not under
 * reduced motion).
 */
export function Sparkline({
  values,
  reference,
  active,
  partial = false,
  tone = 'neutral',
  label,
  wide = false,
}: {
  values: Series;
  reference?: Series;
  active?: number | null;
  partial?: boolean;
  tone?: Tone4;
  label: string;
  wide?: boolean;
}) {
  const g = shape(values, reference, active, partial);
  if (!g) return null;
  const line = { vectorEffect: 'non-scaling-stroke' as const, strokeWidth: 2 };
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={`h-7 shrink-0 overflow-visible ${wide ? 'w-full' : 'w-24'}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {g.ref ? (
        <path
          d={g.ref}
          {...line}
          strokeWidth={1.25}
          strokeDasharray="1 4"
          className="stroke-neutral-fill"
        />
      ) : null}
      {g.at ? (
        <line
          x1={g.at[0]}
          x2={g.at[0]}
          y1={0}
          y2={HEIGHT}
          {...line}
          strokeWidth={1}
          className="stroke-neutral-300"
        />
      ) : null}
      <path d={g.line} {...line} pathLength={1} className={`el-draw ${TONE_STROKE[tone]}`} />
      {g.running ? (
        <path d={g.running} {...line} strokeDasharray="3 3" className={TONE_STROKE[tone]} />
      ) : null}
      <Dot at={g.last} tone={tone} hollow={g.hollow} />
      {g.at && g.at !== g.last ? <Dot at={g.at} tone={tone} /> : null}
    </svg>
  );
}
