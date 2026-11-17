import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getBrand, getConfig, setToken, signIn } from '../../api.js';
import { describeFailure, rememberWho } from '../../data/index.js';
import { WizardPage } from '../../patterns/wizard-page.js';
import { BrandHeader } from '../../ui/brand-header.js';
import { Page, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import { lastUsername, rememberUsername } from './last-username.js';
import { landingPath } from '../../roles.js';
import { Fields, Notice, SIGNED_OUT_PARAM, signInError } from './parts.js';

async function mustChangePasswordFirst(): Promise<boolean> {
  try {
    await getConfig();
    return false;
  } catch (error) {
    return error instanceof ApiError && error.code === 'must_change_password';
  }
}

/** Sign-in (slice 3, T1): one step, no step counter; a remembered username puts the cursor in the password. */
export function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState('');
  const form = { username, setUsername, password, setPassword };
  const company = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company ?? '';
  const [error, setError] = useState('');
  async function send(): Promise<void | false> {
    setError('');
    try {
      const reply = await signIn({ username: username.trim(), password });
      setToken(reply.token);
      rememberWho(reply.user);
      rememberUsername(username.trim());
      // Only a shared phone with nobody acting could show "Who is using this phone?" before a
      // temporary password: ask /config first there (it answers must_change_password, and the data
      // layer then opens /password). Everyone else goes straight on; their first call does the same.
      const asksWho = reply.user.shared && !reply.user.actingPersonId;
      if (asksWho && (await mustChangePasswordFirst())) return false;
      navigate(asksWho ? '/who' : landingPath(reply.user.role));
    } catch (caught) {
      // The screen says what happened; the console keeps the real error for whoever has to find out why.
      if (!(caught instanceof ApiError && caught.code === 'unauthenticated'))
        console.error(`sign-in failed: ${describeFailure(caught)}`, caught);
      setError(t(signInError(caught)));
      return false;
    }
  }
  const body = (
    <Stack gap={4}>
      <Notice error={error} signedOut={params.has(SIGNED_OUT_PARAM) && !error} />
      <Fields form={form} />
    </Stack>
  );
  const ready = Boolean(username.trim() && password);
  const lead = <BrandHeader name={company} detail={t('signin.desk')} />;
  const step = { lead, body, action: t('login.signIn'), ready };
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
        {t('signin.hint')}
      </Text>
    </Page>
  );
}
