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
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import type { ChipFilter } from '../../desk/openLists.js';
import { ListHeading, rowClass } from './Frame.js';
import type {
  CardBlock,
  CountTile,
  OpenCard,
  OpenModel,
  ReportCard,
  Segment,
  TaskCard,
} from './model.js';

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
        <p className="v2-sub">{block.hint}</p>
        <p className="v2-sub">{block.empty}</p>
      </>
    );
  return (
    <div data-testid={testId} className="flex flex-col gap-2">
      <p className="v2-sub">{block.hint}</p>
      <ul className="flex flex-col gap-3">{block.cards.map(card)}</ul>
    </div>
  );
}

/** A breakdown or work card; "Longest" sits after the card, so the card link's first 12 characters stay v1's. */
function OpenCardItem({
  c,
  model,
  pending,
  onQuick,
}: { c: OpenCard } & Pick<OpenViewProps, 'model' | 'pending' | 'onQuick'>) {
  return (
    <li>
      <TicketCard
        ticket={c.ticket}
        now={model.now}
        machineCode={c.machine}
        names={model.names}
        quick={c.quick}
        pending={pending}
        onQuick={onQuick}
      />
      {c.longest ? <KeyPill text={model.words.longest} tone="loss" /> : null}
    </li>
  );
}

function TaskItem({ c }: { c: TaskCard }) {
  return (
    <li>
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
  );
}

function ReportItem({ c, fill }: { c: ReportCard; fill: string }) {
  return (
    <li>
      <Card
        to={`/desk/${c.ticket.id}`}
        title={c.machine}
        refLabel={c.ticket.ref}
        status={<StatusPill group="report" id="needs_report" />}
        problem={c.ticket.problem}
        meta={c.meta}
      >
        <Link to={`/desk/${c.ticket.id}`} className="v2-btn v2-btn-ghost">
          {fill}
        </Link>
      </Card>
    </li>
  );
}

const takeaway = (line: TakeawayData | null | undefined) =>
  line ? <Takeaway data={line} /> : null;

/** The chosen list under its takeaway; Breakdowns also carries the paused "Waiting" section. */
function ChosenList(props: OpenViewProps) {
  const { model } = props;
  const item = (c: OpenCard) => <OpenCardItem key={c.ticket.id} c={c} {...props} />;
  if (model.segment === 'tasks')
    return (
      <>
        {takeaway(model.takeaways['desk.tasks'])}
        <Hinted
          block={model.tasks}
          testId="tasks-tab"
          emptyState
          card={(c) => <TaskItem key={c.ticket.id} c={c} />}
        />
      </>
    );
  if (model.segment === 'work') return <Hinted block={model.work} card={item} />;
  const { paused } = model.breakdowns;
  return (
    <>
      {takeaway(model.takeaways['desk.breakdowns'])}
      <Hinted block={model.breakdowns} card={item} />
      {paused ? (
        <section aria-label={model.words.waiting} className="flex flex-col gap-2">
          <ListHeading>{paused.heading}</ListHeading>
          <ul className="flex flex-col gap-3">{paused.cards.map(item)}</ul>
        </section>
      ) : null}
    </>
  );
}

function NeedsReport({ model }: Pick<OpenViewProps, 'model'>) {
  const block = model.needsReport;
  if (!block) return null;
  return (
    <section aria-label={model.words.needsReport} className="flex flex-col gap-2">
      <ListHeading>{block.heading}</ListHeading>
      <p className="v2-sub">{block.hint}</p>
      <ul className="flex flex-col gap-3">
        {block.cards.map((c) => (
          <ReportItem key={c.ticket.id} c={c} fill={model.words.fillReport} />
        ))}
      </ul>
    </section>
  );
}

/** The counts strip, filter line, sign-off feed, Team now link and segment bar. */
function Controls({ model, onFilter, onSegment, signoff }: OpenViewProps) {
  return (
    <>
      <CountsStrip
        label={model.words.chips}
        selected={model.counts.find((c) => c.pressed)?.id ?? ''}
        onSelect={(id) => onFilter(id as ChipFilter)}
        items={model.counts.map((c) => ({ ...c, icon: TILE_ICON[c.id] }))}
      />
      {model.showing ? (
        <p role="status" className="v2-lede">
          {model.showing}
        </p>
      ) : null}
      {signoff}
      <Link to="/desk/team" className={rowClass}>
        <Users aria-hidden size={20} />
        <span className="flex-1">{model.teamNow}</span>
        <ChevronRight aria-hidden size={20} />
      </Link>
      <SegmentedBar
        label={model.words.segments}
        selected={model.segment}
        onSelect={(id) => onSegment(id as Segment)}
        items={model.segments}
      />
    </>
  );
}

/** The Open screen's body, in v1's control order (the gallery's desk-order lock, OPEN). */
export function OpenView(props: OpenViewProps): ReactNode {
  const { model, pane } = props;
  const list = (
    <>
      <Controls {...props} />
      <ChosenList {...props} />
      <NeedsReport model={model} />
    </>
  );
  if (pane === undefined) return list;
  return (
    <div className="grid grid-cols-[minmax(0,28.75rem)_minmax(0,1fr)] items-start gap-4">
      <div className="flex flex-col gap-4">{list}</div>
      <section
        aria-label={model.words.ticketPane}
        className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl bg-surface shadow-card"
      >
        {pane ?? <p className="v2-sub">{model.words.pickTicket}</p>}
      </section>
    </div>
  );
}
