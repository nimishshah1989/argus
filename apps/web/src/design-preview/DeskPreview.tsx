/* eslint-disable i18next/no-literal-string -- Disposable English-only design review. */
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ListTree,
  MoreHorizontal,
  Pause,
  Play,
  Users,
} from 'lucide-react';
import {
  Button,
  Card,
  StatusPair,
  countStyle,
  disclosure,
  disclosureSummary,
  mutedText,
} from './components.js';
import { previewPersonName, previewTickets, type PreviewTicket, type PreviewWork } from './data.js';

const ui = {
  card: 'grid min-h-[52px] w-full min-w-0 gap-3 rounded-[18px] border border-[var(--line)] bg-white p-4 text-left text-[var(--ink)] shadow-sm transition-colors duration-200 hover:border-[#a8a8b0] motion-reduce:transition-none',
  top: 'flex items-center justify-between gap-3',
  heading: 'mb-3 flex items-center gap-2 text-[15px]',
  insights: 'space-y-4 px-3.5 pb-4 pt-1 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0',
  figures: 'm-0 grid grid-cols-3 gap-2',
  figure: 'min-w-0 rounded-xl bg-[var(--neutral)] p-3',
  back: '-ml-3 -mt-2 justify-self-start text-[var(--teal)] lg:hidden',
  action: 'w-full sm:w-auto sm:min-w-[180px]',
  secondary: 'bg-[var(--neutral)] text-sm',
};

interface TicketCardProps {
  ticket: PreviewTicket;
  selected: boolean;
  onOpen: () => void;
}
function TicketCard({ ticket, selected, onOpen }: TicketCardProps) {
  return (
    <button
      aria-pressed={selected}
      className={`${ui.card} ${selected ? 'border-[var(--teal)] ring-1 ring-[var(--teal)]' : ''}`}
      onClick={onOpen}
      type="button"
    >
      <span className={ui.top}>
        <strong>
          {ticket.ref} · {ticket.machineCode}
        </strong>
        <ChevronRight aria-hidden="true" size={19} />
      </span>
      <span className="break-words font-semibold">{ticket.problem}</span>
      <StatusPair condition={ticket.condition} work={ticket.work} />
    </button>
  );
}

function figure(label: string, value: string) {
  return (
    <div className={ui.figure}>
      <dt className={mutedText}>{label}</dt>
      <dd className="m-0 font-bold">{value}</dd>
    </div>
  );
}

function TicketInsights({ ticket }: { ticket: PreviewTicket }) {
  return (
    <details className={disclosure}>
      <summary className={disclosureSummary}>
        <ListTree aria-hidden="true" size={19} />
        Timeline, people &amp; figures
        <ChevronDown aria-hidden="true" size={18} />
      </summary>
      <div className={ui.insights}>
        <section aria-label="Timeline">
          <h3 className={ui.heading}>
            <ListTree aria-hidden="true" size={18} /> Timeline
          </h3>
          <ol className="m-0 grid list-none gap-3.5 p-0 text-sm">
            {ticket.timeline.map((item) => (
              <li key={item.time}>{`${item.time} · ${item.text}`}</li>
            ))}
          </ol>
        </section>
        <section aria-label="People">
          <h3 className={ui.heading}>
            <Users aria-hidden="true" size={18} /> People
          </h3>
          <p className="text-sm">{`Lead · ${previewPersonName(ticket.lead)}`}</p>
          <p className="mt-2 text-sm">{`Support · ${previewPersonName(ticket.support)}`}</p>
        </section>
        <section aria-label="Figures">
          <h3 className={ui.heading}>
            <BarChart3 aria-hidden="true" size={18} /> Figures
          </h3>
          <dl className={ui.figures}>
            {figure('Downtime', `${ticket.downtimeMinutes} min`)}
            {figure('Active work', `${ticket.activeMinutes} min`)}
            {figure('Updates', String(ticket.timeline.length))}
          </dl>
        </section>
      </div>
    </details>
  );
}

interface WorkingProps {
  ticket: PreviewTicket;
  onWork: (work: PreviewWork) => void;
  onBack: () => void;
}
function WorkingTicket({ ticket, onWork, onBack }: WorkingProps) {
  return (
    <Card className="grid gap-4">
      <Button className={ui.back} icon={ArrowLeft} onClick={onBack} variant="quiet">
        Back to open
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h2>
            {ticket.machineCode} · {ticket.ref}
          </h2>
          <p className="text-[var(--muted)]">{ticket.problem}</p>
        </div>
        <StatusPair condition={ticket.condition} work={ticket.work} />
      </div>
      {ticket.work !== 'In progress' ? (
        <Button
          className={ui.action}
          icon={Play}
          onClick={() => onWork('In progress')}
          variant="primary"
        >
          {ticket.work === 'Waiting' ? 'Resume' : 'Start'}
        </Button>
      ) : null}
      <details className={disclosure}>
        <summary className={disclosureSummary}>
          <MoreHorizontal aria-hidden="true" size={20} />
          More actions
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <div className="grid grid-cols-2 gap-3 px-3.5 pb-4 pt-1">
          <Button className={ui.secondary} icon={Pause} onClick={() => onWork('Waiting')}>
            Pause
          </Button>
          <Button
            className={ui.secondary}
            icon={ArrowLeftRight}
            onClick={() => onWork('Not started')}
          >
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
    <div className={`preview-desk min-w-0 ${selected ? 'preview-desk--selected' : ''}`}>
      <section className="min-w-0" aria-labelledby="preview-open-heading">
        <div className="flex items-center justify-between gap-3.5">
          <h2 id="preview-open-heading">Open</h2>
          <span className={countStyle}>{tickets.length}</span>
        </div>
        <div className="mt-5 grid gap-3">
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
      <section className="preview-ticket-detail min-w-0" aria-label="Working ticket">
        {selected ? (
          <WorkingTicket
            ticket={selected}
            onWork={updateWork}
            onBack={() => setSelectedRef(undefined)}
          />
        ) : null}
      </section>
    </div>
  );
}
