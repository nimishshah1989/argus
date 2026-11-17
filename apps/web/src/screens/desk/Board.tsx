/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ActorContext } from '@uptimo/domain';
import type { CommandAction, Config, Machine, State, Ticket } from '../../api.js';
import { quickSpec } from '../../components/actionSpecs.js';
import { machineLabel } from '../../components/format.js';
import { SignoffFeed } from '../../components/SignoffFeed.js';
import { TicketCard } from '../../components/TicketCard.js';
import { CountsStrip } from '../../ui/counts-strip.js';
import { ChevronRight, CircleCheck, Hourglass, LifeBuoy, OctagonX, Users } from '../../ui/icon.js';
import { SegmentedBar } from '../../ui/segmented-bar.js';
import { NeedsReport } from './NeedsReport.js';
import {
  breakdownCount,
  notStarted,
  openCounts,
  pausedBreakdowns,
  pendingTasks,
  workRequests,
  type ChipFilter,
} from './openLists.js';
import { ListHeading } from './parts.js';
import { TasksList } from './TasksList.js';

type Segment = 'breakdowns' | 'tasks' | 'work';

export interface CardContext {
  now: string;
  machines: Machine[];
  names: Record<string, string>;
  actor: ActorContext | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

/** Ticket cards under a hint line, or what to say when there are none. */
export function CardList({
  tickets,
  empty,
  ctx,
}: {
  tickets: Ticket[];
  empty: string;
  ctx: CardContext;
}) {
  if (tickets.length === 0) return <p className="text-body text-neutral-600">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <TicketCard
            ticket={ticket}
            now={ctx.now}
            machineCode={machineLabel(ticket, ctx.machines)}
            names={ctx.names}
            quick={ctx.actor ? quickSpec(ticket, ctx.actor) : null}
            pending={ctx.pending}
            onQuick={ctx.onQuick}
          />
        </li>
      ))}
    </ul>
  );
}

function Counts({
  open,
  machines,
  filter,
  onFilter,
}: {
  open: Ticket[];
  machines: Machine[];
  filter: ChipFilter;
  onFilter: (filter: ChipFilter) => void;
}) {
  const { t } = useTranslation();
  const counts = openCounts(open, machines);
  return (
    <CountsStrip
      label={t('deskLists.chips')}
      selected={filter}
      onSelect={(id) => onFilter(id as ChipFilter)}
      items={[
        {
          id: 'down',
          label: t('deskLists.chip.down'),
          value: counts.down,
          tone: 'danger',
          icon: OctagonX,
        },
        {
          id: 'waiting',
          label: t('deskLists.chip.waiting'),
          value: counts.waiting,
          tone: 'hold',
          icon: Hourglass,
        },
        {
          id: 'support',
          label: t('deskLists.chip.support'),
          value: counts.support,
          tone: 'warning',
          icon: LifeBuoy,
        },
        {
          id: 'running',
          label: t('deskLists.chip.running'),
          value: counts.running,
          tone: 'ok',
          icon: CircleCheck,
        },
      ]}
    />
  );
}

function TeamNowLink({ count }: { count: number }) {
  const { t } = useTranslation();
  const key = count === 0 ? 'none' : count === 1 ? 'one' : 'many';
  return (
    <Link
      to="/desk/team"
      className="flex min-h-target items-center gap-3 rounded-2xl border border-neutral-200 bg-surface px-4 text-body"
    >
      <Users aria-hidden size={20} />
      <span className="flex-1">{t(`deskLists.teamNow.${key}`, { count })}</span>
      <ChevronRight aria-hidden size={20} className="text-neutral-600" />
    </Link>
  );
}

function Breakdowns({
  open,
  filter,
  ctx,
}: {
  open: Ticket[];
  filter: ChipFilter;
  ctx: CardContext;
}) {
  const { t } = useTranslation();
  const paused = pausedBreakdowns(open, filter);
  return (
    <>
      <p className="text-footnote text-neutral-600">{t('deskLists.hint.start')}</p>
      <CardList tickets={notStarted(open, filter)} empty={t('deskLists.empty.start')} ctx={ctx} />
      {paused.length > 0 ? (
        <section aria-label={t('deskLists.chip.waiting')} className="flex flex-col gap-2">
          <ListHeading>{t('deskLists.pausedSection', { count: paused.length })}</ListHeading>
          <CardList tickets={paused} empty="" ctx={ctx} />
        </section>
      ) : null}
    </>
  );
}

/** v3's Open screen: counts, who is on a job, then Breakdowns / Tasks / Work and the reports still owed. */
export function OpenLists({
  state,
  ctx,
  config,
}: {
  state: State;
  ctx: CardContext;
  config?: Config;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<ChipFilter>('');
  const [segment, setSegment] = useState<Segment>('breakdowns');
  const open = state.open;
  const tasks = pendingTasks(open);
  const work = workRequests(open);
  const lists: Record<Segment, ReactNode> = {
    breakdowns: <Breakdowns open={open} filter={filter} ctx={ctx} />,
    tasks: <TasksList open={open} config={config} ctx={ctx} />,
    work: (
      <Hinted
        hint={t('deskLists.hint.work')}
        tickets={work}
        empty={t('deskLists.empty.work')}
        ctx={ctx}
      />
    ),
  };
  return (
    <>
      <Counts open={open} machines={ctx.machines} filter={filter} onFilter={setFilter} />
      {filter && filter !== 'running' ? (
        <p role="status" className="text-footnote font-semibold text-neutral-900">
          {t('deskLists.showing', { what: t(`deskLists.filter.${filter}`) })}
        </p>
      ) : null}
      <SignoffFeed now={ctx.now} />
      <TeamNowLink count={teamNowCount(open)} />
      <SegmentedBar
        label={t('deskLists.segments')}
        selected={segment}
        onSelect={(id) => setSegment(id as Segment)}
        items={[
          {
            id: 'breakdowns',
            label: t('deskLists.tab.breakdowns', { count: breakdownCount(open) }),
          },
          { id: 'tasks', label: t('deskLists.tab.tasks', { count: tasks.length }) },
          { id: 'work', label: t('deskLists.tab.work', { count: work.length }) },
        ]}
      />
      {lists[segment]}
      <NeedsReport tickets={state.needReport} ctx={ctx} />
    </>
  );
}

function Hinted({
  hint,
  tickets,
  empty,
  ctx,
}: {
  hint: string;
  tickets: Ticket[];
  empty: string;
  ctx: CardContext;
}) {
  return (
    <>
      <p className="text-footnote text-neutral-600">{hint}</p>
      <CardList tickets={tickets} empty={empty} ctx={ctx} />
    </>
  );
}

/** Leads on a working or paused job, counted once each. */
function teamNowCount(open: Ticket[]): number {
  return new Set(
    open
      .filter((t) => (t.status === 'working' || t.status === 'waiting') && t.leadPersonId)
      .map((t) => t.leadPersonId),
  ).size;
}
