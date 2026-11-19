import { useTranslation } from 'react-i18next';
import type { PmCalendarItem, PmCalendarReply } from '@uptimo/shared';
import { StateNotice } from '../../patterns/frame.js';
import { Button } from '../../ui/button.js';
import { CalendarCheck, CalendarClock, TriangleAlert } from '../../ui/icon.js';
import { KpiTile, StatusChip } from '../../ui/elements/index.js';
import PmCalendar, { type PmMove } from './PmCalendar.js';
import { eventsOf, rateText, type PmComplianceView } from './pm-calendar-view.js';
import { displayDay } from './machine-values.js';

/** The PM page's painted blocks, split from the page so each stays small and the page keeps its state and writes. */

/** The one move's two answers: the server's refusal, or the day it landed on. */
export function MoveNotes({ refusal, moved }: { refusal: string | null; moved: string | null }) {
  if (refusal === null && moved === null) return null;
  return refusal === null ? (
    <p role="status" className="text-footnote font-medium text-good-ink">
      {moved}
    </p>
  ) : (
    <p role="alert" className="text-body font-medium text-bad-ink">
      {refusal}
    </p>
  );
}

/** The two tiles: the figure's value printed once, its counts as the note (R16); an empty figure prints a dash. */
export function ComplianceTiles({ view }: { view: PmComplianceView }) {
  const { t } = useTranslation();
  const empty = t('pm.compliance.empty');
  return (
    <>
      <div data-compliance="pm">
        <KpiTile
          label={t('pm.compliance.pm')}
          value={view.empty ? null : view.pm.pct}
          format={rateText}
          note={
            view.empty
              ? empty
              : t('pm.compliance.pmCounts', {
                  onTime: view.pm.counts.onTime ?? 0,
                  eligible: view.pm.counts.eligible ?? 0,
                })
          }
        />
      </div>
      <div data-compliance="schedule">
        <KpiTile
          label={t('pm.compliance.schedule')}
          value={view.empty ? null : view.schedule.pct}
          format={rateText}
          note={
            view.empty
              ? empty
              : t('pm.compliance.scheduleCounts', {
                  done: view.schedule.counts.done ?? 0,
                  eligible: view.schedule.counts.eligible ?? 0,
                })
          }
        />
      </div>
    </>
  );
}

/** The window both tiles speak for. */
export function ComplianceWindow({ view }: { view: PmComplianceView | null }) {
  const { t } = useTranslation();
  if (view === null)
    return <p className="text-body text-neutral-600">{t('pm.calendar.noFigure')}</p>;
  if (view.empty) return null;
  return (
    <p className="text-footnote text-neutral-600">
      {t('pm.compliance.window', { from: displayDay(view.from), to: displayDay(view.to) })}
    </p>
  );
}

/** The key the calendar and the lists share: an icon and a word each, never colour alone. */
export function Legend({ cap, count, days }: { cap: number; count: number; days: number }) {
  const { t } = useTranslation();
  const chips = [
    ['planned', 'neutral', CalendarCheck, t('pm.calendar.legend.planned')],
    ['open', 'neutral', CalendarClock, t('pm.calendar.legend.open')],
    ['crowded', 'watch', TriangleAlert, t('pm.calendar.legend.crowded')],
  ] as const;
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label={t('pm.calendar.legend')} className="flex flex-wrap gap-2">
        {chips.map(([key, tone, icon, label]) => (
          <li key={key} data-legend={key}>
            <StatusChip tone={tone} icon={icon}>
              {label}
            </StatusChip>
          </li>
        ))}
      </ul>
      <p className="text-footnote text-neutral-600">
        {t('pm.calendar.cap', { cap })} · {t('pm.calendar.load', { count, days })}
      </p>
    </div>
  );
}

/** The crowded days and each one's nearest free day, with the Move button the server would accept (R5). */
export function SpreadPanel({
  items,
  canMove,
  pending,
  onMove,
}: {
  items: readonly PmCalendarItem[];
  canMove: boolean;
  pending: boolean;
  onMove: (item: PmCalendarItem, target: string) => void;
}) {
  const { t } = useTranslation();
  const crowded = items.filter((item) => item.crowded);
  if (crowded.length === 0) return null;
  const days = new Set(crowded.map((item) => item.scheduledOn)).size;
  return (
    <section aria-labelledby="pm-spread-title" className="flex flex-col gap-3">
      <h3 id="pm-spread-title" className="text-body font-semibold">
        {t('pm.calendar.spread.title')}
      </h3>
      <p className="text-footnote text-neutral-600">
        {t('pm.calendar.spread.hint', { count: days })}
      </p>
      <ul className="flex flex-col gap-3">
        {crowded.map((item) => (
          <li
            key={item.ticketId ?? item.planId ?? item.machineId}
            data-crowded={item.machineCode}
            data-tone="watch"
            className="flex flex-col gap-2 rounded-tile border-l-4 border-watch-fill bg-surface p-3 shadow-card"
          >
            <span className="text-body font-semibold">
              {item.machineCode} · {displayDay(item.scheduledOn)}
            </span>
            <span>
              <StatusChip tone="watch" icon={TriangleAlert}>
                {t('pm.calendar.legend.crowded')}
              </StatusChip>
            </span>
            {item.suggestedOn === null ? (
              <span className="text-footnote text-neutral-600">{t('pm.calendar.noFreeDay')}</span>
            ) : canMove && item.movable ? (
              <Button
                // eslint-disable-next-line i18next/no-literal-string -- a variant value, not copy
                variant="tonal"
                disabled={pending}
                onClick={() => onMove(item, item.suggestedOn!)}
              >
                {t('pm.calendar.moveTo', { date: displayDay(item.suggestedOn) })}
              </Button>
            ) : (
              <span className="text-footnote text-neutral-600">
                {t('pm.calendar.suggested', { date: displayDay(item.suggestedOn) })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The grid, its loading/refused states and the empty month's line; the page's other blocks never wait on it. */
export function CalendarArea({
  calendar,
  events,
  canMove,
  initialDate,
  onMove,
  onRange,
}: {
  calendar: { data: PmCalendarReply | undefined; error: unknown; refetch: () => unknown };
  events: ReturnType<typeof eventsOf>;
  canMove: boolean;
  initialDate: string;
  onMove: (move: PmMove) => Promise<void>;
  onRange: (range: { from: string; to: string }) => void;
}) {
  const { t } = useTranslation();
  if (calendar.error)
    return (
      <StateNotice
        // eslint-disable-next-line i18next/no-literal-string -- a ViewState value, not copy
        state="error"
        empty={t('pm.calendar.error')}
        onRetry={() => void calendar.refetch()}
      />
    );
  if (!calendar.data)
    return (
      <p role="status" className="text-body text-neutral-600">
        {t('pm.calendar.loading')}
      </p>
    );
  return (
    <>
      <PmCalendar
        events={events}
        editable={canMove}
        initialDate={initialDate}
        onMove={onMove}
        onRange={onRange}
      />
      {calendar.data.items.length === 0 ? (
        <p className="text-body text-neutral-600">{t('pm.calendar.empty')}</p>
      ) : null}
    </>
  );
}
