import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandAction, CommandBody, Config, Ticket } from '../api.js';
import { ActionBar } from './ActionBar.js';
import {
  buildReportBody,
  ContextSection,
  initialReportValues,
  FillReport,
  type ReportValues,
} from './reportFields.js';
import { ClassificationSection, DetailsSection, PeopleSection } from './ReportSections.js';

const secondaryButton =
  'min-h-13 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100';
const primaryButton =
  'min-h-13 flex-1 rounded-xl bg-accent px-4 text-base font-semibold text-white hover:bg-accent/90 disabled:opacity-50';

function ReportButtons({
  mode,
  pending,
  onDone,
}: {
  mode: 'close' | 'late';
  pending: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onDone} className={secondaryButton}>
        {t('common.back')}
      </button>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending
          ? t('common.saving')
          : mode === 'late'
            ? t('report.fileReport')
            : t('report.closeWithReport')}
      </button>
    </div>
  );
}

interface FormProps {
  ticket: Ticket;
  config: Config;
  personId: string;
  mode: 'close' | 'late';
  pending: boolean;
  error: string | null;
  command: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  onDone: () => void;
}

function ReportForm({
  ticket,
  config,
  personId,
  mode,
  pending,
  error,
  command,
  onDone,
}: FormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ReportValues>(() => initialReportValues(ticket, config));

  function update(patch: Partial<ReportValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const report = buildReportBody(values);
    const action: CommandAction = mode === 'late' ? 'report' : 'close';
    const body: CommandBody =
      mode === 'late' ? { personId, report } : { personId, kind: 'report', report };
    if (await command(action, body)) onDone();
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">
        {mode === 'late' ? t('report.fill') : t('report.closeWith')}
      </h2>
      <form
        onSubmit={submit}
        aria-label={mode === 'late' ? t('report.fill') : t('report.closeWith')}
        className="mt-4 space-y-6"
      >
        <DetailsSection values={values} update={update} />
        <PeopleSection values={values} update={update} config={config} />
        <ClassificationSection values={values} update={update} config={config} />
        <ContextSection values={values} update={update} config={config} />
        {error && (
          <p role="alert" className="rounded-xl bg-stopped/10 p-4 text-stopped">
            {error}
          </p>
        )}
        <ReportButtons mode={mode} pending={pending} onDone={onDone} />
      </form>
    </section>
  );
}

interface PanelProps {
  ticket: Ticket;
  config: Config;
  personId: string;
  crew: string[];
  canEdit: boolean;
  command: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  pending: boolean;
  error: string | null;
}

/**
 * The report is a close path: choosing "With report" in the close form opens the form instead of
 * posting the close, then the form posts close-with-report (or `/report` for a late report).
 */
export function ReportPanel({
  ticket,
  config,
  personId,
  crew,
  canEdit,
  command,
  pending,
  error,
}: PanelProps) {
  const [mode, setMode] = useState<'close' | 'late' | null>(null);

  async function handleAction(action: CommandAction, body: CommandBody): Promise<boolean> {
    if (action === 'close' && 'kind' in body && body.kind === 'report') {
      setMode('close');
      return true;
    }
    return command(action, body);
  }

  if (mode) {
    return (
      <ReportForm
        ticket={ticket}
        config={config}
        personId={personId}
        mode={mode}
        pending={pending}
        error={error}
        command={command}
        onDone={() => setMode(null)}
      />
    );
  }

  const canFileLate =
    canEdit &&
    ticket.status === 'closed' &&
    ticket.closeKind === 'no_report' &&
    ticket.kind !== 'general';

  function openLate() {
    setMode('late');
  }

  return (
    <>
      {canFileLate && <FillReport onOpen={openLate} />}
      {canEdit && (
        <ActionBar
          ticket={ticket}
          config={config}
          personId={personId}
          crew={crew}
          error={error}
          pending={pending}
          onRun={handleAction}
        />
      )}
    </>
  );
}
