import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import type { CommandAction, Machine, Person, State, Ticket } from '../../api.js';
import type { ActorContext } from '@uptimo/domain';
import { quickSpec } from '../../components/actionSpecs.js';
import { errorMessage, machineLabel } from '../../components/format.js';
import { NeedReportList } from '../../components/NeedReportList.js';
import { TicketCard } from '../../components/TicketCard.js';

export type Tab = 'open' | 'mine' | 'team';

export function Tabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useTranslation();
  const tabs: { id: Tab; label: string }[] = [
    { id: 'open', label: t('desk.tab.open') },
    { id: 'mine', label: t('desk.tab.mine') },
    { id: 'team', label: t('desk.tab.team') },
  ];
  return (
    <div
      role="group"
      aria-label={t('desk.ticketLists')}
      className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-neutral-200 p-1"
    >
      {tabs.map((item) => {
        const selected = item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.id)}
            className={`min-h-13 rounded-lg px-3 text-base font-semibold ${
              selected
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:bg-white/60'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Counts({ open }: { open: Ticket[] }) {
  const { t } = useTranslation();
  const counts = [
    { label: t('desk.count.open'), value: open.length },
    {
      label: t('desk.count.stopped'),
      value: open.filter((ticket) => ticket.kind === 'stopped').length,
    },
    {
      label: t('desk.count.support'),
      value: open.filter((ticket) => ticket.kind === 'support').length,
    },
    {
      label: t('desk.count.general'),
      value: open.filter((ticket) => ticket.kind === 'general').length,
    },
  ];
  return (
    <dl className="mt-4 grid grid-cols-4 gap-2">
      {counts.map((item) => (
        <div key={item.label} className="rounded-xl bg-white p-3 shadow-sm">
          <dt className="text-xs text-neutral-500">{item.label}</dt>
          <dd className="mt-0.5 text-2xl font-semibold tracking-tight">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TeamNow({ open, people }: { open: Ticket[]; people: Person[] | undefined }) {
  const { t } = useTranslation();
  const leads = new Map<string, string>();
  for (const ticket of open) {
    if (ticket.status !== 'working' || !ticket.leadPersonId) continue;
    const name = people?.find((person) => person.id === ticket.leadPersonId)?.name;
    if (name) leads.set(ticket.leadPersonId, name);
  }
  return (
    <section aria-label={t('desk.teamNow')} className="mt-6">
      <h2 className="text-sm font-medium text-neutral-600">{t('desk.teamNow')}</h2>
      {leads.size === 0 ? (
        <p className="mt-2 text-neutral-500">
          {people ? t('desk.teamNowEmpty') : t('common.loading')}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {[...leads].map(([id, name]) => (
            <li key={id} className="rounded-full bg-white px-3 py-2 text-sm font-medium shadow-sm">
              {name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ListProps {
  title: string;
  empty: string;
  tickets: Ticket[];
  machines: Machine[];
  now: string;
  actor: ActorContext | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

function TicketList({ title, empty, tickets, machines, now, actor, pending, onQuick }: ListProps) {
  return (
    <section>
      <h2 className="text-sm font-medium text-neutral-600">
        {title} <span className="text-neutral-400">({tickets.length})</span>
      </h2>
      {tickets.length === 0 ? (
        <p className="mt-2 text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              now={now}
              machineCode={machineLabel(ticket, machines)}
              quick={actor ? quickSpec(ticket, actor) : null}
              pending={pending}
              onQuick={onQuick}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface BoardProps {
  state: UseQueryResult<State>;
  people: Person[] | undefined;
  machines: Machine[];
  actor: ActorContext | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

export function Board({ state, people, machines, actor, pending, onQuick }: BoardProps) {
  const { t } = useTranslation();
  const open = state.data?.open ?? [];
  if (state.isLoading && !state.data)
    return <p className="mt-6 text-neutral-500">{t('common.loading')}</p>;
  if (state.error) {
    return (
      <p role="alert" className="mt-6 rounded-xl bg-stopped/10 p-3 text-stopped">
        {errorMessage(state.error)}
      </p>
    );
  }
  const groups = [
    {
      kind: 'stopped' as const,
      title: t('desk.group.breakdowns'),
      empty: t('desk.empty.breakdowns'),
    },
    { kind: 'general' as const, title: t('desk.group.tasks'), empty: t('desk.empty.tasks') },
    { kind: 'support' as const, title: t('desk.group.work'), empty: t('desk.empty.work') },
  ];
  return (
    <>
      <Counts open={open} />
      <TeamNow open={open} people={people} />
      <NeedReportList tickets={state.data?.needReport ?? []} machines={machines} />
      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <TicketList
            key={group.kind}
            title={group.title}
            empty={group.empty}
            tickets={open.filter((ticket) => ticket.kind === group.kind)}
            machines={machines}
            now={state.data?.now ?? new Date().toISOString()}
            actor={actor}
            pending={pending}
            onQuick={onQuick}
          />
        ))}
      </div>
    </>
  );
}
