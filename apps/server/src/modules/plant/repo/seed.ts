import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface NewMachine {
  code: string;
  segment: string;
  category: string | null;
  make: string | null;
  model: string | null;
  serial: string | null;
  controller: string | null;
  controllerModel: string | null;
  controllerSerial: string | null;
  year: number | null;
  purchasedOn: string | null;
  powerKw: number | null;
  location: string | null;
  cell: string | null;
  assetCode: string | null;
  capacityKva: number | null;
}

export interface NewListItem {
  list: string;
  code: string;
  label: string;
  active: boolean;
  isVendor?: boolean;
  pausesSla?: boolean;
}

export interface NewShift {
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
  crossesMidnight: boolean;
}

export interface NewGlossaryTerm {
  source: string;
  english: string;
  direction: string;
}

export async function insertSegments(
  tx: Db,
  tenantId: string,
  codes: string[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [index, code] of codes.entries()) {
    const row = (
      await tx.query(
        'INSERT INTO segment (tenant_id, code, name, sort, group_by) VALUES ($1, $2, $2, $3, $4) RETURNING id',
        [tenantId, code, index, code === 'CNC' ? 'letters' : 'category'],
      )
    ).rows[0] as { id: string };
    ids.set(code, row.id);
  }
  return ids;
}

export async function insertMachines(
  tx: Db,
  tenantId: string,
  segmentIds: Map<string, string>,
  machines: NewMachine[],
): Promise<void> {
  for (const m of machines) {
    await tx.query(
      `INSERT INTO machine (tenant_id, code, segment_id, category, make, model, serial, controller, controller_model, controller_serial, year, purchased_on, power_kw, location, cell, asset_code, capacity_kva)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        tenantId,
        m.code,
        segmentIds.get(m.segment),
        m.category,
        m.make,
        m.model,
        m.serial,
        m.controller,
        m.controllerModel,
        m.controllerSerial,
        m.year,
        m.purchasedOn,
        m.powerKw,
        m.location,
        m.cell,
        m.assetCode,
        m.capacityKva,
      ],
    );
  }
}

export async function insertListItems(
  tx: Db,
  tenantId: string,
  lists: NewListItem[],
): Promise<void> {
  for (const item of lists) {
    await tx.query(
      'INSERT INTO list_item (tenant_id, list, code, label, sort, active, is_vendor, pauses_sla) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        tenantId,
        item.list,
        item.code,
        item.label,
        0,
        item.active,
        item.isVendor ?? false,
        item.pausesSla ?? false,
      ],
    );
  }
}

export async function insertShifts(tx: Db, tenantId: string, shifts: NewShift[]): Promise<void> {
  for (const shift of shifts) {
    await tx.query(
      'INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, shift.code, shift.name, shift.startsAt, shift.endsAt, shift.crossesMidnight],
    );
  }
}

export async function insertSettings(
  tx: Db,
  tenantId: string,
  settings: Array<[string, unknown]>,
): Promise<void> {
  for (const [key, value] of settings) {
    await tx.query('INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3)', [
      tenantId,
      key,
      JSON.stringify(value),
    ]);
  }
}

export async function insertGlossaryTerms(
  tx: Db,
  tenantId: string,
  terms: NewGlossaryTerm[],
): Promise<void> {
  for (const term of terms) {
    await tx.query(
      'INSERT INTO glossary_term (tenant_id, source, english, direction) VALUES ($1, $2, $3, $4)',
      [tenantId, term.source, term.english, term.direction],
    );
  }
}
