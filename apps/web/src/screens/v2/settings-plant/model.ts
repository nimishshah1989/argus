import type { GroupReply, MachineReply, ShiftReply } from '@uptimo/shared/plant-settings';

/** Counts over active machines: no criticality set, and not counted in production data. */
export type MachinesTakeaway = { total: number; unset: number; excluded: number };
/** The group holding the most active machines, out of every active machine. */
export type GroupsTakeaway = { groupId: string; n: number; total: number; hidden: boolean };
/** Active shifts and their hours a day; `productionHours` is the profile's number, passed through. */
export type ShiftsTakeaway = { count: number; totalHours: number; productionHours: number | null };

/** Hours from `startsAt` to `endsAt` ("HH:MM"), wrapping past midnight. */
export function shiftHours(startsAt: string, endsAt: string): number {
  void startsAt;
  void endsAt;
  throw new Error('not implemented');
}

/** Null when there is no active machine. */
export function machinesTakeaway(rows: readonly MachineReply[]): MachinesTakeaway | null {
  void rows;
  throw new Error('not implemented');
}

/** Null when no active machine sits in an active group; a tie goes to the group listed first. */
export function groupsTakeaway(
  groups: readonly GroupReply[],
  machines: readonly MachineReply[],
): GroupsTakeaway | null {
  void groups;
  void machines;
  throw new Error('not implemented');
}

/** Null when there is no active shift. */
export function shiftsTakeaway(
  shifts: readonly ShiftReply[],
  productionHours: number | null,
): ShiftsTakeaway | null {
  void shifts;
  void productionHours;
  throw new Error('not implemented');
}
