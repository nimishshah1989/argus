import type { PoolClient } from 'pg';
import type { Tx } from '../mapper.js';

type Minutes = { activeMin?: number | null; waitMin?: number | null };

/** Minutes set directly by a correction: kept on the ticket so every later recompute applies them; null takes one off. */
export function overridesFrom(tx: Tx, current: Record<string, unknown>): Record<string, unknown> {
  if (tx.action !== 'correct') return current;
  const changes = (tx.body.changes ?? {}) as Minutes;
  const next = { ...current };
  for (const [field, key] of [
    ['activeMin', 'handsOnOverrideMin'],
    ['waitMin', 'waitingOverrideMin'],
  ] as const) {
    const value = changes[field];
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  return next;
}

/** The machine details a ticket shows (code, category, cell, criticality), replaced when a correction changes the machine. */
export async function setMachineSnapshot(
  client: PoolClient,
  ticketId: string,
  snapshot: unknown,
): Promise<void> {
  await client.query('UPDATE ticket SET machine_snapshot = $2::jsonb WHERE id = $1', [
    ticketId,
    JSON.stringify(snapshot),
  ]);
}

const OVERRIDE_KEYS = {
  responseMin: 'responseMin',
  handsOnOverrideMin: 'activeMin',
  waitingOverrideMin: 'waitMin',
  downtimeMin: 'downtimeMin',
  repairMin: 'repairMin',
} as const;

/** The figures a ticket's stored overrides set by hand. */
export function overriddenFigures(
  overrides: unknown,
): Array<(typeof OVERRIDE_KEYS)[keyof typeof OVERRIDE_KEYS]> {
  const set = (overrides as Record<string, unknown> | null) ?? {};
  return Object.entries(OVERRIDE_KEYS)
    .filter(([key]) => set[key] !== undefined)
    .map(([, figure]) => figure);
}
