import type { CrewMember, RestorableStatus, WorkSegment } from '../types.js';
import { canCancel, canClose, canWork } from '../permissions.js';
import { apply, assertWorking, clampAt, closeSegments, TransitionError } from './helpers.js';
import type { Command, TransitionInput, TransitionResult } from './types.js';

export function start(
  input: TransitionInput,
  command: Extract<Command, { type: 'start' }>,
): TransitionResult {
  if (input.ticket.status !== 'open') throw new TransitionError('Can only start an open ticket');
  if (input.segments.some((segment) => segment.role === 'lead' && !segment.endedAt)) {
    throw new TransitionError('Ticket already has an open lead segment');
  }
  if (
    !canWork({
      role: input.ctx.role,
      loginId: input.ctx.loginId,
      personId: input.ctx.personId,
      shared: input.ctx.shared,
    })
  ) {
    throw new TransitionError('Not allowed');
  }
  const at = clampAt(command.at ?? input.ctx.now, input);
  const ticket = {
    status: 'working' as const,
    startedAt: at,
    leadPersonId: command.personId,
    segmentStartedAt: at,
    handedOver: false,
  };
  const event = { type: command.pickup ? ('pickup' as const) : ('start' as const) };
  const segment: WorkSegment = { personId: command.personId, role: 'lead', startedAt: at };
  return apply(input, { ticket, event, at, segments: [...input.segments, segment] });
}

export function pause(
  input: TransitionInput,
  command: Extract<Command, { type: 'pause' }>,
): TransitionResult {
  assertWorking(input);
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'waiting' as const,
    waitReason: command.reason,
    waitSince: at,
    assignedToPersonId: command.assignToPersonId ?? input.ticket.assignedToPersonId,
  };
  return apply(input, {
    ticket,
    event: { type: 'pause', reason: command.reason },
    at,
    segments: closeSegments(input.segments, at),
  });
}

export function resume(
  input: TransitionInput,
  command: Extract<Command, { type: 'resume' }>,
): TransitionResult {
  if (input.ticket.status !== 'waiting')
    throw new TransitionError('Can only resume a waiting ticket');
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'working' as const,
    leadPersonId: command.personId,
    segmentStartedAt: at,
    waitReason: null,
    waitSince: null,
  };
  const segment: WorkSegment = { personId: command.personId, role: 'lead', startedAt: at };
  return apply(input, {
    ticket,
    event: { type: 'resume' },
    at,
    segments: [...input.segments, segment],
  });
}

export function transfer(
  input: TransitionInput,
  command: Extract<Command, { type: 'transfer' }>,
): TransitionResult {
  assertWorking(input);
  const at = clampAt(input.ctx.now, input);
  const ticket = {
    status: 'open' as const,
    handedOver: true,
    handoverSince: at,
    transferToPersonId: command.toPersonId ?? null,
    transferToShift: command.toShift ?? null,
    transfers: input.ticket.transfers + 1,
    leadPersonId: null,
    segmentStartedAt: null,
  };
  return apply(input, {
    ticket,
    event: { type: 'transfer', reason: command.note },
    at,
    segments: closeSegments(input.segments, at),
  });
}

export function update(
  input: TransitionInput,
  command: Extract<Command, { type: 'update' }>,
): TransitionResult {
  if (!['open', 'working', 'waiting'].includes(input.ticket.status))
    throw new TransitionError('Cannot update a closed ticket');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: {},
    event: { type: 'update', reason: command.text },
    at,
    segments: input.segments,
  });
}

export function machineRunning(
  input: TransitionInput,
  command: Extract<Command, { type: 'machineRunning' }>,
): TransitionResult {
  if (input.ticket.kind !== 'stopped')
    throw new TransitionError('Only a stopped ticket has a running machine');
  const at = clampAt(command.at ?? input.ctx.now, input);
  return apply(input, {
    ticket: { machineRunningAt: at, machineStoppedAt: null },
    event: { type: 'running' },
    at,
    segments: input.segments,
  });
}

export function machineStopped(
  input: TransitionInput,
  _command: Extract<Command, { type: 'machineStopped' }>,
): TransitionResult {
  if (!input.ticket.machineRunningAt) throw new TransitionError('Machine is not running');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { machineStoppedAt: at },
    event: { type: 'stopped' },
    at,
    segments: input.segments,
  });
}

export function close(
  input: TransitionInput,
  command: Extract<Command, { type: 'close' }>,
): TransitionResult {
  assertWorking(input);
  if (
    !canClose(
      {
        role: input.ctx.role,
        loginId: input.ctx.loginId,
        personId: input.ctx.personId,
        shared: input.ctx.shared,
      },
      {
        raisedLoginId: input.ticket.raisedLoginId,
        leadPersonId: input.ticket.leadPersonId,
        startedAt: input.ticket.startedAt,
        status: input.ticket.status,
        crew: input.crew,
      },
    )
  ) {
    throw new TransitionError('Not allowed to close');
  }
  const at = clampAt(command.at ?? input.ctx.now, input);
  const ticket = {
    status: 'closed' as const,
    closedAt: at,
    closedByPersonId: command.personId,
    closeKind: command.kind,
    closeNote: command.note ?? null,
  };
  return apply(input, {
    ticket,
    event: { type: 'close', reason: command.note },
    at,
    segments: closeSegments(input.segments, at),
  });
}

export function cancel(
  input: TransitionInput,
  command: Extract<Command, { type: 'cancel' }>,
): TransitionResult {
  const actor = {
    role: input.ctx.role,
    loginId: input.ctx.loginId,
    personId: input.ctx.personId,
    shared: input.ctx.shared,
  };
  if (
    !canCancel(actor, {
      raisedLoginId: input.ticket.raisedLoginId,
      leadPersonId: input.ticket.leadPersonId,
      startedAt: input.ticket.startedAt,
      status: input.ticket.status,
      crew: input.crew,
    })
  ) {
    throw new TransitionError('Not allowed to cancel');
  }
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { status: 'cancelled' as const },
    event: {
      type: 'cancel',
      reason: command.reason,
      status: input.ticket.status as RestorableStatus,
    },
    at,
    segments: closeSegments(input.segments, at),
  });
}

export function join(
  input: TransitionInput,
  command: Extract<Command, { type: 'join' }>,
): TransitionResult {
  if (!['working', 'waiting'].includes(input.ticket.status))
    throw new TransitionError('Can only join a live ticket');
  if (
    !canWork({
      role: input.ctx.role,
      loginId: input.ctx.loginId,
      personId: input.ctx.personId,
      shared: input.ctx.shared,
    })
  )
    throw new TransitionError('Not allowed');
  if (input.crew.some((member) => member.personId === command.personId && !member.leftAt))
    throw new TransitionError('Already on this ticket');
  const at = clampAt(input.ctx.now, input);
  const crew: CrewMember[] = [...input.crew, { personId: command.personId, role: command.role }];
  const segments =
    input.ticket.status === 'working'
      ? [
          ...input.segments,
          { personId: command.personId, role: command.role, startedAt: at } as WorkSegment,
        ]
      : input.segments;
  return apply(input, { ticket: {}, event: { type: 'join' }, at, segments, crew });
}

export function leave(
  input: TransitionInput,
  command: Extract<Command, { type: 'leave' }>,
): TransitionResult {
  if (!input.crew.some((member) => member.personId === command.personId && !member.leftAt))
    throw new TransitionError('Not on this ticket');
  const at = clampAt(input.ctx.now, input);
  const crew: CrewMember[] = input.crew.map((member) =>
    member.personId === command.personId
      ? { ...member, leftAt: at, leftReason: command.reason }
      : member,
  );
  const segments = input.segments.map((segment) =>
    segment.personId === command.personId && !segment.endedAt
      ? { ...segment, endedAt: at }
      : segment,
  );
  let leadPersonId = input.ticket.leadPersonId;
  if (input.ticket.leadPersonId === command.personId) {
    leadPersonId =
      crew.find((member) => member.role === 'primary' && !member.leftAt)?.personId ?? null;
  }
  return apply(input, {
    ticket: { leadPersonId },
    event: { type: 'leave', reason: command.reason },
    at,
    segments,
    crew,
  });
}

export function upgradeKind(
  input: TransitionInput,
  _command: Extract<Command, { type: 'upgradeKind' }>,
): TransitionResult {
  if (input.ticket.kind !== 'support')
    throw new TransitionError('Only a support ticket can be upgraded');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { kind: 'stopped', kindUpgradedAt: at },
    event: { type: 'upgrade_kind' },
    at,
    segments: input.segments,
  });
}

export function lateReport(
  input: TransitionInput,
  _command: Extract<Command, { type: 'lateReport' }>,
): TransitionResult {
  if (input.ticket.status !== 'closed' || input.ticket.closeKind !== 'no_report')
    throw new TransitionError('Only a closed no-report ticket takes a late report');
  const at = clampAt(input.ctx.now, input);
  return apply(input, {
    ticket: { closeKind: 'report' },
    event: { type: 'report' },
    at,
    segments: input.segments,
  });
}
