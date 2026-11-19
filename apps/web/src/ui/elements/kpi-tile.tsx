import { ChevronRight } from '../icon.js';
import { toneOfChange, type Measure, type Tone4 } from '../meaning/index.js';
import { FAMILY_EDGE, type Family } from './family.js';
import { useCountUp } from './motion.js';
import { Sparkline } from './sparkline.js';
import { StatusChip } from './status-chip.js';
import { TONE_EDGE, WRAP } from './tone.js';
import { TrendDelta } from './trend-delta.js';

/** What a figure with no value prints: a dash, never 0 (a missing month is not zero hours). */
export const NO_VALUE = '—';

interface KpiTileProps {
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
  /**
   * The figure's identity family (availability, downtime, repairs, planned): the edge and the trend line wear its
   * colour. A family says what the figure is, never whether it is good: the tone is still said by the chip and the
   * change, each with its icon and word.
   */
  family?: Family;
  /** Makes the whole tile a button that opens an explanation (a `DrillPanel`); absent keeps the tile a plain figure. */
  onOpen?: () => void;
}

type Shown = KpiTileProps & { own: Tone4; frame: string; figure: string };

/**
 * One headline figure: what it is, its value, how it moved and, when the screen has a verdict, a chip with the tone's
 * icon and word. With a `change`, the chip and the tone take it from the figure's good direction (down is good for
 * downtime), not from the sign; without one they take `tone`, and only when there is a `verdict` to say it in words.
 * The 4 px edge and the line are the tone's, or the family's when there is a `family`.
 */
export function KpiTile(props: KpiTileProps) {
  const { value, format, tone = 'neutral', verdict, change, family } = props;
  const shown = useCountUp(value ?? 0);
  // A colour is only used when a word or icon says it too: the change's own, or the verdict chip.
  const own = change
    ? toneOfChange(change.measure.better, change.delta)
    : verdict
      ? tone
      : 'neutral';
  const edge = family ? FAMILY_EDGE[family] : TONE_EDGE[own];
  const frame = `flex min-w-0 flex-col gap-1 rounded-tile border-l-4 bg-surface p-4 shadow-card ${edge}`;
  const shownProps: Shown = {
    ...props,
    own,
    frame,
    figure: value === null ? NO_VALUE : format(shown),
  };
  return props.onOpen ? <KpiButton {...shownProps} /> : <KpiPlain {...shownProps} />;
}

/**
 * The tile that opens an explanation: one button, its parts as phrasing content. A chevron at the top right marks that
 * a tap goes somewhere, and the tile darkens while pressed.  Its name is its own text (an `aria-label` that left out the change would break
 * label-in-name, WCAG 2.5.3); the figure counts up, so a screen reader may hear it settle.
 */
function KpiButton(p: Shown) {
  return (
    <button
      type="button"
      data-tone={p.own}
      data-family={p.family}
      aria-haspopup="dialog"
      onClick={p.onOpen}
      className={`${p.frame} min-h-target-min w-full text-left transition-colors duration-(--motion-fast) active:bg-neutral-200`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={`text-footnote text-neutral-600 ${WRAP}`}>{p.label}</span>
        <ChevronRight aria-hidden size={16} className="mt-0.5 shrink-0 text-neutral-600" />
      </span>
      <span className={`text-title2 font-bold tabular-nums ${WRAP}`}>{p.figure}</span>
      {p.verdict ? (
        <span>
          <StatusChip tone={p.own}>{p.verdict}</StatusChip>
        </span>
      ) : null}
      <Moves {...p} as="span" />
    </button>
  );
}

/** A plain figure: a definition list, label and value. */
function KpiPlain(p: Shown) {
  return (
    <dl data-tone={p.own} data-family={p.family} className={p.frame}>
      <dt className={`text-footnote text-neutral-600 ${WRAP}`}>{p.label}</dt>
      <dd className={`text-title2 font-bold tabular-nums ${WRAP}`}>{p.figure}</dd>
      {p.verdict ? (
        <dd>
          <StatusChip tone={p.own}>{p.verdict}</StatusChip>
        </dd>
      ) : null}
      <Moves {...p} as="dd" />
    </dl>
  );
}

/** How it moved and its line, side by side. */
function Moves({ change, trend, own, family, as: Tag }: Shown & { as: 'span' | 'dd' }) {
  if (!change && !trend) return null;
  return (
    <Tag className="flex flex-wrap items-center justify-between gap-2">
      {change ? <TrendDelta measure={change.measure} delta={change.delta} /> : null}
      {trend ? (
        <Sparkline values={trend.values} tone={own} family={family} label={trend.label} />
      ) : null}
    </Tag>
  );
}
