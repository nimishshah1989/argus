import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export type AssetKind = 'amc' | 'warranty' | 'legal' | 'calibration';

export interface PmPlanDraftInput {
  machineId?: string | null;
  category?: string | null;
  title: string;
  intervalDays?: number | null;
  meterInterval?: number | null;
  meterTolerance?: number | null;
  lastMeterReading?: number | null;
  /** The plant's day, `YYYY-MM-DD`; a calendar date, never an instant. */
  lastDoneOn?: string | null;
  checklist?: readonly unknown[];
  active?: boolean;
}

export interface PmPlan {
  id: string;
  machineId: string | null;
  category: string | null;
  title: string;
  intervalDays: number | null;
  meterInterval: number | null;
  meterTolerance: number | null;
  lastMeterReading: number | null;
  lastDoneOn: string | null;
  checklist: unknown[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetRegisterInput {
  kind: AssetKind;
  machineId?: string | null;
  vendor?: string | null;
  reference?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  dueOn?: string | null;
  leadDays?: number;
  ownerPersonId?: string | null;
  notes?: string | null;
}

export interface AssetRegisterRow {
  id: string;
  kind: AssetKind;
  machineId: string | null;
  vendor: string | null;
  reference: string | null;
  startsOn: string | null;
  endsOn: string | null;
  dueOn: string | null;
  leadDays: number;
  ownerPersonId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PM_PLAN_COLUMNS = `id, machine_id, category, title, interval_days,
  meter_interval::float8 AS meter_interval, meter_tolerance::float8 AS meter_tolerance,
  last_meter_reading::float8 AS last_meter_reading, last_done_on::text AS last_done_on,
  checklist, active, created_at, updated_at`;

const ASSET_COLUMNS = `id, kind, machine_id, vendor, reference, starts_on::text AS starts_on,
  ends_on::text AS ends_on, due_on::text AS due_on, lead_days, owner_person_id, notes,
  created_at, updated_at`;

function pmPlanRow(row: Record<string, unknown>): PmPlan {
  return {
    id: row.id as string,
    machineId: (row.machine_id as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    title: row.title as string,
    intervalDays: (row.interval_days as number | null) ?? null,
    meterInterval: (row.meter_interval as number | null) ?? null,
    meterTolerance: (row.meter_tolerance as number | null) ?? null,
    lastMeterReading: (row.last_meter_reading as number | null) ?? null,
    lastDoneOn: (row.last_done_on as string | null) ?? null,
    checklist: (row.checklist as unknown[] | null) ?? [],
    active: row.active === true,
    createdAt: new Date(row.created_at as string | number | Date),
    updatedAt: new Date(row.updated_at as string | number | Date),
  };
}

function assetRow(row: Record<string, unknown>): AssetRegisterRow {
  return {
    id: row.id as string,
    kind: row.kind as AssetKind,
    machineId: (row.machine_id as string | null) ?? null,
    vendor: (row.vendor as string | null) ?? null,
    reference: (row.reference as string | null) ?? null,
    startsOn: (row.starts_on as string | null) ?? null,
    endsOn: (row.ends_on as string | null) ?? null,
    dueOn: (row.due_on as string | null) ?? null,
    leadDays: row.lead_days as number,
    ownerPersonId: (row.owner_person_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: new Date(row.created_at as string | number | Date),
    updatedAt: new Date(row.updated_at as string | number | Date),
  };
}

/** One PM plan draft (D17: the checklist is a list on the row; the job it produces is a ticket with channel `pm`). */
export async function insertPmPlan(
  tx: Db,
  tenantId: string,
  draft: PmPlanDraftInput,
): Promise<PmPlan> {
  const row = (
    await tx.query(
      `INSERT INTO pm_plan (tenant_id, machine_id, category, title, interval_days, meter_interval,
         meter_tolerance, last_meter_reading, last_done_on, checklist, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${PM_PLAN_COLUMNS}`,
      [
        tenantId,
        draft.machineId ?? null,
        draft.category ?? null,
        draft.title,
        draft.intervalDays ?? null,
        draft.meterInterval ?? null,
        draft.meterTolerance ?? null,
        draft.lastMeterReading ?? null,
        draft.lastDoneOn ?? null,
        JSON.stringify(draft.checklist ?? []),
        draft.active ?? true,
      ],
    )
  ).rows[0];
  return pmPlanRow(row as Record<string, unknown>);
}

export async function pmPlanById(tx: Db, tenantId: string, id: string): Promise<PmPlan | null> {
  const row = (
    await tx.query(`SELECT ${PM_PLAN_COLUMNS} FROM pm_plan WHERE tenant_id = $1 AND id = $2`, [
      tenantId,
      id,
    ])
  ).rows[0];
  return row ? pmPlanRow(row as Record<string, unknown>) : null;
}

/** One AMC, warranty, legal or calibration row of the plant's register. */
export async function insertAssetRegister(
  tx: Db,
  tenantId: string,
  asset: AssetRegisterInput,
): Promise<AssetRegisterRow> {
  const row = (
    await tx.query(
      `INSERT INTO asset_register (tenant_id, kind, machine_id, vendor, reference, starts_on,
         ends_on, due_on, lead_days, owner_person_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${ASSET_COLUMNS}`,
      [
        tenantId,
        asset.kind,
        asset.machineId ?? null,
        asset.vendor ?? null,
        asset.reference ?? null,
        asset.startsOn ?? null,
        asset.endsOn ?? null,
        asset.dueOn ?? null,
        asset.leadDays ?? 0,
        asset.ownerPersonId ?? null,
        asset.notes ?? null,
      ],
    )
  ).rows[0];
  return assetRow(row as Record<string, unknown>);
}

export async function assetRegisterById(
  tx: Db,
  tenantId: string,
  id: string,
): Promise<AssetRegisterRow | null> {
  const row = (
    await tx.query(`SELECT ${ASSET_COLUMNS} FROM asset_register WHERE tenant_id = $1 AND id = $2`, [
      tenantId,
      id,
    ])
  ).rows[0];
  return row ? assetRow(row as Record<string, unknown>) : null;
}
