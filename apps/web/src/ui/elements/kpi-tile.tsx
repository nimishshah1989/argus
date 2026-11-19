import type { Measure, Tone4 } from '../meaning/index.js';
import { useCountUp } from './motion.js';
import { Sparkline } from './sparkline.js';
import { StatusChip } from './status-chip.js';
import { TONE_EDGE, WRAP } from './tone.js';
import { TrendDelta } from './trend-delta.js';

/**
 * One headline figure: what it is, its value (already printed with its unit, `formatFigure`), how it moved and,
 * when the screen has a verdict, a chip with the tone's icon and word. A 4 px edge repeats the tone.
 */
export function KpiTile({
  label,
  value,
  format,
  tone = 'neutral',
  verdict,
  change,
  trend,
}: {
  label: string;
  /** The figure itself; it eases to a new value (600 ms, none under reduced motion). */
  value: number;
  /** Prints a value with its unit (`formatFigure`). */
  format: (value: number) => string;
  tone?: Tone4;
  /** The word for the verdict chip ("On target"); absent shows no chip. */
  verdict?: string;
  change?: { measure: Measure; delta: number };
  trend?: { values: number[]; label: string };
}) {
  const shown = useCountUp(value);
  return (
    <dl
      data-tone={tone}
      className={`flex min-w-0 flex-col gap-1 rounded-tile border-l-4 bg-surface p-4 el-lift shadow-card ${TONE_EDGE[tone]}`}
    >
      <dt className={`text-footnote text-neutral-600 ${WRAP}`}>{label}</dt>
      <dd className={`text-title2 font-bold tabular-nums ${WRAP}`}>{format(shown)}</dd>
      {verdict ? (
        <dd>
          <StatusChip tone={tone}>{verdict}</StatusChip>
        </dd>
      ) : null}
      {change || trend ? (
        <dd className="flex flex-wrap items-center justify-between gap-2">
          {change ? <TrendDelta measure={change.measure} delta={change.delta} /> : null}
          {trend ? <Sparkline values={trend.values} tone={tone} label={trend.label} /> : null}
        </dd>
      ) : null}
    </dl>
  );
}
