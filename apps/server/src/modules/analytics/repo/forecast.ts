import type { PoolClient } from 'pg';
import { FORECAST_MODEL, type FrozenForecast } from '@uptimo/domain';

type Db = Pick<PoolClient, 'query'>;

/** The one stored profile name (`snapshot.ts`): the legacy family the frozen numbers belong to (R7). */
const FORECAST_PROFILE = 'legacy';

/** Whether the plant's month already has a frozen row: the freeze's first read, before it loads the plant. */
export async function monthFrozen(tx: Db, tenantId: string, month: string): Promise<boolean> {
  const result = await tx.query(
    'SELECT EXISTS (SELECT 1 FROM forecast WHERE tenant_id = $1 AND month = $2::date) AS frozen',
    [tenantId, month],
  );
  return result.rows[0].frozen === true;
}

export interface ForecastInsert {
  month: string;
  /** The run's instant, written explicitly so a fake clock pins it (R7). */
  frozenAt: Date;
  rows: readonly FrozenForecast[];
}

/**
 * The freeze's one statement (R5/R7): a row per machine, `as_of` = the month's 1st, the stored profile and model,
 * `frozen_at` the run's instant. `ON CONFLICT DO NOTHING` on the machine/month key means a second worker (or a
 * second run) inserts nothing and leaves `predicted` byte-identical; the row count is what the caller audits.
 */
export async function insertForecasts(
  tx: Db,
  tenantId: string,
  input: ForecastInsert,
): Promise<number> {
  const records = input.rows.map((row) => ({
    machine_id: row.machineId,
    predicted: row.predicted,
  }));
  const result = await tx.query(
    `INSERT INTO forecast (tenant_id, machine_id, month, as_of, profile, model, predicted, frozen_at)
     SELECT $1, f.machine_id, $2::date, $2::date, $3, $4, f.predicted, $5::timestamptz
       FROM jsonb_to_recordset($6::jsonb) AS f(machine_id uuid, predicted jsonb)
     ON CONFLICT (tenant_id, machine_id, month) DO NOTHING`,
    [
      tenantId,
      input.month,
      FORECAST_PROFILE,
      FORECAST_MODEL,
      input.frozenAt,
      JSON.stringify(records),
    ],
  );
  return result.rowCount ?? 0;
}
