import type { AuditRow } from '@uptimo/shared/audit';

/** The last 7 days of changes: how many, the area (`entity`) with most of them, and who made most in that area. */
export type AuditTakeaway = { count: number; area: string; areaCount: number; by: string | null };

export const AUDIT_WINDOW_DAYS = 7;

/**
 * Null when no row is inside the window, or when more pages exist (`hasMore`) and the oldest loaded row is still
 * inside it: never a partial count. Ties (area, then person) go to the one with the newest row.
 */
export function auditTakeaway(
  rows: readonly AuditRow[],
  hasMore: boolean,
  now: Date,
): AuditTakeaway | null {
  const since = now.getTime() - AUDIT_WINDOW_DAYS * 86_400_000;
  const time = (row: AuditRow) => Date.parse(row.at);
  if (hasMore && rows.length > 0 && Math.min(...rows.map(time)) >= since) return null;
  const inside = rows.filter((row) => time(row) >= since && time(row) <= now.getTime());
  const area = top(inside, (row) => row.entity, time);
  if (!area) return null;
  const mine = inside.filter((row) => row.entity === area.key && row.actor);
  const by = top(mine, (row) => row.actor!.name, time)?.key ?? null;
  return { count: inside.length, area: area.key, areaCount: area.count, by };
}

/** The key with most rows; a tie goes to the key with the newest row. */
function top(
  rows: readonly AuditRow[],
  keyOf: (row: AuditRow) => string,
  time: (row: AuditRow) => number,
) {
  const tally = new Map<string, { count: number; newest: number }>();
  for (const row of rows) {
    const seen = tally.get(keyOf(row)) ?? { count: 0, newest: -Infinity };
    tally.set(keyOf(row), { count: seen.count + 1, newest: Math.max(seen.newest, time(row)) });
  }
  const [key, found] =
    [...tally].sort(([, a], [, b]) => b.count - a.count || b.newest - a.newest)[0] ?? [];
  return key === undefined || !found ? null : { key, count: found.count };
}

/** Only the admin exports the CSV; the head reads. */
export function mayExport(role: string | undefined): boolean {
  return role === 'admin';
}
