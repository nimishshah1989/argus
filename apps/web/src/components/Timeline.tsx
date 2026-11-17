import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { TicketEvent } from '../api.js';
import { HistoryList, SectionTitle } from '../ui/detail-kit.js';
import { Stack } from '../ui/layout.js';
import type { Tone } from '../ui/status/index.js';
import { escalationLines, escalationLinks } from './escalation-history.js';
import { formatTime } from './format.js';

/** The dot colour of each kind of event (the word beside it says the same thing). */
const TONES: Record<string, Tone> = {
  down: 'danger',
  stopped: 'danger',
  upgrade_kind: 'danger',
  escalate: 'danger',
  escalation_ack: 'ok',
  start: 'info',
  pickup: 'info',
  lockout_confirmed: 'ok',
  resume: 'info',
  join: 'info',
  lead: 'info',
  restore: 'info',
  pause: 'hold',
  transfer: 'moved',
  running: 'ok',
  close: 'ok',
  report: 'ok',
};

const LABEL_KEYS: Record<string, string> = {
  down: 'timeline.down',
  escalate: 'timeline.escalate',
  escalation_ack: 'timeline.escalationAck',
  start: 'timeline.start',
  pickup: 'timeline.pickup',
  update: 'timeline.update',
  pause: 'timeline.pause',
  resume: 'timeline.resume',
  transfer: 'timeline.transfer',
  join: 'timeline.join',
  leave: 'timeline.leave',
  lead: 'timeline.lead',
  running: 'timeline.running',
  stopped: 'timeline.stopped',
  upgrade_kind: 'timeline.upgrade',
  close: 'timeline.close',
  report: 'timeline.report',
  cancel: 'timeline.cancel',
  restore: 'timeline.restore',
  edit: 'timeline.edit',
  task: 'timeline.task',
  acknowledge: 'timeline.acknowledge',
  lockout_confirmed: 'timeline.lockoutConfirmed',
  tag_add: 'timeline.tagAdd',
  tag_remove: 'timeline.tagRemove',
};

interface Props {
  events: TicketEvent[];
  names: Record<string, string>;
  reasonLabels: Record<string, string>;
  timeZone?: string;
  /** A head or admin gets "Set the ladder" beside a step that fired with no ladder; everyone else does not. */
  canSetLadder?: boolean;
}

export function Timeline({ events, names, reasonLabels, timeZone, canSetLadder = false }: Props) {
  const { t } = useTranslation();
  const escalation = escalationLines(events, names, t);
  const links = escalationLinks(events, canSetLadder);
  const items = events.map((event) => {
    const actor = event.actingPersonId ? names[event.actingPersonId] : undefined;
    // A lockout confirmation keeps the steps' wording in `reason`; it is what was confirmed, not a "Reason".
    const confirmedSteps = event.type === 'lockout_confirmed' ? event.reason : undefined;
    const link = links.get(event.seq);
    const reason =
      event.reason && event.reason !== event.text && !confirmedSteps
        ? t('timeline.reason', { reason: reasonLabels[event.reason] ?? event.reason })
        : undefined;
    return {
      key: event.seq,
      tone: TONES[event.type] ?? 'muted',
      title: t(LABEL_KEYS[event.type] ?? event.type),
      at: event.at,
      when: formatTime(event.at, timeZone),
      // The report event's text is the problem, which the header already shows.
      detail: [
        actor,
        event.type === 'down' ? undefined : event.text,
        escalation.get(event.seq),
        confirmedSteps,
        reason,
      ]
        .filter(Boolean)
        .join(' · '),
      action: link ? (
        <Link
          to={link.to}
          className="inline-flex min-h-target-min items-center rounded-xl bg-accent-tint px-4 text-body font-semibold text-accent-text"
        >
          {t(link.labelKey)}
        </Link>
      ) : undefined,
    };
  });
  return (
    <Stack gap={2}>
      <SectionTitle>{t('detail.history')}</SectionTitle>
      {items.length === 0 ? (
        <p className="text-body text-neutral-600">{t('timeline.empty')}</p>
      ) : (
        <HistoryList items={items} />
      )}
    </Stack>
  );
}
