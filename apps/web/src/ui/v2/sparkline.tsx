import { MOTION } from './motion.js';

/**
 * A trend in a small line, drawn in once when it first appears (`draw`). It is decoration: the figure and words
 * beside it say what it means. `tone` colours it by whether the trend is good.
 */
export function Sparkline({
  values,
  tone = 'neutral',
  width = 88,
  height = 28,
  draw = false,
}: {
  values: number[];
  tone?: 'gain' | 'loss' | 'neutral';
  width?: number;
  height?: number;
  draw?: boolean;
}) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - lo) / span) * (height - 4);
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`v2-spark v2-spark-${tone}`}
    >
      <path d={d} className={draw ? MOTION.draw : undefined} />
    </svg>
  );
}
