import type { PoolClient } from 'pg';
import type { Figures, TicketEvent } from '@uptimo/domain';
import { recomputeFigures, rowToTicket } from './mapper.js';
import { driftCandidateRows } from './repo/drift.js';
import { loadEvents } from './repo/events.js';
import { loadSegments } from './repo/segments.js';

export interface DriftLine {
  ref: string;
  figure: string;
  cached: number | null;
  recomputed: number | null;
}

/** Cached column, figure name, in the order a report lists them. */
const CACHED: ReadonlyArray<[column: string, figure: keyof Figures]> = [
  ['response_min', 'responseMin'],
  ['active_min', 'activeMin'],
  ['wait_min', 'waitMin'],
  ['vendor_min', 'vendorMin'],
  ['handover_wait_min', 'handoverWaitMin'],
  ['down_acc_min', 'downAccMin'],
  ['downtime_min', 'downtimeMin'],
  ['follow_min', 'followMin'],
  ['repair_min', 'repairMin'],
];

/**
 * Nightly check (SPEC §6): recompute each closed ticket's figures from its own events, at the moment it closed,
 * and report any that differ from the cached ones. Skips overridden figures. Reads only; fixes nothing.
 */
export async function figureDrift(client: PoolClient, tenantId: string): Promise<DriftLine[]> {
  const lines: DriftLine[] = [];
  for (const row of await driftCandidateRows(client, tenantId)) {
    const ticket = rowToTicket(row);
    const events = await loadEvents(client, ticket.id);
    const segments = await loadSegments(client, ticket.id);
    const fresh = recomputeFigures(ticket, events as unknown as TicketEvent[], segments, {
      overrides: (row.overrides as Record<string, unknown>) ?? {},
      now: ticket.closedAt ?? new Date(),
    });
    for (const [column, figure] of CACHED) {
      if ((fresh.overridden as string[] | undefined)?.includes(figure)) continue;
      const cached = (row[column] as number | null) ?? null;
      const recomputed = (fresh[figure] as number | null) ?? null;
      if (cached !== recomputed) lines.push({ ref: ticket.ref, figure, cached, recomputed });
    }
  }
  return lines;
}
