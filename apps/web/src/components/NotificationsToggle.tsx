import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api.js';
import {
  disablePush,
  enablePush,
  ensurePushBinding,
  getPushState,
  type PushState,
} from '../push.js';

const buttonClass =
  'min-h-13 shrink-0 rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-50';

/** The account-area control: shows the push state and lets the person enable or disable it. */
export function NotificationsToggle() {
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const personId = me.data?.user.actingPersonId;
  const [state, setState] = useState<PushState>('loading');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getPushState().then((value) => {
      if (active) setState(value);
    });
    return () => {
      active = false;
    };
  }, []);

  // The acting-person re-subscribe rule, run silently when the phone's acting person changes.
  useEffect(() => {
    if (state === 'on' && personId) void ensurePushBinding(personId);
  }, [state, personId]);

  async function toggle() {
    if (!personId || busy) return;
    setBusy(true);
    setNote('');
    if (state === 'on') {
      await disablePush();
      setState('off');
    } else {
      const result = await enablePush(personId);
      if (result === 'subscribed') setState('on');
      if (result === 'denied') {
        setState('denied');
        setNote('Notifications are blocked on this phone.');
      }
      if (result === 'unavailable') setNote('Notifications are not available on this server.');
      if (result === 'unsupported') setState('unsupported');
    }
    setBusy(false);
  }

  if (state === 'loading' || state === 'unsupported') return null;

  const status =
    state === 'on'
      ? 'Notifications are on for this phone.'
      : state === 'denied'
        ? note || 'Notifications are blocked on this phone.'
        : note || 'Get an alert when tickets change.';

  return (
    <section
      aria-label="Notifications"
      data-testid="notifications-toggle"
      className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
    >
      <p className="text-sm text-neutral-600">{status}</p>
      {state !== 'denied' && (
        <button type="button" onClick={() => void toggle()} disabled={busy} className={buttonClass}>
          {busy ? 'Saving…' : state === 'on' ? 'Turn off' : 'Enable'}
        </button>
      )}
    </section>
  );
}
