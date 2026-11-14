import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CommandAction, CommandBody, CommandResult, Ticket } from '../api.js';
import { enqueue, isQueueable } from '../offline/outbox.js';
import { ApiError, http, idempotencyKey, isOffline } from './client.js';

/** The raw command POST with a caller-supplied key (the outbox replays with the stored one). */
export function sendCommand(
  ticketId: string,
  action: CommandAction,
  body: object,
  key: string,
): Promise<{ ticket: Ticket }> {
  return http<{ ticket: Ticket }>(`/api/v1/tickets/${ticketId}/${action}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });
}

/**
 * Runs one command. Offline, the four offline-writable commands go to the outbox with a fresh
 * Idempotency-Key and resolve as `{ queued: true }`; everything else needs a connection.
 */
export async function runCommand(
  ticketId: string,
  action: CommandAction,
  body: CommandBody,
): Promise<CommandResult> {
  const key = idempotencyKey();
  if (isOffline() && isQueueable(action)) {
    const entry = await enqueue({
      action,
      ticketId,
      body,
      idempotencyKey: key,
      at: new Date().toISOString(),
    });
    return { queued: true, id: entry.id };
  }
  return sendCommand(ticketId, action, body, key);
}

export interface CommandHandle {
  run(ticketId: string, action: CommandAction, body: CommandBody): Promise<boolean>;
  error: string | null;
  pending: boolean;
}

/** Runs one command, then refreshes the board and the open detail. Errors stay on the screen. */
export function useCommand(): CommandHandle {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (input: { ticketId: string; action: CommandAction; body: CommandBody }) =>
      runCommand(input.ticketId, input.action, input.body),
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
