/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through the model's words */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CommandAction, Ticket } from '../../../api.js';
import { TicketCard } from '../../../components/TicketCard.js';
import { CountsStrip } from '../../../ui/counts-strip.js';
import { EmptyState } from '../../../ui/elements/states.js';
import {
  AlarmClock,
  ChevronRight,
  CircleCheck,
  Clock,
  Hourglass,
  LifeBuoy,
  OctagonX,
  Users,
  type IconComponent,
} from '../../../ui/icon.js';
import { SegmentedBar } from '../../../ui/segmented-bar.js';
import { StatusPill } from '../../../ui/status/status-pill.js';
import { TicketCard as Card } from '../../../ui/ticket-card.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import type { ChipFilter } from '../../desk/openLists.js';
import { ListHeading, rowClass } from '../../desk/parts.js';
import type { CardBlock, CountTile, OpenCard, OpenModel, Segment } from './model.js';

export type OpenViewProps = {
  model: OpenModel;
  /** A quick button is disabled while a command sends. */
  pending: boolean;
  onFilter: (filter: ChipFilter) => void;
  onSegment: (segment: Segment) => void;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
  /** The sign-off feed (`components/SignoffFeed.tsx`), drawn under the counts; the Page passes it. */
  signoff?: ReactNode;
  /**
   * Wide (>= 1024 px) only: the right-hand region "Ticket". `undefined` on a phone (no pane); `null` when no ticket
   * is chosen (the "Pick a ticket" line); otherwise the embedded ticket.
   */
  pane?: ReactNode | null;
};

const TILE_ICON: Record<CountTile['id'], IconComponent> = {
  down: OctagonX,
  waiting: Hourglass,
  support: LifeBuoy,
  running: CircleCheck,
};

/** Hint, then the cards or the empty sentence. */
function Hinted<C>({
  block,
  card,
  testId,
  emptyState,
}: {
  block: CardBlock<C>;
  card: (c: C) => ReactNode;
  testId?: string;
  emptyState?: boolean;
}) {
  if (block.cards.length === 0)
    return emptyState ? (
      <EmptyState title={block.empty} />
    ) : (
      <>
        <p className="text-footnote text-neutral-600">{block.hint}</p>
        <p className="text-body text-neutral-600">{block.empty}</p>
      </>
    );
  return (
    <div data-testid={testId} className="flex flex-col gap-2">
      <p className="text-footnote text-neutral-600">{block.hint}</p>
      <ul className="flex flex-col gap-3">{block.cards.map(card)}</ul>
    </div>
  );
}

/** The Open screen's body, in v1's control order (`e2e/gallery/desk-order.spec.ts` OPEN). */
export function OpenView({
  model,
  pending,
  onFilter,
  onSegment,
  onQuick,
  signoff,
  pane,
}: OpenViewProps): ReactNode {
  const { words, takeaways } = model;
  const { now, names } = model;
  const openCard = (c: OpenCard) => (
    <li key={c.ticket.id}>
      <TicketCard
        ticket={c.ticket}
        now={now}
        machineCode={c.machine}
        names={names}
        quick={c.quick}
        pending={pending}
        onQuick={onQuick}
      />
      {c.longest ? <KeyPill text={words.longest} tone="loss" /> : null}
    </li>
  );
  const takeaway = (id: 'desk.breakdowns' | 'desk.tasks') => {
    const line = takeaways[id];
    return line ? <Takeaway data={line} /> : null;
  };
  const lists: Record<Segment, ReactNode> = {
    breakdowns: (
      <>
        {takeaway('desk.breakdowns')}
        <Hinted block={model.breakdowns} card={openCard} />
        {model.breakdowns.paused ? (
          <section aria-label={words.waiting} className="flex flex-col gap-2">
            <ListHeading>{model.breakdowns.paused.heading}</ListHeading>
            <ul className="flex flex-col gap-3">{model.breakdowns.paused.cards.map(openCard)}</ul>
          </section>
        ) : null}
      </>
    ),
    tasks: (
      <>
        {takeaway('desk.tasks')}
        <Hinted
          block={model.tasks}
          testId="tasks-tab"
          emptyState
          card={(c) => (
            <li key={c.ticket.id}>
              <Card
                to={`/desk/${c.ticket.id}`}
                title={c.machine}
                refLabel={c.ticket.ref}
                status={<StatusPill group="task" id={c.state} />}
                kind={{
                  text: c.line,
                  tone: c.overdue ? 'danger' : 'info',
                  icon: c.overdue ? AlarmClock : Clock,
                }}
                problem={c.ticket.problem}
                meta={c.meta}
              />
            </li>
          )}
        />
      </>
    ),
    work: <Hinted block={model.work} card={openCard} />,
  };
  const list = (
    <>
      <CountsStrip
        label={words.chips}
        selected={model.counts.find((c) => c.pressed)?.id ?? ''}
        onSelect={(id) => onFilter(id as ChipFilter)}
        items={model.counts.map((c) => ({ ...c, icon: TILE_ICON[c.id] }))}
      />
      {model.showing ? (
        <p role="status" className="text-footnote font-semibold text-neutral-900">
          {model.showing}
        </p>
      ) : null}
      {signoff}
      <Link to="/desk/team" className={`${rowClass} text-body`}>
        <Users aria-hidden size={20} />
        <span className="flex-1">{model.teamNow}</span>
        <ChevronRight aria-hidden size={20} className="text-neutral-600" />
      </Link>
      <SegmentedBar
        label={words.segments}
        selected={model.segment}
        onSelect={(id) => onSegment(id as Segment)}
        items={model.segments}
      />
      {lists[model.segment]}
      {model.needsReport ? (
        <section aria-label={words.needsReport} className="flex flex-col gap-2">
          <ListHeading>{model.needsReport.heading}</ListHeading>
          <p className="text-footnote text-neutral-600">{model.needsReport.hint}</p>
          <ul className="flex flex-col gap-3">
            {model.needsReport.cards.map((c) => (
              <li key={c.ticket.id}>
                <Card
                  to={`/desk/${c.ticket.id}`}
                  title={c.machine}
                  refLabel={c.ticket.ref}
                  status={<StatusPill group="report" id="needs_report" />}
                  problem={c.ticket.problem}
                  meta={c.meta}
                >
                  <Link
                    to={`/desk/${c.ticket.id}`}
                    className="flex min-h-target items-center justify-center rounded-xl bg-accent-tint px-4 text-body font-semibold text-accent-text"
                  >
                    {words.fillReport}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
  if (pane === undefined) return list;
  return (
    <div className="grid grid-cols-[minmax(0,28.75rem)_minmax(0,1fr)] items-start gap-4">
      <div className="flex flex-col gap-4">{list}</div>
      <section
        aria-label={words.ticketPane}
        className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl bg-surface shadow-card"
      >
        {pane ?? <p className="p-6 text-body text-neutral-600">{words.pickTicket}</p>}
      </section>
    </div>
  );
}
