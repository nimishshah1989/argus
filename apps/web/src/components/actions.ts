import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, command, type CommandAction, type CommandBody, type Ticket } from '../api.js';

export interface ActionSpec {
  action: CommandAction;
  label: string;
  primary?: boolean;
}

const WORK_ROLES = new Set(['technician', 'supervisor', 'head', 'admin']);

/** Work actions are technician and above (DOMAIN.md §3); the server still checks every one. */
export function canWork(role: string | undefined): boolean {
  return role !== undefined && WORK_ROLES.has(role);
}

function spec(action: CommandAction, label: string, primary = false): ActionSpec {
  return { action, label, primary };
}

/** The actions legal from the ticket's status in DOMAIN.md §2. */
export function legalActions(ticket: Ticket): ActionSpec[] {
  const machineRunning = Boolean(ticket.machineRunningAt);
  const canMarkRunning = ticket.kind === 'stopped';
  if (ticket.status === 'open') {
    return [
      spec('start', ticket.handedOver ? 'Pick up' : 'Start', true),
      ...(ticket.handedOver ? [spec('update', 'Update')] : []),
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
      spec('close', 'Close'),
    ];
  }
  if (ticket.status === 'waiting') {
    return [
      spec('resume', 'Resume', true),
      spec('update', 'Update'),
      ...(canMarkRunning ? [spec('machine-running', 'Machine running')] : []),
      ...(machineRunning ? [spec('machine-stopped', 'Machine stopped')] : []),
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
    ]);
    return true;
  }

  return { run, error, pending: mutation.isPending };
}
