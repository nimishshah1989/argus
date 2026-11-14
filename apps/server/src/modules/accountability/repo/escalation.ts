import type { PoolClient } from 'pg';
import type { EscalationLevel, EscalationTrigger } from '@uptimo/domain';
import type { SlaTimerKind } from './timers.js';

type Db = Pick<PoolClient, 'query'>;

export interface RuleRow {
  id: string;
  trigger: EscalationTrigger;
  severity_min: string;
  level: EscalationLevel;
  notify_person_id: string | null;
  notify_role: string | null;
  channel: 'push' | 'whatsapp';
  delay_minutes: number;
  repeat_minutes: number | null;
  repeat_cap: number | null;
  active: boolean;
}

/** The plant's switched-on rules for one trigger (row security keeps every other plant's out). */
export async function activeRulesFor(tx: Db, trigger: EscalationTrigger): Promise<RuleRow[]> {
  return (
    await tx.query<RuleRow>(
      'SELECT * FROM escalation_rule WHERE trigger = $1 AND active ORDER BY level, id',
      [trigger],
    )
  ).rows;
}

export async function ruleById(tx: Db, id: string): Promise<RuleRow | undefined> {
  return (await tx.query<RuleRow>('SELECT * FROM escalation_rule WHERE id = $1', [id])).rows[0];
}

/** Everyone with a roster line at this level for this shift on this plant date. */
export async function rosterPersonIds(
  tx: Db,
  tenantId: string,
  line: { date: string; shiftId: string; level: EscalationLevel },
): Promise<string[]> {
  const { rows } = await tx.query(
    `SELECT person_id FROM roster_entry
      WHERE tenant_id = $1 AND date = $2::date AND shift_id = $3 AND level = $4 ORDER BY person_id`,
    [tenantId, line.date, line.shiftId, line.level],
  );
  return rows.map((row) => row.person_id as string);
}

/** The state of this episode of the clock (`null` when another episode, or none, is the current one). */
export async function clockStateAt(
  tx: Db,
  tenantId: string,
  ticketId: string,
  clock: { kind: SlaTimerKind; firedAt: Date },
): Promise<'running' | 'paused' | 'stopped' | null> {
  const { rows } = await tx.query(
    `SELECT state FROM sla_timer
      WHERE tenant_id = $1 AND ticket_id = $2 AND kind = $3 AND fired_at = $4`,
    [tenantId, ticketId, clock.kind, clock.firedAt],
  );
  return rows[0]?.state ?? null;
}
