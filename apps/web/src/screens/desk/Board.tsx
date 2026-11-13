import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import type { CommandAction, Machine, Person, State, Ticket } from '../../api.js';
import type { ActorContext } from '@uptimo/domain';
import { errorMessage } from '../../components/format.js';
import { NeedReportList } from '../../components/NeedReportList.js';
import {
  Segments,
  StatusChips,
  TeamStrip,
  TicketCards,
  type OpenTab,
  type TicketCardsProps,
} from './OpenParts.js';
import {
  breakdownCount,
  notStarted,
  openCounts,
  pausedBreakdowns,
  pendingTasks,
  workRequests,
  type ChipFilter,
} from './openLists.js';

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

interface BoardProps {
  state: UseQueryResult<State>;
  people: Person[] | undefined;
  machines: Machine[];
  timeZone?: string;
  actor: ActorContext | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

type Shared = Omit<TicketCardsProps, 'tickets' | 'hint' | 'empty'>;

const FILTER_KEY = {
  down: 'deskLists.filter.down',
  waiting: 'deskLists.filter.waiting',
  support: 'deskLists.filter.support',
} as const;

interface ViewProps {
  open: Ticket[];
  needReport: Ticket[];
  filter: ChipFilter;
  shared: Shared;
}

/** Breakdowns: not started (stopped first, longest wait first), then paused, then closed without a report. */
function Breakdowns({ open, needReport, filter, shared }: ViewProps) {
  const { t } = useTranslation();
  const paused = pausedBreakdowns(open, filter);
  return (
    <>
      <TicketCards
        {...shared}
        tickets={notStarted(open, filter)}
        hint={t('deskLists.hint.start')}
        empty={t(filter ? 'deskLists.empty.filtered' : 'deskLists.empty.start')}
      />
      {paused.length > 0 && (
        <section aria-label={t('deskLists.pausedSection', { count: paused.length })}>
          <h2 className="mt-6 text-sm font-medium text-neutral-600">
            {t('deskLists.pausedSection', { count: paused.length })}
          </h2>
          <TicketCards {...shared} tickets={paused} hint={t('deskLists.hint.paused')} empty="" />
        </section>
      )}
      {!filter && <NeedReportList tickets={needReport} machines={shared.machines} />}
    </>
  );
}

function OpenTabs({ tab, ...view }: ViewProps & { tab: OpenTab }) {
  const { t } = useTranslation();
  if (tab === 'bd') return <Breakdowns {...view} />;
  const isTasks = tab === 'tasks';
  return (
    <TicketCards
      {...view.shared}
      tickets={isTasks ? pendingTasks(view.open) : workRequests(view.open)}
      hint={t(isTasks ? 'deskLists.hint.tasks' : 'deskLists.hint.work')}
      empty={t(isTasks ? 'deskLists.empty.tasks' : 'deskLists.empty.work')}
    />
  );
}

/** Open, as v3 lays it out: status chips, Team now, then Breakdowns / Tasks / Work (v3.views.01). */
export function Board({ state, people, machines, timeZone, actor, pending, onQuick }: BoardProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<ChipFilter>('');
  const [tab, setTab] = useState<OpenTab>('bd');
  if (state.error) {
    return (
      <p role="alert" className="mt-6 rounded-xl bg-stopped/10 p-3 text-stopped">
        {errorMessage(state.error)}
      </p>
    );
  }
  if (!state.data) return <p className="mt-6 text-neutral-500">{t('common.loading')}</p>;
  const { open, needReport, now } = state.data;
  const shared = { machines, people, now, timeZone, actor, pending, onQuick };
  const narrowed = filter !== '' && filter !== 'running' ? filter : null;
  return (
    <>
      <StatusChips counts={openCounts(open, machines)} filter={filter} onFilter={setFilter} />
      <TeamStrip open={open} people={people} />
      <Segments
        tab={tab}
        counts={{
          bd: breakdownCount(open),
          tasks: pendingTasks(open).length,
          work: workRequests(open).length,
        }}
        onChange={setTab}
      />
      {narrowed && (
        <button
          type="button"
          onClick={() => setFilter('')}
          className="mt-3 min-h-13 text-left font-medium text-accent"
        >
          {t('deskLists.showing', { what: t(FILTER_KEY[narrowed]) })}
        </button>
      )}
      <OpenTabs tab={tab} open={open} needReport={needReport} filter={filter} shared={shared} />
    </>
  );
}
