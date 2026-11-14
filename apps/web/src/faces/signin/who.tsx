import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, chooseActing, clearToken, getActingChoices, getMe, signOut } from '../../api.js';
import { WizardPage } from '../../patterns/wizard-page.js';
import { Card } from '../../ui/card.js';
import { Label, Select } from '../../ui/input.js';
import { Page, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import { ensurePushBinding } from '../../push.js';
import { replayOutbox } from '../../offline/replay.js';
import { Notice } from './parts.js';

/** "Signed in as" the login, and that it is a shared phone. */
function SignedInAs() {
  const { t } = useTranslation();
  const user = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user;
  return (
    <Card>
      <Text size="footnote" tone="secondary">
        {t('signin.signedInAs')}
      </Text>
      <Text weight="semibold">{user?.username ?? ''}</Text>
      {user?.shared ? (
        <Text size="footnote" tone="secondary">
          {t('signin.sharedPhone')}
        </Text>
      ) : null}
    </Card>
  );
}

/** "Your name" from the people the server lets this phone choose (GET /auth/acting), by name. */
function NamePicker({ value, set }: { value: string; set: (id: string) => void }) {
  const { t } = useTranslation();
  const all = useQuery({ queryKey: ['acting-choices'], queryFn: getActingChoices }).data;
  const people = [...(all?.people ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Stack gap={2}>
      <Label htmlFor="who-person">{t('signin.yourName')}</Label>
      <Select id="who-person" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">{t('signin.selectName')}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </Stack>
  );
}

/** Who is using this shared phone (slice 3, T2): asked once after sign-in and whenever the server asks again. */
export function Who() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [personId, setPersonId] = useState('');
  const [error, setError] = useState('');
  async function send(): Promise<false> {
    setError('');
    try {
      await chooseActing(personId);
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.field === 'actingPersonId')) throw caught;
      setError(t('signin.chooseName'));
      return false;
    }
    await getMe();
    // A shared phone that already allows alerts follows the person now using it, and only them.
    await ensurePushBinding(personId).catch(() => undefined);
    // What this person queued earlier on this phone goes now (review of PR 225); others' stays held.
    await replayOutbox().catch(() => undefined);
    for (const key of ['me', 'config', 'state', 'tickets'])
      await queryClient.invalidateQueries({ queryKey: [key] });
    navigate('/floor');
    return false;
  }
  async function leave(): Promise<void> {
    await signOut().catch(() => undefined);
    clearToken();
    navigate('/login');
  }
  const body = (
    <Stack gap={4}>
      <Text tone="secondary">{t('signin.whoLede')}</Text>
      <Notice error={error} signedOut={false} />
      <NamePicker value={personId} set={setPersonId} />
    </Stack>
  );
  const step = {
    lead: <SignedInAs />,
    title: t('signin.whoTitle'),
    body,
    action: t('signin.continue'),
    ready: Boolean(personId),
    back: t('login.signIn'),
    onBack: () => void leave(),
  };
  return (
    <Page>
      <WizardPage
        title={t('login.signIn')}
        aside={t('kit.wizard.step', { n: 2, total: 2 })}
        quietOnline
        steps={[step]}
        offlineAllowed={false}
        onFinish={send}
        result={null}
      />
    </Page>
  );
}
