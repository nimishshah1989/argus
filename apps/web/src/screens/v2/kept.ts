import { useRef } from 'react';
import { personKey } from '../../data/index.js';
import type { LoadState } from '../../ui/v2/screen-states.js';
import { modelToShow } from './refresh.js';

/**
 * The model a screen draws: the last good one while a load is on its way or failed on the connection, as v1 kept its
 * data, but only for the login and acting person it was read for. Another person's answer is never shown, and an
 * empty or refused answer replaces the model (that is news).
 */
export function useKept<M>(loaded: { state: LoadState; model?: M }): M | undefined {
  const last = useRef<{ who: string; model: M }>(undefined);
  if (loaded.state === 'ready' && loaded.model !== undefined)
    last.current = { who: personKey(), model: loaded.model };
  return modelToShow(loaded, last.current?.who === personKey() ? last.current.model : undefined);
}
