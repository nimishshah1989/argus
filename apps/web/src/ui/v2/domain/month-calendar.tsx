/* eslint-disable i18next/no-literal-string -- calendar option values and class names, not copy; every visible word comes in as a prop */
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import type { EventDisplayInfo, EventDropInfo } from '@fullcalendar/react';
import { Icon } from '../icons.js';
import type { CalendarEvent, CalendarRange, CalendarWords } from './calendar-events.js';
import './month-skin.css';

/**
 * The one door to the calendar library in the v2 kit (ADR 0009 R1, as `screens/analytics/PmCalendar.tsx` is for v1):
 * this file is the only v2 place that names it, and a screen reaches it through `React.lazy(() => import(...))`, so
 * the library and its theme live in a chunk that downloads only when a calendar is on screen, never in a start-up
 * file. The look is the v2 tokens (`month-skin.css`); a refused drop snaps back; a reader's keyboard has the
 * screen's own list of jobs, because a drag has no keyboard.
 */

export type MonthCalendarProps = {
  events: readonly CalendarEvent[];
  /** Whether a drag may start (head and admin only; the server refuses everyone else whatever the grid allows). */
  editable: boolean;
  /** The month first shown: the plant's today from the server, never the browser's clock. */
  initialDate: string;
  words: CalendarWords;
  /** The screen's move: it throws on a refusal so the chip can return to its day. */
  onMove: (id: string, day: string) => Promise<void>;
  onRange: (range: CalendarRange) => void;
  /** A chip was pressed: the screen opens that machine. */
  onOpen: (code: string) => void;
};

/** The grid's inclusive range: the library's `end` is exclusive, ours is not. */
function gridRange(start: string, endExclusive: string): CalendarRange {
  const end = new Date(Date.parse(`${endExclusive.slice(0, 10)}T00:00:00Z`) - 86_400_000);
  return { from: start.slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/** One chip: the code in view, an icon for its state, and its date and status for a screen reader. */
function Chip({ info }: { info: EventDisplayInfo }) {
  const event = info.event.extendedProps as CalendarEvent;
  const name = <span className="v2-cal-code">{event.code}</span>; // ui-allow: entity-code a drag chip cannot hold a button
  return (
    <span className="v2-cal-event" data-crowded={event.crowded ? 'true' : undefined}>
      <Icon name={event.open ? 'clock' : 'check'} size={12} />
      {event.crowded ? <Icon name="alert" size={12} /> : null}
      {name}
      <span className="v2-sr">{` — ${event.aria}`}</span>
    </span>
  );
}

export default function MonthCalendar(props: MonthCalendarProps) {
  const { events, editable, initialDate, words, onMove, onRange, onOpen } = props;
  const drop = async (info: EventDropInfo): Promise<void> => {
    try {
      await onMove(info.event.id, info.event.startStr.slice(0, 10));
    } catch {
      info.revert();
    }
  };
  return (
    <div className="v2-month-calendar" role="group" aria-label={words.label}>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin, classicThemePlugin]}
        initialView="dayGridMonth"
        initialDate={initialDate}
        firstDay={1}
        locale="en"
        height="auto"
        dayMaxEvents={false}
        events={events.map((e) => ({
          id: e.id,
          title: e.code,
          start: e.day,
          allDay: true,
          startEditable: e.movable,
          durationEditable: false,
          extendedProps: e,
        }))}
        editable={editable}
        eventStartEditable={editable}
        eventDurationEditable={false}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        buttons={{ today: { text: words.today, hint: words.today, display: 'text' } }}
        eventContent={(info) => <Chip info={info} />}
        eventClick={(info) => onOpen(info.event.title)}
        eventDrop={(info) => void drop(info)}
        datesSet={(info) => onRange(gridRange(info.startStr, info.endStr))}
      />
    </div>
  );
}
