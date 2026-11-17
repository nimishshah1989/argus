import type { PoolClient } from 'pg';
import type { EscalationRuleDefault } from '@uptimo/domain';
import type { Store } from '../../plant/index.js';

type Db = Pick<PoolClient, 'query'>;

/** Two first readers of one plant's ladder take turns: the second then finds the rules the first wrote. */
export async function lockLadderSeed(tx: Db, tenantId: string): Promise<void> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`escalation-seed:${tenantId}`]);
}

/** Whether the plant has any rule at all (a switched-off one still counts: the head's own choice stands). */
export async function hasEscalationRules(tx: Db): Promise<boolean> {
  return ((await tx.query('SELECT 1 FROM escalation_rule LIMIT 1')).rowCount ?? 0) > 0;
}

/** One starting rule; a rule that is already there (two first reads at once) is left alone. */
export async function insertEscalationDefault(
  tx: Db,
  tenantId: string,
  rule: EscalationRuleDefault,
): Promise<void> {
  await tx.query(
    `INSERT INTO escalation_rule
       (tenant_id, trigger, severity_min, level, notify_role, channel, delay_minutes, repeat_minutes, repeat_cap, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT DO NOTHING`,
    [
      tenantId,
      rule.trigger,
      rule.severityMin,
      rule.level,
      rule.notifyRole,
      rule.channel,
      rule.delayMinutes,
      rule.repeatMinutes,
      rule.repeatCap,
      rule.active ?? true,
    ],
  );
}

/** Deletes the plant's roster lines dated before `day` (YYYY-MM-DD); how many went. */
export async function deleteRosterBefore(tx: Db, tenantId: string, day: string): Promise<number> {
  const { rowCount } = await tx.query(
    'DELETE FROM roster_entry WHERE tenant_id = $1 AND date < $2::date',
    [tenantId, day],
  );
  return rowCount ?? 0;
}

/**
 * Copies every line dated `input.date` onto each of the next `input.days` dates, with the same shift, person
 * and level. A line that is already there is left alone; nothing is ever deleted.
 */
export async function copyRoster(
  tx: Db,
  tenantId: string,
  input: { date: string; days: number },
): Promise<{ created: number; skipped: number }> {
  const { rows } = await tx.query(
    `WITH source AS (
       SELECT shift_id, person_id, level FROM roster_entry
       WHERE tenant_id = $1 AND date = $2::date
     ), moved AS (
       INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
       SELECT $1, ($2::date + day)::date, source.shift_id, source.person_id, source.level
       FROM source CROSS JOIN generate_series(1, $3::int) AS day
       ON CONFLICT (tenant_id, date, shift_id, person_id) DO NOTHING
       RETURNING id
     )
     SELECT (SELECT count(*) FROM source)::int AS lines, (SELECT count(*) FROM moved)::int AS created`,
    [tenantId, input.date, input.days],
  );
  const created = rows[0].created as number;
  return { created, skipped: (rows[0].lines as number) * input.days - created };
}

type OwnTable = 'roster_entry' | 'escalation_rule';

/** How the generic settings routes read and write one of this module's tables: the statements live here. */
function ownStore(table: OwnTable, all: Store['all']): Store {
  return {
    all,
    one: async (tx, id) =>
      (await tx.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [id])).rows[0],
    insert: async (tx, tenantId, values) => {
      const columns = ['tenant_id', ...Object.keys(values)];
      const marks = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${marks}) RETURNING *`;
      return (await tx.query(sql, [tenantId, ...Object.values(values)])).rows[0];
    },
    update: async (tx, id, values) => {
      const sets = Object.keys(values).map((column, i) => `${column} = $${i + 2}`);
      const sql = `UPDATE ${table} SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1 RETURNING *`;
      return (await tx.query(sql, [id, ...Object.values(values)])).rows[0];
    },
  };
}

/** The roster lines dated from `filter.from` to `filter.to` (plant dates, both ends included), newest first. */
export const rosterStore: Store = {
  ...ownStore(
    'roster_entry',
    async (tx, filter = {}) =>
      (
        await tx.query(
          `SELECT * FROM roster_entry WHERE date BETWEEN $1::date AND $2::date
          ORDER BY date DESC, shift_id, level, person_id`,
          [filter.from, filter.to],
        )
      ).rows,
  ),
  remove: async (tx, id) => {
    await tx.query('DELETE FROM roster_entry WHERE id = $1', [id]);
  },
};

export const ruleStore: Store = ownStore(
  'escalation_rule',
  async (tx) =>
    (
      await tx.query(
        'SELECT * FROM escalation_rule ORDER BY trigger, severity_min, level, notify_role NULLS LAST, id',
      )
    ).rows,
);
