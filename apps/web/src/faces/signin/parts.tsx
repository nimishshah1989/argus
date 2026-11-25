import { useTranslation } from 'react-i18next';
import { Banner } from '../../ui/banner.js';

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
