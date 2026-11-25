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
  void rows;
  void hasMore;
  void now;
  throw new Error('not implemented');
}

/** Only the admin exports the CSV; the head reads. */
export function mayExport(role: string | undefined): boolean {
  void role;
  throw new Error('not implemented');
}
