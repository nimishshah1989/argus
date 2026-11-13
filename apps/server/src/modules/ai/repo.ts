import type { PoolClient } from 'pg';
import type { AiFeatureName, AiRowOutcome } from '@uptimo/shared';
import type { AiUsage } from './provider.js';
import type { AiJson } from './redact.js';

type Db = Pick<PoolClient, 'query'>;

export interface NewSuggestion {
  tenantId: string;
  feature: AiFeatureName;
  subjectType: 'ticket';
  subjectId: string;
  ticketId: string | null;
  promptVersion: string;
  modelRef: string;
  now: Date;
}

/**
 * One statement. No row back means another job holds a live claim or the row is settled
 * (`duplicate`). A `running` row older than the 90 s lease (30 s call timeout plus margin) is
 * re-claimed: its process died mid-call.
 */
export async function claimSuggestion(
  tx: Db,
  row: NewSuggestion,
): Promise<{ id: string; attempts: number } | null> {
  const result = await tx.query(
    `INSERT INTO ai_suggestion (tenant_id, feature, subject_type, subject_id, ticket_id,
       prompt_version, model_ref, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'running', $8, $8)
     ON CONFLICT (tenant_id, subject_type, subject_id, feature, prompt_version) DO UPDATE
       SET status = 'running', updated_at = EXCLUDED.updated_at
       WHERE ai_suggestion.status = 'retry_wait'
          OR (ai_suggestion.status = 'running'
              AND ai_suggestion.updated_at < EXCLUDED.updated_at - interval '90 seconds')
     RETURNING id, attempts`,
    [
      row.tenantId,
      row.feature,
      row.subjectType,
      row.subjectId,
      row.ticketId,
      row.promptVersion,
      row.modelRef,
      row.now,
    ],
  );
  const claimed = result.rows[0];
  return claimed ? { id: claimed.id, attempts: Number(claimed.attempts) } : null;
}

/** Raised before the call, so a process that dies mid-call still counts the try. */
export async function markAttempt(
  tx: Db,
  tenantId: string,
  id: string,
  now: Date,
): Promise<number> {
  const result = await tx.query(
    `UPDATE ai_suggestion SET attempts = attempts + 1, updated_at = $3
     WHERE tenant_id = $1 AND id = $2 RETURNING attempts`,
    [tenantId, id, now],
  );
  return Number(result.rows[0].attempts);
}

export interface Settlement {
  status: 'ready' | 'retry_wait' | 'failed';
  outcome: AiRowOutcome;
  output: AiJson | null;
  usage: AiUsage;
  costMicroUsd: number;
  now: Date;
}

/** Usage and cost are added to the row's totals, so tokens of failed tries still count. */
export async function settleSuggestion(
  tx: Db,
  tenantId: string,
  id: string,
  s: Settlement,
): Promise<void> {
  await tx.query(
    `UPDATE ai_suggestion
     SET status = $3, outcome = $4, output = $5::jsonb,
         input_tokens = input_tokens + $6, output_tokens = output_tokens + $7,
         cost_micro_usd = cost_micro_usd + $8, updated_at = $9
     WHERE tenant_id = $1 AND id = $2`,
    [
      tenantId,
      id,
      s.status,
      s.outcome,
      s.output === null ? null : JSON.stringify(s.output),
      s.usage.inputTokens,
      s.usage.outputTokens,
      s.costMicroUsd,
      s.now,
    ],
  );
}

export async function monthCostMicroUsd(tx: Db, tenantId: string, since: Date): Promise<number> {
  const result = await tx.query(
    `SELECT COALESCE(sum(cost_micro_usd), 0)::bigint AS total FROM ai_suggestion
     WHERE tenant_id = $1 AND created_at >= $2`,
    [tenantId, since],
  );
  return Number(result.rows[0].total);
}
