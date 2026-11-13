import type { PoolClient } from 'pg';
import type { Criticality, ListUpsertBody } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;
type Rows = Record<string, unknown>[];

export interface PlantRows {
  lists: Rows;
  segments: Rows;
  groups: Rows;
  machines: Rows;
  shifts: Rows;
  settings: { key: string; value: unknown }[];
}

// Sequential queries: a single pg client cannot run concurrent queries
// ("Calling client.query() when the client is already executing a query").
export async function loadPlantRows(tx: Db): Promise<PlantRows> {
  const lists = await tx.query(
    'SELECT id, list, code, label, label_gu, label_hi, sort, active, is_vendor, pauses_sla, tag FROM list_item ORDER BY list, sort, code',
  );
  const segments = await tx.query(
    'SELECT id, code, name, sort, show_on_board, group_by FROM segment ORDER BY sort, code',
  );
  const groups = await tx.query(
    'SELECT id, segment_id, code, name, sort, hidden FROM machine_group ORDER BY sort, code',
  );
  const machines = await tx.query(
    'SELECT id, code, category, cell, segment_id, group_id, criticality FROM machine ORDER BY code',
  );
  const shifts = await tx.query(
    'SELECT id, code, name, starts_at, ends_at, crosses_midnight FROM shift ORDER BY code',
  );
  const settings = await tx.query('SELECT key, value FROM setting');
  return {
    lists: lists.rows,
    segments: segments.rows,
    groups: groups.rows,
    machines: machines.rows,
    shifts: shifts.rows,
    settings: settings.rows,
  };
}

export async function selectSettings(tx: Db): Promise<Rows> {
  return (await tx.query('SELECT key, value FROM setting ORDER BY key')).rows;
}

export async function upsertSetting(
  tx: Db,
  tenantId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await tx.query(
    'INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
    [tenantId, key, JSON.stringify(value)],
  );
}

export async function selectListItems(tx: Db, list: string): Promise<Rows> {
  return (
    await tx.query(
      'SELECT id, code, label, label_gu, label_hi, sort, active, is_vendor, pauses_sla, tag FROM list_item WHERE list = $1 ORDER BY sort, code',
      [list],
    )
  ).rows;
}

export async function saveListItem(
  tx: Db,
  item: { tenantId: string; list: string; code: string; body: ListUpsertBody },
): Promise<void> {
  const { body } = item;
  await tx.query(
    `INSERT INTO list_item (tenant_id, list, code, label, label_gu, label_hi, sort, active, is_vendor, pauses_sla, tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tenant_id, list, code) DO UPDATE SET
         label = EXCLUDED.label, label_gu = EXCLUDED.label_gu, label_hi = EXCLUDED.label_hi,
         sort = EXCLUDED.sort, active = EXCLUDED.active, is_vendor = EXCLUDED.is_vendor,
         pauses_sla = EXCLUDED.pauses_sla, tag = EXCLUDED.tag, updated_at = now()`,
    [
      item.tenantId,
      item.list,
      item.code,
      body.label,
      body.labelGu ?? null,
      body.labelHi ?? null,
      body.sort ?? 0,
      body.active ?? true,
      body.isVendor ?? false,
      body.pausesSla ?? false,
      body.tag ?? null,
    ],
  );
}

export async function removeListItem(tx: Db, id: string): Promise<void> {
  await tx.query('DELETE FROM list_item WHERE id = $1', [id]);
}

export async function selectMissingTranslations(tx: Db): Promise<Rows> {
  return (
    await tx.query(
      "SELECT id, list, code, label, label_gu, label_hi FROM list_item WHERE label_gu IS NULL OR label_gu = '' ORDER BY list, code",
    )
  ).rows;
}

export async function updateTranslation(
  tx: Db,
  id: string,
  labelGu: string | null,
  labelHi: string | null,
): Promise<void> {
  await tx.query(
    'UPDATE list_item SET label_gu = COALESCE($2, label_gu), label_hi = COALESCE($3, label_hi), updated_at = now() WHERE id = $1',
    [id, labelGu, labelHi],
  );
}

export async function setMachineCriticality(
  tx: Db,
  id: string,
  criticality: Criticality | null,
): Promise<number> {
  const machine = await tx.query(
    'UPDATE machine SET criticality = $2, updated_at = now() WHERE id = $1 RETURNING id',
    [id, criticality],
  );
  return machine.rowCount ?? 0;
}

export async function hasShifts(tx: Db): Promise<boolean> {
  return ((await tx.query('SELECT 1 FROM shift LIMIT 1')).rowCount ?? 0) > 0;
}

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
