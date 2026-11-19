/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
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
import { Banner } from '../../ui/banner.js';
import { Card } from '../../ui/card.js';
import { LoadingState } from '../../ui/elements/states.js';
import { ClosedTotals, RecentCancelled } from './ClosedSection.js';
import { Empty, Section, TicketRow } from './parts.js';
import { workingByPerson } from './views.js';

/** A row inside a card: no second shadow, a tint instead. */
const innerRow =
  'flex min-h-target items-center justify-between gap-3 rounded-xl bg-neutral-100 px-4 py-3';

const time = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/** The Team tab's Waiting list: paused tickets, the ones waiting longest first (server sends newest first). */
export function waitingFirst(tickets: Ticket[]): Ticket[] {
  return tickets
    .filter((ticket) => ticket.status === 'waiting')
    .sort((a, b) => time(a.waitSince) - time(b.waitSince));
}

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
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.personId}>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-body font-bold">
                    {people[group.personId] ?? t('common.teamMember')}
                  </p>
                  <p className="rounded-full bg-info-tint px-2.5 py-1 text-caption font-bold text-info-ink">
                    {formatMinutes(group.minutes)}
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {group.tickets.map((ticket) => (
                    <li key={ticket.id}>
                      <Link to={`/desk/${ticket.id}`} className={innerRow}>
                        <span className="text-body font-semibold">{ticket.ref}</span>
                        <span className="text-footnote text-neutral-600">
                          {machineLabel(ticket, machines)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Waiting({ tickets, config, machines }: WorkingProps) {
  const { t } = useTranslation();
  const waiting = waitingFirst(tickets);
  return (
    <Section title={t('status.waiting')}>
      {waiting.length === 0 ? (
        <Empty />
      ) : (
        <ul className="flex flex-col gap-2">
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
        <ul className="flex flex-col gap-2">
          {open.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              machines={machines}
              detail={ticket.problem}
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
  if (state.isLoading && !state.data) return <LoadingState label={t('common.loading')} tiles={1} />;
  if (state.error) {
    return <Banner tone="error" title={errorMessage(state.error)} />;
  }
  return (
    <>
      <WorkingNow tickets={live} config={config} machines={machines} />
      <Waiting tickets={live} config={config} machines={machines} />
      <NotStarted tickets={live} machines={machines} />
      <RecentCancelled machines={machines} />
      <ClosedTotals machines={machines} config={config} />
    </>
  );
}
