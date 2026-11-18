import type { PoolClient } from 'pg';
import { assetRegisterCreateSchema, assetRegisterPatchSchema } from '@uptimo/shared';
import { activePerson } from '../identity/index.js';
import { registerStore } from './repo/asset-registers.js';
import { exists } from './repo/plant-settings.js';
import type { Problem, Resource } from './settings-resources.js';

/**
 * The generated `/settings/registers` resource (ticket 51a, R6): one row per AMC, warranty, statutory test or
 * calibration. `active: true` is the reply's switch with no column behind it; `active: false` is the generic
 * remove path (R7), so this resource has no `switchTo`. R12 reads the type/test/not-renewing text back from `notes`.
 */

type Reply = Record<string, unknown>;

/** A stored date column may arrive as text (`starts_on::text`) or a local-midnight Date; either way the day is it. */
const dayOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

function registerReply(row: Record<string, unknown>): Reply {
  return {
    id: row.id,
    kind: row.kind,
    machineId: row.machine_id ?? null,
    vendor: row.vendor ?? null,
    reference: row.reference ?? null,
    startsOn: dayOrNull(row.starts_on),
    endsOn: dayOrNull(row.ends_on),
    dueOn: dayOrNull(row.due_on),
    leadDays: Number(row.lead_days ?? 0),
    ownerPersonId: row.owner_person_id ?? null,
    notes: row.notes ?? null,
    // A listed row is on; the generic remove answers `{...before, active:false}` with no column behind it (R7).
    active: true,
  };
}

/** A machine of this plant (RLS hides every other plant's, so a foreign id is the same 422 as an unknown one). */
async function machineProblem(tx: PoolClient, machineId: string | null): Promise<Problem | null> {
  if (!machineId || (await exists(tx, 'machine', machineId))) return null;
  return { field: 'machineId', message: 'Unknown machine' };
}

/** The owner is the only recipient of the notice (R9), and only while the person is active. */
async function ownerProblem(
  tx: PoolClient,
  tenantId: string,
  ownerPersonId: string | null,
): Promise<Problem | null> {
  if (!ownerPersonId || (await activePerson(tx, tenantId, ownerPersonId))) return null;
  return { field: 'ownerPersonId', message: 'Choose an active person of this plant' };
}

/** The dates are the whole reminder: an end before its start cannot be stored (0015's CHECK says the same). */
function datesProblem(register: Reply): Problem | null {
  const startsOn = register.startsOn as string | null | undefined;
  const endsOn = register.endsOn as string | null | undefined;
  if (!startsOn || !endsOn || endsOn >= startsOn) return null;
  return { field: 'endsOn', message: 'The end date cannot be before the start date' };
}

async function checkRegister(
  tx: PoolClient,
  register: Reply,
  _edit: unknown,
  tenantId: string,
): Promise<Problem | null> {
  return (
    datesProblem(register) ??
    (await machineProblem(tx, (register.machineId as string | null | undefined) ?? null)) ??
    (await ownerProblem(
      tx,
      tenantId,
      (register.ownerPersonId as string | null | undefined) ?? null,
    ))
  );
}

export const registers: Resource = {
  path: 'settings/registers',
  table: 'asset_register',
  store: registerStore,
  kind: 'register',
  order: 'kind',
  columns: {
    kind: 'kind',
    machineId: 'machine_id',
    vendor: 'vendor',
    reference: 'reference',
    startsOn: 'starts_on',
    endsOn: 'ends_on',
    dueOn: 'due_on',
    leadDays: 'lead_days',
    ownerPersonId: 'owner_person_id',
    notes: 'notes',
  },
  create: assetRegisterCreateSchema,
  patch: assetRegisterPatchSchema,
  reply: registerReply,
  check: checkRegister,
};
