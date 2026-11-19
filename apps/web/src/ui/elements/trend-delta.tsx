import { describeChange, type Measure } from '../meaning/index.js';
import { TONE_INK } from './tone.js';

/**
 * How a figure moved: the signed change with its unit, an icon and a word (Better, Worse, No change). Whether the
 * move is good comes from the figure's good direction in the meaning map, not from its sign.
 */
export function TrendDelta({ measure, delta }: { measure: Measure; delta: number }) {
  const { tone, icon: Icon, word, text } = describeChange(measure, delta);
  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center gap-1 text-footnote font-semibold ${TONE_INK[tone]}`}
    >
      <Icon aria-hidden size={16} className="shrink-0" />
      <span>{text}</span>
      <span className="font-normal">{word}</span>
    </span>
  );
}
