import type { Command, CorrectChanges } from '@uptimo/domain';
import type { CommandAction } from '@uptimo/shared';
import type { LoadedCtx, Tx } from './mapper.js';

type Builder = (body: Record<string, unknown>, personId: string, loaded: LoadedCtx) => Command;

const BUILDERS: Record<CommandAction, Builder> = {
  start: (body, personId, { ticket }) => ({
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
  'machine-stopped': (body, personId) => ({
    type: 'machineStopped',
    personId,
    at: body.at as Date | undefined,
  }),
  close: (body, personId) => ({
    type: 'close',
    personId,
    kind: body.kind as 'report' | 'no_report' | 'done',
    at: body.at as Date | undefined,
    note: body.note as string | undefined,
  }),
  report: (_body, personId) => ({ type: 'lateReport', personId }),
  cancel: (body, personId) => ({ type: 'cancel', personId, reason: body.reason as string }),
  restore: (body, personId, { events }) => {
    const cancel = [...events].reverse().find((event) => event.type === 'cancel');
    const toStatus = (cancel?.payload.previousStatus as 'open' | 'working' | 'waiting') ?? 'open';
    return { type: 'restore', personId, reason: body.reason as string, toStatus };
  },
  correct: (body, personId) => {
    const { activeMin, waitMin, ...rest } = body.changes as CorrectChanges & {
      activeMin?: number | null;
      waitMin?: number | null;
    };
    return {
      type: 'correct',
      personId,
      reason: body.reason as string,
      changes: {
        ...rest,
        ...(activeMin === undefined ? {} : { handsOnOverrideMin: activeMin }),
        ...(waitMin === undefined ? {} : { waitingOverrideMin: waitMin }),
      },
    };
  },
  'upgrade-kind': (_body, personId) => ({ type: 'upgradeKind', personId }),
  acknowledge: (_body, personId, { onRoster }) => ({ type: 'acknowledge', personId, onRoster }),
};

export function buildCommand(tx: Tx, personId: string, loaded: LoadedCtx): Command {
  return BUILDERS[tx.action](tx.body, personId, loaded);
}
