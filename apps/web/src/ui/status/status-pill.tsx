import { useTranslation } from 'react-i18next';
import { STATUS, type StatusDef, type StatusGroup, type StatusId, type Tone } from './index.js';

const TONE: Record<Tone, string> = {
  danger: 'border-danger text-danger',
  info: 'border-info text-info',
  warning: 'border-warning text-warning',
  hold: 'border-hold text-hold',
  moved: 'border-moved text-moved',
  ok: 'border-ok text-ok',
  muted: 'border-muted text-muted',
};

/** Colour never carries meaning alone: every pill has an icon and a label. */
export function StatusPill<G extends StatusGroup>({ group, id }: { group: G; id: StatusId<G> }) {
  const { t } = useTranslation();
  const { tone, icon: Icon, label } = (STATUS[group] as Record<string, StatusDef>)[id]!;
  return (
    <span
      data-status={`${group}.${id}`}
      className={`inline-flex items-center gap-1 rounded-lg border bg-surface px-2 py-1 text-footnote font-medium ${TONE[tone]}`}
    >
      <Icon aria-hidden size={16} />
      {t(label)}
    </span>
  );
}
