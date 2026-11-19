import { useEffect, useRef, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Whether the person asked the system for less motion; every animation of the elements reads it and switches off. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** Counting is only drawn in a browser that allows motion; server rendering and tests show the final value. */
const canAnimate = (): boolean => typeof window !== 'undefined' && !reducedMotion();

export const COUNT_MS = 600;
const easeOut = (p: number): number => 1 - (1 - p) ** 3;

/**
 * A number that eases to its target in 600 ms (ease-out): from zero when it first appears, from what was shown when
 * the target changes, so a changed figure visibly moves. Under reduced motion, and without a window, it is the
 * target at once.
 */
export function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (canAnimate() ? 0 : target));
  const shown = useRef(value);
  useEffect(() => {
    if (!canAnimate()) {
      shown.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    const origin = shown.current;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      shown.current = origin + (target - origin) * easeOut(p);
      setValue(shown.current);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const query = window.matchMedia(QUERY);
    const stop = () => {
      if (!query.matches) return;
      cancelAnimationFrame(frame);
      shown.current = target;
      setValue(target);
    };
    query.addEventListener('change', stop);
    return () => {
      cancelAnimationFrame(frame);
      query.removeEventListener('change', stop);
    };
  }, [target]);
  return value;
}
