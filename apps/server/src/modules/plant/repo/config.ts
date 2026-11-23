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
    'SELECT id, code, name, sort, show_on_board, group_by FROM segment WHERE active ORDER BY sort, code',
  );
  const groups = await tx.query(
    'SELECT id, segment_id, code, name, sort, hidden FROM machine_group ORDER BY sort, code',
  );
  const machines = await tx.query(
    "SELECT id, code, category, cell, segment_id, group_id, criticality FROM machine WHERE status <> 'scrapped' ORDER BY code",
  );
  const shifts = await tx.query(
    'SELECT id, code, name, starts_at, ends_at, crosses_midnight FROM shift WHERE active ORDER BY code',
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

/**
 * The generic settings list: the plant's switches and numbers. Team Focus and nudge state is one row per item
 * (`focus:` and `nudge:`) and is read by its own screens, never here: leaking an item row into the list would
 * show hundreds of settings rows a head cannot edit.
 */
export async function selectSettings(tx: Db): Promise<Rows> {
  return (
    await tx.query("SELECT key, value FROM setting WHERE key !~ '^(focus|nudge):' ORDER BY key")
  ).rows;
}

/** One stored `setting` row by key, with its id (the write's audit names the row it changed). */
export interface StoredSetting {
  id: string;
  key: string;
  value: unknown;
}

/** The Action Center's stored acknowledgements, one row per nudge key, in a stable order. */
export async function selectNudgeAcks(tx: Db): Promise<StoredSetting[]> {
  return (
    await tx.query("SELECT id, key, value FROM setting WHERE key LIKE 'nudge:%' ORDER BY key")
  ).rows;
}

/**
 * The Team Focus notes of one focus month (ADR 0018): every row whose key starts with `focus:<period>|`, ordered by
 * key. The period is a validated `YYYY-MM`; bind the pattern, never build it into the SQL text.
 */
export async function selectFocusNotes(tx: Db, period: string): Promise<StoredSetting[]> {
  return (
    await tx.query('SELECT id, key, value FROM setting WHERE key LIKE $1 ORDER BY key', [
      `focus:${period}|%`,
    ])
  ).rows;
}

/** One nudge's stored acknowledgement, or undefined when the nudge was never acted on. */
export async function selectNudgeAck(tx: Db, key: string): Promise<StoredSetting | undefined> {
  return (await tx.query('SELECT id, key, value FROM setting WHERE key = $1', [key])).rows[0];
}

/**
 * Writes one nudge's acknowledgement. The table's `(tenant_id, key)` uniqueness is the one row per nudge: a second
 * head's write replaces the value and keeps the row (and its id), so the audit trail reads one row's history.
 */
export async function saveNudgeAck(
  tx: Db,
  input: { tenantId: string; key: string; value: unknown },
): Promise<StoredSetting> {
  return (
    await tx.query(
      `INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
       RETURNING id, key, value`,
      [input.tenantId, input.key, JSON.stringify(input.value)],
    )
  ).rows[0];
}

/** Reopen: the row goes, and with it the ack; stale keys are not deleted by anything else. */
export async function removeNudgeAck(tx: Db, key: string): Promise<StoredSetting | undefined> {
  return (await tx.query('DELETE FROM setting WHERE key = $1 RETURNING id, key, value', [key]))
    .rows[0];
}

/** The stored value of one setting; undefined when the plant never set it. */
export async function selectSetting(tx: Db, key: string): Promise<unknown> {
  return (await tx.query('SELECT value FROM setting WHERE key = $1', [key])).rows[0]?.value;
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

/** Switches a list entry off; the row, its labels and every history reference stay. */
export async function deactivateListItem(tx: Db, id: string): Promise<void> {
  await tx.query('UPDATE list_item SET active = false, updated_at = now() WHERE id = $1', [id]);
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

/** Sets a machine's importance; returns the value it had, or null when this plant has no such machine. */
export async function setMachineCriticality(
  tx: Db,
  id: string,
  criticality: Criticality | null,
): Promise<{ before: Criticality | null } | null> {
  const row = (
    await tx.query(
      `UPDATE machine m SET criticality = $2, updated_at = now()
         FROM (SELECT id, criticality FROM machine WHERE id = $1 FOR UPDATE) old
        WHERE m.id = old.id RETURNING old.criticality AS before`,
      [id, criticality],
    )
  ).rows[0];
  return row ? { before: row.before } : null;
}

export async function hasShifts(tx: Db): Promise<boolean> {
  return ((await tx.query('SELECT 1 FROM shift LIMIT 1')).rowCount ?? 0) > 0;
}
