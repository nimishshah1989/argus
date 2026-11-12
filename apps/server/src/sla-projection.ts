import type { PoolClient } from 'pg';
import { loadSlaProjections } from './ticket/sla.js';

export { projectTicketSla } from './ticket/sla.js';

/** Attach one batch of SLA projections to ticket rows without per-card queries. */
export async function withSlaProjections(
  client: PoolClient,
  tenantId: string,
  rows: Array<Record<string, unknown>>,
  project: (row: Record<string, unknown>) => Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
  const slas = await loadSlaProjections(
    client,
    tenantId,
    rows.map((row) => row.id as string),
    new Date(),
  );
  return rows.map((row) => ({ ...project(row), sla: slas.get(row.id as string) ?? null }));
}
