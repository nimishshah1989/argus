import { useTranslation } from 'react-i18next';
import { STATUS, type StatusDef, type StatusGroup, type StatusId, type Tone } from './index.js';

const TONE: Record<Tone, string> = {
  danger: 'bg-danger-tint text-danger-ink',
  info: 'bg-info-tint text-info-ink',
  warning: 'bg-warning-tint text-warning-ink',
  hold: 'bg-hold-tint text-hold-ink',
  moved: 'bg-moved-tint text-moved-ink',
  ok: 'bg-ok-tint text-ok-ink',
  muted: 'bg-muted-tint text-muted-ink',
};

/** Colour never carries meaning alone: every pill has an icon and a label. */
export function StatusPill<G extends StatusGroup>({ group, id }: { group: G; id: StatusId<G> }) {
  const { t } = useTranslation();
  const { tone, icon: Icon, label } = (STATUS[group] as Record<string, StatusDef>)[id]!;
  return (
    <span
      data-status={`${group}.${id}`}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-caption font-bold ${TONE[tone]}`}
    >
      <Icon aria-hidden size={16} />
      {t(label)}
    </span>
  );
}
