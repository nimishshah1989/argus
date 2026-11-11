import type { TicketEvent } from '@uptimo/domain';
import type { BhavinEditChange, BhavinEvent } from './event-schema.js';
import type { MutableImportedState } from './state-events.js';

type EditEvent = Extract<BhavinEvent, { type: 'edit' }>;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  return Object.is(left, right);
}

function currentValue(state: MutableImportedState, field: BhavinEditChange['field']): unknown {
  if (field === 'handsOnOverrideMin') return state.overrides.handsOnOverrideMin ?? null;
  if (field === 'waitingOverrideMin') return state.overrides.waitingOverrideMin ?? null;
  return state[field];
}

function assignChange(state: MutableImportedState, change: BhavinEditChange): void {
  const value = change.to;
  switch (change.field) {
    case 'reportedAt':
      state.reportedAt = value as Date;
      break;
    case 'startedAt':
      state.startedAt = value as Date;
      break;
    case 'closedAt':
      state.closedAt = value as Date;
      break;
    case 'problem':
      state.problem = value as string;
      break;
    case 'machineCode':
      state.machineCode = value as string | null;
      break;
    case 'kind':
      state.kind = value as MutableImportedState['kind'];
      break;
    case 'leadPerson':
      state.leadPerson = value as string | null;
      break;
    case 'closedByPerson':
      state.closedByPerson = value as string | null;
      break;
    case 'handsOnOverrideMin':
      state.overrides.handsOnOverrideMin = value as number;
      break;
    case 'waitingOverrideMin':
      state.overrides.waitingOverrideMin = value as number;
      break;
  }
}

export function applyImportedEdit(
  state: MutableImportedState,
  event: EditEvent,
  seq: number,
): TicketEvent {
  if (event.by === null) throw new Error(`missing_actor at seq ${seq}`);
  if (state.status === 'cancelled') throw new Error(`edit_on_cancelled at seq ${seq}`);
  if (
    state.status === 'closed' &&
    state.closedAt &&
    event.at.getTime() - state.closedAt.getTime() > WEEK_MS
  ) {
    throw new Error(`edit_after_seven_days at seq ${seq}`);
  }
  for (const change of event.payload.changes) {
    if (!sameValue(currentValue(state, change.field), change.from)) {
      throw new Error(`stale_edit ${change.field} at seq ${seq}`);
    }
    assignChange(state, change);
  }
  state.editedAt = event.at;
  return {
    type: 'edit',
    at: event.at,
    ...(event.text === null ? {} : { reason: event.text }),
    changes: event.payload.changes,
  };
}
