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

const NUMBER = /\d[\d,]*(?:\.\d+)?/;
const valueOf = (text: string) => {
  const m = NUMBER.exec(text);
  return m ? Number(m[0].replace(/,/g, '')) : null;
};

/** `text` with its first number moved to `value`, printed with the same decimals and grouping. */
export function withValue(text: string, value: number): string {
  const m = NUMBER.exec(text);
  if (!m) return text;
  const raw = m[0];
  const decimals = raw.split('.')[1]?.length ?? 0;
  const shown = Math.max(0, value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: raw.includes(','),
  });
  return text.slice(0, m.index) + shown + text.slice(m.index + raw.length);
}

export type Tick = { text: string; flash?: 'up' | 'down' };

/**
 * A printed figure that arrives: on first load it ticks up from zero, on an update it ticks from the old value to
 * the new one and flashes its direction once. It always ends on the engine's own text, character for character.
 */
export function useTick(text: string, ms = 700): Tick {
  const [shown, setShown] = useState<Tick>({ text });
  const last = useRef<string | null>(null);
  useLayoutEffect(() => {
    const before = last.current;
    last.current = text;
    const from = before === null ? 0 : valueOf(before);
    const to = valueOf(text);
    const flash =
      before !== null && from !== null && to !== null && from !== to
        ? to > from
          ? 'up'
          : 'down'
        : undefined;
    if (to === null || from === null || from === to || reducedMotion())
      return setShown({ text, flash });
    const start = performance.now();
    let frame = 0;
    let done = false;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      done = t >= 1;
      setShown({
        text: t < 1 ? withValue(text, from + (to - from) * (1 - (1 - t) ** 3)) : text,
        flash,
      });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setShown({ text: withValue(text, from), flash });
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      // A tick cut short (React running the effect twice in development) starts again from where it began.
      if (!done) last.current = before;
    };
  }, [text, ms]);
  return shown;
}
