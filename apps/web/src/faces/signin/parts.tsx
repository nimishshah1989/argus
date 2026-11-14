import type { MessageKey } from '@uptimo/shared/i18n';
import { useState } from 'react';
import type { ApiError } from '../../api.js';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../ui/banner.js';
import { Checkbox, Input, Label } from '../../ui/input.js';
import { Stack } from '../../ui/layout.js';

/** The server's sign-in refusals in the catalogue's words; anything else reads as a failed sign-in. */
export function signInError(error: ApiError): MessageKey {
  if (error.code === 'rate_limited') return 'signin.tooMany';
  if (error.code === 'not_found') return 'signin.unknownCompany';
  return 'login.failed';
}

/** `/login?signedOut=1` is where the data layer sends a refused session. */
export const SIGNED_OUT_PARAM = 'signedOut';

/** Why the last attempt failed, or why the phone was signed out (v3.signin.05). */
export function Notice({ error, signedOut }: { error: string; signedOut: boolean }) {
  const { t } = useTranslation();
  if (error) return <Banner tone="error" title={error} />;
  if (!signedOut) return null;
  return (
    <Banner tone="attention" title={t('signin.signedOut')}>
      {t('signin.signedOutDetail')}
    </Banner>
  );
}

export interface SignInForm {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
}

/** Username, password and "Show password" (a real 52 px checkbox, as v3). */
export function Fields({ form }: { form: SignInForm }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const { username, setUsername, password, setPassword } = form;
  return (
    <>
      <Stack gap={2}>
        <Label htmlFor="signin-username">{t('login.username')}</Label>
        <Input
          id="signin-username"
          // eslint-disable-next-line i18next/no-literal-string -- browser autofill hint, not copy
          autoComplete="username"
          autoFocus={!username}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Stack>
      <Stack gap={2}>
        <Label htmlFor="signin-password">{t('login.password')}</Label>
        <Input
          id="signin-password"
          type={show ? 'text' : 'password'}
          // eslint-disable-next-line i18next/no-literal-string -- browser autofill hint, not copy
          autoComplete="current-password"
          autoFocus={Boolean(username)}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Stack>
      <Checkbox
        label={t('signin.showPassword')}
        checked={show}
        onChange={(e) => setShow(e.target.checked)}
      />
    </>
  );
}
