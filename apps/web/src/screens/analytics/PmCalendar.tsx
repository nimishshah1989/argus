/* eslint-disable i18next/no-literal-string -- FullCalendar option values and container names, not copy; every visible word goes through t() */
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import type { EventDisplayInfo, EventDropInfo } from '@fullcalendar/react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarClock, TriangleAlert } from '../../ui/icon.js';
import { displayDay } from './machine-values.js';
import { gridRange, type PmEvent } from './pm-calendar-view.js';
import './pm-calendar.css';

/**
 * The one door to FullCalendar (ticket 50c, ADR 0009 R1): this file is the only place the library is named, and
 * the page that mounts it is reached through `React.lazy(() => import('./PmCalendarPage.js'))`. So the library and
 * its classic theme live in a chunk a head downloads only on `/analytics/pm`; the start-up files never carry it.
 * The chrome is the catalogue's, the drag is the page's write, and a refused drop snaps back.
 */

export interface PmMove {
  planId: string | null;
  machineId: string;
  machineCode: string;
  ticketId: string | null;
  scheduledOn: string;
}

export interface PmCalendarProps {
  events: readonly PmEvent[];
  /** True only for head and admin (R10); the server refuses everyone else whatever the grid allows. */
  editable: boolean;
  /** The month first shown: the plant's today from the server, never the browser's clock. */
  initialDate: string;
  /** The page's move: it throws on a refusal so the event can return to its day. */
  onMove: (move: PmMove) => Promise<void>;
  /** FullCalendar's six-week grid, both ends inclusive plant days. */
  onRange: (range: { from: string; to: string }) => void;
}

/** The status words a screen reader hears: colour never carries the meaning alone. */
function statusWords(t: TFunction, props: PmEvent['extendedProps']): string {
  if (props.status === 'open')
    return t(props.crowded ? 'pm.calendar.aria.openCrowded' : 'pm.calendar.aria.open');
  return t(props.crowded ? 'pm.calendar.aria.plannedCrowded' : 'pm.calendar.aria.planned');
}

/** One event's chip: the machine code in view, its date and status words for a screen reader. */
function EventChip({ info }: { info: EventDisplayInfo }) {
  const { t } = useTranslation();
  const props = info.event.extendedProps as PmEvent['extendedProps'];
  return (
    <span
      className="pm-event"
      data-pm-status={props.status}
      data-pm-crowded={props.crowded ? 'true' : undefined}
    >
      {props.status === 'open' ? (
        <CalendarClock aria-hidden size={12} className="shrink-0" />
      ) : (
        <CalendarCheck aria-hidden size={12} className="shrink-0" />
      )}
      {props.crowded ? <TriangleAlert aria-hidden size={12} className="shrink-0" /> : null}
      <span className="pm-event-code">{info.event.title}</span>
      <span className="sr-only">
        {` — ${t('pm.calendar.eventAria', {
          date: displayDay(info.event.startStr.slice(0, 10)),
          status: statusWords(t, props),
        })}`}
      </span>
    </span>
  );
}

export default function PmCalendar({
  events,
  editable,
  initialDate,
  onMove,
  onRange,
}: PmCalendarProps) {
  const { t } = useTranslation();
  const drop = async (info: EventDropInfo): Promise<void> => {
    const props = info.event.extendedProps as PmEvent['extendedProps'];
    try {
      await onMove({
        planId: props.planId,
        machineId: props.machineId,
        machineCode: props.machineCode,
        ticketId: props.ticketId,
        scheduledOn: info.event.startStr.slice(0, 10),
      });
    } catch {
      // The server's refusal (409/422) is announced by the page; the event returns to its scheduled day.
      info.revert();
    }
  };
  return (
    <div className="pm-calendar overflow-x-auto rounded-card bg-surface p-3 shadow-card">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin, classicThemePlugin]}
        initialView="dayGridMonth"
        initialDate={initialDate}
        firstDay={1}
        locale="en"
        height="auto"
        dayMaxEvents={false}
        events={[...events]}
        editable={editable}
        eventStartEditable={editable}
        eventDurationEditable={false}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        buttons={{ today: { text: t('pm.calendar.today'), display: 'text' } }}
        eventContent={(info) => <EventChip info={info} />}
        eventDrop={(info) => void drop(info)}
        datesSet={(info) => onRange(gridRange(info.startStr, info.endStr))}
      />
    </div>
  );
}
