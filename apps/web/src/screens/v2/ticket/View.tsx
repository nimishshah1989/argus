import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CommandAction, CommandBody, Config, Me, TicketDetail } from '../../../api.js';
import { actorFrom, crewFrom } from '../../../components/actionSpecs.js';
import { AdminPanel } from '../../../components/AdminPanel.js';
import { peopleNames } from '../../../components/format.js';
import { LockoutCard } from '../../../components/LockoutCard.js';
import { LockoutChip } from '../../../components/LockoutChip.js';
import { LockoutGate } from '../../../components/LockoutGate.js';
import { PmReportCard } from '../../../components/PmReport.js';
import { ReportControls } from '../../../components/ReportControls.js';
import { SignoffPanel } from '../../../components/SignoffPanel.js';
import { SlaTimerSummary } from '../../../components/SlaTimerSummary.js';
import { TaskPanel } from '../../../components/TaskPanel.js';
import { HistoryList, PersonRows } from '../../../ui/detail-kit.js';
import { ChevronLeft } from '../../../ui/icon.js';
import { Inline, Stack } from '../../../ui/layout.js';
import type { StatusRef } from '../../../ui/meaning.js';
import { StatusPill } from '../../../ui/status/status-pill.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { hasReportContext, lockoutFor, type TicketFact, type TicketModel } from './model.js';

export type TicketViewProps = {
  model: TicketModel;
  /** The reply, config and login the re-hosted v1 parts take (TaskPanel, SignoffPanel, SlaTimerSummary, LockoutGate/Card, PmReport, AdminPanel, ReportControls). */
  detail: TicketDetail;
  config?: Config;
  me?: Me;
  run: (ticketId: string, action: CommandAction, body: CommandBody) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  /** Opens the full-screen close flow: Write report and close ('close') or Fill report ('late'). */
  onFlow: (mode: 'close' | 'late') => void;
};

const Pill = StatusPill as (props: StatusRef) => ReactNode;

const takeaway = (data: TakeawayData | null) => (data ? <Takeaway data={data} /> : null);

/** One `dt` and exactly one `dd` per fact; a note prints after the `dd`, never as a second one. */
function Facts({ rows }: { rows: TicketFact[] }) {
  return (
    <dl className="v2-facts">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="v2-sub">{row.label}</dt>
          <dd className="v2-fact-value">{row.value}</dd>
          {row.note ? <span className="v2-sub">{row.note}</span> : null}
        </div>
      ))}
    </dl>
  );
}

function Header({ model, lockout }: { model: TicketModel; lockout: boolean }) {
  return (
    <header>
      <Stack gap={2}>
        <h1 className="v2-title">
          {model.title}
          {model.ref ? <span className="v2-sub"> {model.ref}</span> : null}
        </h1>
        <Inline gap={2}>
          {model.chips.map((chip) => (
            <Pill
              key={`${chip.group}.${chip.id}`}
              {...({ group: chip.group, id: chip.id } as StatusRef)}
            />
          ))}
          {lockout ? <LockoutChip /> : null}
        </Inline>
        {model.machineLine ? <p className="v2-sub">{model.machineLine}</p> : null}
        <p>{model.problem}</p>
      </Stack>
    </header>
  );
}

function Minutes({ model }: { model: TicketModel }) {
  const { minutes } = model;
  if (!minutes) return null;
  return (
    <Panel title={minutes.heading}>
      {takeaway(model.takeaways['ticket.minutes'])}
      <dl className="v2-facts">
        {minutes.figures.map((figure) => (
          <div key={figure.id}>
            <dt className="v2-sub">{figure.label}</dt>
            <dd className="v2-fact-value">{figure.value}</dd>
            {figure.hint ? <span className="v2-sub">{figure.hint}</span> : null}
            <span className="v2-yardstick">{figure.yardstick}</span>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function People({ model }: { model: TicketModel }) {
  const { people } = model;
  return (
    <Panel title={people.heading}>
      {takeaway(model.takeaways['ticket.people'])}
      {people.rows.length === 0 ? <p className="v2-sub">{people.empty}</p> : null}
      {people.rows.length > 0 ? <PersonRows rows={people.rows} /> : null}
    </Panel>
  );
}

function History({ model }: { model: TicketModel }) {
  const { history } = model;
  const items = history.rows.map(({ link, ...row }) => ({
    ...row,
    action: link ? (
      <Link to={link.to} className="v2-btn v2-btn-ghost">
        {link.label}
      </Link>
    ) : undefined,
  }));
  return (
    <Panel title={history.heading}>
      {items.length === 0 ? (
        <p className="v2-sub">{history.empty}</p>
      ) : (
        <HistoryList items={items} />
      )}
    </Panel>
  );
}

/** The report form and the action bar (v1's `Controls`). */
function Controls({
  detail,
  config,
  me,
  run,
  pending,
  error,
  onFlow,
}: Omit<TicketViewProps, 'model'>) {
  const { ticket, people } = detail;
  const actor = me ? actorFrom(me) : null;
  if (!hasReportContext(config, me) || actor === null) return null;
  return (
    <ReportControls
      ticket={ticket}
      config={config!}
      personId={me!.actingPersonId!}
      actor={actor}
      crew={crewFrom(people)}
      command={(action, body) => run(ticket.id, action, body)}
      pending={pending}
      error={error}
      onFlow={onFlow}
    />
  );
}

function ReportCard({ props, names }: { props: TicketViewProps; names: Record<string, string> }) {
  const { model, detail } = props;
  if (model.report)
    return (
      <Panel title={model.report.heading}>
        <Facts rows={model.report.rows} />
      </Panel>
    );
  return detail.report?.pmReport ? (
    <PmReportCard report={detail.report.pmReport} names={names} />
  ) : null;
}

/** The ticket in v1's control order (gallery/desk-order.spec.ts); takeaways are plain text lines, never headings, links or buttons. */
export function TicketView(props: TicketViewProps): ReactNode {
  const { model, detail, config, me } = props;
  const { ticket } = detail;
  const names = peopleNames(config?.people);
  return (
    <LockoutGate key={ticket.id} ticketId={ticket.id} {...lockoutFor(detail, me)}>
      <Stack gap={6}>
        <Link to={model.back.to} className="v2-btn v2-btn-ghost">
          <ChevronLeft aria-hidden size={20} />
          {model.back.label}
        </Link>
        <Header model={model} lockout={Boolean(ticket.lockout)} />
        <TaskPanel detail={detail} config={config} />
        <SignoffPanel ticket={ticket} config={config} />
        <SlaTimerSummary ticket={ticket} detailed config={config} />
        {model.acknowledgedBy ? <p className="v2-sub">{model.acknowledgedBy}</p> : null}
        <div className="v2-card v2-pad">
          <Facts rows={model.facts} />
        </div>
        <LockoutCard names={names} timeZone={config?.timeZone} />
        <ReportCard props={props} names={names} />
        <a
          href={model.share.href}
          target="_blank"
          rel="noopener noreferrer"
          className="v2-btn v2-btn-ghost"
        >
          {model.share.label}
        </a>
        <Minutes model={model} />
        <People model={model} />
        <History model={model} />
        <AdminPanel ticket={ticket} config={config} me={me} />
        <Controls {...props} />
      </Stack>
    </LockoutGate>
  );
}
