import { useTranslation } from 'react-i18next';
import type { TicketEvent } from '../api.js';
import { HistoryList, SectionTitle } from '../ui/detail-kit.js';
import { Stack } from '../ui/layout.js';
import type { Tone } from '../ui/status/index.js';
import { formatTime } from './format.js';

/** The dot colour of each kind of event (the word beside it says the same thing). */
const TONES: Record<string, Tone> = {
  down: 'danger',
  stopped: 'danger',
  upgrade_kind: 'danger',
  start: 'info',
  pickup: 'info',
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
  tag_add: 'timeline.tagAdd',
  tag_remove: 'timeline.tagRemove',
};

interface Props {
  events: TicketEvent[];
  names: Record<string, string>;
  reasonLabels: Record<string, string>;
  timeZone?: string;
}

export function Timeline({ events, names, reasonLabels, timeZone }: Props) {
  const { t } = useTranslation();
  const items = events.map((event) => {
    const actor = event.actingPersonId ? names[event.actingPersonId] : undefined;
    const reason =
      event.reason && event.reason !== event.text
        ? t('timeline.reason', { reason: reasonLabels[event.reason] ?? event.reason })
        : undefined;
    return {
      key: event.seq,
      tone: TONES[event.type] ?? 'muted',
      title: t(LABEL_KEYS[event.type] ?? event.type),
      at: event.at,
      when: formatTime(event.at, timeZone),
      // The report event's text is the problem, which the header already shows.
      detail: [actor, event.type === 'down' ? undefined : event.text, reason]
        .filter(Boolean)
        .join(' · '),
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
