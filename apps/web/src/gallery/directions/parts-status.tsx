import { useTranslation } from 'react-i18next';
import { statusMeaning, type StatusRef } from '../../ui/meaning.js';
import { TONE } from './parts-tile.js';
import { statusRole } from './variant.js';

/** A status as the directions draw it: the kit's icon and word, in the tone role the direction gives it (Running is grey). */
export function StatusChip({ status }: { status: StatusRef }) {
  const { t } = useTranslation();
  const { icon: Icon, label } = statusMeaning(status);
  const role = statusRole(status);
  return (
    <span
      data-status={`${status.group}.${status.id}`}
      data-tone={role}
      className={`inline-flex min-h-7 items-center gap-1.5 px-2.5 text-caption font-bold ${TONE[role].ink} ${TONE[role].tint}`}
      style={{ borderRadius: 'var(--proto-radius-chip)' }}
    >
      <Icon aria-hidden size={16} />
      {t(label)}
    </span>
  );
}
