import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  getConfig,
  getMe,
  getTicket,
  type BreakdownReport,
  type CommandAction,
  type CommandBody,
  type Config,
  type Me,
  type Ticket,
  type TicketDetail as TicketDetailData,
  type TicketInterval,
  type TicketPerson,
} from '../api.js';
import { AdminPanel } from '../components/AdminPanel.js';
import { canWork, useTicketCommand } from '../components/actions.js';
import { ReportPanel } from '../components/ReportForm.js';
import { ShareButton } from '../components/ShareButton.js';
import { Figures } from '../components/Figures.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Timeline } from '../components/Timeline.js';
import {
  elapsedLabel,
  errorMessage,
  formatDateTime,
  formatMinutes,
  formatTime,
  machineLabel,
  peopleNames,
} from '../components/format.js';

const CLOSE_LABEL_KEYS = {
  report: 'close.report',
  no_report: 'close.noReport',
  done: 'close.done',
};

const ROLE_LABEL_KEYS: Record<string, string> = {
  lead: 'role.lead',
  primary: 'role.primary',
  support: 'role.support',
};

function waitLabel(code: string, config?: Config): string {
  const item = (config?.lists.wait_reason ?? []).find((entry) => entry.code === code);
  return item?.label ?? code;
}

function intervalMinutes(interval: TicketInterval): number {
  const end = interval.endedAt ? new Date(interval.endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(interval.startedAt).getTime()) / 60000));
}

interface Fact {
  label: string;
  value: string;
  wide?: boolean;
}

function fact(label: string, value: string | null | undefined, wide = false): Fact[] {
  return value ? [{ label, value, ...(wide ? { wide } : {}) }] : [];
}

function factRows(t: TFunction, ticket: Ticket, config?: Config): Fact[] {
  const machine =
    ticket.kind === 'general'
      ? t('floor.workRequest')
      : machineLabel(ticket, config?.machines ?? []);
  const lead = (config?.people ?? []).find((person) => person.id === ticket.leadPersonId);
  const time = (iso: string | null) => (iso ? formatDateTime(iso, config?.timeZone) : null);
  return [
    { label: t('ticket.fact.machine'), value: machine },
    {
      label: t('ticket.fact.reported'),
      value: formatDateTime(ticket.reportedAt, config?.timeZone),
    },
    ...fact(t('ticket.fact.lead'), lead?.name),
    ...fact(t('ticket.fact.location'), ticket.location),
    ...fact(t('ticket.fact.workType'), ticket.workType),
    ...fact(t('ticket.fact.started'), time(ticket.startedAt)),
    ...fact(t('ticket.fact.machineRunning'), time(ticket.machineRunningAt)),
    ...fact(
      t('ticket.fact.pauseReason'),
      ticket.waitReason ? waitLabel(ticket.waitReason, config) : null,
    ),
    ...fact(t('ticket.fact.handover'), ticket.handedOver ? t('ticket.fact.waitingPickup') : null),
    ...fact(t('ticket.fact.closed'), time(ticket.closedAt)),
    ...fact(
      t('ticket.fact.closedAs'),
      ticket.closeKind ? t(CLOSE_LABEL_KEYS[ticket.closeKind]) : null,
    ),
    ...fact(t('ticket.fact.closeNote'), ticket.closeNote, true),
  ];
}

function FactList({ rows }: { rows: Fact[] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map((row) => (
        <div key={row.label} className={row.wide ? 'col-span-2' : undefined}>
          <dt className="text-xs text-neutral-500">{row.label}</dt>
          <dd className="mt-0.5 text-base">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Facts({ ticket, config }: { ticket: Ticket; config?: Config }) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('ticket.facts')}</h2>
      <FactList rows={factRows(t, ticket, config)} />
    </section>
  );
}

function personList(
  ids: string[] | undefined,
  names: Record<string, string>,
  t: TFunction,
): string | null {
  if (!ids || ids.length === 0) return null;
  return ids.map((id) => names[id] ?? t('common.teamMember')).join(', ');
}

function reportPeople(report: BreakdownReport, role: 'done' | 'supported'): string[] {
  return report.people.filter((person) => person.role === role).map((person) => person.personId);
}

function ReportCard({ report, names }: { report: BreakdownReport; names: Record<string, string> }) {
  const { t } = useTranslation();
  const rows = [
    ...fact(t('report.problem'), report.problem, true),
    ...fact(t('report.observedBy'), report.observedBy),
    ...fact(t('report.correctiveAction'), report.correctiveAction, true),
    ...fact(t('report.doneBy'), personList(reportPeople(report, 'done'), names, t)),
    ...fact(t('report.supportedBy'), personList(reportPeople(report, 'supported'), names, t)),
    ...fact(t('report.downtime'), formatMinutes(report.downtimeMin)),
    ...fact(
      t('report.response'),
      report.responseMin == null ? null : formatMinutes(report.responseMin),
    ),
    ...fact(t('report.repair'), report.repairMin == null ? null : formatMinutes(report.repairMin)),
    ...fact(t('report.category'), report.breakdownCategory),
    ...fact(t('report.maintenanceCode'), report.maintCode),
    ...fact(t('report.spareUsed'), report.spareUsed),
    ...fact(t('report.rootCause'), report.rootCause, true),
    ...fact(t('report.handoverTo'), report.handoverName),
    ...fact(t('report.date'), report.date),
    ...fact(t('report.shift'), report.shiftCode),
  ];
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('report.title')}</h2>
      <FactList rows={rows} />
    </section>
  );
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
      {config && personId && (
        <ReportPanel
          ticket={ticket}
          config={config}
          personId={personId}
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
