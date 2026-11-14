import { useTranslation } from 'react-i18next';
import { TONE_FILL, statusMeaning, type StatusRef } from '../meaning.js';
import type { StatusGroup, StatusId } from './index.js';

/** Colour never carries meaning alone: every pill has an icon and a label. */
export function StatusPill<G extends StatusGroup>({ group, id }: { group: G; id: StatusId<G> }) {
  const { t } = useTranslation();
  const { tone, icon: Icon, label } = statusMeaning({ group, id } as StatusRef);
  return (
    <span
      data-status={`${group}.${id}`}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-caption font-bold ${TONE_FILL[tone]}`}
    >
      <Icon aria-hidden size={16} />
      {t(label)}
    </span>
  );
}
