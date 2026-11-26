import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { analyticsFiguresQuery } from '../../../analytics-figures.js';

/** How often v1's Today read again (the app's own query refetch): what needs you now must not go stale. */
export const REFRESH_MS = 30_000;

/** The reads a tick must ask the server for again: the figures (for the years asked), what needs a person now, and the Action Center. */
const reread = () => [
  analyticsFiguresQuery.queryKey,
  ['state'],
  ['analytics-action-center', 'one', null],
];

/** Calls `again` every `REFRESH_MS` until the returned function is called. */
export function refreshEvery(again: () => void): () => void {
  const timer = setInterval(again, REFRESH_MS);
  return () => clearInterval(timer);
}

/**
 * One tick: mark the live reads old, so the live reader (which serves anything under 30 seconds old from its cache) asks
 * the server again now, then ask for a new model. Without it a tick would find the cache just under 30 seconds old.
 */
export function rereadThen(client: QueryClient, again: () => void): void {
  for (const queryKey of reread())
    void client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
  again();
}

/** Keeps a screen's model fresh while it is open, every 30 seconds, through the live reader. */
export function useRefresh(again: () => void): void {
  const client = useQueryClient();
  const latest = useRef(again);
  latest.current = again;
  useEffect(() => refreshEvery(() => rereadThen(client, () => latest.current())), [client]);
}
