/**
 * The four metric families (ticket 80u): one identity hue each. A family says what a figure is (availability,
 * downtime, repairs, planned work); it never says whether the figure is good, so it never replaces the tone's icon and
 * word. The colours are the `--color-family-*` tokens in `ui/tokens.css`, light and dark.
 */
export type Family = 'availability' | 'downtime' | 'repairs' | 'planned';

/** Written out in full so the build finds each class. */
export const FAMILY_EDGE: Record<Family, string> = {
  availability: 'border-[var(--color-family-availability)]',
  downtime: 'border-[var(--color-family-downtime)]',
  repairs: 'border-[var(--color-family-repairs)]',
  planned: 'border-[var(--color-family-planned)]',
};

export const FAMILY_STROKE: Record<Family, string> = {
  availability: 'stroke-[var(--color-family-availability)]',
  downtime: 'stroke-[var(--color-family-downtime)]',
  repairs: 'stroke-[var(--color-family-repairs)]',
  planned: 'stroke-[var(--color-family-planned)]',
};

/** The five steps of a family's ramp (`--color-family-<name>-ramp-1..5`, with `-ramp-ink-N` for the text on it). */
export const RAMP_STEPS = [1, 2, 3, 4, 5] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

/**
 * The step of a value against the largest: fifths of the square root, so a month of 20 hours still shows beside one
 * of 240. Nothing (zero or less) is step 0, no colour.
 */
export function familyStep(value: number, max: number): 0 | RampStep {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil(Math.sqrt(value / max) * 5))) as RampStep;
}
