import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CommandAction, CommandBody, Config, Me, TicketDetail } from '../../../api.js';
import { actorFrom, crewFrom } from '../../../components/actionSpecs.js';
import { peopleNames } from '../../../components/format.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Row } from '../../../ui/v2/row.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { ReportControls } from './actions/ReportControls.js';
import { LockoutGate } from './LockoutGate.js';
import { hasReportContext, lockoutFor, type TicketModel } from './model.js';
import { AdminCard } from './parts/AdminCard.js';
import { DownloadPdfButton } from './parts/DownloadPdf.js';
import { Facts } from './parts/Facts.js';
import { LockoutCard } from './parts/LockoutCard.js';
import { PmReportCard } from './parts/PmReportCard.js';
import { PILL_TONE, LockoutTag, StatusTag } from './parts/StatusTag.js';
import { SignoffCard, signoffWaiting } from './parts/SignoffCard.js';
import { TaskCard } from './parts/TaskCard.js';
import { SlaTimers } from './SlaTimers.js';

export type TicketViewProps = {
  model: TicketModel;
  /** The reply, config and login the action parts take (tasks, sign-off, clocks, lockout, PM report, admin, actions). */
  detail: TicketDetail;
  config?: Config;
  me?: Me;
  run: (ticketId: string, action: CommandAction, body: CommandBody) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  /** Opens the full-screen close flow: Write report and close ('close') or Fill report ('late'). */
  onFlow: (mode: 'close' | 'late') => void;
};

/**
 * The verdict block: the takeaway as the lede, the chips, the machine line and problem, and who acknowledged. A
 * `header` element: the e2e specs read the status words inside the last header on the page. The title and ref sit in
 * the Shell's header, not here.
 */
function Head({ model, lockout }: { model: TicketModel; lockout: boolean }) {
  const lede = model.takeaways['ticket.minutes'];
  return (
    <header className="v2-stack v2-ticket-gap-sm">
      {lede ? <Takeaway data={lede} /> : null}
      <div className="v2-ticket-chips">
        {model.chips.map((chip) => (
          <StatusTag key={`${chip.group}.${chip.id}`} status={chip} />
        ))}
        {lockout ? <LockoutTag /> : null}
      </div>
      {model.machineLine ? <p className="v2-sub">{model.machineLine}</p> : null}
      <p className="v2-lede">{model.problem}</p>
      {model.acknowledgedBy ? <p className="v2-sub">{model.acknowledgedBy}</p> : null}
    </header>
  );
}

/** The report form and the action bar, then Share on WhatsApp and Download PDF (outside the Actions region). */
function Actions(props: TicketViewProps) {
  const { model, detail, config, me, run, pending, error, onFlow } = props;
  const { ticket, people } = detail;
  const actor = me ? actorFrom(me) : null;
  return (
    <div className="v2-stack v2-ticket-gap-sm">
      {hasReportContext(config, me) && actor !== null ? (
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
      ) : null}
      <div className="v2-ticket-buttons">
        <a
          href={model.share.href}
          target="_blank"
          rel="noopener noreferrer"
          className="v2-btn v2-btn-ghost"
        >
          {model.share.label}
        </a>
        {detail.report ? <DownloadPdfButton ticket={ticket} /> : null}
      </div>
    </div>
  );
}

/** Downtime, hands-on and waiting: each value alone in its `dd`, the hint and yardstick outside it. */
function Minutes({ model }: { model: TicketModel }) {
  const { minutes } = model;
  if (!minutes) return null;
  return (
    <Panel title={minutes.heading}>
      <dl className="v2-facts">
        {minutes.figures.map((figure) => (
          <div key={figure.id}>
            <dt className="v2-sub">{figure.label}</dt>
            <dd className="v2-fact-value v2-num">{figure.value}</dd>
            {figure.hint ? <span className="v2-sub">{figure.hint}</span> : null}
            <span className="v2-yardstick">{figure.yardstick}</span>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Lead first, then the crew: role, joined, minutes and left; the person with the most time is marked. */
function People({ model }: { model: TicketModel }) {
  const { t } = useTranslation();
  const { people } = model;
  const takeaway = model.takeaways['ticket.people'];
  return (
    <Panel title={people.heading}>
      {takeaway ? <Takeaway data={takeaway} /> : null}
      {people.rows.length === 0 ? (
        <p className="v2-sub">{people.empty}</p>
      ) : (
        <div className="v2-ticket-scroll">
          <table className="v2-table">
            <thead>
              <tr>
                <th scope="col">{t('detail.col.person')}</th>
                <th scope="col">{t('detail.col.role')}</th>
                <th scope="col">{t('detail.col.joined')}</th>
                <th scope="col" className="v2-num-head">
                  {t('detail.col.minutes')}
                </th>
                <th scope="col">{t('detail.col.left')}</th>
              </tr>
            </thead>
            <tbody>
              {people.rows.map((row) => (
                <tr key={row.key} data-worst={row.key === takeaway?.outlier || undefined}>
                  <td>{row.name}</td>
                  <td>{row.role}</td>
                  <td className="v2-num">{row.joined ?? '—'}</td>
                  <td className="v2-num-cell">{row.value}</td>
                  <td className="v2-num">{row.left ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** Every event oldest first, a dot in its tone; "Set the ladder" under an escalation nobody was told about. */
function History({ model }: { model: TicketModel }) {
  const { history } = model;
  return (
    <Panel title={history.heading}>
      {history.rows.length === 0 ? (
        <p className="v2-sub">{history.empty}</p>
      ) : (
        <ol className="v2-ticket-history">
          {history.rows.map((row) => (
            <li key={row.key} data-tone={PILL_TONE[row.tone]}>
              <span className="v2-h3">{row.title}</span>
              <span className="v2-sub">
                <time dateTime={row.at}>{row.when}</time>
                {row.detail ? ` · ${row.detail}` : null}
              </span>
              {row.link ? (
                <Link to={row.link.to} className="v2-btn v2-btn-ghost">
                  {row.link.label}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/** The breakdown report's rows, or the PM job's report. */
function Report({
  model,
  detail,
  names,
}: Pick<TicketViewProps, 'model' | 'detail'> & { names: Record<string, string> }) {
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

/**
 * S29 Ticket body on the v2 kit (wireframe S29-ticket.html): the verdict, the action bar, the clocks and figures, then
 * two columns (facts, people, lockout | history, sign-off, report, follow-up task, admin); one column on a phone in the
 * same order. While production's OK is awaited, the sign-off card goes first. Takeaways are text lines, never headings.
 */
export function TicketView(props: TicketViewProps): ReactNode {
  const { t } = useTranslation();
  const { model, detail, config, me } = props;
  const { ticket } = detail;
  const names = peopleNames(config?.people);
  const signoffFirst = signoffWaiting(ticket);
  return (
    <LockoutGate key={ticket.id} ticketId={ticket.id} {...lockoutFor(detail, me)}>
      <div className="v2-stack v2-ticket">
        {signoffFirst ? <SignoffCard ticket={ticket} config={config} /> : null}
        <Head model={model} lockout={Boolean(ticket.lockout)} />
        <Actions {...props} />
        <Row>
          <SlaTimers ticket={ticket} detailed config={config} />
          <Minutes model={model} />
        </Row>
        <div className="v2-grid v2-grid-2 v2-ticket-columns">
          <div className="v2-stack v2-ticket">
            <Panel title={t('ticket.facts')}>
              <Facts rows={model.facts} />
            </Panel>
            <People model={model} />
            <LockoutCard names={names} timeZone={config?.timeZone} />
          </div>
          <div className="v2-stack v2-ticket">
            <History model={model} />
            {signoffFirst ? null : <SignoffCard ticket={ticket} config={config} />}
            <Report model={model} detail={detail} names={names} />
            <TaskCard detail={detail} config={config} />
            <AdminCard ticket={ticket} config={config} me={me} />
          </div>
        </div>
      </div>
    </LockoutGate>
  );
}
