import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Config, Ticket, SlaTimer, TicketStatus } from '../api.js';
import { formatDateTime, formatMinutes } from './format.js';

function timerText(t: TFunction, timer: SlaTimer): string {
  const minutes = formatMinutes(Math.abs(timer.remainingMinutes));
  if (timer.state === 'paused') {
    return timer.breached
      ? t('sla.pausedOverdue', { time: minutes })
      : t('sla.paused', { time: minutes });
  }
  if (timer.state === 'stopped') {
    return timer.breached
      ? t('sla.stoppedLate', { time: minutes })
      : t('sla.stoppedLeft', { time: minutes });
  }
  return timer.breached
    ? t('sla.overdue', { time: minutes })
    : t('sla.remaining', { time: minutes });
}

interface RowProps {
  label: string;
  timer: SlaTimer | null;
  detailed: boolean;
  status: TicketStatus;
  timeZone?: string;
}

function TimerDetails({ timer, status, timeZone }: Omit<RowProps, 'label' | 'detailed'>) {
  const { t } = useTranslation();
  return (
    <>
      {timeZone && timer?.dueAt && timer.state !== 'stopped' && (
        <dd className="mt-0.5 text-caption text-neutral-600">
          {t('sla.due')} <time dateTime={timer.dueAt}>{formatDateTime(timer.dueAt, timeZone)}</time>
        </dd>
      )}
      {timer?.state === 'paused' && !timer.dueAt && (
        <dd className="mt-0.5 text-caption text-neutral-600">{t('sla.dueAfterResume')}</dd>
      )}
      {timeZone && timer?.stoppedAt && (
        <dd className="mt-0.5 text-caption text-neutral-600">
          {t('sla.stoppedAt')}{' '}
          <time dateTime={timer.stoppedAt}>{formatDateTime(timer.stoppedAt, timeZone)}</time>
        </dd>
      )}
      {status === 'cancelled' && (
        <dd className="mt-0.5 text-caption text-neutral-600">{t('sla.cancelledRestore')}</dd>
      )}
    </>
  );
}

function TimerRow({ label, timer, detailed, status, timeZone }: RowProps) {
  const { t } = useTranslation();
  if (!timer) {
    return (
      <div>
        <dt className="text-caption font-medium text-neutral-600">{label}</dt>
        <dd className="mt-0.5 text-footnote text-neutral-600">{t('sla.notApplicable')}</dd>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-caption font-medium text-neutral-600">{label}</dt>
      <dd
        className={`mt-0.5 text-footnote tabular-nums ${
          timer.breached ? 'font-semibold text-danger-ink' : 'text-neutral-700'
        }`}
      >
        {timerText(t, timer)}
      </dd>
      {detailed && <TimerDetails timer={timer} status={status} timeZone={timeZone} />}
    </div>
  );
}

interface Props {
  ticket: Ticket;
  detailed?: boolean;
  config?: Config;
}

export function SlaTimerSummary({ ticket, detailed = false, config }: Props) {
  const { t } = useTranslation();
  const timeZone = config?.timeZone;
  if (!ticket.sla) {
    const message = ticket.sla === undefined ? t('sla.unavailable') : t('sla.notConfigured');
    if (!detailed) return <p className="mt-2 text-caption text-neutral-600">{message}</p>;
    return (
      <section aria-label={t('sla.title')} className="rounded-2xl bg-surface p-4 shadow-card">
        <h2 className="text-footnote font-medium text-neutral-600">{t('sla.title')}</h2>
        <p className="mt-2 text-footnote text-neutral-600">{message}</p>
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
  if (!detailed) return <dl className="mt-2 grid grid-cols-2 gap-3 text-footnote">{rows}</dl>;
  return (
    <section aria-label={t('sla.title')} className="rounded-2xl bg-surface p-4 shadow-card">
      <h2 className="text-footnote font-medium text-neutral-600">{t('sla.title')}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">{rows}</dl>
    </section>
  );
}
