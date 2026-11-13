import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getConfig,
  getMe,
  getTicket,
  type CommandAction,
  type CommandBody,
  type Config,
  type Me,
  type TicketDetail as TicketDetailData,
  type TicketInterval,
  type TicketPerson,
} from '../api.js';
import { AdminPanel } from '../components/AdminPanel.js';
import { canWork, useTicketCommand } from '../components/actions.js';
import { Facts, ReportCard } from '../components/TicketFacts.js';
import { ReportPanel } from '../components/ReportForm.js';
import { ShareButton } from '../components/ShareButton.js';
import { Figures } from '../components/Figures.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { SlaTimerSummary } from '../components/SlaTimerSummary.js';
import { OfflineBanner } from '../components/OfflineBanner.js';
import { Timeline } from '../components/Timeline.js';
import {
  elapsedLabel,
  errorMessage,
  formatMinutes,
  formatTime,
  peopleNames,
} from '../components/format.js';

const ROLE_LABEL_KEYS: Record<string, string> = {
  lead: 'role.lead',
  primary: 'role.primary',
  support: 'role.support',
};

function intervalMinutes(interval: TicketInterval): number {
  const end = interval.endedAt ? new Date(interval.endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(interval.startedAt).getTime()) / 60000));
}

interface PeopleProps {
  people: TicketPerson[];
  intervals: TicketInterval[];
  names: Record<string, string>;
  timeZone?: string;
}

function PeopleSection({ people, intervals, names, timeZone }: PeopleProps) {
  const { t } = useTranslation();
  const byPerson = new Map<string, TicketInterval[]>();
  for (const interval of intervals) {
    byPerson.set(interval.personId, [...(byPerson.get(interval.personId) ?? []), interval]);
  }
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('ticket.people')}</h2>
      {people.length === 0 ? (
        <p className="mt-2 text-neutral-500">{t('ticket.peopleEmpty')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {people.map((member) => (
            <li key={member.personId}>
              <p className="text-base">
                <span className="font-medium">
                  {names[member.personId] ?? t('common.teamMember')}
                </span>
                <span className="text-neutral-600">
                  {' '}
                  · {t(ROLE_LABEL_KEYS[member.role] ?? member.role)}
                </span>
                {member.leftAt && <span className="text-neutral-500"> · {t('ticket.left')}</span>}
              </p>
              {(byPerson.get(member.personId) ?? []).map((interval) => (
                <p key={interval.startedAt} className="text-sm text-neutral-600">
                  {formatTime(interval.startedAt, timeZone)}–
                  {interval.endedAt ? formatTime(interval.endedAt, timeZone) : t('ticket.now')} ·{' '}
                  {formatMinutes(intervalMinutes(interval))}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ViewProps {
  detail: TicketDetailData;
  config?: Config;
  me?: Me;
  run: (ticketId: string, action: CommandAction, body: CommandBody) => Promise<boolean>;
  pending: boolean;
  error: string | null;
}

function hasReportContext(
  config: Config | undefined,
  personId: string | null | undefined,
): boolean {
  return Boolean(config && personId);
}

function TicketView({ detail, config, me, run, pending, error }: ViewProps) {
  const { t } = useTranslation();
  const { ticket, events, people, intervals } = detail;
  const names = peopleNames(config?.people);
  const reasonLabels: Record<string, string> = {};
  for (const item of config?.lists.wait_reason ?? []) reasonLabels[item.code] = item.label;
  const personId = me?.actingPersonId;
  const crew = people.filter((member) => !member.leftAt).map((member) => member.personId);
  return (
    <>
      <header className="mt-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.ref}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="mt-2 text-base text-neutral-900">{ticket.problem}</p>
        <p className="mt-1 text-sm text-neutral-500">
          {t('ticket.reportedAgo', { time: elapsedLabel(ticket.reportedAt) })}
        </p>
      </header>
      <SlaTimerSummary ticket={ticket} detailed config={config} />
      {hasReportContext(config, personId) && (
        <ReportPanel
          ticket={ticket}
          config={config!}
          personId={personId!}
          crew={crew}
          canEdit={canWork(me?.role)}
          command={(action, body) => run(ticket.id, action, body)}
          pending={pending}
          error={error}
        />
      )}
      <AdminPanel ticket={ticket} config={config} me={me} />
      <div className="mt-3">
        <ShareButton ticket={ticket} config={config} mode="full" />
      </div>
      <Facts ticket={ticket} config={config} />
      {detail.report && <ReportCard report={detail.report} names={names} />}
      <Figures figures={ticket.figures} kind={ticket.kind} names={names} />
      <Timeline
        events={events}
        names={names}
        reasonLabels={reasonLabels}
        timeZone={config?.timeZone}
      />
      <PeopleSection
        people={people}
        intervals={intervals}
        names={names}
        timeZone={config?.timeZone}
      />
    </>
  );
}

export function TicketDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const detail = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id),
    enabled: Boolean(id),
  });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useTicketCommand();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <Link to="/desk" className="inline-flex min-h-13 items-center font-medium text-accent">
        {t('ticket.back')}
      </Link>
      <OfflineBanner />
      {detail.data ? (
        <TicketView
          detail={detail.data}
          config={config.data}
          me={me.data?.user}
          run={run}
          pending={pending}
          error={error}
        />
      ) : detail.error ? (
        <p role="alert" className="mt-6 rounded-xl bg-stopped/10 p-3 text-stopped">
          {errorMessage(detail.error)}
        </p>
      ) : (
        <p className="mt-6 text-neutral-500">{t('common.loading')}</p>
      )}
    </main>
  );
}
