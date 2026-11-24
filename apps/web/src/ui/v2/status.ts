/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills statusOf and deletes this line */
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
  throw new Error('not implemented');
}
