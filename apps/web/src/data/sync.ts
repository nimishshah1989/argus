import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { listDrafts, queueByOwner } from '../offline/outbox.js';

export type SyncId = 'online' | 'offline' | 'sending' | 'draft';

/** First match wins: no connection, then work waiting to go, then drafts, then all clear. */
export function syncId(input: { online: boolean; queued: number; drafts: number }): SyncId {
  if (!input.online) return 'offline';
  if (input.queued > 0) return 'sending';
  if (input.drafts > 0) return 'draft';
  return 'online';
}

/** `null` follows the browser; the gallery sets `false` to show the offline state. */
export const OnlineContext = createContext<boolean | null>(null);

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  const forced = useContext(OnlineContext);
  const browser = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return forced ?? browser;
}

const REFRESH_MS = 3000;

/**
 * Reads the outbox on mount, on connection change and every 3 s; a storage failure counts as 0. Only the
 * current person's queued work is "sending": what someone else queued is held, never sent from here.
 */
export function useSyncStatus(): SyncId {
  const online = useOnline();
  const [counts, setCounts] = useState({ queued: 0, drafts: 0 });
  useEffect(() => {
    let alive = true;
    const refresh = async (): Promise<void> => {
      const [queued, drafts] = await Promise.all([
        queueByOwner().then(
          (split) => split.mine,
          () => 0,
        ),
        listDrafts().then(
          (list) => list.length,
          () => 0,
        ),
      ]);
      if (alive) setCounts({ queued, drafts });
    };
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [online]);
  return syncId({ online, ...counts });
}
