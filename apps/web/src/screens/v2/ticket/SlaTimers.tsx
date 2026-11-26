import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Config, SlaTimer, Ticket, TicketStatus } from '../../../api.js';
import { formatDateTime, formatMinutes } from '../../../components/format.js';

function timerText(t: TFunction, timer: SlaTimer): string {
  const minutes = formatMinutes(Math.abs(timer.remainingMinutes));
  if (timer.state === 'paused')
    return timer.breached
      ? t('sla.pausedOverdue', { time: minutes })
      : t('sla.paused', { time: minutes });
  if (timer.state === 'stopped')
    return timer.breached
      ? t('sla.stoppedLate', { time: minutes })
      : t('sla.stoppedLeft', { time: minutes });
  return timer.breached
    ? t('sla.overdue', { time: minutes })
    : t('sla.remaining', { time: minutes });
}

type RowProps = {
  label: string;
  timer: SlaTimer | null;
  detailed: boolean;
  status: TicketStatus;
  timeZone?: string;
};

function TimerDetails({ timer, status, timeZone }: Omit<RowProps, 'label' | 'detailed'>) {
  const { t } = useTranslation();
  return (
    <>
      {timeZone && timer?.dueAt && timer.state !== 'stopped' && (
        <dd className="v2-yardstick">
          {t('sla.due')} <time dateTime={timer.dueAt}>{formatDateTime(timer.dueAt, timeZone)}</time>
        </dd>
      )}
      {timer?.state === 'paused' && !timer.dueAt && (
        <dd className="v2-yardstick">{t('sla.dueAfterResume')}</dd>
      )}
      {timeZone && timer?.stoppedAt && (
        <dd className="v2-yardstick">
          {t('sla.stoppedAt')}{' '}
          <time dateTime={timer.stoppedAt}>{formatDateTime(timer.stoppedAt, timeZone)}</time>
        </dd>
      )}
      {status === 'cancelled' && <dd className="v2-yardstick">{t('sla.cancelledRestore')}</dd>}
    </>
  );
}

function TimerRow({ label, timer, detailed, status, timeZone }: RowProps) {
  const { t } = useTranslation();
  if (!timer)
    return (
      <div>
        <dt className="v2-sub">{label}</dt>
        <dd className="v2-sub">{t('sla.notApplicable')}</dd>
      </div>
    );
  return (
    <div>
      <dt className="v2-sub">{label}</dt>
      <dd className="v2-fact-value v2-num" data-late={timer.breached || undefined}>
        {timerText(t, timer)}
      </dd>
      {detailed && <TimerDetails timer={timer} status={status} timeZone={timeZone} />}
    </div>
  );
}

/**
 * The two clocks, Acknowledge and Restore (v1 `SlaTimerSummary` on the kit): remaining, overdue (in the loss colour
 * and words), paused, stopped, not applicable, or the line that says the plant has none. `detailed` is the ticket
 * page's card with the due and stopped times; without it, the two lines a list row carries.
 */
export function SlaTimers({
  ticket,
  detailed = false,
  config,
}: {
  ticket: Ticket;
  detailed?: boolean;
  config?: Config;
}) {
  const { t } = useTranslation();
  const timeZone = config?.timeZone;
  if (!ticket.sla) {
    const message = ticket.sla === undefined ? t('sla.unavailable') : t('sla.notConfigured');
    if (!detailed) return <p className="v2-sub">{message}</p>;
    return (
      <section aria-label={t('sla.title')} className="v2-card v2-pad v2-stack">
        <h2 className="v2-h2">{t('sla.title')}</h2>
        <p className="v2-sub">{message}</p>
      </section>
    );
  }
  const rows = (
    <>
      <TimerRow
        label={t('sla.ack')}
        timer={ticket.sla.ack}
        detailed={detailed}
        status={ticket.status}
        timeZone={timeZone}
      />
      <TimerRow
        label={t('sla.restore')}
        timer={ticket.sla.restore}
        detailed={detailed}
        status={ticket.status}
        timeZone={timeZone}
      />
    </>
  );
  if (!detailed) return <dl className="v2-sla-pair">{rows}</dl>;
  return (
    <section aria-label={t('sla.title')} className="v2-card v2-pad v2-stack">
      <h2 className="v2-h2">{t('sla.title')}</h2>
      <dl className="v2-facts">{rows}</dl>
    </section>
  );
}
