/**
 * How a figure is doing against its yardstick or target (ADR 0036): good, watch, bad, or neutral when there is
 * nothing to judge it by. It owns the colour of a tile's edge and badge, a table cell and the verdict chip; red is
 * only ever `bad`. A figure's kind (`Tone` in points.tsx: a loss, a gain) is a different thing and colours words.
 */
export type Status = 'good' | 'watch' | 'bad' | 'neutral';

/**
 * A figure's status against its target (ADR 0036 R7). No target, or a value or target that is not finite → neutral.
 * Meets or beats the target in the `better` direction → good. Worse by at most `band` × |target| (default 0.10) →
 * watch; worse by more → bad. With a target of 0, any worse value is bad.
 */
export function statusOf(figure: {
  value: number;
  target?: number;
  better: 'higher' | 'lower';
  band?: number;
}): Status {
  const { value, target, better, band = 0.1 } = figure;
  if (target === undefined || !Number.isFinite(value) || !Number.isFinite(target)) return 'neutral';
  const worse = better === 'higher' ? target - value : value - target;
  if (worse <= 0) return 'good';
  if (target === 0) return 'bad';
  // The tolerance keeps 2.2 vs 2 (worse by 0.2000…02) inside a 10 % band.
  return worse <= band * Math.abs(target) + 1e-9 ? 'watch' : 'bad';
}
