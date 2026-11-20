import { useEffect, useRef } from 'react';

/** How often v1's Today read again (the app's own query refetch): what needs you now must not go stale. */
export const REFRESH_MS = 30_000;

/** Calls `again` every `REFRESH_MS` until the returned function is called. */
export function refreshEvery(again: () => void): () => void {
  const timer = setInterval(again, REFRESH_MS);
  return () => clearInterval(timer);
}

/** Keeps a screen's model fresh while it is open; the live reader serves a read younger than 30 seconds from its cache. */
export function useRefresh(again: () => void): void {
  const latest = useRef(again);
  latest.current = again;
  useEffect(() => refreshEvery(() => latest.current()), []);
}
