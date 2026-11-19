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
  if (part === undefined) return figure;
  const measure = figure.parts?.[part];
  if (!measure) throw new Error(`meaning: figure "${key}" has no measure "${part}"`);
  return measure;
}

/**
 * A figure's value with its unit: `82.5%`, `₹1,20,000`, `12.5 hrs`, `7`. It rounds to one decimal unless the screen
 * passes `digits`: a figure the engine gives to 2 places keeps both (`digits` 2 prints `3.12%`, not `3.1%`).
 */
export function formatFigure(measure: Measure, value: number, digits = 1, min = 0): string {
  const { text, unit } = splitFigure(measure, value, digits, min);
  return unit ? `${text} ${unit}` : text;
}

/**
 * A value as the number and its word unit apart, so a tile can print the unit smaller: `%` and `₹` stay on the
 * number (`94.4%`, `₹1,20,000`); `hrs`, `/day` and the like come back as `unit`.
 */
export function splitFigure(
  measure: Measure,
  value: number,
  digits = 1,
  min = 0,
): { text: string; unit: string } {
  const text = value.toLocaleString('en-IN', {
    minimumFractionDigits: min,
    maximumFractionDigits: digits,
  });
  const symbol = UNIT_SYMBOL[measure.unit];
  if (measure.unit === 'money') return { text: `${symbol}${text}`, unit: '' };
  if (measure.unit === 'percent') return { text: `${text}${symbol}`, unit: '' };
  return { text, unit: symbol };
}

const HOUR_UNITS: ReadonlySet<string> = new Set(['hours', 'hoursPerDay', 'hoursPerMachine']);

/**
 * How many decimal places print a value exactly as the engine gave it (at most 2). A figure in hours prints at least
 * one, as the old platform did ("120.0 hrs"). Use it as both the minimum and the maximum, so a count that eases to
 * its value shows the same places all the way and never flickers.
 */
export function figurePlaces(measure: Measure, value: number): number {
  const given = (String(Math.abs(value)).split('.')[1] ?? '').length;
  return Math.min(2, Math.max(given, HOUR_UNITS.has(measure.unit) ? 1 : 0));
}

/** Round to `places` decimals the same way either side of zero: +0.05 and -0.05 are the same size, never 0.1 and 0. */
export function roundMove(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.sign(value) * (Math.round(Math.abs(value) * scale) / scale) || 0;
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
