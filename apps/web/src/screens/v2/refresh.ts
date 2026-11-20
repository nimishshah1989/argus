import { useEffect, useRef } from 'react';
import { QueryObserver, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { analyticsFiguresQuery } from '../../analytics-figures.js';

/**
 * Calls `onNewFigures` each time the engine's figures are refetched with a newer copy. A v1 screen read the figures with
 * `useQuery`, so the app's 30-second refetch kept it current; a v2 model is built from the reply once, so it is built
 * again whenever this says the reply changed. Returns the way to stop watching.
 */
export function watchFigures(client: QueryClient, onNewFigures: () => void): () => void {
  const observer = new QueryObserver(client, analyticsFiguresQuery);
  let seen = client.getQueryState(analyticsFiguresQuery.queryKey)?.dataUpdatedAt ?? 0;
  return observer.subscribe(({ dataUpdatedAt }) => {
    if (dataUpdatedAt === seen) return;
    const first = seen === 0;
    seen = dataUpdatedAt;
    if (!first) onNewFigures();
  });
}

/** A screen built from the engine's figures stays as current as v1 was: it is asked to load again when they refresh. */
export function useRefreshOnFigures(reload: () => void): void {
  const client = useQueryClient();
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => watchFigures(client, () => latest.current()), [client]);
}
