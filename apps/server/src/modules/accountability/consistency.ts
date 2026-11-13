import type { Pool, PoolClient } from 'pg';
import { withTenant } from '@uptimo/db';
import { slaConsistencyIds } from '../tickets/index.js';

export type SlaTicketReconciler = (
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  now: Date,
) => Promise<unknown>;

export interface SlaConsistencyOptions {
  pool: Pool;
  reconcileTicket: SlaTicketReconciler;
  now: Date;
  tenantId?: string;
}

export interface SlaConsistencyResult {
  tenants: number;
  tickets: number;
}

async function reconcileTenant(options: SlaConsistencyOptions, tenantId: string): Promise<number> {
  return withTenant(options.pool, tenantId, async (client) => {
    const ticketIds = await slaConsistencyIds(client, tenantId);
    for (const ticketId of ticketIds) {
      await options.reconcileTicket(client, tenantId, ticketId, options.now);
    }
    return ticketIds.length;
  });
}

export async function runSlaConsistency(
  options: SlaConsistencyOptions,
): Promise<SlaConsistencyResult> {
  const tenants = options.tenantId
    ? [{ tenant_id: options.tenantId }]
    : (await options.pool.query('SELECT * FROM tenants_with_sla_policies()')).rows;
  const result = { tenants: 0, tickets: 0 };
  const errors: unknown[] = [];
  for (const tenant of tenants) {
    try {
      result.tickets += await reconcileTenant(options, tenant.tenant_id as string);
      result.tenants += 1;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, 'SLA consistency failed');
  return result;
}

export interface SlaConsistencyPayload {
  tenantId?: string;
}

export interface SlaConsistencyRuntime {
  pool: Pool;
  reconcileTicket: SlaTicketReconciler;
  now: () => Date;
}

export function processSlaConsistencyJob(
  payload: SlaConsistencyPayload,
  runtime: SlaConsistencyRuntime,
): Promise<SlaConsistencyResult> {
  if (payload.tenantId && !/^[0-9a-f-]{36}$/i.test(payload.tenantId)) {
    throw new Error('Invalid SLA consistency tenant id');
  }
  return runSlaConsistency({
    pool: runtime.pool,
    reconcileTicket: runtime.reconcileTicket,
    now: runtime.now(),
    ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
  });
}
