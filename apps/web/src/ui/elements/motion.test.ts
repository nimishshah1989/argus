// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COUNT_MS, easeTo, type MotionEnv } from './motion.js';

/** A browser stand-in: time moves only when the test says, and the reduced-motion setting can flip mid-way. */
function fake(reduced = false) {
  let time = 0;
  let queued: (() => void) | undefined;
  let listener: (() => void) | undefined;
  const media = {
    matches: reduced,
    addEventListener: (_: string, fn: () => void) => (listener = fn),
    removeEventListener: () => (listener = undefined),
  };
  const env = {
    now: () => time,
    frame: (fn: () => void) => ((queued = fn), 1),
    cancel: () => (queued = undefined),
    reduced: media,
  } as unknown as MotionEnv;
  return {
    env,
    tick(ms: number) {
      time += ms;
      const run = queued;
      queued = undefined;
      run?.();
    },
    reduce() {
      media.matches = true;
      listener?.();
    },
    running: () => queued !== undefined,
  };
}

describe('the count-up engine behind every figure', () => {
  it('starts at the origin, eases, and lands exactly on the target', () => {
    const f = fake();
    const seen: number[] = [];
    easeTo(0, 1.41, (v) => seen.push(v), f.env);
    f.tick(0);
    f.tick(COUNT_MS / 2);
    f.tick(COUNT_MS);
    expect(seen[0]).toBe(0);
    expect(seen[1]).toBeGreaterThan(0.7); // ease-out is past halfway at half time
    expect(seen[1]).toBeLessThan(1.41);
    expect(seen.at(-1)).toBe(1.41); // exactly, not 1.4099999999999997
    expect(f.running()).toBe(false);
  });

  it('eases from the old value, not from zero, when the target changes', () => {
    const f = fake();
    const seen: number[] = [];
    easeTo(80, 100, (v) => seen.push(v), f.env);
    f.tick(0);
    f.tick(100);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...seen)).toBeLessThanOrEqual(100);
  });

  it('shows the target at once under reduced motion', () => {
    const f = fake(true);
    const seen: number[] = [];
    easeTo(0, 50, (v) => seen.push(v), f.env);
    expect(seen).toEqual([50]);
    expect(f.running()).toBe(false);
  });

  it('jumps to the target when reduced motion is asked for mid-animation', () => {
    const f = fake();
    const seen: number[] = [];
    easeTo(0, 50, (v) => seen.push(v), f.env);
    f.tick(0);
    f.tick(100);
    f.reduce();
    expect(seen.at(-1)).toBe(50);
    expect(f.running()).toBe(false);
  });

  it('stops when told to', () => {
    const f = fake();
    const stop = easeTo(0, 5, () => {}, f.env);
    stop();
    expect(f.running()).toBe(false);
  });
});
