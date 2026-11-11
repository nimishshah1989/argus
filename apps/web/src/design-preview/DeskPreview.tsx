/* eslint-disable i18next/no-literal-string -- Disposable English-only design review. */
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  ListTree,
  MoreHorizontal,
  Pause,
  Play,
  UserRound,
  Users,
} from 'lucide-react';
import { Button, Card, StatusPair } from './components.js';
import { previewPersonName, previewTickets, type PreviewTicket, type PreviewWork } from './data.js';

interface TicketCardProps {
  ticket: PreviewTicket;
  selected: boolean;
  onOpen: () => void;
}

function TicketCard({ ticket, selected, onOpen }: TicketCardProps) {
  return (
    <button aria-pressed={selected} className="preview-ticket-card" onClick={onOpen} type="button">
      <span className="preview-ticket-card__top">
        <strong>{ticket.ref}</strong>
        <span>{ticket.machineCode}</span>
        <ChevronRight aria-hidden="true" size={19} strokeWidth={1.8} />
      </span>
      <span className="preview-ticket-card__problem">{ticket.problem}</span>
      <StatusPair condition={ticket.condition} work={ticket.work} />
      <span className="preview-ticket-card__meta">
        <Clock3 aria-hidden="true" size={16} /> Reported {ticket.reportedAt}
      </span>
    </button>
  );
}

function TicketTimeline({ ticket }: { ticket: PreviewTicket }) {
  return (
    <section aria-labelledby="preview-timeline-heading">
      <h3 id="preview-timeline-heading">
        <ListTree aria-hidden="true" size={18} /> Timeline
      </h3>
      <ol className="preview-timeline">
        {ticket.timeline.map((item) => (
          <li key={item.id}>
            <time>{item.time}</time>
            <p>{item.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TicketInsights({ ticket }: { ticket: PreviewTicket }) {
  return (
    <details className="preview-disclosure preview-ticket-insights">
      <summary>
        <ListTree aria-hidden="true" size={19} />
        Timeline, people &amp; figures
        <ChevronDown aria-hidden="true" size={18} />
      </summary>
      <div className="preview-disclosure-body preview-insight-grid">
        <TicketTimeline ticket={ticket} />
        <section aria-labelledby="preview-people-heading">
          <h3 id="preview-people-heading">
            <Users aria-hidden="true" size={18} /> People
          </h3>
          <ul className="preview-people-list">
            <li>
              <UserRound aria-hidden="true" size={18} />
              <span>
                <strong>{previewPersonName(ticket.lead)}</strong>Lead
              </span>
            </li>
            <li>
              <UserRound aria-hidden="true" size={18} />
              <span>
                <strong>{previewPersonName(ticket.support)}</strong>Support
              </span>
            </li>
          </ul>
        </section>
        <section aria-labelledby="preview-figures-heading">
          <h3 id="preview-figures-heading">
            <BarChart3 aria-hidden="true" size={18} /> Figures
          </h3>
          <dl className="preview-figures">
            <div>
              <dt>Downtime</dt>
              <dd>{ticket.downtimeMinutes} min</dd>
            </div>
            <div>
              <dt>Active work</dt>
              <dd>{ticket.activeMinutes} min</dd>
            </div>
            <div>
              <dt>Updates</dt>
              <dd>{ticket.timeline.length}</dd>
            </div>
          </dl>
        </section>
      </div>
    </details>
  );
}

interface WorkingTicketProps {
  ticket: PreviewTicket;
  onWork: (work: PreviewWork) => void;
  onBack: () => void;
}

function WorkingTicket({ ticket, onWork, onBack }: WorkingTicketProps) {
  return (
    <Card className="preview-working-ticket">
      <Button className="preview-back" icon={ArrowLeft} onClick={onBack} variant="quiet">
        Back to open
      </Button>
      <div className="preview-working-ticket__header">
        <div>
          <p className="preview-ticket-ref">{ticket.ref}</p>
          <h2>{ticket.machineCode}</h2>
          <p>{ticket.problem}</p>
        </div>
        <StatusPair condition={ticket.condition} work={ticket.work} />
      </div>
      <p className="preview-report-meta">
        Reported {ticket.reportedAt} by {previewPersonName(ticket.reportedBy)}
      </p>
      {ticket.work === 'Not started' ? (
        <Button
          className="preview-primary-action"
          icon={Play}
          onClick={() => onWork('In progress')}
          variant="primary"
        >
          Start
        </Button>
      ) : null}
      {ticket.work === 'Waiting' ? (
        <Button
          className="preview-primary-action"
          icon={Play}
          onClick={() => onWork('In progress')}
          variant="primary"
        >
          Resume
        </Button>
      ) : null}
      <details className="preview-disclosure preview-more-actions">
        <summary>
          <MoreHorizontal aria-hidden="true" size={20} />
          More actions
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <div className="preview-disclosure-body preview-secondary-actions">
          <Button icon={Pause} onClick={() => onWork('Waiting')}>
            Pause
          </Button>
          <Button icon={ArrowLeftRight} onClick={() => onWork('Not started')}>
            Transfer
          </Button>
        </div>
      </details>
      <TicketInsights ticket={ticket} />
    </Card>
  );
}

export function DeskPreview() {
  const [tickets, setTickets] = useState(previewTickets);
  const [selectedRef, setSelectedRef] = useState<string>();
  const selected = tickets.find((ticket) => ticket.ref === selectedRef);

  function updateWork(work: PreviewWork) {
    setTickets((current) =>
      current.map((ticket) => (ticket.ref === selectedRef ? { ...ticket, work } : ticket)),
    );
  }

  return (
    <div className={`preview-desk ${selected ? 'preview-desk--selected' : ''}`}>
      <section className="preview-open-list" aria-labelledby="preview-open-heading">
        <div className="preview-section-heading">
          <div>
            <p className="preview-eyebrow">WORK QUEUE</p>
            <h2 id="preview-open-heading">Open</h2>
          </div>
          <span className="preview-count">{tickets.length}</span>
        </div>
        <p className="preview-section-intro">
          Choose a ticket to see the work, not just the alarm.
        </p>
        <div className="preview-ticket-list">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.ref}
              onOpen={() => setSelectedRef(ticket.ref)}
              selected={selectedRef === ticket.ref}
              ticket={ticket}
            />
          ))}
        </div>
      </section>
      <section className="preview-ticket-detail" aria-label="Working ticket">
        {selected ? (
          <WorkingTicket
            ticket={selected}
            onWork={updateWork}
            onBack={() => setSelectedRef(undefined)}
          />
        ) : (
          <Card className="preview-empty-detail">
            <ClipboardList aria-hidden="true" size={32} strokeWidth={1.5} />
            <h2>Select a ticket</h2>
            <p>Open a synthetic ticket to preview its actions and details.</p>
          </Card>
        )}
      </section>
    </div>
  );
}
