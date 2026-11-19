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

/** What the easing needs from the browser; a test passes its own. */
export interface MotionEnv {
  now: () => number;
  frame: (callback: () => void) => number;
  cancel: (handle: number) => void;
  reduced: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;
}

const browser = (): MotionEnv => ({
  now: () => performance.now(),
  frame: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
  reduced: window.matchMedia(QUERY),
});

/**
 * Ease a value from `origin` to `target` over 600 ms (ease-out), telling `onValue` each step. Under reduced motion,
 * or the moment the person asks for it mid-way, it jumps to the target. Returns the way to stop it.
 */
export function easeTo(
  origin: number,
  target: number,
  onValue: (value: number) => void,
  env: MotionEnv = browser(),
): () => void {
  if (env.reduced.matches) {
    onValue(target);
    return () => {};
  }
  let handle = 0;
  const start = env.now();
  const step = () => {
    const p = Math.min(1, (env.now() - start) / COUNT_MS);
    onValue(p < 1 ? origin + (target - origin) * easeOut(p) : target);
    if (p < 1) handle = env.frame(step);
  };
  const jump = () => {
    if (!env.reduced.matches) return;
    env.cancel(handle);
    onValue(target);
  };
  handle = env.frame(step);
  env.reduced.addEventListener('change', jump);
  return () => {
    env.cancel(handle);
    env.reduced.removeEventListener('change', jump);
  };
}

/**
 * A number that eases to its target: from zero when it first appears, from what was shown when the target changes,
 * so a changed figure visibly moves. Under reduced motion, and without a window, it is the target at once.
 */
export function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (canAnimate() ? 0 : target));
  const shown = useRef(value);
  useEffect(() => {
    const show = (next: number) => {
      shown.current = next;
      setValue(next);
    };
    if (!canAnimate()) {
      show(target);
      return;
    }
    return easeTo(shown.current, target, show);
  }, [target]);
  return value;
}
