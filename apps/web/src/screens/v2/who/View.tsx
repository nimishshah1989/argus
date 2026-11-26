import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getActingChoices, getBrand, getMe } from '../../../api.js';
import { SignOutSheet } from '../../../components/AccountSheet.js';
import { useOnline } from '../../../data/index.js';
import { actAs } from '../../../faces/signin/act-as.js';
import { Notice } from '../../../faces/signin/parts.js';
import { StateNotice } from '../../../patterns/frame.js';
import { offlineNotice } from '../../../patterns/view-state.js';
import { landingPath } from '../../../roles.js';
import { Button } from '../../../ui/v2/button.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import { SelectField } from '../../../ui/v2/select-field.js';
import { whoChoices, whoError } from './model.js';

/** "Your name" from the people this phone may choose (GET /auth/acting); a failed load shows the error state with retry. */
function NamePicker({ value, set }: { value: string; set: (id: string) => void }): ReactElement {
  const { t } = useTranslation();
  const choices = useQuery({ queryKey: ['acting-choices'], queryFn: getActingChoices });
  if (choices.isError && !choices.data)
    // eslint-disable-next-line i18next/no-literal-string -- state name, not copy
    return <StateNotice state="error" empty="" onRetry={() => void choices.refetch()} />;
  return (
    <SelectField
      label={t('signin.yourName')}
      all={t('signin.selectName')}
      value={value}
      options={whoChoices(choices.data?.people ?? []).map((p) => ({ key: p.id, label: p.name }))}
      onChange={set}
    />
  );
}

/** S19 "Who is using this phone" on the v2 kit: v1's exact flow, laid out like the sign-in card (step 2 of 2). */
export function WhoView(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnline();
  const [personId, setPersonId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const company = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company ?? '';
  const user = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user;
  const ready = Boolean(personId) && online && !busy;
  const offline = offlineNotice(online, false);

  async function send(): Promise<void> {
    if (!ready) return;
    setError('');
    setBusy(true);
    try {
      const me = await actAs(queryClient, personId);
      navigate(landingPath(me.user.role));
    } catch (caught) {
      setError(t(whoError(caught) ?? 'kit.wizard.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="v2-card v2-pad">
      <SectionHead
        title={t('login.signIn')}
        sub={`${company} · ${t('kit.wizard.step', { n: 2, total: 2 })}`}
      />
      <p>{t('signin.signedInAs')}</p>
      <p>
        <strong>{user?.username ?? ''}</strong>
      </p>
      {user?.shared ? <p>{t('signin.sharedPhone')}</p> : null}
      <h2>{t('signin.whoTitle')}</h2>
      <p>{t('signin.whoLede')}</p>
      <Notice error={error} signedOut={false} />
      {offline ? (
        <p role="status" className="v2-sub">
          {t(offline)}
        </p>
      ) : null}
      <NamePicker value={personId} set={setPersonId} />
      <Button primary disabled={!ready} onClick={() => void send()}>
        {t('signin.continue')}
      </Button>
      <Button onClick={() => setConfirming(true)}>{t('login.signIn')}</Button>
      <SignOutSheet open={confirming} onOpenChange={setConfirming} />
    </main>
  );
}
