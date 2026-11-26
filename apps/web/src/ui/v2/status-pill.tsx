import { useTranslation } from 'react-i18next';
import { statusMeaning, type StatusRef } from '../meaning.js';
import type { StatusGroup, StatusId, Tone } from '../status/index.js';

/** The v1 status tones on the v2 pill tints: red only for a loss, amber to watch, blue for planned work. */
const PILL: Record<Tone, string> = {
  danger: 'v2-pill-loss',
  warning: 'v2-pill-risk',
  info: 'v2-pill-plan',
  moved: 'v2-pill-plan',
  hold: 'v2-pill-decide',
  ok: 'v2-pill-gain',
  muted: 'v2-pill-neutral',
};

/** A status of any group (`ui/status`) as a v2 pill: its icon and its word, so colour never works alone. */
export function StatusPill<G extends StatusGroup>({ group, id }: { group: G; id: StatusId<G> }) {
  const { t } = useTranslation();
  const { tone, icon: StatusIcon, label } = statusMeaning({ group, id } as StatusRef);
  return (
    <span data-status={`${group}.${id}`} className={`v2-pill ${PILL[tone]}`}>
      <StatusIcon aria-hidden size={14} />
      {t(label)}
    </span>
  );
}
