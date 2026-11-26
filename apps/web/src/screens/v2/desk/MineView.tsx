import type { ReactNode } from 'react';
import type { CommandAction, Ticket } from '../../../api.js';
import { Notice } from '../../../ui/v2/notice.js';
import { Skeleton } from '../../../ui/v2/screen-states.js';
import { ListCard, PlainRow, TicketRow } from './parts.js';
import type { MineCard, MineModel } from './team-model.js';

export type MineViewProps = {
  model: MineModel;
  /** A quick command is sending: the quick buttons are disabled. */
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
  /** The "Day report" link was pressed (the Page downloads it with the sign-in token). */
  onDayReport: () => void;
  /** The last download failed: "Could not download the day report." under the link. */
  dayReportFailed: boolean;
};

function Cards({
  cards,
  model,
  pending,
  onQuick,
}: {
  cards: MineCard[];
  model: MineModel;
  pending: boolean;
  onQuick: MineViewProps['onQuick'];
}) {
  if (cards.length === 0) return <p className="v2-sub">{model.words.none}</p>;
  return (
    <ul className="v2-desk-rows">
      {cards.map((card) => (
        <TicketRow
          key={card.ticket.id}
          ticket={card.ticket}
          now={model.now}
          machine={card.machine}
          names={model.names}
          quick={card.quick}
          pending={pending}
          onQuick={onQuick}
        />
      ))}
    </ul>
  );
}

/**
 * The Mine tab (S28): In progress and Waiting (rows with their quick button), Closed last 30 days, and the Day
 * report, in v1's order. The Shell's header carries the title.
 */
export function MineView({
  model,
  pending,
  onQuick,
  onDayReport,
  dayReportFailed,
}: MineViewProps): ReactNode {
  const { words } = model;
  if (model.state === 'loading') return <Skeleton />;
  if (model.state === 'error') return <Notice tone="error" title={model.error ?? ''} />;
  return (
    <>
      {model.empty && <p className="v2-lede">{model.empty}</p>}
      <ListCard title={words.inProgress}>
        <Cards cards={model.inProgress} model={model} pending={pending} onQuick={onQuick} />
      </ListCard>
      <ListCard title={words.waiting}>
        <Cards cards={model.waiting} model={model} pending={pending} onQuick={onQuick} />
      </ListCard>
      <ListCard title={words.closed}>
        {model.closed.length === 0 ? (
          <p className="v2-sub">{words.none}</p>
        ) : (
          <ul className="v2-desk-rows">
            {model.closed.map((row) => (
              <PlainRow
                key={row.id}
                id={row.id}
                title={row.ref}
                lines={[row.machine, row.detail]}
                time={row.time}
              />
            ))}
          </ul>
        )}
      </ListCard>
      <section aria-label={words.dayReport} className="v2-stack">
        <a
          href={model.dayReport.href}
          download
          onClick={(event) => {
            event.preventDefault();
            onDayReport();
          }}
          className="v2-btn v2-btn-ghost"
        >
          {words.dayReport}
        </a>
        {dayReportFailed && <Notice tone="error" title={words.dayReportError} />}
      </section>
    </>
  );
}
