import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;
export type Row = Record<string, unknown>;

/** The four tables the plant-settings routes write. Names here are ours, never a caller's. */
export type SettingsTable =
  'machine' | 'segment' | 'machine_group' | 'shift' | 'list_item' | 'glossary_term';

/** One table holding several lists: a resource reads and writes only the rows with this column value. */
export interface Scope {
  column: string;
  value: string;
}

export async function selectAll(
  tx: Db,
  table: SettingsTable,
  order: string,
  scope?: Scope,
): Promise<Row[]> {
  const where = scope ? `WHERE ${scope.column} = $1` : '';
  return (
    await tx.query(`SELECT * FROM ${table} ${where} ORDER BY ${order}`, scope ? [scope.value] : [])
  ).rows;
}

/** One row of this plant (the tenant policy hides every other plant's), locked for the edit. */
export async function selectOne(
  tx: Db,
  table: SettingsTable,
  id: string,
  scope?: Scope,
): Promise<Row | undefined> {
  const where = scope ? `AND ${scope.column} = $2` : '';
  const params = scope ? [id, scope.value] : [id];
  return (await tx.query(`SELECT * FROM ${table} WHERE id = $1 ${where} FOR UPDATE`, params))
    .rows[0];
}

export async function exists(tx: Db, table: SettingsTable, id: string): Promise<boolean> {
  return ((await tx.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id])).rowCount ?? 0) > 0;
}

/** Whether any machine of the segment is still in service (a segment with one cannot be switched off). */
export async function segmentHasLiveMachines(tx: Db, segmentId: string): Promise<boolean> {
  return (
    ((
      await tx.query(
        "SELECT 1 FROM machine WHERE segment_id = $1 AND status <> 'scrapped' LIMIT 1",
        [segmentId],
      )
    ).rowCount ?? 0) > 0
  );
}

/** Whether the segment is switched on (an unknown id counts as on: unknown ids are refused elsewhere). */
export async function segmentIsOn(tx: Db, segmentId: string): Promise<boolean> {
  const row = (await tx.query('SELECT active FROM segment WHERE id = $1', [segmentId])).rows[0];
  return row ? row.active === true : true;
}

/** Whether any shift other than this one is still switched on (a plant always keeps one). */
export async function hasOtherActiveShift(tx: Db, shiftId: string): Promise<boolean> {
  return (
    ((await tx.query('SELECT 1 FROM shift WHERE active AND id <> $1 LIMIT 1', [shiftId]))
      .rowCount ?? 0) > 0
  );
}

export async function insertRow(
  tx: Db,
  table: SettingsTable,
  tenantId: string,
  values: Record<string, unknown>,
): Promise<Row> {
  const columns = ['tenant_id', ...Object.keys(values)];
  const marks = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${marks}) RETURNING *`;
  return (await tx.query(sql, [tenantId, ...Object.values(values)])).rows[0];
}

export async function updateRow(
  tx: Db,
  table: SettingsTable,
  id: string,
  values: Record<string, unknown>,
): Promise<Row> {
  const sets = Object.keys(values).map((column, i) => `${column} = $${i + 2}`);
  const sql = `UPDATE ${table} SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1 RETURNING *`;
  return (await tx.query(sql, [id, ...Object.values(values)])).rows[0];
}

/** The segment a group belongs to; undefined when this plant has no such group. */
export async function groupSegment(tx: Db, id: string): Promise<string | undefined> {
  const row = (await tx.query('SELECT segment_id FROM machine_group WHERE id = $1', [id])).rows[0];
  return row?.segment_id as string | undefined;
}

export interface NewMove {
  tenantId: string;
  machineId: string;
  fromCell: string | null;
  toCell: string | null;
  effectiveFrom: string;
}

export async function insertMove(tx: Db, move: NewMove): Promise<void> {
  await tx.query(
    'INSERT INTO machine_move (tenant_id, machine_id, from_cell, to_cell, effective_from) VALUES ($1, $2, $3, $4, $5)',
    [move.tenantId, move.machineId, move.fromCell, move.toCell, move.effectiveFrom],
  );
}

/** The date of the machine's newest cell move, or undefined when it has never moved. */
export async function latestMoveDate(tx: Db, machineId: string): Promise<string | undefined> {
  const row = (
    await tx.query(
      'SELECT effective_from::text AS day FROM machine_move WHERE machine_id = $1 ORDER BY effective_from DESC LIMIT 1',
      [machineId],
    )
  ).rows[0];
  return row?.day as string | undefined;
}

/** A machine's cell moves, newest first. */
export async function selectMoves(tx: Db, machineId: string): Promise<Row[]> {
  return (
    await tx.query(
      `SELECT id, machine_id, from_cell, to_cell, effective_from::text AS effective_from
         FROM machine_move WHERE machine_id = $1 ORDER BY effective_from DESC, created_at DESC, id`,
      [machineId],
    )
  ).rows;
}
