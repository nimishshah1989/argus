import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CommandAction, Ticket } from '../../../api.js';
import { TicketCard } from '../../../components/TicketCard.js';
import { Banner } from '../../../ui/banner.js';
import { LoadingState } from '../../../ui/elements/states.js';
import { ListHeading, rowClass } from './Frame.js';
import type { MineCard, MineModel, TicketRowItem } from './team-model.js';

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <ListHeading>{title}</ListHeading>
      {children}
    </section>
  );
}

function CardList({
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
    <ul className="flex flex-col gap-3">
      {cards.map((card) => (
        <li key={card.ticket.id}>
          <TicketCard
            ticket={card.ticket}
            now={model.now}
            machineCode={card.machine}
            names={model.names}
            quick={card.quick}
            pending={pending}
            onQuick={onQuick}
          />
        </li>
      ))}
    </ul>
  );
}

function ClosedRow({ row }: { row: TicketRowItem }) {
  return (
    <li>
      <Link to={`/desk/${row.id}`} className={rowClass}>
        <span className="min-w-0">
          <span className="v2-h3 block">{row.ref}</span>
          <span className="v2-sub block truncate">{row.machine}</span>
          <span className="v2-sub block truncate">{row.detail}</span>
        </span>
        <span className="v2-sub shrink-0 text-right">{row.time}</span>
      </Link>
    </li>
  );
}

/**
 * `/desk/mine` under the frame's title: regions In progress and Waiting (ticket cards with their quick button),
 * Closed last 30 days (rows), and the "Day report" link last, in v1's control order. No h1.
 */
export function MineView({
  model,
  pending,
  onQuick,
  onDayReport,
  dayReportFailed,
}: MineViewProps): ReactNode {
  const { t } = useTranslation();
  const { words } = model;
  if (model.state === 'loading') return <LoadingState label={t('common.loading')} tiles={1} />;
  if (model.state === 'error') return <Banner tone="error" title={model.error ?? ''} />;
  return (
    <>
      {model.empty && <p className="v2-sub">{model.empty}</p>}
      <Section title={words.inProgress}>
        <CardList cards={model.inProgress} model={model} pending={pending} onQuick={onQuick} />
      </Section>
      <Section title={words.waiting}>
        <CardList cards={model.waiting} model={model} pending={pending} onQuick={onQuick} />
      </Section>
      <Section title={words.closed}>
        {model.closed.length === 0 ? (
          <p className="v2-sub">{words.none}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {model.closed.map((row) => (
              <ClosedRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </Section>
      <section aria-label={words.dayReport}>
        <a
          href={model.dayReport.href}
          download
          onClick={(event) => {
            event.preventDefault();
            onDayReport();
          }}
          className={`${rowClass} v2-h3`}
        >
          {words.dayReport}
        </a>
        {dayReportFailed && <Banner tone="error" title={words.dayReportError} />}
      </section>
    </>
  );
}
