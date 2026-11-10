import { useEffect, useState } from 'react';
import { queueLength } from '../offline/outbox.js';

const POLL_MS = 3_000;

/**
 * A quiet, non-interactive banner for the offline/queued state. It reads the browser's
 * `navigator.onLine` plus the outbox queue length (apps/web/src/offline/outbox.ts) and
 * refreshes on `online`/`offline` events and a light poll.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    let active = true;

    function refresh() {
      setOnline(navigator.onLine);
      queueLength()
        .then((count) => {
          if (active) setQueued(count);
        })
        .catch(() => {
          if (active) setQueued(0);
        });
    }

    function onOnline() {
      setOnline(true);
      refresh();
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(timer);
    };
  }, []);

  if (online && queued === 0) return null;

  const message = online ? `${queued} queued, reconnecting…` : 'Offline — closes will be queued';

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="mt-3 rounded-xl bg-waiting/10 px-4 py-3 text-sm font-medium text-waiting"
    >
      {message}
    </div>
  );
}
