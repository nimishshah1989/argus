import type { Tone4 } from '../meaning/index.js';
import { TONE_STROKE } from './tone.js';

const WIDTH = 96;
const HEIGHT = 28;
const PAD = 3;

/** The polyline points of a series scaled into the box; a flat series runs through the middle. */
export function sparklinePoints(values: number[]): [number, number][] {
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo;
  const step = (WIDTH - 2 * PAD) / (values.length - 1);
  return values.map((v, at) => [
    PAD + at * step,
    span === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((v - lo) / span) * (HEIGHT - 2 * PAD),
  ]);
}

/** A small line of recent values. `label` says it in words (it is an image); fewer than two values draw nothing. */
export function Sparkline({
  values,
  tone = 'neutral',
  label,
}: {
  values: number[];
  tone?: Tone4;
  label: string;
}) {
  if (values.length < 2) return null;
  const points = sparklinePoints(values);
  const [x, y] = points[points.length - 1]!;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-7 w-24 shrink-0 overflow-hidden"
    >
      <polyline
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className={`el-draw ${TONE_STROKE[tone]}`}
        points={points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')}
      />
      <circle cx={x} cy={y} r={1} strokeWidth={5} className={TONE_STROKE[tone]} />
    </svg>
  );
}
