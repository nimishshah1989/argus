import { useState, type FormEvent } from 'react';
import type { CommandAction, CommandBody, Config, Ticket } from '../api.js';
import { ActionBar } from './ActionBar.js';
import {
  activePeople,
  buildReportBody,
  ContextSection,
  Field,
  initialReportValues,
  listOptions,
  FillReport,
  PeoplePicker,
  type ReportValues,
  type ReportValuesProps,
  Section,
  SelectField,
  togglePerson,
} from './reportFields.js';

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
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onDone} className={secondaryButton}>
        Back
      </button>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? 'Saving…' : mode === 'late' ? 'File report' : 'Close with report'}
      </button>
    </div>
  );
}

function DetailsSection({ values, update }: ReportValuesProps) {
  return (
    <Section title="What happened">
      <Field
        id="report-problem"
        label="Problem"
        value={values.problem}
        onChange={(problem) => update({ problem })}
        multiline
      />
      <Field
        id="report-observed"
        label="Observed by"
        value={values.observedBy}
        onChange={(observedBy) => update({ observedBy })}
        placeholder="Name or role"
      />
      <Field
        id="report-corrective"
        label="Corrective action"
        value={values.correctiveAction}
        onChange={(correctiveAction) => update({ correctiveAction })}
        multiline
      />
      <Field
        id="report-downtime"
        label="Downtime (min)"
        value={values.downtimeMin}
        onChange={(downtimeMin) => update({ downtimeMin })}
        type="number"
      />
      <Field
        id="report-response"
        label="Response (min)"
        value={values.responseMin}
        onChange={(responseMin) => update({ responseMin })}
        type="number"
      />
      <Field
        id="report-repair"
        label="Repair (min)"
        value={values.repairMin}
        onChange={(repairMin) => update({ repairMin })}
        type="number"
      />
    </Section>
  );
}

function PeopleSection({ values, update, config }: ReportValuesProps & { config: Config }) {
  const people = activePeople(config.people);
  return (
    <Section title="Who did the work">
      <PeoplePicker
        legend="Done by"
        people={people}
        selected={values.doneByPersonIds}
        onToggle={(personId) =>
          update({ doneByPersonIds: togglePerson(values.doneByPersonIds, personId) })
        }
      />
      <PeoplePicker
        legend="Supported by"
        people={people}
        selected={values.supportedByPersonIds}
        onToggle={(personId) =>
          update({ supportedByPersonIds: togglePerson(values.supportedByPersonIds, personId) })
        }
      />
    </Section>
  );
}

function ClassificationSection({ values, update, config }: ReportValuesProps & { config: Config }) {
  return (
    <Section title="Classification">
      <SelectField
        id="report-category"
        label="Breakdown category"
        value={values.breakdownCategory}
        options={listOptions(config, 'breakdown_category')}
        onChange={(breakdownCategory) => update({ breakdownCategory })}
      />
      <SelectField
        id="report-maint"
        label="Maintenance code"
        value={values.maintCode}
        options={listOptions(config, 'maint_code')}
        onChange={(maintCode) => update({ maintCode })}
      />
      <Field
        id="report-spare"
        label="Spare used"
        value={values.spareUsed}
        onChange={(spareUsed) => update({ spareUsed })}
      />
      <Field
        id="report-root"
        label="Root cause"
        value={values.rootCause}
        onChange={(rootCause) => update({ rootCause })}
        multiline
      />
      <Field
        id="report-handover"
        label="Handover to"
        value={values.handoverName}
        onChange={(handoverName) => update({ handoverName })}
      />
    </Section>
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
        {mode === 'late' ? 'Fill breakdown report' : 'Close with breakdown report'}
      </h2>
      <form
        onSubmit={submit}
        aria-label={mode === 'late' ? 'Fill breakdown report' : 'Close with breakdown report'}
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

  return (
    <>
      {canFileLate && <FillReport onOpen={() => setMode('late')} />}
      {canEdit && (
        <ActionBar
          ticket={ticket}
          config={config}
          personId={personId}
          error={error}
          pending={pending}
          onRun={handleAction}
        />
      )}
    </>
  );
}
