/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { applyUpdate, inChangeover, useWaitingUpdate } from '../app-update.js';
import { getConfig } from '../api.js';
import { Banner } from '../ui/banner.js';
import { Button } from '../ui/button.js';

const MINUTE_MS = 60_000;

/**
 * A new version waits until a person taps Update, and stays quiet during the shift changeover so it
 * never interrupts a handover. A wall TV (`auto`) has nobody to tap: it updates itself once the changeover is over.
 */
export function UpdateBanner({ auto = false }: { auto?: boolean }) {
  const { t } = useTranslation();
  const waiting = useWaitingUpdate();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  const quiet = inChangeover(now, config.data?.shifts ?? [], config.data?.timeZone ?? undefined);
  useEffect(() => {
    if (auto && waiting && config.data && !quiet) applyUpdate(waiting);
  }, [auto, waiting, config.data, quiet]);
  if (auto || !waiting || quiet) return null;
  return (
    <Banner
      tone="info"
      title={t('update.title')}
      action={
        <Button variant="tonal" onClick={() => applyUpdate(waiting)}>
          {t('update.action')}
        </Button>
      }
    >
      {t('update.body')}
    </Banner>
  );
}
