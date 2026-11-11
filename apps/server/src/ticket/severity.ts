/**
 * Server-side severity helpers (M2-2.1).
 *
 * Loads the tenant severity matrix from `setting` (falling back to the domain
 * default) and recalculates severity when a correction changes machine or kind.
 */
import type { PoolClient } from 'pg';
import {
  computeSeverity,
  defaultSeverityMatrix,
  type Criticality,
  type SeverityMatrix,
} from '@uptimo/domain';
import { severityMatrixSchema } from '@uptimo/shared';
import type { Ticket } from '@uptimo/domain';
import type { LoadedCtx, TicketExtras, Tx } from '../ticket-mapper.js';

/** Build raise extras, deriving severity from the machine criticality snapshot. */
export function buildRaiseExtras(
  snapshot: Record<string, unknown>,
  body: Record<string, unknown>,
  criticality: Criticality | null,
  matrix: SeverityMatrix,
): TicketExtras {
  const kind = body.kind as 'stopped' | 'support' | 'general';
  const urgent = (body.urgent as boolean | undefined) ?? false;
  return {
    machineSnapshot: snapshot,
    location: (body.location as string | undefined) ?? null,
    workType: (body.workType as string | undefined) ?? null,
    urgent,
    problemLang: (body.problemLang as string | undefined) ?? null,
    reportedByRole: (body.reportedByRole as string | undefined) ?? null,
    raisedChannel: 'floor',
    parentId: null,
    expectedBackAt: null,
    waitingSpare: null,
    severity: computeSeverity(matrix, criticality, kind, urgent),
    criticalitySnapshot: criticality,
  };
}

/** Load the tenant severity matrix from settings, or the domain default. */
export async function loadSeverityMatrix(
  client: PoolClient,
  tenantId: string,
): Promise<SeverityMatrix> {
  const result = await client.query(
    "SELECT value FROM setting WHERE tenant_id = $1 AND key = 'severity_matrix'",
    [tenantId],
  );
  const row = result.rows[0] as { value?: unknown } | undefined;
  if (!row?.value) return defaultSeverityMatrix;
  const parsed = severityMatrixSchema.safeParse(row.value);
  return parsed.success ? parsed.data : defaultSeverityMatrix;
}

/** Fetch a machine's criticality (null when the machine is missing or unset). */
export async function machineCriticality(
  client: PoolClient,
  tenantId: string,
  machineId: string | null,
): Promise<Criticality | null> {
  if (!machineId) return null;
  const result = await client.query(
    'SELECT criticality FROM machine WHERE id = $1 AND tenant_id = $2',
    [machineId, tenantId],
  );
  return (result.rows[0]?.criticality as Criticality | null) ?? null;
}

export interface RecalculateInput {
  tenantId: string;
  machineId: string | null;
  kind: 'stopped' | 'support' | 'general';
  urgent: boolean;
}

/**
 * Recalculate severity for a ticket after a correction changed machine or kind.
 * Returns the new severity and criticality snapshot.
 */
export async function recalculateSeverity(
  client: PoolClient,
  input: RecalculateInput,
): Promise<{ severity: string; criticalitySnapshot: string | null }> {
  const matrix = await loadSeverityMatrix(client, input.tenantId);
  const criticality = await machineCriticality(client, input.tenantId, input.machineId);
  return {
    severity: computeSeverity(matrix, criticality, input.kind, input.urgent),
    criticalitySnapshot: criticality,
  };
}

/**
 * Recalculate severity when a command changed machine or kind (correct, upgrade-kind).
 * Mutates the ticket and the loaded extras so the response projection stays in sync.
 */
export async function refreshSeverity(
  client: PoolClient,
  tx: Tx,
  loaded: LoadedCtx,
  ticket: Ticket,
): Promise<void> {
  if (tx.action !== 'correct' && tx.action !== 'upgrade-kind') return;
  const changes = (tx.body.changes ?? {}) as Record<string, unknown>;
  if (tx.action === 'correct' && !('machineId' in changes) && !('kind' in changes)) return;
  const { severity, criticalitySnapshot } = await recalculateSeverity(client, {
    tenantId: tx.tenantId,
    machineId: ticket.machineId,
    kind: ticket.kind,
    urgent: loaded.row.urgent === true,
  });
  ticket.severity = severity;
  ticket.criticalitySnapshot = criticalitySnapshot;
  // Keep extras in sync: the response projects {...ticket, ...extras}, so a stale
  // extras.severity would mask the recalculated ticket value.
  loaded.extras.severity = severity;
  loaded.extras.criticalitySnapshot = criticalitySnapshot;
}
