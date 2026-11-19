import { dayNumber } from './plant-date.js';
import { effectiveHours, type SourcedReport } from './rows.js';

/** The Compare scorecard's repeat-fault part (ticket 43, packet 43a), split out of `compare-score.ts` for its line budget. */

/** The clusters in one code's sorted days: three or more within 30 days of the cluster's first day. */
function clustersOf(days: number[]): number {
  days.sort((left, right) => left - right);
  let clusters = 0;
  let index = 0;
  while (index < days.length) {
    let end = index;
    while (end + 1 < days.length && (days[end + 1] ?? 0) - (days[index] ?? 0) <= 30) end += 1;
    const clustered = end - index + 1 >= 3;
    if (clustered) clusters += 1;
    index = clustered ? end + 1 : index + 1;
  }
  return clusters;
}

/** The platform's repeat-fault clusters and very long faults, from the machine's own rows. */
export function repeatOf(
  list: readonly SourcedReport[],
  threshold: number,
): { clusters: number; long: number } {
  const byCode = new Map<string, number[]>();
  for (const row of list) {
    const code = String(row.report.maintCode ?? '').trim();
    const day = dayNumber(row.report.date);
    if (code === '' || code === '—' || day === null) continue;
    byCode.set(code, [...(byCode.get(code) ?? []), day]);
  }
  let clusters = 0;
  for (const days of byCode.values()) clusters += clustersOf(days);
  return { clusters, long: list.filter((row) => effectiveHours(row.report) > threshold).length };
}

/** The repeat part's printed text, with the platform's plural forms. */
export function repeatDetail(
  repeat: { clusters: number; long: number },
  threshold: number,
): string {
  const clusters = `${repeat.clusters} repeat-fault cluster${repeat.clusters === 1 ? '' : 's'}`;
  return `${clusters}, ${repeat.long} breakdown${repeat.long === 1 ? '' : 's'} over ${threshold} hrs`;
}
