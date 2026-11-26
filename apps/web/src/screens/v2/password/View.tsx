import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { changePassword, getMe, getToken } from '../../../api.js';
import { describeFailure, useOnline } from '../../../data/index.js';
import { landingPath } from '../../../roles.js';
import { Button } from '../../../ui/v2/button.js';
import { ErrorNotice } from '../../../ui/v2/notice.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import { signInError } from '../sign-in/model.js';
import { passwordReady, passwordRefusal } from './model.js';

function Field(p: {
  id: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  value: string;
  set: (v: string) => void;
  autoFocus?: boolean;
}): ReactElement {
  return (
    <div className="v2-date-field">
      <label htmlFor={p.id}>{p.label}</label>
      <input
        id={p.id}
        type="password"
        autoComplete={p.autoComplete}
        autoFocus={p.autoFocus}
        value={p.value}
        onChange={(e) => p.set(e.target.value)}
      />
    </div>
  );
}

/* eslint-disable i18next/no-literal-string -- browser autofill hints, not copy */
function Fields(f: {
  old: string;
  setOld: (v: string) => void;
  next: string;
  setNext: (v: string) => void;
  again: string;
  setAgain: (v: string) => void;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <Field
        id="password-old"
        label={t('signin.currentPassword')}
        autoComplete="current-password"
        value={f.old}
        set={f.setOld}
        autoFocus
      />
      <Field
        id="password-new"
        label={t('signin.newPassword')}
        autoComplete="new-password"
        value={f.next}
        set={f.setNext}
      />
      <Field
        id="password-again"
        label={t('signin.newPasswordAgain')}
        autoComplete="new-password"
        value={f.again}
        set={f.setAgain}
      />
    </>
  );
}
/* eslint-enable i18next/no-literal-string */

/** After the save: only now are the other phones signed out. The landing asks who next, if needed. */
function Saved({ onContinue }: { onContinue: () => void }): ReactElement {
  const { t } = useTranslation();
  return (
    <main className="v2-card v2-pad">
      <SectionHead title={t('signin.passwordSaved')} />
      <p>{t('signin.passwordHint')}</p>
      <Button primary onClick={onContinue}>
        {t('signin.continue')}
      </Button>
    </main>
  );
}

/** S19 "Change password" on the v2 kit: v1's exact flow, laid out like sign-in. */
export function PasswordView(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const online = useOnline();
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [landing, setLanding] = useState<string | null>(null);
  const ready = passwordReady(old, next, again) && online && !busy;
  const differ = Boolean(next && again && next !== again);

  // No session (a bookmark, or signed out): nothing to change a password for; sign in first.
  if (getToken() === null) return <Navigate to="/login" replace />;

  async function send(): Promise<void> {
    if (!ready) return;
    setError('');
    setBusy(true);
    try {
      await changePassword({ old, password: next });
      // The same role rule as sign-in: a technician and above continue to the desk, the floor for the rest.
      const me = await getMe().catch(() => null);
      setLanding(landingPath(me?.user.role ?? ''));
    } catch (caught) {
      const key = passwordRefusal(caught);
      if (!key) console.error(`change password failed: ${describeFailure(caught)}`, caught);
      setError(t(key ?? signInError(caught)));
    } finally {
      setBusy(false);
    }
  }

  if (landing !== null) return <Saved onContinue={() => navigate(landing)} />;

  return (
    <main className="v2-card v2-pad">
      <SectionHead title={t('signin.passwordTitle')} />
      <ErrorNotice error={error} />
      <form
        onKeyDown={(e) => {
          // Enter in a field submits; on the button it already presses it.
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement) void send();
        }}
      >
        <Fields
          old={old}
          setOld={setOld}
          next={next}
          setNext={setNext}
          again={again}
          setAgain={setAgain}
        />
        {differ ? <p role="alert">{t('signin.passwordsDiffer')}</p> : null}
        <Button primary disabled={!ready} onClick={() => void send()}>
          {t('signin.savePassword')}
        </Button>
      </form>
    </main>
  );
}
