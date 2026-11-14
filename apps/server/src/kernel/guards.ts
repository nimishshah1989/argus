import type { PoolClient } from 'pg';

/** A module's veto over switching a machine off: returns the reason, or null when it has no objection. */
export interface MachineGuard {
  readonly name: string;
  switchOffBlocker(client: PoolClient, tenantId: string, machineId: string): Promise<string | null>;
}

// Module-global like the reply parts; contributing a name again replaces it.
const machineGuards = new Map<string, MachineGuard>();

export function contributeMachineGuard(guard: MachineGuard): void {
  machineGuards.set(guard.name, guard);
}

/** The first reason a module gives against switching this machine off, or null. */
export async function machineSwitchOffBlocker(
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<string | null> {
  for (const guard of machineGuards.values()) {
    const reason = await guard.switchOffBlocker(client, tenantId, machineId);
    if (reason) return reason;
  }
  return null;
}
