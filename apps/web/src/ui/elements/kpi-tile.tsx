import type { ReactNode } from 'react';
import { toneOfChange, type Measure, type Tone4 } from '../meaning/index.js';
import { useCountUp } from './motion.js';
import { Sparkline } from './sparkline.js';
import { StatusChip } from './status-chip.js';
import { TONE_EDGE, WRAP } from './tone.js';
import { TrendDelta } from './trend-delta.js';

/** What a figure with no value prints: a dash, never 0 (a missing month is not zero hours). */
export const NO_VALUE = '—';

/**
 * One headline figure: what it is, its value, how it moved and, when the screen has a verdict, a chip with the tone's
 * icon and word. With a `change`, the 4 px edge, the chip and the trend line take their tone from the figure's good
 * direction (down is good for downtime), not from the sign; without one they take `tone`, and only when there is a `verdict` to say it in words.
 */
/** A colour is only used when a word or icon says it too: the rounded change's own, or the verdict chip. */
function toneOf(
  tone: Tone4,
  verdict: string | undefined,
  change: { measure: Measure; delta: number } | undefined,
): Tone4 {
  if (change) return toneOfChange(change.measure.better, Math.round(change.delta * 10) / 10);
  return verdict ? tone : 'neutral';
}

/** The value, with its word unit smaller beside it. */
function Headline({ text, unit }: { text: string; unit?: string }) {
  return (
    <dd className={`text-title2 font-bold tabular-nums ${WRAP}`}>
      {text}
      {unit ? (
        <>
          {' '}
          <span className="block whitespace-nowrap text-footnote font-semibold text-neutral-600 sm:inline">
            {unit}
          </span>
        </>
      ) : null}
    </dd>
  );
}

export function KpiTile({
  label,
  value,
  format,
  tone = 'neutral',
  verdict,
  change,
  trend,
  unit,
  note,
  action,
}: {
  label: string;
  /** The figure; it eases to a new value (600 ms, none under reduced motion). `null` prints a dash. */
  value: number | null;
  /** Prints a value with its unit (`formatFigure`). */
  format: (value: number) => string;
  tone?: Tone4;
  /** The word for the verdict chip ("On target"); absent shows no chip. */
  verdict?: string;
  change?: { measure: Measure; delta: number };
  trend?: { values: number[]; label: string };
  /** The word unit, printed smaller beside the value (`format` then returns the number alone). */
  unit?: string;
  /** A quiet line in no tone, for what is not a verdict (an amount added since the last period). */
  note?: string;
  /** A small mark at the label's end (a chevron on a tile that opens something). */
  action?: ReactNode;
}) {
  const shown = useCountUp(value ?? 0);
  const own = toneOf(tone, verdict, change);
  return (
    <dl
      data-tone={own}
      className={`flex min-w-0 flex-col gap-1 h-full rounded-tile border-l-4 bg-surface p-4 shadow-card ${TONE_EDGE[own]}`}
    >
      <dt className="flex items-start justify-between gap-2 text-footnote text-neutral-600">
        <span className={WRAP}>{label}</span>
        {action}
      </dt>
      <Headline
        text={value === null ? NO_VALUE : format(shown)}
        unit={value === null ? undefined : unit}
      />
      {verdict ? (
        <dd>
          <StatusChip tone={own}>{verdict}</StatusChip>
        </dd>
      ) : null}
      {note ? <dd className="text-footnote text-neutral-600">{note}</dd> : null}
      {change || trend ? (
        <dd className="flex flex-wrap items-center justify-between gap-2">
          {change ? <TrendDelta measure={change.measure} delta={change.delta} /> : null}
          {trend ? <Sparkline values={trend.values} tone={own} label={trend.label} /> : null}
        </dd>
      ) : null}
    </dl>
  );
}
