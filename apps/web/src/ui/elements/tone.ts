import type { Tone4 } from '../meaning/index.js';

/**
 * Tailwind classes for the four tones (ticket 81 tokens), written out in full so the build finds them. A tone is
 * never shown by colour alone: every element that uses these also prints an icon and a word.
 */
export const TONE_BOX: Record<Tone4, string> = {
  good: 'bg-good-tint text-good-ink',
  watch: 'bg-watch-tint text-watch-ink',
  bad: 'bg-bad-tint text-bad-ink',
  neutral: 'bg-neutral-tint text-neutral-ink',
};

/** Ink for text and icons on the card or page surface. */
export const TONE_INK: Record<Tone4, string> = {
  good: 'text-good-ink',
  watch: 'text-watch-ink',
  bad: 'text-bad-ink',
  neutral: 'text-neutral-ink',
};

/** A bar or a dot: the fill is 3:1 on the surface. */
export const TONE_BAR: Record<Tone4, string> = {
  good: 'bg-good-fill',
  watch: 'bg-watch-fill',
  bad: 'bg-bad-fill',
  neutral: 'bg-neutral-fill',
};

export const TONE_EDGE: Record<Tone4, string> = {
  good: 'border-good-fill',
  watch: 'border-watch-fill',
  bad: 'border-bad-fill',
  neutral: 'border-neutral-200',
};

export const TONE_STROKE: Record<Tone4, string> = {
  good: 'stroke-good-fill',
  watch: 'stroke-watch-fill',
  bad: 'stroke-bad-fill',
  neutral: 'stroke-neutral-fill',
};

/** Long words and 7-digit numbers wrap inside their box instead of pushing the page sideways. */
export const WRAP = 'min-w-0 break-words';
