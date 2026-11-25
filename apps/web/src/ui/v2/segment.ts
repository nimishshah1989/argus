/** The machine segments, each with one fixed colour on every screen (ADR 0036 R23). Never good or bad. */
export const SEGMENTS = ['cnc', 'conv', 'process', 'robot', 'util', 'dg'] as const;
export type SegmentKey = (typeof SEGMENTS)[number];

const BY_NAME: Record<string, SegmentKey> = {
  cnc: 'cnc',
  conventional: 'conv',
  process: 'process',
  robot: 'robot',
  robots: 'robot',
  utility: 'util',
  utilities: 'util',
  dg: 'dg',
};

/**
 * A machine's segment from its type or category name, ignoring case, surrounding space and a trailing
 * "machine(s)" / "set(s)": CNC → cnc, Conventional → conv, Process → process, Robot(s) → robot,
 * Utility / Utilities → util, DG / DG Sets → dg. Anything else (or empty) → undefined.
 */
export function segmentKey(name: string | null | undefined): SegmentKey | undefined {
  const base = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+(machines?|sets?)$/, '');
  return Object.hasOwn(BY_NAME, base) ? BY_NAME[base] : undefined;
}

/** The segment's colour token: `var(--color-v2-seg-<key>)` (tokens in `ui/tokens.css`). */
export function segmentVar(key: SegmentKey): string {
  return `var(--color-v2-seg-${key})`;
}
