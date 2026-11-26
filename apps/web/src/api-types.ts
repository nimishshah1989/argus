import type { User } from '@uptimo/shared/auth';
import type { CommandReply, Ticket } from '@uptimo/shared/replies';
import type { BreakdownReportBody } from '@uptimo/shared/ticket';
import type { TaskInput } from '@uptimo/shared/tasks';
import type { CloseKind, TicketKind, TicketStatus } from '@uptimo/shared/ticket-reply';

/** The request and reply shapes the web app adds over `@uptimo/shared`; `api.ts` re-exports every one. */

export type RaiseKind = TicketKind;
export type Me = User;
export type BreakdownCategory = NonNullable<BreakdownReportBody['breakdownCategory']>;
export type CommandResult = CommandReply | { queued: true; id: string };

export type CorrectChanges = Partial<
  Pick<Ticket, 'reportedAt' | 'startedAt' | 'closedAt' | 'problem' | 'leadPersonId'>
> & { machineId?: string | null; kind?: RaiseKind; closedByPersonId?: string | null };

export type TicketListQuery = {
  status?: TicketStatus[];
  kind?: RaiseKind[];
  machineId?: string;
  personId?: string;
  raisedBy?: string;
  from?: string;
  to?: string;
  /** The channel a ticket was raised through; `['pm']` is the technician's PM job list (49c). */
  channel?: string[];
  cursor?: string;
  limit?: number;
};

/** The action bodies the desk sends; each command from DOMAIN.md §4. */
export type CommandBody =
  | { personId?: string }
  | { personId?: string; reasonCode: string; note?: string }
  | { personId?: string; text: string }
  | { personId?: string; note: string; toPersonId?: string }
  | {
      personId?: string;
      kind: CloseKind;
      at?: string;
      note?: string;
      report?: BreakdownReportBody;
      /** What a close leaves behind (ticket 19): the follow-up task. */
      task?: TaskInput;
      /** Asked only when a follow-up task is marked done: 0 to 1440. */
      taskDownMin?: number;
    }
  | { personId?: string; report: BreakdownReportBody }
  | { personId?: string; reason: string }
  | { personId?: string; role: 'primary' | 'support' }
  | { personId?: string; response: 'confirmed' | 'disputed'; reason?: string }
  | { reason: string; changes: CorrectChanges };
