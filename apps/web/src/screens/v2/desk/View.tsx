/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through the model's words */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CommandAction, Ticket } from '../../../api.js';
import { Icon, type IconName } from '../../../ui/v2/icons.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import { StatusPill } from '../../../ui/v2/status-pill.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import type { ChipFilter } from '../../desk/openLists.js';
import type {
  CardBlock,
  CountTile,
  OpenCard,
  OpenModel,
  ReportCard,
  Segment,
  TaskCard,
} from './model.js';
import { ListCard, PlainRow, TicketRow } from './parts.js';

export type OpenViewProps = {
  model: OpenModel;
  /** A quick button is disabled while a command sends. */
  pending: boolean;
  onFilter: (filter: ChipFilter) => void;
  onSegment: (segment: Segment) => void;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
  /** The production sign-off card, drawn under the counts; the Page passes it. */
  signoff?: ReactNode;
};

const TILE_ICON: Record<CountTile['id'], IconName> = {
  down: 'stop',
  waiting: 'pause',
  support: 'wrench',
  running: 'check',
};
const TILE_TONE: Record<CountTile['tone'], string> = {
  danger: 'loss',
  hold: 'decide',
  warning: 'risk',
  ok: 'gain',
};

/** The four counts (Down, Waiting, Support, Running OK) as kit tiles; each filters the lists, a second press shows all. */
function CountTiles({ model, onFilter }: Pick<OpenViewProps, 'model' | 'onFilter'>) {
  return (
    <div role="group" aria-label={model.words.chips} className="v2-desk-counts">
      {model.counts.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.pressed}
          className="v2-card v2-desk-count"
          data-tone={TILE_TONE[c.tone]}
          onClick={() => onFilter(c.pressed ? '' : c.id)}
        >
          <Icon name={TILE_ICON[c.id]} size={16} />
          <span className="v2-kpi-value">{c.value}</span>
          <span className="v2-sub">{c.label}</span>
        </button>
      ))}
    </div>
  );
}

const takeaway = (line: TakeawayData | null | undefined) =>
  line ? <Takeaway data={line} /> : null;

/** The rows of a list, or its empty sentence. */
function Rows<C>({ block, row }: { block: CardBlock<C>; row: (c: C) => ReactNode }) {
  if (block.cards.length === 0) return <p className="v2-sub">{block.empty}</p>;
  return <ul className="v2-desk-rows">{block.cards.map(row)}</ul>;
}

function OpenRow({
  c,
  model,
  pending,
  onQuick,
}: { c: OpenCard } & Pick<OpenViewProps, 'model' | 'pending' | 'onQuick'>) {
  return (
    <TicketRow
      key={c.ticket.id}
      ticket={c.ticket}
      now={model.now}
      machine={c.machine}
      names={model.names}
      quick={c.quick}
      pending={pending}
      onQuick={onQuick}
      longest={c.longest ? model.words.longest : undefined}
    />
  );
}

function TaskRow({ c }: { c: TaskCard }) {
  return (
    <PlainRow
      key={c.ticket.id}
      id={c.ticket.id}
      title={c.machine}
      lines={[c.ticket.ref, c.ticket.problem, c.meta]}
      time={c.line}
      status={<StatusPill group="task" id={c.state} />}
    />
  );
}

function ReportRow({ c, fill }: { c: ReportCard; fill: string }) {
  return (
    <PlainRow
      key={c.ticket.id}
      id={c.ticket.id}
      title={c.machine}
      lines={[c.ticket.ref, c.ticket.problem, c.meta]}
      status={<StatusPill group="report" id="needs_report" />}
      action={
        <Link to={`/desk/${c.ticket.id}`} className="v2-btn v2-btn-ghost">
          {fill}
        </Link>
      }
    />
  );
}

/** The chosen segment's list under its takeaway; Breakdowns also carries the paused "Waiting" list. */
function ChosenList(props: OpenViewProps) {
  const { model } = props;
  const row = (c: OpenCard) => <OpenRow key={c.ticket.id} c={c} {...props} />;
  const title = model.segments.find((s) => s.pressed)?.label ?? '';
  if (model.segment === 'tasks')
    return (
      <ListCard title={title} sub={model.tasks.hint}>
        {takeaway(model.takeaways['desk.tasks'])}
        <div data-testid="tasks-tab">
          <Rows block={model.tasks} row={(c) => <TaskRow key={c.ticket.id} c={c} />} />
        </div>
      </ListCard>
    );
  if (model.segment === 'work')
    return (
      <ListCard title={title} sub={model.work.hint}>
        <Rows block={model.work} row={row} />
      </ListCard>
    );
  const { paused } = model.breakdowns;
  return (
    <>
      <ListCard title={title} sub={model.breakdowns.hint}>
        {takeaway(model.takeaways['desk.breakdowns'])}
        <Rows block={model.breakdowns} row={row} />
      </ListCard>
      {paused ? (
        <section aria-label={model.words.waiting} className="v2-card v2-pad v2-stack">
          <h2 className="v2-h2">{paused.heading}</h2>
          <ul className="v2-desk-rows">{paused.cards.map(row)}</ul>
        </section>
      ) : null}
    </>
  );
}

function NeedsReport({ model }: Pick<OpenViewProps, 'model'>) {
  const block = model.needsReport;
  if (!block) return null;
  return (
    <section aria-label={model.words.needsReport} className="v2-card v2-pad v2-stack">
      <h2 className="v2-h2">{block.heading}</h2>
      <p className="v2-sub">{block.hint}</p>
      <ul className="v2-desk-rows">
        {block.cards.map((c) => (
          <ReportRow key={c.ticket.id} c={c} fill={model.words.fillReport} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The Open tab (S28): the counts with their filter line, production sign-off, Team now, the Breakdowns / Tasks /
 * Work segments with the chosen list (rows with one quick button each), Waiting, and Closed without a report.
 */
export function OpenView(props: OpenViewProps): ReactNode {
  const { model, onSegment, signoff } = props;
  return (
    <>
      <CountTiles model={model} onFilter={props.onFilter} />
      {model.showing ? (
        <p role="status" className="v2-lede">
          {model.showing}
        </p>
      ) : null}
      {signoff}
      <Link to="/desk/team" className="v2-card v2-desk-team">
        <Icon name="people" size={18} />
        <span className="v2-desk-main">{model.teamNow}</span>
        <Icon name="chevronRight" size={16} />
      </Link>
      <Segmented
        label={model.words.segments}
        options={model.segments.map((s) => ({ key: s.id, label: s.label }))}
        value={model.segment}
        onChange={onSegment}
      />
      <ChosenList {...props} />
      <NeedsReport model={model} />
    </>
  );
}
