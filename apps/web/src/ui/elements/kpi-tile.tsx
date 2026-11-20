import type { ReactNode } from 'react';
import { ChevronRight } from '../icon.js';
import { roundMove, toneOfChange, type Measure, type Tone4 } from '../meaning/index.js';
import { FAMILY_EDGE, type Family } from './family.js';
import { useCountUp } from './motion.js';
import { Sparkline } from './sparkline.js';
import { StatusChip } from './status-chip.js';
import { Tags, type TagSpec } from './tags.js';
import { TONE_EDGE, WRAP } from './tone.js';
import { TrendDelta } from './trend-delta.js';

/** What a figure with no value prints: a dash, never 0 (a missing month is not zero hours). */
export const NO_VALUE = '—';

interface KpiTileBase {
  label: string;
  tone?: Tone4;
  /** The word for the verdict chip ("On target"); absent shows no chip. */
  verdict?: string;
  change?: { measure: Measure; delta: number };
  trend?: {
    values: readonly (number | null)[];
    label: string;
    /** The last value is a month still running: dashed, ending on a hollow dot. */
    partial?: boolean;
    /** The point being pointed at in another chart on the page. */
    active?: number | null;
    /** Fill the tile's width instead of a small line beside the change. */
    wide?: boolean;
    /** Keep the line out of a screen reader's reading (the figure and its change already say it); on a tile that is a button it stays out of the button's name. */
    quiet?: boolean;
  };
  /** The word unit, printed smaller beside the value (`format` then returns the number alone). */
  unit?: string;
  /** Keep a short unit (`%`, `h`) on the figure's line on a phone, where a word unit drops under it. */
  unitBeside?: boolean;
  /** A quiet line in no tone, for what is not a verdict (an amount added since the last period). */
  note?: string;
  /** A small mark at the label's end on a plain tile that something else (a link over it) makes tappable. A tile with `onOpen` draws its own chevron and ignores this, so a tile never shows two. */
  action?: ReactNode;
  /**
   * The figure's identity family (availability, downtime, repairs, planned): the edge and the trend line wear its
   * colour. A family says what the figure is, never whether it is good: the tone is still said by the chip and the
   * change, each with its icon and word.
   */
  family?: Family;
  /** Status tags (tone, icon and word) under the note. */
  tags?: TagSpec[];
  /** Anything else a screen prints between the tags and the change (its own words for how the figure moved). */
  detail?: ReactNode;
  /** `data-testid` of the tile, and of the printed figure alone (without its unit). */
  testId?: string;
  valueTestId?: string;
  /** Makes the whole tile a button that opens an explanation (a `DrillPanel`); absent keeps the tile a plain figure. */
  onOpen?: () => void;
}

/**
 * The figure: a number (or `null`, a dash) eases to a new value (600 ms, none under reduced motion) and is printed by
 * `format` (`formatFigure`); a string is a word the screen needs in its place ("Stable"), printed as given, with no
 * count-up, no `format` and no unit.
 */
type KpiTileProps = KpiTileBase &
  ({ value: number | null; format: (value: number) => string } | { value: string; format?: never });

type Shown = KpiTileProps & { own: Tone4; frame: string; figure: string };

/**
 * One headline figure: what it is, its value, how it moved and, when the screen has a verdict, a chip with the tone's
 * icon and word. With a `change`, the chip and the tone take it from the figure's good direction (down is good for
 * downtime), not from the sign; without one they take `tone`, and only when there is a `verdict` to say it in words.
 * The 4 px edge and the line are the tone's, or the family's when there is a `family`.
 */
export function KpiTile(props: KpiTileProps) {
  const { value, tone = 'neutral', verdict, change, family } = props;
  const shown = useCountUp(typeof value === 'number' ? value : 0);
  // A colour is only used when a word or icon says it too: the rounded change's own, or the verdict chip.
  const own = change
    ? toneOfChange(change.measure.better, roundMove(change.delta))
    : verdict
      ? tone
      : 'neutral';
  const edge = family ? FAMILY_EDGE[family] : TONE_EDGE[own];
  const frame = `flex h-full min-w-0 flex-col gap-1 rounded-tile border-l-4 bg-surface p-4 shadow-card ${edge}`;
  const shownProps: Shown = {
    ...props,
    own,
    frame,
    figure: figureText(props, shown),
  };
  return props.onOpen ? <KpiButton {...shownProps} /> : <KpiPlain {...shownProps} />;
}

/** What the figure prints: a dash for none, a word as given, a number through `format`. */
function figureText(props: KpiTileProps, shown: number): string {
  if (props.format === undefined) return props.value;
  return props.value === null ? NO_VALUE : props.format(shown);
}

/** The value, with its word unit smaller beside it (under it on a phone, so a long unit never breaks). */
function Headline({
  figure,
  unit,
  as: Tag,
  testId,
  beside,
}: {
  figure: string;
  unit?: string;
  as: 'span' | 'dd';
  testId?: string;
  beside?: boolean;
}) {
  return (
    <Tag className={`text-title2 font-bold tabular-nums ${WRAP}`}>
      {testId ? <span data-testid={testId}>{figure}</span> : figure}
      {unit && figure !== NO_VALUE ? <Unit unit={unit} beside={beside} /> : null}
    </Tag>
  );
}

/**
 * The word unit after the figure: under it on a phone, beside it from `sm` up. `beside` keeps a short unit on the
 * figure's line, its separator a non-breaking space inside the same no-wrap box so it cannot wrap before the unit.
 */
function Unit({ unit, beside }: { unit: string; beside?: boolean }) {
  if (beside) {
    return (
      <span className="whitespace-nowrap text-footnote font-semibold text-neutral-600">
        {'\u00a0'}
        {unit}
      </span>
    );
  }
  return (
    <>
      {' '}
      <span className="block whitespace-nowrap text-footnote font-semibold text-neutral-600 sm:inline">
        {unit}
      </span>
    </>
  );
}

/**
 * The tile that opens an explanation: one button, its parts as phrasing content. A chevron at the top right marks that
 * a tap goes somewhere, and the tile darkens while pressed (neutral-100: the label keeps 4.66:1 in light and 7.29:1 in dark; neutral-200 would drop it to 4.15:1).  Its name is its own text (an `aria-label` that left out the change would break
 * label-in-name, WCAG 2.5.3); the figure counts up, so a screen reader may hear it settle.
 */
function KpiButton(p: Shown) {
  return (
    <button
      type="button"
      data-tone={p.own}
      data-family={p.family}
      data-testid={p.testId}
      aria-haspopup="dialog"
      onClick={p.onOpen}
      className={`${p.frame} min-h-target-min w-full text-left transition-colors duration-(--motion-fast) active:bg-neutral-100`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={`text-footnote text-neutral-600 ${WRAP}`}>{p.label}</span>
        <ChevronRight aria-hidden size={16} className="mt-0.5 shrink-0 text-neutral-600" />
      </span>
      <Headline
        figure={p.figure}
        unit={typeof p.value === 'string' ? undefined : p.unit}
        as="span"
        testId={p.valueTestId}
        beside={p.unitBeside}
      />
      {p.verdict ? (
        <span>
          <StatusChip tone={p.own}>{p.verdict}</StatusChip>
        </span>
      ) : null}
      {p.note ? <span className="text-footnote text-neutral-600">{p.note}</span> : null}
      {p.tags ? <Tags list={p.tags} /> : null}
      {p.detail}
      <Moves {...p} as="span" />
    </button>
  );
}

/** A plain figure: a definition list, label and value. */
function KpiPlain(p: Shown) {
  return (
    <dl data-tone={p.own} data-family={p.family} data-testid={p.testId} className={p.frame}>
      <dt className="flex items-start justify-between gap-2 text-footnote text-neutral-600">
        <span className={WRAP}>{p.label}</span>
        {p.action}
      </dt>
      <Headline
        figure={p.figure}
        unit={typeof p.value === 'string' ? undefined : p.unit}
        as="dd"
        testId={p.valueTestId}
        beside={p.unitBeside}
      />
      {p.verdict ? (
        <dd>
          <StatusChip tone={p.own}>{p.verdict}</StatusChip>
        </dd>
      ) : null}
      {p.note ? <dd className="text-footnote text-neutral-600">{p.note}</dd> : null}
      {p.tags ? (
        <dd>
          <Tags list={p.tags} />
        </dd>
      ) : null}
      {p.detail ? <dd>{p.detail}</dd> : null}
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
        <Sparkline
          values={trend.values}
          tone={own}
          family={family}
          label={trend.label}
          partial={trend.partial}
          active={trend.active}
          wide={trend.wide}
          quiet={trend.quiet}
        />
      ) : null}
    </Tag>
  );
}
