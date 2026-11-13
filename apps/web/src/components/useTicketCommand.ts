import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, command, type CommandAction, type CommandBody } from '../api.js';

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
