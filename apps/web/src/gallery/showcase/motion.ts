import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Whether the person asked the system for less motion; every animation here reads it and switches off. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

export const COUNT_MS = 600;
const easeOut = (p: number): number => 1 - (1 - p) ** 3;

/** A number that counts up from zero once, in 600 ms with an ease-out; under reduced motion it is the final value at once. */
export function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      setValue(target * easeOut(p));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const query = window.matchMedia(QUERY);
    const stop = () => {
      if (!query.matches) return;
      cancelAnimationFrame(frame);
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
