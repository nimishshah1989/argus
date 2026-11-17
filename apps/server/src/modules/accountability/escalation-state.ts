import type { PoolClient } from 'pg';
import { pendingEscalationLevels, type EscalationHistoryEvent } from '@uptimo/domain';
import type { EscalationState } from '@uptimo/shared/ticket-reply';
import type { TicketPart } from '../../kernel/index.js';
import { ticketEventRows } from '../tickets/index.js';

const EMPTY: EscalationState = { pendingLevels: [], lastLevel: null, lastAt: null };

interface EscalationRow {
  type: 'escalate' | 'escalation_ack';
  at: Date;
  payload: Record<string, unknown>;
}

/** The two event kinds the ladder reads, grouped by ticket; every other event says nothing about it. */
function ladderEvents(rows: Array<Record<string, unknown>>): Map<string, EscalationRow[]> {
  const byTicket = new Map<string, EscalationRow[]>();
  for (const row of rows) {
    if (row.type !== 'escalate' && row.type !== 'escalation_ack') continue;
    const ticketId = row.ticket_id as string;
    const own = byTicket.get(ticketId) ?? [];
    own.push({
      type: row.type,
      at: new Date(row.at as string | number | Date),
      payload: (row.payload ?? {}) as Record<string, unknown>,
    });
    byTicket.set(ticketId, own);
  }
  return byTicket;
}

/** The level and time of each `escalate` row, oldest first; its payload may be gone, which names no level. */
function stepsOf(rows: readonly EscalationRow[]): Array<{ level: string; at: Date }> {
  return rows.flatMap((row) => {
    if (row.type !== 'escalate') return [];
    const step = row.payload.escalation as { level?: unknown } | undefined;
    return typeof step?.level === 'string' ? [{ level: step.level, at: row.at }] : [];
  });
}

/** The whole history read: the domain decides which chains still wait, never a second copy of its rule. */
function stateOf(rows: readonly EscalationRow[]): EscalationState {
  const events: EscalationHistoryEvent[] = rows.map((row) => ({
    type: row.type,
    payload: row.payload,
  }));
  const last = stepsOf(rows).at(-1);
  return {
    pendingLevels: pendingEscalationLevels(events),
    lastLevel: last?.level ?? null,
    lastAt: last ? last.at.toISOString() : null,
  };
}

/** The escalation state of every ticket in a reply: one batch read for the page, never one per ticket. */
export async function loadEscalationStates(
  client: PoolClient,
  ticketIds: string[],
): Promise<Map<string, EscalationState>> {
  const states = new Map(ticketIds.map((id) => [id, EMPTY]));
  if (ticketIds.length === 0) return states;
  const byTicket = ladderEvents(await ticketEventRows(client, ticketIds));
  for (const [id, rows] of byTicket) states.set(id, stateOf(rows));
  return states;
}

/** The desk card and the detail read it from every ticket reply; a write answers its fresh value like `sla`. */
export const escalationTicketPart: TicketPart = {
  name: 'escalation',
  load: (client, _tenantId, ids) => loadEscalationStates(client, ids),
  afterWrite: async (client, write) => ({
    escalation: (await loadEscalationStates(client, [write.ticketId])).get(write.ticketId) ?? EMPTY,
  }),
};
