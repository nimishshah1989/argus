import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getBrand, setToken, signIn } from '../../api.js';
import { WizardPage } from '../../patterns/wizard-page.js';
import { BrandHeader } from '../../ui/brand-header.js';
import { Page, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import { lastUsername, rememberUsername } from './last-username.js';
import { Fields, Notice, SIGNED_OUT_PARAM, signInError } from './parts.js';

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
      rememberUsername(username.trim());
      navigate('/floor');
    } catch (caught) {
      if (!(caught instanceof ApiError)) throw caught;
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
