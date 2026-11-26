import type { GroupReply, MachineReply, ShiftReply } from '@uptimo/shared/plant-settings';

/** Counts over active machines: no criticality set, and not counted in production data. */
export type MachinesTakeaway = { total: number; unset: number; excluded: number };
/** The group holding the most active machines, out of every active machine. */
export type GroupsTakeaway = { groupId: string; n: number; total: number; hidden: boolean };
/** Active shifts and their hours a day; `productionHours` is the profile's number, passed through. */
export type ShiftsTakeaway = { count: number; totalHours: number; productionHours: number | null };

/** Hours from `startsAt` to `endsAt` ("HH:MM"), wrapping past midnight; equal times are a full day. */
export function shiftHours(startsAt: string, endsAt: string): number {
  const minutes = (hhmm: string) => {
    const [h = 0, m = 0] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const span = minutes(endsAt) - minutes(startsAt);
  return (span > 0 ? span : span + 24 * 60) / 60;
}

/** Null when there is no active machine. */
export function machinesTakeaway(rows: readonly MachineReply[]): MachinesTakeaway | null {
  const live = rows.filter((m) => m.active);
  if (live.length === 0) return null;
  return {
    total: live.length,
    unset: live.filter((m) => m.criticality === null).length,
    excluded: live.filter((m) => m.excludedFromProduction).length,
  };
}

/** Null when no active machine sits in an active group; a tie goes to the group listed first. */
export function groupsTakeaway(
  groups: readonly GroupReply[],
  machines: readonly MachineReply[],
): GroupsTakeaway | null {
  const live = machines.filter((m) => m.active);
  let best: GroupsTakeaway | null = null;
  for (const g of groups) {
    if (!g.active) continue;
    const n = live.filter((m) => m.groupId === g.id).length;
    if (n > 0 && (!best || n > best.n))
      best = { groupId: g.id, n, total: live.length, hidden: g.hidden };
  }
  return best;
}

/** Null when there is no active shift. */
export function shiftsTakeaway(
  shifts: readonly ShiftReply[],
  productionHours: number | null,
): ShiftsTakeaway | null {
  const live = shifts.filter((s) => s.active);
  if (live.length === 0) return null;
  const totalHours = live.reduce((sum, s) => sum + shiftHours(s.startsAt, s.endsAt), 0);
  return { count: live.length, totalHours, productionHours };
}
