import type { FigureOverrides, RestorableStatus, TicketEvent } from '@uptimo/domain';
import type { BhavinEvent } from './event-schema.js';
import type {
  BhavinCrew,
  BhavinReport,
  BhavinSegment,
  BhavinState,
  BhavinTicket,
} from './schema.js';
import { applyImportedEdit } from './state-edit.js';

export interface MutableImportedState extends BhavinState {
  status: BhavinTicket['status'];
  kind: BhavinTicket['kind'];
  machineCode: string | null;
  problem: string;
  reportedAt: Date;
  overrides: FigureOverrides;
  editedAt: Date | null;
}

interface InternalState extends MutableImportedState {
  _firstStart: Date | null;
  _previousStatus: RestorableStatus | null;
  _crew: BhavinCrew[];
  _segments: BhavinSegment[];
  _reports: BhavinReport[];
  _past: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const active = (status: BhavinTicket['status']) =>
  status === 'open' || status === 'working' || status === 'waiting';

function actor(event: BhavinEvent, seq: number): string {
  if (event.by === null) throw new Error(`missing_actor at seq ${seq}`);
  return event.by;
}

function applyDownOrStart(state: InternalState, event: BhavinEvent, seq: number): void {
  if (event.type === 'down') {
    if (seq !== 0) throw new Error(`down_seq at seq ${seq}`);
    state.status = 'open';
    state.reportedAt = event.at;
    state.machineRunningAt = null;
    state.machineStoppedAt = null;
    return;
  }
  if (event.type !== 'start' && event.type !== 'pickup') return;
  const person = actor(event, seq);
  if (state.status !== 'open') throw new Error(`start_requires_open at seq ${seq}`);
  if (event.type === 'pickup' && !state.handedOver) {
    throw new Error(`pickup_requires_transfer at seq ${seq}`);
  }
  if (state._firstStart === null) {
    state._firstStart = event.at;
    state.selfStarted = event.type === 'start' && event.at.getTime() === state.reportedAt.getTime();
  }
  state.status = 'working';
  state.startedAt = event.at;
  state.leadPerson = person;
  state.segmentStartedAt = event.at;
  state.handedOver = false;
}

function applyJoin(state: InternalState, event: BhavinEvent, seq: number): void {
  const person = actor(event, seq);
  if (state.status !== 'working' && state.status !== 'waiting') {
    throw new Error(`join_requires_active_work at seq ${seq}`);
  }
  if (event.type !== 'join') return;
  const match = state._crew.some(
    (member) =>
      member.person === person &&
      member.role === event.payload.role &&
      member.joinedAt.getTime() === event.at.getTime(),
  );
  if (!match) throw new Error(`join_crew_mismatch at seq ${seq}`);
}

function nextLead(state: InternalState, leaving: string, at: Date): string | null {
  return (
    state._crew
      .filter(
        (member) =>
          member.role === 'primary' &&
          member.person !== leaving &&
          (member.leftAt === null || member.leftAt.getTime() > at.getTime()),
      )
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.person ?? null
  );
}

function applyLeave(state: InternalState, event: BhavinEvent, seq: number): void {
  const person = actor(event, seq);
  if (!active(state.status)) throw new Error(`leave_requires_active at seq ${seq}`);
  const match = state._crew.some(
    (member) =>
      member.person === person &&
      member.leftAt?.getTime() === event.at.getTime() &&
      member.leftReason === event.text,
  );
  if (!match) throw new Error(`leave_crew_mismatch at seq ${seq}`);
  if (state.leadPerson === person) state.leadPerson = nextLead(state, person, event.at);
}

function applyCrewEvent(state: InternalState, event: BhavinEvent, seq: number): void {
  if (event.type === 'join') applyJoin(state, event, seq);
  if (event.type === 'leave') applyLeave(state, event, seq);
}

function applyPauseOrResume(state: InternalState, event: BhavinEvent, seq: number): void {
  if (event.type === 'pause') {
    const person = actor(event, seq);
    if (state.status !== 'working') throw new Error(`pause_requires_working at seq ${seq}`);
    state.status = 'waiting';
    state.waitReason = event.payload.reason;
    state.waitSince = event.at;
    state.pausedByPerson = person;
    state.expectedBackAt = event.payload.expectedBackAt;
    if (event.payload.assignTo !== null) state.assignedToPerson = event.payload.assignTo;
  } else if (event.type === 'resume') {
    const person = actor(event, seq);
    if (state.status !== 'waiting') throw new Error(`resume_requires_waiting at seq ${seq}`);
    state.status = 'working';
    state.leadPerson = person;
    state.segmentStartedAt = event.at;
    state.waitReason = null;
    state.waitSince = null;
  }
}

function applyTransferOrUpdate(state: InternalState, event: BhavinEvent, seq: number): void {
  if (event.type === 'transfer') {
    actor(event, seq);
    if (state.status !== 'working') throw new Error(`transfer_requires_working at seq ${seq}`);
    state.status = 'open';
    state.handedOver = true;
    state.handoverSince = event.at;
    state.transferToPerson = event.payload.to;
    state.transferToShift = event.payload.toShift;
    state.transfers += 1;
    state.leadPerson = null;
    state.segmentStartedAt = null;
  } else if (event.type === 'update') {
    actor(event, seq);
    if (!active(state.status)) throw new Error(`update_requires_active at seq ${seq}`);
    if (event.payload.spare !== null) state.waitingSpare = event.payload.spare;
    if (event.payload.expectedBackAt !== null) state.expectedBackAt = event.payload.expectedBackAt;
  }
}

function assertActiveStopped(state: InternalState, seq: number): void {
  if (state.kind !== 'stopped' || (state.status !== 'working' && state.status !== 'waiting')) {
    throw new Error(`machine_requires_active_stopped at seq ${seq}`);
  }
}

function applyRunning(state: InternalState, at: Date, seq: number): void {
  assertActiveStopped(state, seq);
  if (state.machineRunningAt !== null && state.machineStoppedAt === null) {
    throw new Error(`repeated_running at seq ${seq}`);
  }
  state.machineRunningAt = at;
  state.machineStoppedAt = null;
}

function applyStopped(state: InternalState, at: Date, seq: number): void {
  assertActiveStopped(state, seq);
  if (state.machineRunningAt === null || state.machineStoppedAt !== null) {
    throw new Error(`stopped_requires_running at seq ${seq}`);
  }
  state.machineStoppedAt = at;
}

function applyMachineEvent(state: InternalState, event: BhavinEvent, seq: number): void {
  if (event.type === 'upgrade_kind') {
    if (state.kind !== 'support' || !active(state.status)) {
      throw new Error(`upgrade_requires_active_support at seq ${seq}`);
    }
    state.kind = 'stopped';
    state.kindUpgradedAt = event.at;
  }
  if (event.type === 'running') applyRunning(state, event.at, seq);
  if (event.type === 'stopped') applyStopped(state, event.at, seq);
}

function hasReportAt(reports: BhavinReport[], at: Date): boolean {
  return reports.length === 1 && reports[0]?.submittedAt.getTime() === at.getTime();
}

function applyClose(state: InternalState, event: BhavinEvent, seq: number): void {
  const person = actor(event, seq);
  const pastClose = state._past && seq === 1 && state.status === 'open';
  if (state.status !== 'working' && !pastClose) {
    throw new Error(`close_requires_working at seq ${seq}`);
  }
  if (event.type !== 'close') return;
  if (event.payload.kind === 'report' && !hasReportAt(state._reports, event.at)) {
    throw new Error(`close_report_mismatch at seq ${seq}`);
  }
  state.status = 'closed';
  state.closedAt = event.at;
  state.closedByPerson = person;
  state.closeKind = event.payload.kind;
  state.closeNote = event.text;
}

function applyLateReport(state: InternalState, event: BhavinEvent, seq: number): void {
  actor(event, seq);
  if (state.status !== 'closed' || state.closeKind !== 'no_report') {
    throw new Error(`late_report_requires_no_report at seq ${seq}`);
  }
  if (!hasReportAt(state._reports, event.at))
    throw new Error(`late_report_timestamp at seq ${seq}`);
  state.closeKind = 'report';
}

function applyCloseOrReport(state: InternalState, event: BhavinEvent, seq: number): void {
  if (event.type === 'close') applyClose(state, event, seq);
  if (event.type === 'report') applyLateReport(state, event, seq);
}

function applyCancelOrRestore(state: InternalState, event: BhavinEvent, seq: number): void {
  if (event.type === 'cancel') {
    actor(event, seq);
    if (!active(state.status) || event.payload.previousStatus !== state.status) {
      throw new Error(`cancel_previous_status at seq ${seq}`);
    }
    state._previousStatus = state.status;
    state.status = 'cancelled';
    state.cancelledAt = event.at;
    return;
  }
  if (event.type !== 'restore') return;
  actor(event, seq);
  const previous = state._previousStatus;
  if (state.status !== 'cancelled' || previous === null || state.cancelledAt === null) {
    throw new Error(`restore_requires_cancel at seq ${seq}`);
  }
  if (event.at.getTime() - state.cancelledAt.getTime() > WEEK_MS) {
    throw new Error(`restore_after_seven_days at seq ${seq}`);
  }
  if (
    previous === 'working' &&
    !state._segments.some(
      (segment) =>
        segment.person === state.leadPerson && segment.startedAt.getTime() === event.at.getTime(),
    )
  ) {
    throw new Error(`restore_lead_segment at seq ${seq}`);
  }
  state.status = previous;
  state.cancelledAt = null;
  state.segmentStartedAt = event.at;
  state.waitSince = previous === 'waiting' ? event.at : null;
}

function toDomainEvent(event: BhavinEvent): TicketEvent {
  const base = { type: event.type, at: event.at } as TicketEvent;
  if (event.type === 'pause') {
    return { ...base, reason: event.payload.reason, isVendor: event.payload.isVendor };
  }
  if (event.type === 'cancel') {
    return {
      ...base,
      status: event.payload.previousStatus,
      ...(event.text === null ? {} : { reason: event.text }),
    };
  }
  return { ...base, ...(event.text === null ? {} : { reason: event.text }) };
}

export function applyImportedEvent(
  state: MutableImportedState,
  event: BhavinEvent,
  seq: number,
): TicketEvent {
  if (event.type === 'edit') return applyImportedEdit(state, event, seq);
  const internal = state as InternalState;
  applyDownOrStart(internal, event, seq);
  applyCrewEvent(internal, event, seq);
  applyPauseOrResume(internal, event, seq);
  applyTransferOrUpdate(internal, event, seq);
  applyMachineEvent(internal, event, seq);
  applyCloseOrReport(internal, event, seq);
  applyCancelOrRestore(internal, event, seq);
  return toDomainEvent(event);
}
