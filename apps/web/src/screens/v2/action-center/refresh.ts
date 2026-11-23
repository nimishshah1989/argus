import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { actionCenterBoardQuery } from '../../../api.js';

/** How often v1's Action Center read again (the app's own query refetch): a nudge raised or settled must show. */
export const REFRESH_MS = 30_000;

/**
 * One tick, or one answered write: mark the board old, so the live reader (which serves anything under 30 seconds old
 * from its cache) asks the server again now, then ask for a new model.
 */
export function rereadThen(client: QueryClient, again: () => void): void {
  void client.invalidateQueries({
    queryKey: actionCenterBoardQuery.queryKey,
    exact: true,
    refetchType: 'none',
  });
  again();
}

/** Calls `again` every `REFRESH_MS` until the returned function is called. */
export function refreshEvery(client: QueryClient, again: () => void): () => void {
  const timer = setInterval(() => rereadThen(client, again), REFRESH_MS);
  return () => clearInterval(timer);
}

/** Keeps the page fresh while it is open, every 30 seconds, through the live reader. */
export function useRefresh(again: () => void): void {
  const client = useQueryClient();
  const latest = useRef(again);
  latest.current = again;
  useEffect(() => refreshEvery(client, () => latest.current()), [client]);
}
