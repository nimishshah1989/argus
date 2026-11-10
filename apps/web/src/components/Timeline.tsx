import type { TicketEvent } from '../api.js';
import { formatTime } from './format.js';

const LABELS: Record<string, string> = {
  down: 'Reported',
  start: 'Started',
  pickup: 'Picked up',
  update: 'Update',
  pause: 'Paused',
  resume: 'Resumed',
  transfer: 'Transferred',
  join: 'Joined',
  leave: 'Left',
  lead: 'Lead changed',
  running: 'Machine running',
  stopped: 'Machine stopped',
  upgrade_kind: 'Upgraded to breakdown',
  close: 'Closed',
  report: 'Report filed',
  cancel: 'Cancelled',
  restore: 'Restored',
  edit: 'Edited',
  task: 'Task created',
  acknowledge: 'Acknowledged',
};

interface Props {
  events: TicketEvent[];
  names: Record<string, string>;
  reasonLabels: Record<string, string>;
  timeZone?: string;
}

export function Timeline({ events, names, reasonLabels, timeZone }: Props) {
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">Timeline</h2>
      {events.length === 0 ? (
        <p className="mt-2 text-neutral-500">No events yet.</p>
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
                    {LABELS[event.type] ?? event.type}
                    {actor && <span className="font-normal text-neutral-600"> · {actor}</span>}
                  </p>
                  {event.text && <p className="mt-0.5 text-sm text-neutral-600">{event.text}</p>}
                  {event.reason && event.reason !== event.text && (
                    <p className="mt-0.5 text-sm text-neutral-500">
                      Reason: {reasonLabels[event.reason] ?? event.reason}
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
