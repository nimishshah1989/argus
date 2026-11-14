import type {
  ActorContext,
  CrewMember,
  RestorableStatus,
  TicketEvent,
  WorkSegment,
} from '../types.js';
import type { Ticket } from '../ticket.js';

export type Command =
  | { type: 'start'; personId: string; at?: Date; pickup?: boolean }
  | { type: 'pause'; personId: string; reason: string; note?: string; assignToPersonId?: string }
  | { type: 'resume'; personId: string; note?: string }
  | { type: 'transfer'; personId: string; toPersonId?: string; toShift?: string; note: string }
  | { type: 'update'; personId: string; text: string }
  | { type: 'machineRunning'; personId: string; at?: Date }
  | { type: 'machineStopped'; personId: string; at?: Date }
  | {
      type: 'close';
      personId: string;
      kind: 'report' | 'no_report' | 'done';
      at?: Date;
      note?: string;
    }
  | { type: 'cancel'; personId: string; reason: string }
  | { type: 'join'; personId: string; role: 'primary' | 'support' }
  | { type: 'leave'; personId: string; reason: string }
  | { type: 'upgradeKind'; personId: string }
  | { type: 'lateReport'; personId: string }
  | { type: 'restore'; personId: string; reason: string; toStatus?: RestorableStatus }
  | { type: 'correct'; personId: string; reason: string; changes: CorrectChanges }
  /** `steps`: the texts the person confirmed, kept on the history entry as they were worded then. */
  | { type: 'confirmLockout'; personId: string; steps: string[] };

export interface CorrectChanges {
  reportedAt?: Date;
  startedAt?: Date;
  closedAt?: Date;
  problem?: string;
  machineId?: string | null;
  kind?: 'stopped' | 'support' | 'general';
  leadPersonId?: string | null;
  closedByPersonId?: string | null;
  /** A number sets the minutes by hand; null takes the setting off again. */
  handsOnOverrideMin?: number | null;
  waitingOverrideMin?: number | null;
}

export interface TransitionInput {
  ticket: Ticket;
  events: TicketEvent[];
  segments: WorkSegment[];
  crew: CrewMember[];
  command: Command;
  ctx: ActorContext & { now: Date };
}

export interface TransitionResult {
  ticket: Ticket;
  events: TicketEvent[];
  segments: WorkSegment[];
  crew: CrewMember[];
}
