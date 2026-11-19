import { FIGURE_MEANING } from './figures.js';
import { CircleCheck, CircleX, Minus, TriangleAlert, type IconComponent } from '../icon.js';
import { CHANGE_WORD, UNIT_SYMBOL } from './strings.js';
import type { Direction, Measure, Tone4 } from './types.js';

/**
 * The meaning map (ticket 82): the one place a screen asks what a status, a severity or a figure means.
 * Statuses and severities: `statusMeaningOf`, `workStatusMeaning`, `NUDGE_SEVERITY`, `NUDGE_STATUS`.
 * Figures: `figureMeasure` for the unit and good direction, `formatFigure` to print a value, `describeChange`
 * to print a change with the right tone, icon and word.
 */
export * from './statuses.js';
export { FIGURE_MEANING, JUDGEMENT_KEYS } from './figures.js';
export { DIRECTION_WORD } from './strings.js';
export type { Direction, FigureMeaning, Meaning, Measure, Tone4, Unit } from './types.js';

/** One icon per tone, so green, amber, red and grey differ in shape as well as colour. */
export const TONE_ICON: Record<Tone4, IconComponent> = {
  good: CircleCheck,
  watch: TriangleAlert,
  bad: CircleX,
  neutral: Minus,
};

/** The unit and good direction of a figure, or of one of its measures (`a3-mttr-mtbf`, `mttr`). */
export function figureMeasure(key: string, part?: string): Measure {
  const figure = FIGURE_MEANING[key];
  if (!figure) throw new Error(`meaning: no entry for figure "${key}"`);
  return (part ? figure.parts?.[part] : undefined) ?? figure;
}

/** A figure's value with its unit: `82.5%`, `₹1,20,000`, `12.5 hrs`, `7`. */
export function formatFigure(measure: Measure, value: number): string {
  const text = value.toLocaleString('en-IN', { maximumFractionDigits: 1 });
  const symbol = UNIT_SYMBOL[measure.unit];
  if (measure.unit === 'money') return `${symbol}${text}`;
  if (measure.unit === 'percent') return `${text}${symbol}`;
  return symbol ? `${text} ${symbol}` : text;
}

/** Whether a move of `delta` is good, bad or neither for a figure that improves in `better`. */
export function toneOfChange(better: Direction, delta: number): Tone4 {
  if (delta === 0 || better === 'neither') return 'neutral';
  return delta > 0 === (better === 'up') ? 'good' : 'bad';
}

export interface ChangeText {
  tone: Tone4;
  icon: IconComponent;
  word: string;
  /** The signed change with its unit: `+2.5%`, `-3 hrs`. */
  text: string;
}

export function describeChange(measure: Measure, delta: number): ChangeText {
  const tone = toneOfChange(measure.better, delta);
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  const word =
    tone === 'good'
      ? CHANGE_WORD.better
      : tone === 'bad'
        ? CHANGE_WORD.worse
        : delta === 0
          ? CHANGE_WORD.same
          : CHANGE_WORD.changed;
  return {
    tone,
    icon: TONE_ICON[tone],
    word,
    text: `${sign}${formatFigure(measure, Math.abs(delta))}`,
  };
}
