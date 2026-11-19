/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string comes in as a prop */
import { TONE_ICON, type Tone4 } from '../meaning/index.js';
import { TONE_BOX, WRAP } from './tone.js';

export interface TimelineEvent {
  id: string;
  /** When it happened, already printed in the plant's way ("05:02 AM", "12 Nov"). */
  time: string;
  title: string;
  detail?: string;
  tone?: Tone4;
}

/** What happened, in the order given (newest first is the caller's choice). Each event wears its tone's icon. */
export function Timeline({ label, events }: { label: string; events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ol aria-label={label} className="flex flex-col">
      {events.map((event, at) => {
        const tone = event.tone ?? 'neutral';
        const Icon = TONE_ICON[tone];
        return (
          <li key={event.id} className="flex min-w-0 gap-3">
            <div className="flex flex-col items-center">
              <span
                data-tone={tone}
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE_BOX[tone]}`}
              >
                <Icon aria-hidden size={16} />
              </span>
              {at < events.length - 1 ? (
                <span aria-hidden className="w-0.5 flex-1 bg-neutral-200" />
              ) : null}
            </div>
            <div className={`flex flex-col gap-1 pb-4 ${WRAP}`}>
              <span className="text-footnote text-neutral-600">{event.time}</span>
              <span className="text-body font-semibold">{event.title}</span>
              {event.detail ? (
                <span className="text-footnote text-neutral-600">{event.detail}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
