/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  disablePush,
  enablePush,
  ensurePushBinding,
  getPushState,
  sendTestPush,
  type PushState,
} from '../push.js';
import { Bell, BellOff, type IconComponent } from '../ui/icon.js';
import { Button } from '../ui/button.js';

type Shown = 'on' | 'off' | 'blocked' | 'unsupported';

/** What each state says: the chip, the headline, the line under it (slice 5, Alerts frames). */
const COPY: Record<Shown, { chip: string; tone: string; title: string; body: string }> = {
  on: {
    chip: 'alerts.chip.on',
    tone: 'bg-ok-tint text-ok-ink',
    title: 'alerts.on.title',
    body: 'alerts.on.body',
  },
  off: {
    chip: 'alerts.chip.off',
    tone: 'bg-muted-tint text-muted-ink',
    title: 'alerts.off.title',
    body: 'alerts.off.body',
  },
  blocked: {
    chip: 'alerts.chip.blocked',
    tone: 'bg-warning-tint text-warning-ink',
    title: 'alerts.blocked.title',
    body: 'alerts.blocked.body',
  },
  unsupported: {
    chip: 'alerts.chip.unavailable',
    tone: 'bg-muted-tint text-muted-ink',
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

function Actions({
  view,
  busy,
  on,
}: {
  view: Shown;
  busy: boolean;
  on: { turnOn: () => void; turnOff: () => void; test: () => void; check: () => void };
}) {
  const { t } = useTranslation();
  return (
    <>
      {view === 'off' ? (
        <Button variant="tonal" disabled={busy} onClick={() => on.turnOn()}>
          {t('alerts.turnOn')}
        </Button>
      ) : null}
      {view === 'on' ? (
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => on.test()}>
            {t('alerts.test')}
          </Button>
          <Button variant="quiet" disabled={busy} onClick={() => on.turnOff()}>
            {t('alerts.turnOff')}
          </Button>
        </div>
      ) : null}
      {view === 'blocked' ? (
        <Button variant="secondary" onClick={() => on.check()}>
          {t('alerts.checkAgain')}
        </Button>
      ) : null}
    </>
  );
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

/** The Alerts control: Off, On, Blocked by the browser, Not available. One send path: `push.ts`. */
export function AlertsCard({ personId }: { personId: string | undefined }) {
  const { t } = useTranslation();
  const { state, note, busy, on } = useAlerts(personId);
  if (state === 'loading') return null;
  const view = SHOWN[state];
  const copy = COPY[view];
  const Icon: IconComponent = view === 'on' ? Bell : BellOff;
  return (
    <section
      aria-label={t('alerts.title')}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-title3 font-semibold">
          <Icon aria-hidden size={20} />
          {t('alerts.title')}
        </h3>
        <span className={`rounded-chip px-3 py-1 text-caption font-bold ${copy.tone}`}>
          {t(copy.chip)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold">{t(copy.title)}</p>
        <p className="text-footnote text-neutral-600">{t(copy.body)}</p>
      </div>
      <Actions view={view} busy={busy} on={on} />
      {note ? (
        <p role="status" className="text-footnote text-neutral-600">
          {note}
        </p>
      ) : null}
    </section>
  );
}
