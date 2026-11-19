import type { PoolClient } from 'pg';
import { pmNextDue, pmToleranceDays, pmWithinWindow } from '@uptimo/shared';
import {
  machinesByIds,
  pmPlanById,
  pmPlanForMachine,
  type MachineRow,
  type PmPlan,
} from '../plant/index.js';
import { tenantInfo } from '../identity/index.js';
import { refuse } from '../../kernel/index.js';
import type { Outcome } from './mapper.js';
import { raisePlannedTicket } from './planned.js';
import { loadTicketRow } from './repo/ticket.js';
import { openPmMachineIds, setPmScheduledOn } from './repo/pm.js';
import { pmCalendarFor } from './pm-calendar.js';

/**
 * A move (50a, R3/R4/R5): materialise the projected plan as a PM ticket at the target, or move an open PM
 * ticket's `task_expected_on`. The plan row is never written, `reported_at`/`started_at` never change, the
 * window is the plan's tolerance on a Monday–Saturday that is not past, and a day holding a PM is refused.
 */

const OPEN_STATUSES = new Set(['open', 'working', 'waiting']);
const WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6];

const dayOfWeek = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay();
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const UNKNOWN_PLAN = refuse(404, 'not_found', 'Unknown plan', 'planId');
const UNKNOWN_MACHINE = refuse(404, 'not_found', 'Unknown machine', 'machineId');
const UNKNOWN_TICKET = refuse(404, 'not_found', 'Unknown ticket', 'ticketId');
const SCRAPPED = refuse(409, 'conflict', 'Machine is scrapped', 'machineId');
const STARTED = refuse(409, 'conflict', 'A started PM job cannot be moved', 'ticketId');
const ALREADY_OPEN = refuse(
  409,
  'conflict',
  'A PM job is already open for this machine',
  'machineId',
);
const NO_INTERVAL = refuse(
  422,
  'validation',
  'This plan has no interval and cannot be moved',
  'scheduledOn',
);
const PAST = refuse(422, 'validation', 'A PM job cannot be scheduled in the past', 'scheduledOn');
const NOT_WORKING = refuse(
  422,
  'validation',
  'PM jobs are scheduled Monday to Saturday',
  'scheduledOn',
);
const OUTSIDE = refuse(422, 'validation', 'That date is outside the plan tolerance', 'scheduledOn');
const DAY_FULL = refuse(409, 'conflict', 'That day already has a PM job', 'scheduledOn');

export interface PmRescheduleInput {
  tenantId: string;
  machineId: string;
  planId: string | null;
  ticketId: string | null;
  scheduledOn: string;
  loginId: string | null;
  actingPersonId: string | null;
  now: Date;
}

export interface PmRescheduleResult {
  ticketId: string;
  ref: string;
  scheduledOn: string;
  created: boolean;
}

type Step<T> = { value: T } | { refusal: Outcome };
const failed = <T>(refusal: Outcome): Step<T> => ({ refusal });
const ready = <T>(value: T): Step<T> => ({ value });
const ok = (body: PmRescheduleResult): Outcome => ({ status: 200, body });

interface OpenTicket {
  id: string;
  ref: string;
  scheduledOn: string;
}

interface MoveState {
  machine: MachineRow;
  effective: PmPlan | null;
  ticket: OpenTicket | null;
  dueOn: string;
  toleranceDays: number;
  today: string;
}

function planCovers(plan: PmPlan, machine: MachineRow): boolean {
  return (
    plan.machineId === machine.id || (plan.machineId === null && plan.category === machine.category)
  );
}

/** The plan's next due at the time of the move (R4), in the plant's zone; null when it has no interval. */
function dueOf(plan: PmPlan, timeZone: string): string | null {
  return pmNextDue(
    {
      createdAt: plan.createdAt.toISOString(),
      lastDoneOn: plan.lastDoneOn,
      intervalDays: plan.intervalDays,
    },
    timeZone,
  );
}

async function loadOpenTicket(
  client: PoolClient,
  input: PmRescheduleInput,
  machine: MachineRow,
  timeZone: string,
): Promise<Step<OpenTicket>> {
  const row = await loadTicketRow(client, input.ticketId!, input.tenantId);
  if (!row || row.raised_channel !== 'pm' || row.machine_id !== machine.id || row.parent_id != null)
    return failed(UNKNOWN_TICKET);
  if (!OPEN_STATUSES.has(String(row.status)) || row.started_at != null) return failed(STARTED);
  const reportedAt = new Date(row.reported_at as string | number | Date);
  return ready({
    id: row.id as string,
    ref: row.ref as string,
    scheduledOn: str(row.task_expected_on) ?? reportedAt.toLocaleDateString('en-CA', { timeZone }),
  });
}

/** A projection's window: it needs an active plan with an interval and no open job already raised. */
async function planWindow(
  client: PoolClient,
  request: { tenantId: string; machine: MachineRow; effective: PmPlan | null; timeZone: string },
): Promise<Step<{ dueOn: string; toleranceDays: number }>> {
  const { tenantId, machine, effective, timeZone } = request;
  if (!effective) return failed(UNKNOWN_PLAN);
  const due = dueOf(effective, timeZone);
  if (!due) return failed(NO_INTERVAL);
  const open = await openPmMachineIds(client, tenantId, [machine.id]);
  if (open.has(machine.id)) return failed(ALREADY_OPEN);
  return ready({ dueOn: due, toleranceDays: pmToleranceDays(effective.intervalDays) });
}

/** What a ticket move needs after the machine and its plan are resolved. */
interface MoveBase {
  input: PmRescheduleInput;
  machine: MachineRow;
  effective: PmPlan | null;
  timeZone: string;
  today: string;
}

async function prepareTicketMove(client: PoolClient, base: MoveBase): Promise<Step<MoveState>> {
  const ticket = await loadOpenTicket(client, base.input, base.machine, base.timeZone);
  if ('refusal' in ticket) return ticket;
  if (base.effective && base.effective.intervalDays === null) return failed(NO_INTERVAL);
  return ready({
    ...base,
    ticket: ticket.value,
    dueOn: (base.effective && dueOf(base.effective, base.timeZone)) || ticket.value.scheduledOn,
    toleranceDays: pmToleranceDays(base.effective?.intervalDays ?? null),
  });
}

async function preparePlanMove(client: PoolClient, base: MoveBase): Promise<Step<MoveState>> {
  const window = await planWindow(client, {
    tenantId: base.input.tenantId,
    machine: base.machine,
    effective: base.effective,
    timeZone: base.timeZone,
  });
  if ('refusal' in window) return window;
  return ready({ ...base, ticket: null, ...window.value });
}

/** Everything a move needs, or the first refusal: the machine, its effective plan, the ticket and its window. */
async function prepareMove(client: PoolClient, input: PmRescheduleInput): Promise<Step<MoveState>> {
  const named = input.planId
    ? await pmPlanById(client, input.tenantId, input.planId, 'update')
    : null;
  if (input.planId && !named) return failed(UNKNOWN_PLAN);
  const machine = (await machinesByIds(client, input.tenantId, [input.machineId], 'share'))[0];
  if (!machine) return failed(UNKNOWN_MACHINE);
  if (machine.status === 'scrapped') return failed(SCRAPPED);

  const effective = await pmPlanForMachine(client, input.tenantId, machine.id, 'update');
  if (named && (!named.active || !planCovers(named, machine) || effective?.id !== named.id))
    return failed(UNKNOWN_PLAN);
  const { time_zone: timeZone } = await tenantInfo(client, input.tenantId);
  const today = input.now.toLocaleDateString('en-CA', { timeZone });

  const base: MoveBase = { input, machine, effective, timeZone, today };
  return input.ticketId ? prepareTicketMove(client, base) : preparePlanMove(client, base);
}

/** The target rules (R4), the load refusal (R5) and the write; a no-op move writes no event. */
async function applyMove(
  client: PoolClient,
  input: PmRescheduleInput,
  state: MoveState,
): Promise<Outcome> {
  const target = input.scheduledOn;
  if (target < state.today) return PAST;
  if (!WORKING_DAYS.includes(dayOfWeek(target))) return NOT_WORKING;
  if (!pmWithinWindow(target, state.dueOn, state.toleranceDays)) return OUTSIDE;
  if (state.ticket && state.ticket.scheduledOn === target)
    return ok({
      ticketId: state.ticket.id,
      ref: state.ticket.ref,
      scheduledOn: target,
      created: false,
    });

  // The target must not already hold another PM occurrence (R5); this job's own plan is suppressed by it.
  const day = await pmCalendarFor(client, input.tenantId, { from: target, to: target }, input.now);
  const others = day.items.filter((item) =>
    state.ticket
      ? item.ticketId !== state.ticket.id
      : !(item.planId === state.effective!.id && item.machineId === state.machine.id),
  );
  if (others.length >= day.cap) return DAY_FULL;

  if (state.ticket) {
    const moved = await setPmScheduledOn(client, input.tenantId, {
      ticketId: state.ticket.id,
      from: state.ticket.scheduledOn,
      to: target,
      planId: state.effective?.id ?? null,
      loginId: input.loginId,
      actingPersonId: input.actingPersonId,
    });
    if (!moved) return STARTED;
    return ok({
      ticketId: state.ticket.id,
      ref: moved.ref,
      scheduledOn: target,
      created: false,
    });
  }
  const raised = await raisePlannedTicket(client, {
    tenantId: input.tenantId,
    machineId: state.machine.id,
    channel: 'pm',
    problem: `PM due: ${state.effective!.title}`,
    at: input.now,
    raisedLoginId: input.loginId,
    scheduledOn: target,
  });
  return ok({ ticketId: raised.id, ref: raised.ref, scheduledOn: target, created: true });
}

export async function reschedulePm(client: PoolClient, input: PmRescheduleInput): Promise<Outcome> {
  // Two planners must not read the same free day and both write it; this serialises reschedules per plant.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.tenantId]);
  const prepared = await prepareMove(client, input);
  if ('refusal' in prepared) return prepared.refusal;
  return applyMove(client, input, prepared.value);
}
