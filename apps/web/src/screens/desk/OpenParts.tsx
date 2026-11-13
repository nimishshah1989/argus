import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandAction, Machine, Person, Ticket } from '../../api.js';
import type { ActorContext } from '@uptimo/domain';
import { quickSpec } from '../../components/actionSpecs.js';
import { formatMinutes, machineLabel } from '../../components/format.js';
import { TicketCard } from '../../components/TicketCard.js';
import type { Chip, ChipFilter, OpenCounts } from './openLists.js';
import { teamNow } from './openLists.js';

const EXPANDED_MARK = '▾';
const COLLAPSED_MARK = '▸';

const CHIPS: Array<{ id: Chip | 'running'; tone: string }> = [
  { id: 'down', tone: 'text-stopped' },
  { id: 'waiting', tone: 'text-waiting' },
  { id: 'support', tone: 'text-in-progress' },
  { id: 'running', tone: 'text-running' },
];

/** The four status chips; a tap filters the lists, a second tap clears it (v3 `chipsHtml`). */
export function StatusChips({
  counts,
  filter,
  onFilter,
}: {
  counts: OpenCounts;
  filter: ChipFilter;
  onFilter: (next: ChipFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('deskLists.chips')} className="mt-4 grid grid-cols-4 gap-2">
      {CHIPS.map(({ id, tone }) => (
        <button
          key={id}
          type="button"
          aria-pressed={filter === id}
          onClick={() => onFilter(filter === id ? '' : id)}
          className={`min-h-13 rounded-xl bg-white p-2 text-center shadow-sm ${
            filter === id ? 'ring-2 ring-accent' : ''
          }`}
        >
          <span className={`block text-2xl font-semibold tracking-tight ${tone}`}>
            {counts[id]}
          </span>
          <span className="block text-xs text-neutral-600">{t(`deskLists.chip.${id}`)}</span>
        </button>
      ))}
    </div>
  );
}

/** "Team now": who is on a job, collapsed to one line until tapped (v3 `teamStripHtml`). */
export function TeamStrip({ open, people }: { open: Ticket[]; people: Person[] | undefined }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  const rows = teamNow(open, people);
  const count = new Set(rows.map((row) => row.person.id)).size;
  const label =
    count === 0
      ? t('deskLists.teamNow.none')
      : t(count === 1 ? 'deskLists.teamNow.one' : 'deskLists.teamNow.many', { count });
  return (
    <section aria-label={t('desk.teamNow')} className="mt-3 rounded-xl bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setShown((value) => !value)}
        className="flex min-h-13 w-full items-center justify-between gap-3 px-4 text-left font-medium"
      >
        <span>{label}</span>
        <span aria-hidden="true">{shown ? EXPANDED_MARK : COLLAPSED_MARK}</span>
      </button>
      {shown && rows.length > 0 && (
        <ul className="grid gap-2 px-4 pb-3">
          {rows.map((row) => (
            <li key={row.ticket.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <b>{row.person.name}</b>
              <span className="rounded bg-neutral-200 px-1.5 text-xs">
                {t('deskLists.role.lead')}
              </span>
              <span className="text-neutral-600">{row.ticket.ref}</span>
              <span className="ml-auto text-neutral-500">
                {row.paused ? t('deskLists.paused') : formatMinutes(row.minutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type OpenTab = 'bd' | 'tasks' | 'work';

/** Breakdowns, Tasks and Work with their counts, in v3's order. */
export function Segments({
  tab,
  counts,
  onChange,
}: {
  tab: OpenTab;
  counts: Record<OpenTab, number>;
  onChange: (next: OpenTab) => void;
}) {
  const { t } = useTranslation();
  const tabs: Array<{ id: OpenTab; key: string }> = [
    { id: 'bd', key: 'deskLists.tab.breakdowns' },
    { id: 'tasks', key: 'deskLists.tab.tasks' },
    { id: 'work', key: 'deskLists.tab.work' },
  ];
  return (
    <div
      role="group"
      aria-label={t('deskLists.segments')}
      className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-neutral-200 p-1"
    >
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tab === item.id}
          onClick={() => onChange(item.id)}
          className={`min-h-13 rounded-lg px-2 text-sm font-semibold ${
            tab === item.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
          }`}
        >
          {t(item.key, { count: counts[item.id] })}
        </button>
      ))}
    </div>
  );
}

export interface TicketCardsProps {
  tickets: Ticket[];
  /** Shown above the cards, with the empty text below when there are none. */
  hint?: string;
  empty: string;
  machines: Machine[];
  people: Person[] | undefined;
  now: string;
  timeZone?: string;
  actor: ActorContext | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

export function TicketCards({ tickets, hint, empty, ...rest }: TicketCardsProps) {
  const who = (ticket: Ticket) =>
    rest.people?.find((person) => person.id === ticket.reportedByPersonId)?.name ?? null;
  if (tickets.length === 0) return <p className="mt-3 text-center font-semibold">{empty}</p>;
  return (
    <>
      {hint && <p className="mt-3 text-sm text-neutral-600">{hint}</p>}
      <ul className="mt-3 grid gap-3">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            now={rest.now}
            machineCode={machineLabel(ticket, rest.machines)}
            quick={rest.actor ? quickSpec(ticket, rest.actor) : null}
            pending={rest.pending}
            onQuick={rest.onQuick}
            desk={{ reportedBy: who(ticket), timeZone: rest.timeZone }}
          />
        ))}
      </ul>
    </>
  );
}
