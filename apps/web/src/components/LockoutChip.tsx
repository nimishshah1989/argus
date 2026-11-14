import { useTranslation } from 'react-i18next';
import { Lock } from '../ui/icon.js';
import { TONE_FILL } from '../ui/meaning.js';

/** The "Needs lockout" chip: warning tone, a lock and the words (colour never works alone). */
export function LockoutChip() {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-caption font-bold ${TONE_FILL.warning}`}
    >
      <Lock aria-hidden size={16} />
      {t('lockout.chip')}
    </span>
  );
}
