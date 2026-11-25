import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getBrand, getConfig, setToken, signIn } from '../../../api.js';
import { describeFailure, rememberWho, useOnline } from '../../../data/index.js';
import { lastUsername, rememberUsername } from '../../../faces/signin/last-username.js';
import { Notice, SIGNED_OUT_PARAM } from '../../../faces/signin/parts.js';
import { Button } from '../../../ui/v2/button.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import { nextPath, readyToSignIn, signInError } from './model.js';

async function mustChangePasswordFirst(): Promise<boolean> {
  try {
    await getConfig();
    return false;
  } catch (error) {
    return error instanceof ApiError && error.code === 'must_change_password';
  }
}

/** Username, password and "Show password". */
function Fields(f: {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
}): ReactElement {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <>
      <div className="v2-date-field">
        <label htmlFor="signin-username">{t('login.username')}</label>
        <input
          id="signin-username"
          autoComplete="username"
          autoFocus={!f.username}
          value={f.username}
          onChange={(e) => f.setUsername(e.target.value)}
        />
      </div>
      <div className="v2-date-field">
        <label htmlFor="signin-password">{t('login.password')}</label>
        <input
          id="signin-password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          autoFocus={Boolean(f.username)}
          value={f.password}
          onChange={(e) => f.setPassword(e.target.value)}
        />
      </div>
      <label>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />{' '}
        {t('signin.showPassword')}
      </label>
    </>
  );
}

/** S19 sign-in on the v2 kit: v1's exact flow; a remembered username puts the cursor in the password. */
export function SignInView(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const online = useOnline();
  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const company = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company ?? '';
  const ready = readyToSignIn(username, password) && online && !busy;

  async function send(): Promise<void> {
    if (!ready) return;
    setError('');
    setBusy(true);
    try {
      const reply = await signIn({ username: username.trim(), password });
      setToken(reply.token);
      rememberWho(reply.user);
      rememberUsername(username.trim());
      // Only a shared phone with nobody acting could show "Who is using this phone?" before a temporary
      // password: ask /config first there (the data layer then opens /password if it must change).
      const asksWho = reply.user.shared && !reply.user.actingPersonId;
      const next = nextPath(reply.user, asksWho && (await mustChangePasswordFirst()));
      if (next) navigate(next);
    } catch (caught) {
      // The screen says what happened; the console keeps the real error for whoever has to find out why.
      if (!(caught instanceof ApiError && caught.code === 'unauthenticated'))
        console.error(`sign-in failed: ${describeFailure(caught)}`, caught);
      setError(t(signInError(caught)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="v2-card v2-pad">
      <SectionHead title={company} sub={t('signin.desk')} />
      <Notice error={error} signedOut={params.has(SIGNED_OUT_PARAM) && !error} />
      <form
        onKeyDown={(e) => {
          // Enter in a field submits; on the button it already presses it.
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement) void send();
        }}
      >
        <Fields
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
        />
        <Button primary disabled={!ready} onClick={() => void send()}>
          {t('login.signIn')}
        </Button>
      </form>
      <p>{t('signin.hint')}</p>
    </main>
  );
}
