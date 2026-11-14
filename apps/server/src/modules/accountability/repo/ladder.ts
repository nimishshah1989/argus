import type { PoolClient } from 'pg';
import type { EscalationRuleDefault } from '@uptimo/domain';

type Db = Pick<PoolClient, 'query'>;

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
       (tenant_id, trigger, severity_min, level, notify_role, channel, delay_minutes, repeat_minutes, repeat_cap)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
