import { useTranslation } from 'react-i18next';
import type { TicketEvent } from '../api.js';
import { formatTime } from './format.js';

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
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('timeline.title')}</h2>
      {events.length === 0 ? (
        <p className="mt-2 text-neutral-500">{t('timeline.empty')}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((event) => {
            const actor = event.actingPersonId ? names[event.actingPersonId] : undefined;
            return (
              <li key={event.seq} className="flex gap-3">
                <time dateTime={event.at} className="w-12 shrink-0 pt-0.5 text-sm text-neutral-500">
                  {formatTime(event.at, timeZone)}
                </time>
                <div className="min-w-0">
                  <p className="text-base font-medium">
                    {t(LABEL_KEYS[event.type] ?? event.type)}
                    {actor && <span className="font-normal text-neutral-600"> · {actor}</span>}
                  </p>
                  {event.text && <p className="mt-0.5 text-sm text-neutral-600">{event.text}</p>}
                  {event.reason && event.reason !== event.text && (
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {t('timeline.reason', { reason: reasonLabels[event.reason] ?? event.reason })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
