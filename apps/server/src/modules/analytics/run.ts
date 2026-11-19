import type { Pool, PoolClient } from 'pg';
import {
  inspectionProblem,
  monthActuals,
  outcomeFor,
  type InspectionOutcome,
} from '@uptimo/domain';
import { assertClockNearDatabase, withTenant } from '../../kernel/index.js';
import { jobTenantIds } from '../identity/index.js';
import { audit } from '../ops/index.js';
import { machinesByIds, plantToday } from '../plant/index.js';
import {
  PlannedRaiseError,
  raisePlannedTicket,
  raisedTicketsFor,
  type RaisedTicket,
} from '../tickets/index.js';
import { loadEngineData } from './load.js';
import {
  hotRows,
  pendingMonths,
  rowsForMonth,
  saveOutcomes,
  type StoredForecastRow,
} from './repo/forecast.js';

/**
 * `engine.run` (ticket 52, packet 52b): the nightly scoring pass and the inspection pass. It writes no
 * `kpi_snapshot` (R14). Scoring reads a month's frozen rows, the plant's actuals and the inspection tickets already
 * linked to them, then writes only `outcome`/`scored_at`; inspecting reads the current month's frozen Hot band and
 * raises one planned inspection ticket per row that has none, through the tickets module's own seam (R9/R11).
 */

export const ENGINE_RUN_QUEUE = 'engine.run';

export interface EngineRunOptions {
  /** The run's instant (the fake clock in tests). */
  now: Date;
  /** One customer only; the default fans out over `jobTenantIds()` like the retention jobs. */
  tenantId?: string;
  /** Only a test with a fake clock passes this. */
  allowFakeClock?: boolean;
}

export interface EngineRunResult {
  tenants: number;
  scored: number;
  raised: number;
}

/** The ticket's close state as the forecast row stores it (R12): the fields map one-to-one, nothing else is copied. */
function inspectionOf(ticket: RaisedTicket): InspectionOutcome {
  return {
    ticketId: ticket.id,
    ref: ticket.ref,
    status: ticket.status as InspectionOutcome['status'],
    closeKind: (ticket.closeKind ?? null) as InspectionOutcome['closeKind'],
    closedAt: ticket.closedAt === null ? null : ticket.closedAt.toISOString(),
  };
}

/** The ticket a frozen row raised, when one exists; the row id is the source key on the raise event (R16). */
async function linksFor(
  tx: PoolClient,
  tenantId: string,
  rows: readonly StoredForecastRow[],
): Promise<Map<string, RaisedTicket>> {
  return raisedTicketsFor(
    tx,
    tenantId,
    'forecast',
    rows.map((row) => row.id),
  );
}

/**
 * Scores every pending month of one plant (R8/R13): the month's frozen rows, one `loadEngineData` for the plant and
 * the tickets already linked to each row, then one statement and one `forecast.score` line per month. A row whose
 * month saw no breakdown scores 0 hours and a hit (R15); a month with no rows is never visited.
 */
export async function scoreTenant(tx: PoolClient, tenantId: string, now: Date): Promise<number> {
  const today = await plantToday(tx, tenantId, now);
  const months = await pendingMonths(tx, tenantId, today);
  if (months.length === 0) return 0;
  const data = await loadEngineData(tx, tenantId);
  let scored = 0;
  for (const month of months) {
    const rows = await rowsForMonth(tx, tenantId, month);
    if (rows.length === 0) continue;
    const actuals = monthActuals(data, month);
    const links = await linksFor(tx, tenantId, rows);
    const outcomes = rows.map((row) => {
      const linked = links.get(row.id);
      return {
        id: row.id,
        outcome: outcomeFor(
          row.predicted,
          actuals.get(row.machineId) ?? { hours: 0, episodes: 0 },
          linked ? inspectionOf(linked) : null,
        ),
      };
    });
    const written = await saveOutcomes(tx, tenantId, { scoredAt: now, rows: outcomes });
    scored += written;
    await audit.record(tx, {
      tenantId,
      loginId: null,
      action: 'forecast.score',
      entity: 'forecast',
      entityId: null,
      before: null,
      after: {
        month,
        rows: written,
        hits: outcomes.filter((row) => row.outcome.hit).length,
      },
    });
  }
  return scored;
}

/**
 * Raises the current month's missing inspections (R9/R11): the frozen Hot rows, their existing linked tickets (a
 * closed or cancelled one counts, so the engine never re-raises), then one `raisePlannedTicket` per unlinked row. The
 * advisory lock serialises two workers so the second sees the first's ticket. A machine that is gone or scrapped is
 * skipped — the raise seam refuses it — and never retried. One `inspection.raise` line names the month and the refs.
 */
export async function inspectTenant(tx: PoolClient, tenantId: string, now: Date): Promise<number> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`engine.inspection:${tenantId}`]);
  const today = await plantToday(tx, tenantId, now);
  const month = `${today.slice(0, 7)}-01`;
  const rows = await hotRows(tx, tenantId, month);
  if (rows.length === 0) return 0;
  const links = await linksFor(tx, tenantId, rows);
  const unlinked = rows.filter((row) => !links.has(row.id));
  if (unlinked.length === 0) return 0;
  const machines = await machinesByIds(
    tx,
    tenantId,
    unlinked.map((row) => row.machineId),
    'share',
  );
  const byId = new Map(machines.map((machine) => [machine.id, machine]));
  const refs: string[] = [];
  for (const row of unlinked) {
    const machine = byId.get(row.machineId);
    if (!machine) continue;
    try {
      const raised = await raisePlannedTicket(tx, {
        tenantId,
        machineId: row.machineId,
        channel: 'inspection',
        problem: inspectionProblem({ code: machine.code, month, p80: row.predicted.p80 }),
        at: now,
        source: { forecast: row.id },
      });
      refs.push(raised.ref);
    } catch (error) {
      if (!(error instanceof PlannedRaiseError)) throw error;
    }
  }
  if (refs.length > 0)
    await audit.record(tx, {
      tenantId,
      loginId: null,
      action: 'inspection.raise',
      entity: 'forecast',
      entityId: null,
      before: null,
      after: { month, refs },
    });
  return refs.length;
}

/**
 * Runs both passes for the named customer, or for every customer that still holds data. The score and the inspection
 * are separate tenant transactions, so a failing inspection never loses the night's scoring; each pass is idempotent.
 * Refuses a clock more than 24 hours from the database's before writing anything (R18).
 */
export async function runEngineRun(
  pool: Pool,
  options: EngineRunOptions,
): Promise<EngineRunResult> {
  if (!options.allowFakeClock) await assertClockNearDatabase(pool, ENGINE_RUN_QUEUE, options.now);
  const tenantIds = options.tenantId ? [options.tenantId] : await jobTenantIds(pool);
  const result: EngineRunResult = { tenants: 0, scored: 0, raised: 0 };
  const errors: unknown[] = [];
  for (const tenantId of tenantIds) {
    try {
      result.scored += await withTenant(pool, tenantId, (client) =>
        scoreTenant(client, tenantId, options.now),
      );
      result.raised += await withTenant(pool, tenantId, (client) =>
        inspectTenant(client, tenantId, options.now),
      );
      result.tenants += 1;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, `${ENGINE_RUN_QUEUE} failed`);
  return result;
}
