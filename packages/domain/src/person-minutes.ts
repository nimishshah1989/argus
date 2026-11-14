import type { WorkSegment } from './types.js';

/**
 * Each person's own minutes: every one of their work segments, clipped to the window if one is given, rounded to whole
 * minutes (his `mins()`), then added up per person. A segment still open runs to `now`. This is the only
 * place that adds up a person's minutes: the ticket view, the list and the day report all call it, so they cannot disagree.
 */
export function personMinutes(
  segments: WorkSegment[],
  now: Date,
  window?: { start: Date; end: Date },
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const segment of segments) {
    const from = Math.max(segment.startedAt.getTime(), window?.start.getTime() ?? -Infinity);
    const to = Math.min((segment.endedAt ?? now).getTime(), window?.end.getTime() ?? Infinity);
    if (to < from) continue; // wholly outside the window, or not started yet
    result[segment.personId] = (result[segment.personId] ?? 0) + Math.round((to - from) / 60000);
  }
  return result;
}
