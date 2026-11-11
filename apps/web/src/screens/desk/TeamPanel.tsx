import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Config, Machine, State, Ticket } from '../../api.js';
import {
  elapsedLabel,
  errorMessage,
  formatMinutes,
  machineLabel,
} from '../../components/format.js';
import { ClosedTotals, RecentCancelled } from './ClosedSection.js';
import { Empty, Section, TicketRow, rowClass } from './parts.js';
import { workingByPerson } from './views.js';

function waitText(ticket: Ticket, config?: Config): string {
  if (!ticket.waitReason) return '—';
  const item = (config?.lists.wait_reason ?? []).find((entry) => entry.code === ticket.waitReason);
  return item?.label ?? ticket.waitReason;
}

function personNames(config?: Config): Record<string, string> {
  const map: Record<string, string> = {};
  for (const person of config?.people ?? []) map[person.id] = person.name;
  return map;
}

const linkRowClass = `${rowClass} rounded-lg border border-neutral-200 shadow-none`;

interface WorkingProps {
  tickets: Ticket[];
  config?: Config;
  machines: Machine[];
}

function WorkingNow({ tickets, config, machines }: WorkingProps) {
  const { t } = useTranslation();
  const groups = workingByPerson(tickets);
  const people = personNames(config);
  return (
    <Section title={t('desk.view.workingNow')}>
      {groups.length === 0 ? (
        <Empty />
      ) : (
        <ul className="mt-3 space-y-3">
          {groups.map((group) => (
            <li key={group.personId} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{people[group.personId] ?? t('common.teamMember')}</p>
                <p className="text-sm text-neutral-500">{formatMinutes(group.minutes)}</p>
              </div>
              <ul className="mt-2 space-y-2">
                {group.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link to={`/desk/${ticket.id}`} className={`${linkRowClass} min-h-13`}>
                      <span className="font-semibold">{ticket.ref}</span>
                      <span className="text-sm text-neutral-600">
                        {machineLabel(ticket, machines)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Waiting({ tickets, config, machines }: WorkingProps) {
  const { t } = useTranslation();
  const waiting = tickets.filter((ticket) => ticket.status === 'waiting');
  return (
    <Section title={t('status.waiting')}>
      {waiting.length === 0 ? (
        <Empty />
      ) : (
        <ul className="mt-3 grid gap-2">
          {waiting.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              machines={machines}
              detail={waitText(ticket, config)}
              time={formatMinutes(ticket.figures?.waitMin ?? 0)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function NotStarted({ tickets, machines }: { tickets: Ticket[]; machines: Machine[] }) {
  const { t } = useTranslation();
  const open = tickets.filter((ticket) => ticket.status === 'open');
  return (
    <Section title={t('desk.view.notStarted')}>
      {open.length === 0 ? (
        <Empty />
      ) : (
        <ul className="mt-3 grid gap-2">
          {open.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              machines={machines}
              detail={machineLabel(ticket, machines)}
              time={elapsedLabel(ticket.reportedAt)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

interface Props {
  state: UseQueryResult<State>;
  config?: Config;
  machines: Machine[];
}

/** The Team tab: live sections from `/state`, windows from `/tickets`. */
export function TeamPanel({ state, config, machines }: Props) {
  const { t } = useTranslation();
  const live = state.data?.open ?? [];
  if (state.isLoading && !state.data)
    return <p className="mt-6 text-neutral-500">{t('common.loading')}</p>;
  if (state.error) {
    return (
      <p role="alert" className="mt-6 rounded-xl bg-stopped/10 p-3 text-stopped">
        {errorMessage(state.error)}
      </p>
    );
  }
  return (
    <div className="mt-6 space-y-6">
      <WorkingNow tickets={live} config={config} machines={machines} />
      <Waiting tickets={live} config={config} machines={machines} />
      <NotStarted tickets={live} machines={machines} />
      <RecentCancelled machines={machines} />
      <ClosedTotals machines={machines} config={config} />
    </div>
  );
}
