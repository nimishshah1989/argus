/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { queueByOwner } from '../offline/outbox.js';
import { Banner } from '../ui/banner.js';

const POLL_MS = 3_000;

/**
 * A quiet, non-interactive banner for the offline/queued state. It reads the browser's
 * `navigator.onLine` plus the outbox queue length (apps/web/src/offline/outbox.ts) and
 * refreshes on `online`/`offline` events and a light poll.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [heldBy, setHeldBy] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    function refresh() {
      setOnline(navigator.onLine);
      queueByOwner()
        .then((split) => {
          if (!active) return;
          setQueued(split.mine);
          setHeldBy(split.heldBy);
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

  const message = online ? t('offline.queued', { count: queued }) : t('offline.banner');
  return (
    <>
      {online && queued === 0 ? null : (
        <div data-testid="offline-banner">
          <Banner tone={online ? 'info' : 'offline'} title={message} />
        </div>
      )}
      {heldBy.map((who) => {
        const name = who || t('signin.heldEarlier');
        return (
          <Banner key={who} tone="attention" title={t('signin.held', { name })}>
            {t('signin.heldDetail', { name })}
          </Banner>
        );
      })}
    </>
  );
}
