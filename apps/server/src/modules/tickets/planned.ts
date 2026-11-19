import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { isPlannedChannel, type PlannedChannel } from '@uptimo/shared';
import { raiseTicket, type Ticket, type TicketEvent } from '@uptimo/domain';
import { machinesByIds } from '../plant/index.js';
import * as tm from './mapper.js';
import { buildRaiseExtras, loadSeverityMatrix } from './severity.js';
import * as sql from './repo/ticket.js';

export interface PlannedTicketInput {
  tenantId: string;
  machineId: string;
  channel: PlannedChannel;
  problem: string;
  /** The person the job is raised for, when one is known; a PM run or the forecast engine names none. */
  reportedByPersonId?: string | null;
  /** The login that caused the raise, when a person did; the engine leaves it empty. */
  raisedLoginId?: string | null;
  /** When the job is raised; defaults to now. */
  at?: Date;
  /** The planned job's scheduled plant day (50 R12); the ticket's `task_expected_on`, never the plan's. */
  scheduledOn?: string;
  /**
   * What caused the raise: the nudge key (52 packet 3) or the frozen forecast row id (52 packet 2). It is written on
   * the raise event's payload as `{source:{<kind>: id}}`, the only link the schema has (R16).
   */
  source?: { nudge?: string; forecast?: string };
}

export interface PlannedTicketResult {
  id: string;
  ref: string;
}

/** A planned raise names a machine that is not there, or one that has been scrapped. */
export class PlannedRaiseError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}

/** Inserts the ticket, its scheduled date and its raise events in the caller's transaction (50 R12). */
async function persistRaise(
  client: PoolClient,
  input: PlannedTicketInput,
  raised: { ticket: Ticket; events: TicketEvent[] },
  extras: tm.RaiseExtras,
): Promise<void> {
  await sql.insertTicket(client, input.tenantId, raised.ticket, extras);
  if (input.scheduledOn)
    await sql.setTaskExpectedOn(client, input.tenantId, raised.ticket.id, input.scheduledOn);
  await sql.persistEvents(client, input.tenantId, raised.ticket.id, {
    events: raised.events,
    startSeq: 0,
    idempotencyKey: `planned:${raised.ticket.id}`,
    loginId: input.raisedLoginId ?? null,
    actingPersonId: input.reportedByPersonId ?? null,
    textFor: () => input.problem,
    payloadFor: (event) => ({
      ...(input.scheduledOn ? { scheduledOn: input.scheduledOn } : {}),
      ...(event.type === 'down' && input.source ? { source: input.source } : {}),
    }),
  });
}

/**
 * Raises a `pm` or `inspection` ticket through the tickets module's published interface (D17: planned work is an
 * ordinary ticket with a channel, so the SLA clocks, drift, escalation and live analytics skip it by that channel).
 * It is kind `general` and takes a `WR-` reference: a planned job is not a breakdown, so it does not hold the
 * machine's one-open-breakdown slot, ask production for sign-off or show as a breakdown on the floor/desk lists.
 * It writes in the caller's transaction: 49's PM generation and 52's inspection run get their ticket in the same
 * unit of work as the plan or forecast that caused it. A breakdown channel is refused here; those come from a
 * person, through the HTTP raise path.
 */
export async function raisePlannedTicket(
  client: PoolClient,
  input: PlannedTicketInput,
): Promise<PlannedTicketResult> {
  if (!isPlannedChannel(input.channel)) {
    throw new PlannedRaiseError('channel', 'A planned raise needs a planned channel');
  }
  const machine = (await machinesByIds(client, input.tenantId, [input.machineId], 'share'))[0];
  if (!machine) throw new PlannedRaiseError('machineId', 'Unknown machine');
  if (machine.status === 'scrapped')
    throw new PlannedRaiseError('machineId', 'Machine is scrapped');

  const at = input.at ?? new Date();
  const matrix = await loadSeverityMatrix(client, input.tenantId);
  const body = {
    kind: 'general',
    channel: input.channel,
    problem: input.problem,
  };
  const raised = raiseTicket({
    id: randomUUID(),
    ref: await sql.allocateRef(client, input.tenantId, 'general'),
    kind: 'general',
    machineId: machine.id,
    machineCriticality: machine.criticality,
    severityMatrix: matrix,
    urgent: false,
    problem: input.problem,
    reportedAt: at,
    raisedLoginId: input.raisedLoginId ?? null,
    reportedByPersonId: input.reportedByPersonId ?? null,
    selfStarted: false,
    startNow: false,
  });
  raised.ticket.figures = tm.recomputeFigures(raised.ticket, raised.events, raised.segments, {
    overrides: {},
    now: at,
  });
  const extras = buildRaiseExtras(
    {
      code: machine.code,
      category: machine.category,
      cell: machine.cell,
      criticality: machine.criticality,
    },
    body,
    machine.criticality,
    matrix,
  );
  await persistRaise(client, input, raised, extras);
  return { id: raised.ticket.id, ref: raised.ticket.ref };
}
