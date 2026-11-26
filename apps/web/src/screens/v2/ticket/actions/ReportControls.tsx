/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import { useTranslation } from 'react-i18next';
import { canLateReport, type ActionCrewMember, type ActorContext } from '@uptimo/domain';
import type { CommandAction, CommandBody, Config, Ticket } from '../../../../api.js';
import { Button } from '../../../../ui/v2/button.js';
import { ActionBar } from './ActionBar.js';

interface Props {
  ticket: Ticket;
  config: Config;
  personId: string;
  actor: ActorContext;
  crew: ActionCrewMember[];
  command: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  /** Opens the close flow's full screens: the report close, or the late report. */
  onFlow: (mode: 'close' | 'late') => void;
}

/** A ticket closed without its report waits for one; a technician or above can file it (SPEC 1.6). */
function needsLateReport(ticket: Ticket, actor: ActorContext): boolean {
  return (
    canLateReport(actor) &&
    ticket.status === 'closed' &&
    ticket.closeKind === 'no_report' &&
    ticket.kind !== 'general'
  );
}

/** The late-report prompt and the action bar. */
export function ReportControls({
  ticket,
  config,
  personId,
  actor,
  crew,
  command,
  pending,
  error,
  onFlow,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      {needsLateReport(ticket, actor) && (
        <section className="v2-card v2-pad">
          <h3 className="v2-h3">{t('closes.reportTitle')}</h3>
          <p className="v2-sub">{t('closes.late.note')}</p>
          <Button primary onClick={() => onFlow('late')}>
            {t('report.fillButton')}
          </Button>
        </section>
      )}
      <ActionBar
        ticket={ticket}
        config={config}
        personId={personId}
        actor={actor}
        crew={crew}
        error={error}
        pending={pending}
        onRun={command}
        onWriteReport={() => onFlow('close')}
      />
    </>
  );
}
