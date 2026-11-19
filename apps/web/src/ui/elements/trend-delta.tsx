import { useTranslation } from 'react-i18next';
import { describeChange, formatFigure, roundMove, type Measure } from '../meaning/index.js';
import { TONE_INK } from './tone.js';

/**
 * How a figure moved: the signed change with its unit, an icon and a word (Better, Worse, No change). Whether the
 * move is good comes from the figure's good direction in the meaning map, not from its sign.
 */
export function TrendDelta({ measure, delta }: { measure: Measure; delta: number }) {
  const { t } = useTranslation();
  const rounded = roundMove(delta);
  const { tone, icon: Icon, word, text } = describeChange(measure, rounded);
  // A move in a share is in percentage points, not a percent of a percent.
  const shown =
    measure.unit === 'percent'
      ? `${rounded > 0 ? '+' : rounded < 0 ? '-' : ''}${formatFigure({ ...measure, unit: 'count' }, Math.abs(rounded))} ${t('analytics.unit.points')}`
      : text;
  return (
    <span
      data-tone={tone}
      className={`inline-flex min-w-0 flex-wrap items-center gap-1 text-footnote font-semibold ${TONE_INK[tone]}`}
    >
      <Icon aria-hidden size={16} className="shrink-0" />
      <span>{shown}</span>
      <span className="font-normal">{word}</span>
    </span>
  );
}
