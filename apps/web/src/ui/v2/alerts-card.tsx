import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  disablePush,
  enablePush,
  ensurePushBinding,
  getPushState,
  sendTestPush,
  type PushState,
} from '../../push.js';
import { Bell, BellOff } from '../icon.js';
import { Button } from './button.js';

type Shown = 'on' | 'off' | 'blocked' | 'unsupported';

/** What each state says: the chip (on its v2 tint), the headline, the line under it. */
const COPY: Record<Shown, { chip: string; pill: string; title: string; body: string }> = {
  on: {
    chip: 'alerts.chip.on',
    pill: 'v2-pill-gain',
    title: 'alerts.on.title',
    body: 'alerts.on.body',
  },
  off: {
    chip: 'alerts.chip.off',
    pill: 'v2-pill-neutral',
    title: 'alerts.off.title',
    body: 'alerts.off.body',
  },
  blocked: {
    chip: 'alerts.chip.blocked',
    pill: 'v2-pill-risk',
    title: 'alerts.blocked.title',
    body: 'alerts.blocked.body',
  },
  unsupported: {
    chip: 'alerts.chip.unavailable',
    pill: 'v2-pill-neutral',
    title: 'alerts.unsupported.title',
    body: 'alerts.unsupported.body',
  },
};

const SHOWN: Record<PushState, Shown> = {
  loading: 'off',
  unsupported: 'unsupported',
  unavailable: 'unsupported',
  off: 'off',
  on: 'on',
  denied: 'blocked',
};

/** Keeps a phone's alerts on whoever is acting now (the acting-person rule), even with the sheet shut. */
export function usePushBinding(personId: string | undefined): void {
  useEffect(() => {
    if (personId) void ensurePushBinding(personId);
  }, [personId]);
}

function useAlerts(personId: string | undefined) {
  const { t } = useTranslation();
  const [state, setState] = useState<PushState>('loading');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => getPushState().then(setState);
  useEffect(() => {
    void refresh();
  }, []);

  async function busyWith(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    await work();
    setBusy(false);
  }
  const turnOn = () =>
    busyWith(async () => {
      if (!personId) return;
      setNote('');
      const result = await enablePush(personId);
      if (result === 'subscribed') setState('on');
      if (result === 'denied') setState('denied');
      if (result === 'unsupported') setState('unsupported');
      if (result === 'unavailable') setNote(t('alerts.noServer'));
    });
  const turnOff = () =>
    busyWith(async () => {
      await disablePush();
      setState('off');
    });
  const test = () =>
    busyWith(async () => {
      setNote((await sendTestPush()) ? t('alerts.testSent') : t('alerts.testFailed'));
    });

  return { state, note, busy, on: { turnOn, turnOff, test, check: refresh } };
}

/** v1's Alerts control on the v2 kit: Off, On, Blocked by the browser, Not available. One send path: `push.ts`. */
export function AlertsCard({ personId }: { personId: string | undefined }) {
  const { t } = useTranslation();
  const { state, note, busy, on } = useAlerts(personId);
  if (state === 'loading') return null;
  const view = SHOWN[state];
  const copy = COPY[view];
  const StateIcon = view === 'on' ? Bell : BellOff;
  return (
    <section aria-label={t('alerts.title')} className="v2-card v2-floor-card">
      <div className="v2-floor-card-head">
        <h3 className="v2-h3 v2-floor-inline">
          <StateIcon aria-hidden size={20} />
          {t('alerts.title')}
        </h3>
        <span className={`v2-pill ${copy.pill}`}>{t(copy.chip)}</span>
      </div>
      <p className="v2-h3">{t(copy.title)}</p>
      <p className="v2-sub">{t(copy.body)}</p>
      {view === 'off' ? (
        <Button disabled={busy} onClick={() => void on.turnOn()}>
          {t('alerts.turnOn')}
        </Button>
      ) : null}
      {view === 'on' ? (
        <div className="v2-floor-pair">
          <Button disabled={busy} onClick={() => void on.test()}>
            {t('alerts.test')}
          </Button>
          <Button disabled={busy} onClick={() => void on.turnOff()}>
            {t('alerts.turnOff')}
          </Button>
        </div>
      ) : null}
      {view === 'blocked' ? (
        <Button onClick={() => void on.check()}>{t('alerts.checkAgain')}</Button>
      ) : null}
      {note ? (
        <p role="status" className="v2-sub">
          {note}
        </p>
      ) : null}
    </section>
  );
}
