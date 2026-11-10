import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getConfig,
  getMe,
  getTicket,
  type CommandAction,
  type CommandBody,
  type Config,
  type Me,
  type Ticket,
  type TicketDetail as TicketDetailData,
  type TicketInterval,
  type TicketPerson,
} from '../api.js';
import { canWork, useTicketCommand } from '../components/actions.js';
import { ActionBar } from '../components/ActionBar.js';
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

const CLOSE_LABELS = {
  report: 'With report',
  no_report: 'Without report',
  done: 'Done',
};

const ROLE_LABELS: Record<string, string> = {
  lead: 'Lead',
  primary: 'Primary',
  support: 'Support',
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

function factRows(ticket: Ticket, config?: Config): Fact[] {
  const machine =
    ticket.kind === 'general' ? 'Work request' : machineLabel(ticket, config?.machines ?? []);
  const lead = (config?.people ?? []).find((person) => person.id === ticket.leadPersonId);
  const time = (iso: string | null) => (iso ? formatDateTime(iso, config?.timeZone) : null);
  return [
    { label: 'Machine', value: machine },
    { label: 'Reported', value: formatDateTime(ticket.reportedAt, config?.timeZone) },
    ...fact('Lead', lead?.name),
    ...fact('Location', ticket.location),
    ...fact('Work type', ticket.workType),
    ...fact('Started', time(ticket.startedAt)),
    ...fact('Machine running since', time(ticket.machineRunningAt)),
    ...fact('Pause reason', ticket.waitReason ? waitLabel(ticket.waitReason, config) : null),
    ...fact('Handover', ticket.handedOver ? 'Waiting for pickup' : null),
    ...fact('Closed', time(ticket.closedAt)),
    ...fact('Closed as', ticket.closeKind ? CLOSE_LABELS[ticket.closeKind] : null),
    ...fact('Close note', ticket.closeNote, true),
  ];
}

function Facts({ ticket, config }: { ticket: Ticket; config?: Config }) {
  const rows = factRows(ticket, config);
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">Facts</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map((row) => (
          <div key={row.label} className={row.wide ? 'col-span-2' : undefined}>
            <dt className="text-xs text-neutral-500">{row.label}</dt>
            <dd className="mt-0.5 text-base">{row.value}</dd>
          </div>
        ))}
      </dl>
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
  const byPerson = new Map<string, TicketInterval[]>();
  for (const interval of intervals) {
    byPerson.set(interval.personId, [...(byPerson.get(interval.personId) ?? []), interval]);
  }
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">People</h2>
      {people.length === 0 ? (
        <p className="mt-2 text-neutral-500">Nobody has joined yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {people.map((member) => (
            <li key={member.personId}>
              <p className="text-base">
                <span className="font-medium">{names[member.personId] ?? 'Team member'}</span>
                <span className="text-neutral-600">
                  {' '}
                  · {ROLE_LABELS[member.role] ?? member.role}
                </span>
                {member.leftAt && <span className="text-neutral-500"> · left</span>}
              </p>
              {(byPerson.get(member.personId) ?? []).map((interval) => (
                <p key={interval.startedAt} className="text-sm text-neutral-600">
                  {formatTime(interval.startedAt, timeZone)}–
                  {interval.endedAt ? formatTime(interval.endedAt, timeZone) : 'now'} ·{' '}
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
  const { ticket, events, people, intervals } = detail;
  const names = peopleNames(config?.people);
  const reasonLabels: Record<string, string> = {};
  for (const item of config?.lists.wait_reason ?? []) reasonLabels[item.code] = item.label;
  const personId = me?.actingPersonId;
  return (
    <>
      <header className="mt-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.ref}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="mt-2 text-base text-neutral-900">{ticket.problem}</p>
        <p className="mt-1 text-sm text-neutral-500">Reported {elapsedLabel(ticket.reportedAt)}</p>
      </header>
      {config && personId && canWork(me?.role) && (
        <ActionBar
          ticket={ticket}
          config={config}
          personId={personId}
          error={error}
          pending={pending}
          onRun={(action, body) => run(ticket.id, action, body)}
        />
      )}
      <Facts ticket={ticket} config={config} />
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
        ← Open tickets
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
        <p className="mt-6 text-neutral-500">Loading…</p>
      )}
    </main>
  );
}
