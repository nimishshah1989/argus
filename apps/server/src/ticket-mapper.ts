import { apiError } from '@uptimo/shared';
import {
  canLateReport,
  canRestore,
  canWork,
  figures as computeFigures,
  transition,
  TransitionError,
  type Command,
  type CorrectChanges,
  type CrewMember,
  type Figures,
  type Role,
  type Ticket,
  type TicketEvent,
  type WorkSegment,
} from '@uptimo/domain';

export type Outcome = { status: number; body: unknown };

export type CommandAction =
  | 'start'
  | 'join'
  | 'leave'
  | 'pause'
  | 'resume'
  | 'transfer'
  | 'update'
  | 'machine-running'
  | 'machine-stopped'
  | 'close'
  | 'report'
  | 'cancel'
  | 'restore'
  | 'correct'
  | 'upgrade-kind';

/** The slice of the authenticated session the ticket flow needs. */
export interface ActorAuth {
  loginId: string;
  role: string;
  shared: boolean;
  personId: string | null;
}

/** A ticket_event row rehydrated into a domain event plus the columns the API exposes. */
export interface LoadedEvent {
  type: TicketEvent['type'];
  at: Date;
  reason?: string;
  isVendor?: boolean;
  seq: number;
  loginId: string | null;
  actingPersonId: string | null;
  text: string | null;
  payload: Record<string, unknown>;
}

/** DB-only ticket columns that the domain `Ticket` does not carry. */
export interface TicketExtras {
  machineSnapshot: unknown;
  location: string | null;
  workType: string | null;
  urgent: boolean;
  problemLang: string | null;
  reportedByRole: string | null;
  raisedChannel: string;
  parentId: string | null;
  expectedBackAt: Date | null;
  waitingSpare: string | null;
}

/** Raise-only ticket columns the domain does not model. */
export interface RaiseExtras {
  machineSnapshot: unknown;
  location: string | null;
  workType: string | null;
  urgent: boolean;
  problemLang: string | null;
  reportedByRole: string | null;
}

export interface PersistEventsOptions {
  events: TicketEvent[];
  startSeq: number;
  idempotencyKey: string;
  loginId: string;
  actingPersonId: string | null;
  textFor?: (event: TicketEvent, index: number) => string | null;
  payloadFor?: (event: TicketEvent, index: number) => Record<string, unknown>;
}

export interface Tx {
  tenantId: string;
  ticketId: string;
  key: string;
  action: CommandAction;
  body: Record<string, unknown>;
  auth: ActorAuth;
  actingPersonId: string | null;
}

export interface LoadedCtx {
  row: Record<string, unknown>;
  ticket: Ticket;
  extras: TicketExtras;
  events: LoadedEvent[];
  segments: WorkSegment[];
  crew: CrewMember[];
}

function toDate(value: unknown): Date | null {
  return value == null ? null : new Date(value as string | number | Date);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function num0(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export function rowToTicket(row: Record<string, unknown>): Ticket {
  return {
    id: row.id as string,
    ref: row.ref as string,
    kind: row.kind as Ticket['kind'],
    status: row.status as Ticket['status'],
    machineId: str(row.machine_id),
    problem: row.problem as string,
    reportedAt: toDate(row.reported_at) as Date,
    raisedLoginId: row.raised_login_id as string,
    reportedByPersonId: str(row.reported_by_person_id),
    selfStarted: row.self_started as boolean,
    startedAt: toDate(row.started_at),
    leadPersonId: str(row.lead_person_id),
    segmentStartedAt: toDate(row.segment_started_at),
    handedOver: row.handed_over as boolean,
    handoverSince: toDate(row.handover_since),
    transferToPersonId: str(row.transfer_to_person_id),
    transferToShift: str(row.transfer_to_shift),
    transfers: row.transfers as number,
    waitReason: str(row.wait_reason),
    waitSince: toDate(row.wait_since),
    assignedToPersonId: str(row.assigned_to_person_id),
    machineRunningAt: toDate(row.machine_running_at),
    machineStoppedAt: toDate(row.machine_stopped_at),
    closedAt: toDate(row.closed_at),
    closedByPersonId: str(row.closed_by_person_id),
    closeKind: str(row.close_kind) as Ticket['closeKind'],
    closeNote: str(row.close_note),
    taskReason: str(row.task_reason),
    taskExpectedOn: str(row.task_expected_on),
    taskDownMin: num(row.task_down_min),
    kindUpgradedAt: toDate(row.kind_upgraded_at),
    lastEventSeq: row.last_event_seq as number,
    figures: null,
  };
}

export function rowExtras(row: Record<string, unknown>): TicketExtras {
  return {
    machineSnapshot: row.machine_snapshot,
    location: str(row.location),
    workType: str(row.work_type),
    urgent: row.urgent === true,
    problemLang: str(row.problem_lang),
    reportedByRole: str(row.reported_by_role),
    raisedChannel: str(row.raised_channel) ?? 'floor',
    parentId: str(row.parent_id),
    expectedBackAt: toDate(row.expected_back_at),
    waitingSpare: str(row.waiting_spare),
  };
}

export function figuresFromRow(row: Record<string, unknown>): Figures {
  return {
    responseMin: num(row.response_min),
    activeMin: num0(row.active_min),
    waitMin: num0(row.wait_min),
    vendorMin: num0(row.vendor_min),
    handoverWaitMin: num0(row.handover_wait_min),
    downAccMin: num0(row.down_acc_min),
    downtimeMin: num(row.downtime_min),
    followMin: num(row.follow_min),
    repairMin: num0(row.repair_min),
    perPerson: {},
  };
}

export function recomputeFigures(
  ticket: Ticket,
  events: TicketEvent[],
  segments: WorkSegment[],
  opts: { overrides: Record<string, unknown>; now: Date },
): Figures {
  return computeFigures({
    reportedAt: ticket.reportedAt,
    kind: ticket.kind,
    kindUpgradedAt: ticket.kindUpgradedAt ?? undefined,
    selfStarted: ticket.selfStarted,
    events,
    segments,
    overrides: opts.overrides,
    now: opts.now,
    closedAt: ticket.closedAt ?? undefined,
  });
}

export function ticketProjection(ticket: Ticket, extras: TicketExtras): Record<string, unknown> {
  return { ...ticket, ...extras };
}

export function mapTransitionError(error: TransitionError): Outcome {
  if (error.message.startsWith('Not allowed')) {
    return {
      status: 403,
      body: apiError('forbidden', 'You do not have permission for this action'),
    };
  }
  return { status: 409, body: apiError('conflict', error.message) };
}

const WORK_GATED = new Set<CommandAction>([
  'pause',
  'resume',
  'transfer',
  'update',
  'machine-running',
  'machine-stopped',
  'upgrade-kind',
]);

export function gatePermission(
  action: CommandAction,
  tx: Tx,
  personId: string | null,
): Outcome | null {
  const actor = {
    role: tx.auth.role as Role,
    loginId: tx.auth.loginId,
    personId,
    shared: tx.auth.shared,
  };
  const denied = {
    status: 403,
    body: apiError('forbidden', 'You do not have permission for this action'),
  };
  if (WORK_GATED.has(action) && !canWork(actor)) return denied;
  if (action === 'report' && !canLateReport(actor)) return denied;
  if (action === 'restore' && !canRestore(actor)) return denied;
  return null;
}

type Builder = (
  body: Record<string, unknown>,
  personId: string,
  ticket: Ticket,
  events: LoadedEvent[],
) => Command;

const BUILDERS: Record<CommandAction, Builder> = {
  start: (body, personId, ticket) => ({
    type: 'start',
    personId,
    at: body.at as Date | undefined,
    pickup: ticket.handedOver,
  }),
  join: (body, personId) => ({ type: 'join', personId, role: body.role as 'primary' | 'support' }),
  leave: (body, personId) => ({ type: 'leave', personId, reason: body.reason as string }),
  pause: (body, personId) => ({
    type: 'pause',
    personId,
    reason: body.reasonCode as string,
    note: body.note as string | undefined,
    assignToPersonId: body.assignToPersonId as string | undefined,
  }),
  resume: (body, personId) => ({ type: 'resume', personId, note: body.note as string | undefined }),
  transfer: (body, personId) => ({
    type: 'transfer',
    personId,
    toPersonId: body.toPersonId as string | undefined,
    toShift: body.toShift as string | undefined,
    note: body.note as string,
  }),
  update: (body, personId) => ({ type: 'update', personId, text: body.text as string }),
  'machine-running': (body, personId) => ({
    type: 'machineRunning',
    personId,
    at: body.at as Date | undefined,
  }),
  'machine-stopped': (_body, personId) => ({ type: 'machineStopped', personId }),
  close: (body, personId) => ({
    type: 'close',
    personId,
    kind: body.kind as 'report' | 'no_report' | 'done',
    at: body.at as Date | undefined,
    note: body.note as string | undefined,
  }),
  report: (_body, personId) => ({ type: 'lateReport', personId }),
  cancel: (body, personId) => ({ type: 'cancel', personId, reason: body.reason as string }),
  restore: (body, personId, _ticket, events) => {
    const cancel = [...events].reverse().find((event) => event.type === 'cancel');
    const toStatus = (cancel?.payload.previousStatus as 'open' | 'working' | 'waiting') ?? 'open';
    return { type: 'restore', personId, reason: body.reason as string, toStatus };
  },
  correct: (body, personId) => ({
    type: 'correct',
    personId,
    reason: body.reason as string,
    changes: body.changes as CorrectChanges,
  }),
  'upgrade-kind': (_body, personId) => ({ type: 'upgradeKind', personId }),
};

export function buildCommand(tx: Tx, personId: string, loaded: LoadedCtx): Command {
  return BUILDERS[tx.action](tx.body, personId, loaded.ticket, loaded.events);
}

export function commandExtras(
  action: CommandAction,
  body: Record<string, unknown>,
): {
  expectedBackAt?: Date | null;
  waitingSpare?: string | null;
} {
  if (action === 'pause') {
    return { expectedBackAt: expectedBackAt(body.expectedBackOn as string | undefined) };
  }
  if (action === 'update') {
    return {
      expectedBackAt: expectedBackAt(body.expectedOn as string | undefined),
      waitingSpare: (body.spare as string | undefined) ?? null,
    };
  }
  return {};
}

function expectedBackAt(date: string | undefined): Date | null {
  // 18:00 local on the chosen day; precise tenant-timezone conversion is deferred.
  return date ? new Date(`${date}T18:00:00`) : null;
}

export function applyTransition(
  tx: Tx,
  personId: string | null,
  loaded: LoadedCtx,
  command: Command,
) {
  try {
    return transition({
      ticket: loaded.ticket,
      events: loaded.events,
      segments: loaded.segments,
      crew: loaded.crew,
      command,
      ctx: {
        role: tx.auth.role as Role,
        loginId: tx.auth.loginId,
        personId,
        shared: tx.auth.shared,
        now: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof TransitionError) return mapTransitionError(error);
    throw error;
  }
}
