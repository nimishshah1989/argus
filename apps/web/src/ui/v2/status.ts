/**
 * How a figure is doing against its yardstick or target (ADR 0036): good, watch, bad, or neutral when there is
 * nothing to judge it by. It owns the colour of a tile's edge and badge, a table cell and the verdict chip; red is
 * only ever `bad`. A figure's kind (`Tone` in points.tsx: a loss, a gain) is a different thing and colours words.
 */
export type Status = 'good' | 'watch' | 'bad' | 'neutral';
