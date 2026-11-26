import { useEffect, useRef } from 'react';
import { QueryObserver, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { analyticsFiguresQuery, yearsFrom } from '../../analytics-figures.js';
import type { LoadState } from '../../ui/v2/screen-states.js';

/**
 * Calls `onNewFigures` each time the engine's figures are refetched with a newer copy. A v1 screen read the figures with
 * `useQuery`, so the app's 30-second refetch kept it current; a v2 model is built from the reply once, so it is built
 * again whenever this says the reply changed. Returns the way to stop watching.
 */
export function watchFigures(client: QueryClient, onNewFigures: () => void): () => void {
  const { queryKey, queryFn } = analyticsFiguresQuery;
  const observer = new QueryObserver(client, { queryKey, queryFn });
  let seen = client.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
  return observer.subscribe(({ dataUpdatedAt }) => {
    if (dataUpdatedAt === seen) return;
    const first = seen === 0;
    seen = dataUpdatedAt;
    if (!first) onNewFigures();
  });
}

/**
 * A screen built from the engine's figures stays as current as v1 was: it is asked to load again when they refresh.
 * It watches the figures for the years the address asks for, so a new choice watches its own copy (ADR 0063).
 */
export function useRefreshOnFigures(reload: () => void): void {
  const client = useQueryClient();
  const latest = useRef(reload);
  latest.current = reload;
  const years = yearsFrom(useLocation().search);
  useEffect(() => watchFigures(client, () => latest.current()), [client, years]);
}

/**
 * The model a screen draws. While a refresh loads, or when a refresh fails after a good load (the app's 30-second
 * refetch met a server error or a lost connection), the screen keeps the last good model, as v1 kept its data; the
 * error and offline states are for a first load only. An empty or refused answer replaces the model: that is news.
 */
export function modelToShow<M>(
  loaded: { state: LoadState; model?: M },
  lastGood: M | undefined,
): M | undefined {
  if (loaded.model !== undefined) return loaded.model;
  const keep = loaded.state === 'loading' || loaded.state === 'error' || loaded.state === 'offline';
  return keep ? lastGood : undefined;
}
