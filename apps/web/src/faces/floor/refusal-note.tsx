import { useTranslation } from 'react-i18next';
import type { Refusal } from '../../components/signoff.js';
import { Text } from '../../ui/text.js';

/** The refusal a plain failure or another cell's phone gets, in words (frames 4 and 9). */
export function RefusalNote({ refusal }: { refusal: Refusal | null }) {
  const { t } = useTranslation();
  if (refusal?.kind === 'otherCell') return <Text tone="danger">{t('signoff.otherCell')}</Text>;
  if (refusal?.kind === 'notAllowed') return <Text tone="danger">{t('signoff.notAllowed')}</Text>;
  if (refusal?.kind === 'other') return <Text tone="danger">{t('signoff.failed')}</Text>;
  return null;
}
