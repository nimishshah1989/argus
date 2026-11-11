import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ApiError,
  command,
  type CommandAction,
  type CommandBody,
  type CorrectChanges,
  type Ticket,
} from '../api.js';

export interface ActionSpec {
  action: CommandAction;
  label: string;
  primary?: boolean;
}

/** What the action model needs beyond the ticket: the acting person and the ticket's crew. */
export interface ActionContext {
  personId?: string | null;
  crew?: string[];
}

const WORK_ROLES = new Set(['technician', 'supervisor', 'head', 'admin']);

/** Work actions are technician and above (DOMAIN.md §3); the server still checks every one. */
export function canWork(role: string | undefined): boolean {
  return role !== undefined && WORK_ROLES.has(role);
}

/** The acting person is on the ticket when they are the lead or an active crew member. */
function isOnCrew(ticket: Ticket, context: ActionContext): boolean {
  const personId = context.personId;
  if (!personId) return false;
  if (ticket.leadPersonId === personId) return true;
  return (context.crew ?? []).includes(personId);
}

/** join/leave: whoever is not on the crew may join; whoever is may leave (DOMAIN.md §2). */
function crewActions(ticket: Ticket, context: ActionContext): ActionSpec[] {
  if (!context.personId) return [];
  if (!['open', 'working', 'waiting'].includes(ticket.status)) return [];
  if (isOnCrew(ticket, context)) return [spec('leave', 'Leave')];
  return [spec('join', 'Add me as support')];
}

/** A person may cancel their own ticket only while it is open and nobody has started it. */
export function canCancelOwn(ticket: Ticket, personId: string | null | undefined): boolean {
  if (!personId) return false;
  return (
    ticket.reportedByPersonId === personId && ticket.status === 'open' && ticket.startedAt === null
  );
}

function spec(action: CommandAction, label: string, primary = false): ActionSpec {
  return { action, label, primary };
}

/** The actions legal from the ticket's status in DOMAIN.md §2. */
export function legalActions(ticket: Ticket, context: ActionContext = {}): ActionSpec[] {
  const machineRunning = Boolean(ticket.machineRunningAt);
  const canMarkRunning = ticket.kind === 'stopped';
  if (ticket.status === 'open') {
    return [
      spec('start', ticket.handedOver ? 'Pick up' : 'Start', true),
      ...(ticket.handedOver ? [spec('update', 'Update')] : []),
      ...crewActions(ticket, context),
      spec('cancel', 'Cancel'),
    ];
  }
  if (ticket.status === 'working') {
    return [
      spec('update', 'Update', true),
      spec('pause', 'Pause'),
      spec('transfer', 'Transfer'),
      ...(canMarkRunning ? [spec('machine-running', 'Machine running')] : []),
      ...(machineRunning ? [spec('machine-stopped', 'Machine stopped')] : []),
      ...crewActions(ticket, context),
      spec('close', 'Close'),
      spec('cancel', 'Cancel'),
    ];
  }
  if (ticket.status === 'waiting') {
    return [
      spec('resume', 'Resume', true),
      spec('update', 'Update'),
      ...(canMarkRunning ? [spec('machine-running', 'Machine running')] : []),
      ...(machineRunning ? [spec('machine-stopped', 'Machine stopped')] : []),
      ...crewActions(ticket, context),
      spec('cancel', 'Cancel'),
    ];
  }
  return [];
}

/** The one field-free action a card offers for its status. */
export function quickAction(ticket: Ticket): ActionSpec | null {
  if (ticket.status === 'open') return spec('start', ticket.handedOver ? 'Pick up' : 'Start');
  if (ticket.status === 'waiting') return spec('resume', 'Resume');
  if (ticket.status === 'working' && ticket.kind === 'stopped' && !ticket.machineRunningAt) {
    return spec('machine-running', 'Machine running');
  }
  return null;
}

export interface CorrectChangeValues {
  reportedAt?: string;
  startedAt?: string;
  closedAt?: string;
  problem?: string;
  machineId?: string;
  kind?: string;
}

function filled(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

/** Only the fields the admin actually filled become a correction (DOMAIN.md §4 `correct`). */
export function buildCorrectChanges(values: CorrectChangeValues): CorrectChanges {
  const changes: CorrectChanges = {};
  const reportedAt = filled(values.reportedAt);
  if (reportedAt) changes.reportedAt = reportedAt;
  const startedAt = filled(values.startedAt);
  if (startedAt) changes.startedAt = startedAt;
  const closedAt = filled(values.closedAt);
  if (closedAt) changes.closedAt = closedAt;
  const problem = filled(values.problem);
  if (problem) changes.problem = problem;
  if (values.machineId) changes.machineId = values.machineId;
  if (values.kind === 'stopped' || values.kind === 'support' || values.kind === 'general') {
    changes.kind = values.kind;
  }
  return changes;
}

export function hasCorrectChanges(changes: CorrectChanges): boolean {
  return Object.keys(changes).length > 0;
}

/** Runs one command, then refreshes the board and the open detail. Errors stay on the screen. */
export function useTicketCommand() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (input: { ticketId: string; action: CommandAction; body: CommandBody }) =>
      command(input.ticketId, input.action, input.body),
  });

  async function run(ticketId: string, action: CommandAction, body: CommandBody): Promise<boolean> {
    setError(null);
    try {
      await mutation.mutateAsync({ ticketId, action, body });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save. Try again.');
      return false;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['state'] }),
      queryClient.invalidateQueries({ queryKey: ['ticket'] }),
      // Personal lists (floor My complaints, desk Mine) show the moved ticket too.
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    ]);
    return true;
  }

  return { run, error, pending: mutation.isPending };
}
