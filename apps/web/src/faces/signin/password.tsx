import type { MessageKey } from '@uptimo/shared/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, changePassword, getMe, getToken } from '../../api.js';
import { landingPath, type LandingPath } from '../../roles.js';
import { WizardPage } from '../../patterns/wizard-page.js';
import { Button } from '../../ui/button.js';
import { Input, Label } from '../../ui/input.js';
import { Page, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import { Notice } from './parts.js';

const MIN_LENGTH = 8;

/** The server's refusals in the catalogue's words; anything else is the wizard's generic error. */
function refusal(error: unknown): MessageKey | null {
  if (!(error instanceof ApiError)) return null;
  // A wrong current password: 401 today, 422 for field "old" once the server stops sharing 401 with ended sessions.
  if (error.code === 'unauthenticated' || error.field === 'old') return 'signin.wrongPassword';
  if (error.code === 'rate_limited') return 'signin.tooMany';
  if (error.field === 'password') return 'signin.weakPassword';
  return null;
}

function Field(p: { id: string; label: string; value: string; set: (v: string) => void }) {
  return (
    <Stack gap={2}>
      <Label htmlFor={p.id}>{p.label}</Label>
      <Input
        id={p.id}
        type="password"
        // eslint-disable-next-line i18next/no-literal-string -- browser autofill hint, not copy
        autoComplete={p.id === 'password-old' ? 'current-password' : 'new-password'}
        value={p.value}
        onChange={(e) => p.set(e.target.value)}
      />
    </Stack>
  );
}

/** After the save: only now are the other phones signed out (review of PR 225). The landing asks who next, if needed. */
function Saved({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  return (
    <Stack gap={4}>
      <Text as="h3" size="title2" weight="bold">
        {t('signin.passwordSaved')}
      </Text>
      <Text tone="secondary">{t('signin.passwordHint')}</Text>
      <Button onClick={onContinue}>{t('signin.continue')}</Button>
    </Stack>
  );
}

/** Change a temporary password (slice 3, T2): opened whenever the server says the login must change it. */
export function ChangePassword() {
  const { t } = useTranslation();
  const signedIn = getToken() !== null;
  const navigate = useNavigate();
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [landing, setLanding] = useState<LandingPath>('/floor');
  const differ = Boolean(next && again && next !== again);
  async function send(): Promise<void | false> {
    setError('');
    try {
      await changePassword({ old, password: next });
    } catch (caught) {
      const key = refusal(caught);
      if (!key) throw caught;
      setError(t(key));
      return false;
    }
    // The same role rule as sign-in: a technician and above continue to the desk, the floor for the rest.
    const me = await getMe().catch(() => null);
    setLanding(landingPath(me?.user.role ?? ''));
  }
  const body = (
    <Stack gap={4}>
      <Notice error={error} signedOut={false} />
      <Field id="password-old" label={t('signin.currentPassword')} value={old} set={setOld} />
      <Field id="password-new" label={t('signin.newPassword')} value={next} set={setNext} />
      <Field
        id="password-again"
        label={t('signin.newPasswordAgain')}
        value={again}
        set={setAgain}
      />
      {differ ? <Text tone="danger">{t('signin.passwordsDiffer')}</Text> : null}
    </Stack>
  );
  const toLanding = () => navigate(landing);
  const ready = Boolean(old) && next.length >= MIN_LENGTH && next === again;
  const step = { title: t('signin.passwordTitle'), body, action: t('signin.savePassword'), ready };
  // No session (a bookmark, or signed out): nothing to change a password for; sign in first.
  if (!signedIn) return <Navigate to="/login" replace />;
  return (
    <Page>
      <WizardPage
        title={t('login.signIn')}
        aside=""
        quietOnline
        steps={[step]}
        offlineAllowed={false}
        onFinish={send}
        result={<Saved onContinue={toLanding} />}
      />
    </Page>
  );
}
