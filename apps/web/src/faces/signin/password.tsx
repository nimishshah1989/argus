import type { MessageKey } from '@uptimo/shared/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, changePassword } from '../../api.js';
import { WizardPage } from '../../patterns/wizard-page.js';
import { Input, Label } from '../../ui/input.js';
import { Page, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import { Notice } from './parts.js';

const MIN_LENGTH = 8;

/** The server's refusals in the catalogue's words; anything else is the wizard's generic error. */
function refusal(error: unknown): MessageKey | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'unauthenticated') return 'signin.wrongPassword';
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

/** Change a temporary password (slice 3, T2): opened whenever the server says the login must change it. */
export function ChangePassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const differ = Boolean(next && again && next !== again);
  async function send(): Promise<false> {
    setError('');
    try {
      await changePassword({ old, password: next });
    } catch (caught) {
      const key = refusal(caught);
      if (!key) throw caught;
      setError(t(key));
      return false;
    }
    navigate('/floor');
    return false;
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
  const ready = Boolean(old) && next.length >= MIN_LENGTH && next === again;
  const step = { title: t('signin.passwordTitle'), body, action: t('signin.savePassword'), ready };
  return (
    <Page>
      <WizardPage
        title={t('login.signIn')}
        aside=""
        quietOnline
        steps={[step]}
        offlineAllowed={false}
        onFinish={send}
        result={null}
      />
      <Text size="footnote" tone="secondary">
        {t('signin.passwordHint')}
      </Text>
    </Page>
  );
}
