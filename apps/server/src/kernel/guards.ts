import type { PoolClient } from 'pg';

/** Asks the tickets side whether a machine may be switched off: the reason it may not, or null. */
export type MachineSwitchOffCheck = (
  client: PoolClient,
  tenantId: string,
  machineId: string,
) => Promise<string | null>;

let check: MachineSwitchOffCheck | null = null;

/** The tickets module registers its check once, when the app is built. */
export function setMachineSwitchOffCheck(fn: MachineSwitchOffCheck): void {
  check = fn;
}

/**
 * Why this machine may not be switched off, or null. Fails closed: with no check registered nothing can be
 * switched off, because a machine with an open ticket would then vanish from the board.
 */
export async function machineSwitchOffBlocker(
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<string | null> {
  if (!check) return 'Switching a machine off is not available: the ticket check is not registered';
  return check(client, tenantId, machineId);
}

/** Asks the accountability side whether a person is on the duty roster for the shift running at `at`. */
export type RosterLookup = (
  client: PoolClient,
  tenantId: string,
  personId: string,
  at: Date,
) => Promise<boolean>;

let rosterLookup: RosterLookup | null = null;

/** The accountability module registers its lookup once, when the app is built. */
export function setRosterLookup(fn: RosterLookup): void {
  rosterLookup = fn;
}

/** Whether the person is on duty now. Fails closed: with no lookup registered nobody is on the roster. */
export async function isOnRoster(
  client: PoolClient,
  tenantId: string,
  personId: string,
  at: Date,
): Promise<boolean> {
  return rosterLookup ? rosterLookup(client, tenantId, personId, at) : false;
}
