import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The one motion module of the v2 kit (UX-RULES.md §8). Motion carries information: numbers tick to their figure,
 * charts draw in once on first view, a changed value flashes its direction once, rows re-flow when a filter or sort
 * changes them, the drawer slides in while the page reflows, buttons press. Nothing fades in just because the page
 * loaded. Under reduced motion every one of these is instant (motion.css, and `reducedMotion` here). A screen never
 * animates anything itself: it uses kit parts that do.
 */
export const MOTION = {
  /** A vertical bar (HTML or SVG) grows up from its base, on first view. */
  growY: 'v2-grow-y',
  /** A horizontal bar grows out from its start, on first view. */
  growX: 'v2-grow-x',
  /** A line or a group of marks draws in from left to right, on first view. */
  draw: 'v2-draw',
  /** A clickable card lifts under the pointer. */
  lift: 'v2-lift',
  /** A row that arrives after a filter or sort slides in; `--v2-i` staggers it. */
  reflow: 'v2-reflow',
} as const;

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const NUMBER = /[-−]?\d[\d,]*(?:\.\d+)?/;
/** The first number in printed text, with its sign (an ASCII hyphen or a typographic minus). */
const valueOf = (text: string) => {
  const m = NUMBER.exec(text);
  return m ? Number(m[0].replace(/,/g, '').replace('−', '-')) : null;
};

/** `text` with its first number moved to `value`, printed with the same sign style, decimals and grouping. */
export function withValue(text: string, value: number): string {
  const m = NUMBER.exec(text);
  if (!m) return text;
  const raw = m[0];
  const decimals = raw.split('.')[1]?.length ?? 0;
  const digits = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: raw.includes(','),
  });
  const minus = raw.startsWith('−') ? '−' : '-';
  const shown = value < 0 && Number(digits.replace(/,/g, '')) !== 0 ? minus + digits : digits;
  return text.slice(0, m.index) + shown + text.slice(m.index + raw.length);
}

/** A figure as it shows now; `n` counts changes, so a second rise in a row flashes again (it keys the element). */
export type Tick = { text: string; flash?: 'up' | 'down'; n: number };

/**
 * A printed figure that arrives: on first load it ticks up from zero; on an update it ticks from the value on screen
 * to the new one and flashes its direction once. It always ends on the engine's own text, character for character.
 */
export function useTick(text: string, ms = 700): Tick {
  const [shown, setShown] = useState<Tick>({ text, n: 0 });
  const target = useRef<string | null>(null);
  const onScreen = useRef<number>(0);
  const changes = useRef(0);
  useLayoutEffect(() => {
    const before = target.current;
    target.current = text;
    const to = valueOf(text);
    const was = before === null ? null : valueOf(before);
    if (before !== null && before !== text) changes.current += 1;
    const n = changes.current;
    const flash =
      was !== null && to !== null && was !== to ? (to > was ? 'up' : 'down') : undefined;
    const from = onScreen.current;
    if (to === null || from === to || reducedMotion()) {
      onScreen.current = to ?? 0;
      return setShown({ text, flash, n });
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      onScreen.current = from + (to - from) * (1 - (1 - t) ** 3);
      setShown({ text: t < 1 ? withValue(text, onScreen.current) : text, flash, n });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setShown({ text: withValue(text, from), flash, n });
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, ms]);
  return shown;
}
