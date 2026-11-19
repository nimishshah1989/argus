import { useTranslation } from 'react-i18next';
import type { PmCalendarItem, PmCalendarReply } from '@uptimo/shared';
import { StateNotice } from '../../patterns/frame.js';
import { Button } from '../../ui/button.js';
import PmCalendar, { type PmMove } from './PmCalendar.js';
import { eventsOf, rateText, type PmComplianceView } from './pm-calendar-view.js';
import { displayDay } from './machine-values.js';
import { Section, StatCard } from './parts.js';

/** The PM page's painted blocks, split from the page so each stays small and the page keeps its state and writes. */

/** The page's heading and the plant day every figure on it speaks for. */
export function PageHead({ asOf }: { asOf: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-title2 font-semibold">{t('pm.screen.calendar')}</h2>
      <span className="text-footnote text-neutral-600">
        {t('pm.calendar.asOf', { date: displayDay(asOf) })}
      </span>
    </div>
  );
}

/** The one move's two answers: the server's refusal, or the day it landed on. */
export function MoveNotes({ refusal, moved }: { refusal: string | null; moved: string | null }) {
  if (refusal === null && moved === null) return null;
  return refusal === null ? (
    <p role="status" className="text-footnote font-medium text-ok-ink">
      {moved}
    </p>
  ) : (
    <p role="alert" className="text-body font-medium text-danger-ink">
      {refusal}
    </p>
  );
}

/** The two tiles' windows and counts: the figure's value, printed once behind both cards (R16). */
export function ComplianceTiles({ view }: { view: PmComplianceView }) {
  const { t } = useTranslation();
  if (view.empty) return <p className="text-body text-neutral-600">{t('pm.compliance.empty')}</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li data-compliance="pm">
          <StatCard
            label={t('pm.compliance.pm')}
            value={rateText(view.pm.pct)}
            sub={t('pm.compliance.pmCounts', {
              onTime: view.pm.counts.onTime ?? 0,
              eligible: view.pm.counts.eligible ?? 0,
            })}
          />
        </li>
        <li data-compliance="schedule">
          <StatCard
            label={t('pm.compliance.schedule')}
            value={rateText(view.schedule.pct)}
            sub={t('pm.compliance.scheduleCounts', {
              done: view.schedule.counts.done ?? 0,
              eligible: view.schedule.counts.eligible ?? 0,
            })}
          />
        </li>
      </ul>
      <p className="text-footnote text-neutral-600">
        {t('pm.compliance.window', {
          from: displayDay(view.from),
          to: displayDay(view.to),
        })}
      </p>
    </div>
  );
}

/** The key the calendar and the crowded panel share: words, not colour alone. */
export function Legend({ cap, count, days }: { cap: number; count: number; days: number }) {
  const { t } = useTranslation();
  const chips = [
    ['planned', t('pm.calendar.legend.planned')],
    ['open', t('pm.calendar.legend.open')],
    ['crowded', t('pm.calendar.legend.crowded')],
  ] as const;
  return (
    <div className="flex flex-col gap-1">
      <ul aria-label={t('pm.calendar.legend')} className="flex flex-wrap gap-3 text-footnote">
        {chips.map(([key, label]) => (
          <li key={key} data-legend={key} className="flex items-center gap-1 text-neutral-600">
            <span className={`pm-key pm-key-${key}`} aria-hidden />
            {label}
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
  onMove,
}: {
  items: readonly PmCalendarItem[];
  canMove: boolean;
  onMove: (item: PmCalendarItem, target: string) => void;
}) {
  const { t } = useTranslation();
  const crowded = items.filter((item) => item.crowded);
  if (crowded.length === 0) return null;
  const days = new Set(crowded.map((item) => item.scheduledOn)).size;
  return (
    <Section title={t('pm.calendar.spread.title')}>
      <p className="text-body text-neutral-600">{t('pm.calendar.spread.hint', { count: days })}</p>
      <ul className="flex flex-col gap-2">
        {crowded.map((item) => (
          <li
            key={item.ticketId ?? item.planId ?? item.machineId}
            data-crowded={item.machineCode}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface p-3 shadow-card"
          >
            <span className="text-body font-medium">
              {item.machineCode} · {displayDay(item.scheduledOn)}
            </span>
            {item.suggestedOn === null ? (
              <span className="text-footnote text-neutral-600">{t('pm.calendar.noFreeDay')}</span>
            ) : canMove && item.movable ? (
              <Button
                // eslint-disable-next-line i18next/no-literal-string -- a variant value, not copy
                variant="tonal"
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
    </Section>
  );
}

/** The grid, its loading/refused states and the empty month's line; the page's other blocks never wait on it. */
export function CalendarArea({
  calendar,
  events,
  canMove,
  onMove,
  onRange,
}: {
  calendar: { data: PmCalendarReply | undefined; error: unknown; refetch: () => unknown };
  events: ReturnType<typeof eventsOf>;
  canMove: boolean;
  onMove: (move: PmMove) => Promise<void>;
  onRange: (range: { from: string; to: string }) => void;
}) {
  const { t } = useTranslation();
  if (calendar.error)
    return (
      <StateNotice
        // eslint-disable-next-line i18next/no-literal-string -- a ViewState value, not copy
        state="error"
        empty={t('pm.calendar.empty')}
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
      <PmCalendar events={events} editable={canMove} onMove={onMove} onRange={onRange} />
      {calendar.data.items.length === 0 ? (
        <p className="text-body text-neutral-600">{t('pm.calendar.empty')}</p>
      ) : null}
    </>
  );
}
