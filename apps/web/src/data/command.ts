import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
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
 * A flagged ticket's Start, Pick up, Resume or Join: the person's own lockout confirmation first, then the
 * command. Neither is queued offline, because the server decides on the confirmation standing at that moment.
 */
export async function confirmLockoutThen(
  ticketId: string,
  input: { stepCodes: string[]; action: CommandAction; body: CommandBody },
): Promise<void> {
  const { stepCodes, action, body } = input;
  // The server acts as the session's own person; a cached id could be stale after a shared phone switches people.
  const rest: Record<string, unknown> = { ...body };
  delete rest.personId;
  await sendCommand(ticketId, 'lockout-confirm', { stepCodes }, idempotencyKey());
  await sendCommand(ticketId, action, rest, idempotencyKey());
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
  /** The error of the latest failed run, for a screen that words some refusals itself. */
  failure: () => unknown;
}

/** Runs one command, then refreshes the board and the open detail. Errors stay on the screen. */
export function useCommand(): CommandHandle {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const failed = useRef<unknown>(null);
  const mutation = useMutation({
    mutationFn: (input: { ticketId: string; action: CommandAction; body: CommandBody }) =>
      runCommand(input.ticketId, input.action, input.body),
  });

  async function run(ticketId: string, action: CommandAction, body: CommandBody): Promise<boolean> {
    setError(null);
    failed.current = null;
    try {
      await mutation.mutateAsync({ ticketId, action, body });
    } catch (caught) {
      failed.current = caught;
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

  return { run, error, pending: mutation.isPending, failure: () => failed.current };
}
